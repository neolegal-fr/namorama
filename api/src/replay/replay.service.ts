import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  PayloadTooLargeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { gunzipSync, gzipSync } from 'zlib';
import { AppLoggerService } from '../common/logging/app-logger.service';
import { comptesMesures, jourISO } from '../admin/predicats';
import { ReplayChunkDto } from './dto/replay-chunk.dto';

const MO = 1024 * 1024;
const JOUR_MS = 24 * 60 * 60 * 1000;
/** Au-delà, les caches mémoire repartent de zéro : ils ne servent qu'à éviter un SUM par lot. */
const MAX_CACHE = 5_000;
export const LIGNES_PAR_PAGE = 50;

/** Type rrweb des événements : 4 = Meta (porte l'URL), 6 = Plugin (console). */
const EVENEMENT_META = 4;
const EVENEMENT_PLUGIN = 6;
const PLUGIN_CONSOLE = 'rrweb/console@1';

export type FiltreRejeu = 'cherche_sans_compte' | 'erreur' | 'tarifs_vus' | 'rapport';
export const FILTRES: FiltreRejeu[] = ['cherche_sans_compte', 'erreur', 'tarifs_vus', 'rapport'];

export interface LigneRejeu {
  sessionId: string;
  debut: number;
  dureeMs: number;
  segments: number;
  lots: number;
  octets: number;
  erreur: boolean;
  entree: string | null;
  recuLe: string;
  connecteAuDepart: boolean;
  recherche: boolean;
  compteCree: boolean;
  rapport: boolean;
  tarifsVus: boolean;
  keycloakId: string | null;
}

/** Ce que le navigateur envoie, lu sans faire confiance à sa forme. */
type Evenement = { type?: unknown; timestamp?: unknown; data?: any };

/** Le lot contient-il un message console de niveau `error` ? */
export function contientUneErreur(events: Evenement[]): boolean {
  return events.some(
    e => e?.type === EVENEMENT_PLUGIN && e.data?.plugin === PLUGIN_CONSOLE && e.data?.payload?.level === 'error',
  );
}

/** Chemin de la première page du lot, sans requête ni fragment : ils peuvent porter un jeton. */
export function cheminDEntree(events: Evenement[]): string | null {
  const meta = events.find(e => e?.type === EVENEMENT_META && typeof e.data?.href === 'string');
  if (!meta) return null;
  try {
    return new URL(meta.data.href).pathname.slice(0, 255);
  } catch {
    return null;
  }
}

/** Horodatages extrêmes du lot, en millisecondes. */
export function bornes(events: Evenement[]): { first: number; last: number } {
  const ts = events.map(e => e?.timestamp).filter((t): t is number => typeof t === 'number' && Number.isFinite(t));
  if (!ts.length) return { first: 0, last: 0 };
  return { first: Math.min(...ts), last: Math.max(...ts) };
}

/**
 * Rejeu des sessions : réception bornée, conservation limitée, relecture.
 *
 * `POST /replay` est PUBLIC — la plupart des visiteurs n'ont pas de compte —
 * et aucune route publique n'a de limite de débit. D'où trois plafonds :
 * le corps de la requête (`main.ts`), la visite (`REPLAY_MAX_SESSION_MB`) et
 * le jour (`REPLAY_MAX_DAY_MB`). Au pire, un tiers qui boucle remplit 200 Mo
 * par jour, purgés à 30 jours.
 *
 * Le masquage, lui, est fait par le navigateur AVANT l'envoi : ce service ne
 * reçoit jamais une saisie en clair, et ne regarde pas le contenu des
 * événements au-delà de ce qu'il en résume (bornes, erreur, page d'entrée).
 */
@Injectable()
export class ReplayService implements OnModuleInit, OnModuleDestroy {
  private readonly retentionJours: number;
  private readonly maxSession: number;
  private readonly maxJour: number;

  private readonly visitesConnues = new Set<string>();
  private readonly totauxParVisite = new Map<string, number>();
  private readonly visitesPlafonnees = new Set<string>();
  private jour = '';
  private totalDuJour = 0;
  private jourPlafonne = false;
  private minuterie?: ReturnType<typeof setInterval>;

  constructor(
    private readonly dataSource: DataSource,
    private readonly logger: AppLoggerService,
    config: ConfigService,
  ) {
    this.retentionJours = Number(config.get('REPLAY_RETENTION_DAYS')) || 30;
    this.maxSession = (Number(config.get('REPLAY_MAX_SESSION_MB')) || 5) * MO;
    this.maxJour = (Number(config.get('REPLAY_MAX_DAY_MB')) || 200) * MO;
  }

  async onModuleInit(): Promise<void> {
    await this.rechargerLeJour();
    await this.purger();
    this.minuterie = setInterval(() => void this.purger(), JOUR_MS);
    this.minuterie.unref?.();
  }

  onModuleDestroy(): void {
    if (this.minuterie) clearInterval(this.minuterie);
  }

  /**
   * Reçoit un lot. Lève 404 (visite inconnue), 413 (plafond de visite) ou 429
   * (plafond du jour) ; avale toute erreur d'écriture : un rejeu ne doit
   * jamais faire échouer quoi que ce soit.
   */
  async recevoir(dto: ReplayChunkDto): Promise<void> {
    if (!(await this.visiteConnue(dto.sessionId))) {
      throw new NotFoundException('Visite inconnue');
    }

    const json = JSON.stringify(dto.events);
    const data = gzipSync(json);
    const octets = data.length;

    const dejaRecu = await this.totalDeLaVisite(dto.sessionId);
    if (dejaRecu + octets > this.maxSession) {
      if (!this.visitesPlafonnees.has(dto.sessionId)) {
        this.borner(this.visitesPlafonnees).add(dto.sessionId);
        this.logger.event('replay_capped', { scope: 'session', sessionId: dto.sessionId, bytes: dejaRecu });
      }
      throw new PayloadTooLargeException('Plafond de la visite atteint');
    }

    this.changerDeJourSiBesoin();
    if (this.totalDuJour + octets > this.maxJour) {
      if (!this.jourPlafonne) {
        this.jourPlafonne = true;
        this.logger.event('replay_capped', { scope: 'day', bytes: this.totalDuJour });
      }
      throw new HttpException('Plafond du jour atteint', HttpStatus.TOO_MANY_REQUESTS);
    }

    const { first, last } = bornes(dto.events as Evenement[]);
    try {
      const res: any = await this.dataSource.query(
        `INSERT IGNORE INTO session_replay_chunk
           (sessionId, segment, seq, firstTs, lastTs, eventCount, hasError, href, bytes, data, receivedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          dto.sessionId, dto.segment, dto.seq, first, last, dto.events.length,
          contientUneErreur(dto.events as Evenement[]) ? 1 : 0,
          cheminDEntree(dto.events as Evenement[]), octets, data,
        ],
      );
      // Un lot renvoyé (même segment, même seq) est ignoré : il ne compte pas deux fois.
      const insere = (res?.affectedRows ?? res?.[0]?.affectedRows ?? 0) > 0;
      if (insere) {
        this.borner(this.totauxParVisite).set(dto.sessionId, dejaRecu + octets);
        this.totalDuJour += octets;
      }
    } catch (err) {
      this.logger.error(`Lot de rejeu non enregistré : ${(err as Error).message}`, undefined, ReplayService.name);
    }
  }

  /** Supprime ce qui a dépassé la durée de conservation. Best-effort. */
  async purger(): Promise<number> {
    try {
      const res: any = await this.dataSource.query(
        `DELETE FROM session_replay_chunk WHERE receivedAt < NOW() - INTERVAL ? DAY`,
        [this.retentionJours],
      );
      const n = res?.affectedRows ?? res?.[0]?.affectedRows ?? 0;
      if (n > 0) this.logger.log(`Rejeu : ${n} lot(s) purgé(s) au-delà de ${this.retentionJours} jours`, ReplayService.name);
      this.totauxParVisite.clear();
      return n;
    } catch (err) {
      this.logger.error(`Purge du rejeu impossible : ${(err as Error).message}`, undefined, ReplayService.name);
      return 0;
    }
  }

  /**
   * Les visites enregistrées, des plus récentes aux plus anciennes, avec leurs
   * drapeaux d'entonnoir. Les comptes admin et internes en sont écartés comme
   * de tout le tableau de bord ; une visite sans compte reste, c'est le cas
   * normal d'un visiteur.
   */
  async lister(options: { filtre?: FiltreRejeu; compte?: string; page?: number }): Promise<{ total: number; lignes: LigneRejeu[] }> {
    const conditions = [`(u.keycloakId IS NULL OR (${comptesMesures('u')}))`];
    const params: unknown[] = [];
    if (options.compte) {
      conditions.push('v.keycloakId = ?');
      params.push(options.compte);
    }
    switch (options.filtre) {
      case 'cherche_sans_compte':
        conditions.push('v.searched = 1 AND v.accountCreated = 0 AND v.loggedInAtStart = 0');
        break;
      case 'tarifs_vus':
        conditions.push('v.pricingViewed = 1');
        break;
      case 'rapport':
        conditions.push('v.reportRequested = 1');
        break;
    }
    const avoir = options.filtre === 'erreur' ? 'HAVING MAX(c.hasError) = 1' : '';
    const base = `
      FROM session_replay_chunk c
      JOIN visitor_session v ON v.sessionId = c.sessionId
      LEFT JOIN user u ON u.keycloakId = v.keycloakId
      WHERE ${conditions.join(' AND ')}
      GROUP BY c.sessionId
      ${avoir}`;

    const page = Math.max(0, options.page ?? 0);
    const [compte, lignes] = await Promise.all([
      this.dataSource.query(`SELECT COUNT(*) AS n FROM (SELECT c.sessionId ${base}) t`, params),
      this.dataSource.query(
        `SELECT c.sessionId,
                MIN(c.firstTs) AS debut, MAX(c.lastTs) AS fin,
                COUNT(DISTINCT c.segment) AS segments, COUNT(*) AS lots,
                SUM(c.bytes) AS octets, MAX(c.hasError) AS erreur,
                SUBSTRING_INDEX(GROUP_CONCAT(c.href ORDER BY c.segment, c.seq SEPARATOR '\\n'), '\\n', 1) AS entree,
                MIN(c.receivedAt) AS recuLe,
                MAX(v.loggedInAtStart) AS connecteAuDepart, MAX(v.searched) AS recherche,
                MAX(v.accountCreated) AS compteCree, MAX(v.reportRequested) AS rapport,
                MAX(v.pricingViewed) AS tarifsVus, MAX(v.keycloakId) AS keycloakId
         ${base}
         ORDER BY debut DESC
         LIMIT ${LIGNES_PAR_PAGE} OFFSET ${page * LIGNES_PAR_PAGE}`,
        params,
      ),
    ]);

    return {
      total: Number(compte?.[0]?.n ?? 0),
      lignes: (lignes as any[]).map(r => ({
        sessionId: r.sessionId,
        debut: Number(r.debut),
        dureeMs: Math.max(0, Number(r.fin) - Number(r.debut)),
        segments: Number(r.segments),
        lots: Number(r.lots),
        octets: Number(r.octets),
        erreur: Number(r.erreur) === 1,
        entree: r.entree || null,
        recuLe: r.recuLe instanceof Date ? r.recuLe.toISOString() : String(r.recuLe),
        connecteAuDepart: Number(r.connecteAuDepart) === 1,
        recherche: Number(r.recherche) === 1,
        compteCree: Number(r.compteCree) === 1,
        rapport: Number(r.rapport) === 1,
        tarifsVus: Number(r.tarifsVus) === 1,
        keycloakId: r.keycloakId ?? null,
      })),
    };
  }

  /** Les événements d'une visite, un tableau par segment, dans l'ordre. 404 si rien (purgé). */
  async lire(sessionId: string): Promise<{ sessionId: string; segments: unknown[][] }> {
    const lots: { segment: number; seq: number; data: Buffer }[] = await this.dataSource.query(
      `SELECT segment, seq, data FROM session_replay_chunk WHERE sessionId = ? ORDER BY segment, seq`,
      [sessionId],
    );
    if (!lots.length) throw new NotFoundException('Enregistrement purgé ou absent');

    const parSegment = new Map<number, unknown[]>();
    for (const lot of lots) {
      let events: unknown[];
      try {
        events = JSON.parse(gunzipSync(lot.data).toString('utf-8'));
      } catch {
        continue; // un lot illisible ne doit pas emporter le reste de la visite
      }
      const seg = Number(lot.segment);
      if (!parSegment.has(seg)) parSegment.set(seg, []);
      parSegment.get(seg)!.push(...events);
    }
    return {
      sessionId,
      segments: [...parSegment.entries()].sort((a, b) => a[0] - b[0]).map(([, e]) => e),
    };
  }

  private async visiteConnue(sessionId: string): Promise<boolean> {
    if (this.visitesConnues.has(sessionId)) return true;
    const rows = await this.dataSource.query(`SELECT 1 AS ok FROM visitor_session WHERE sessionId = ? LIMIT 1`, [sessionId]);
    if (!rows?.length) return false;
    this.borner(this.visitesConnues).add(sessionId);
    return true;
  }

  private async totalDeLaVisite(sessionId: string): Promise<number> {
    const enCache = this.totauxParVisite.get(sessionId);
    if (enCache !== undefined) return enCache;
    const rows = await this.dataSource.query(
      `SELECT COALESCE(SUM(bytes), 0) AS n FROM session_replay_chunk WHERE sessionId = ?`,
      [sessionId],
    );
    const total = Number(rows?.[0]?.n ?? 0);
    this.borner(this.totauxParVisite).set(sessionId, total);
    return total;
  }

  /** Le compteur du jour repart à minuit, heure du processus (Paris, cf. CLAUDE.md). */
  private changerDeJourSiBesoin(): void {
    const aujourdhui = jourISO(new Date());
    if (aujourdhui !== this.jour) {
      this.jour = aujourdhui;
      this.totalDuJour = 0;
      this.jourPlafonne = false;
    }
  }

  private async rechargerLeJour(): Promise<void> {
    this.jour = jourISO(new Date());
    try {
      const rows = await this.dataSource.query(
        `SELECT COALESCE(SUM(bytes), 0) AS n FROM session_replay_chunk WHERE receivedAt >= CURDATE()`,
      );
      this.totalDuJour = Number(rows?.[0]?.n ?? 0);
    } catch {
      this.totalDuJour = 0; // table absente (migration non appliquée) : la réception échouera seule
    }
  }

  private borner<T extends Set<string> | Map<string, number>>(c: T): T {
    if (c.size >= MAX_CACHE) c.clear();
    return c;
  }
}
