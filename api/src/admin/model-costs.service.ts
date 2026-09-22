import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { APPELS, COMPTE_DE_L_APPEL, COUT_DE_L_APPEL } from '../common/model-usage/cout-sql';
import { comptesMesures, jourISO, lundiDe, semaineSql } from './predicats';

/**
 * Consommation d'une opération sur un modèle.
 *
 * Groupée par (opération, modèle) et pas seulement par opération : c'est la
 * maille dont la projection a besoin — changer le modèle de l'analyse, c'est
 * réappliquer un autre tarif aux tokens de l'analyse, et à eux seuls.
 */
export interface LigneConsommation {
  operation: string;
  model: string;
  calls: number;
  /** Éléments traités (noms d'un lot d'analyse) : le coût par nom, pas par appel. */
  items: number;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  webSearchCalls: number;
  /** Coût au tarif de chaque appel, en dollars. `null` si aucun appel n'a de tarif. */
  costUsd: number | null;
  /** Appels sans tarif connu — non comptés dans `costUsd`. */
  unpricedCalls: number;
}

export interface CoutsPeriode {
  from: string;
  to: string;
  costUsd: number;
  calls: number;
  unpricedCalls: number;
  /**
   * Coût des appels sans compte : visiteurs de l'étape 1 qui ne se sont jamais
   * connectés, et comptes supprimés depuis. C'est le prix de ceux qui ne
   * restent pas.
   */
  unattributedCostUsd: number;
  /** Comptes distincts auxquels au moins un appel revient. */
  accounts: number;
  byOperation: LigneConsommation[];
}

/** Un point de la série. `null` avant le début du relevé : non mesuré, pas gratuit. */
export interface SemaineCouts {
  week: string;
  costUsd: number | null;
  byOperation: Record<string, number>;
}

/** Tarif en vigueur aujourd'hui pour un modèle — la base du simulateur. */
export interface TarifCourant {
  model: string;
  effectiveFrom: string;
  inputPerM: number;
  cachedInputPerM: number | null;
  outputPerM: number;
}

export interface AdminModelCosts {
  /** Premier appel relevé (`AAAA-MM-JJ`), ou `null` si le relevé est vide. */
  since: string | null;
  period: CoutsPeriode;
  previous: CoutsPeriode;
  weeks: SemaineCouts[];
  prices: TarifCourant[];
  /** Frais d'outil `web_search` en vigueur, par appel. */
  webSearchPerCall: number | null;
}

export interface UserModelCosts {
  keycloakId: string;
  since: string | null;
  costUsd: number;
  calls: number;
  unpricedCalls: number;
  byOperation: LigneConsommation[];
  weeks: SemaineCouts[];
}

export interface CoutCompte {
  costUsd: number;
  calls: number;
  unpricedCalls: number;
}

/**
 * Ce qu'ont coûté les appels au modèle, par période, par opération, par compte.
 *
 * Les montants sont recalculés à chaque lecture depuis les tokens et la table
 * des tarifs (cf. `cout-sql.ts`) : aucun n'est stocké, aucun ne vieillit.
 *
 * Les appels des comptes admin et internes sont écartés du tableau de bord,
 * comme partout ailleurs. Les appels SANS compte restent comptés : ce sont
 * ceux des visiteurs, et c'est une dépense réelle.
 */
@Injectable()
export class ModelCostsService {
  constructor(private readonly dataSource: DataSource) {}

  /** Appels retenus au tableau de bord : sans compte, ou d'un compte mesuré. */
  private static readonly MESURES = `(u.keycloakId IS NULL OR (${comptesMesures()}))`;

  private static readonly AVEC_COMPTE = `${APPELS}
  LEFT JOIN user u ON u.keycloakId = ${COMPTE_DE_L_APPEL}`;

  private static nombre(v: unknown): number {
    const n = Number(v ?? 0);
    return Number.isFinite(n) ? n : 0;
  }

  /** Arrondi au dix-millième de dollar : en deçà, c'est du bruit de flottant. */
  private static usd(v: unknown): number {
    return Math.round(ModelCostsService.nombre(v) * 10000) / 10000;
  }

  private async parOperation(where: string, params: unknown[]): Promise<LigneConsommation[]> {
    const rows = await this.dataSource.query(
      `SELECT m.operation AS operation, m.model AS model,
              COUNT(*) AS calls, SUM(m.items) AS items,
              SUM(m.inputTokens) AS inputTokens, SUM(m.cachedInputTokens) AS cachedInputTokens,
              SUM(m.outputTokens) AS outputTokens, SUM(m.reasoningTokens) AS reasoningTokens,
              SUM(m.webSearchCalls) AS webSearchCalls,
              SUM(${COUT_DE_L_APPEL}) AS cost,
              SUM((${COUT_DE_L_APPEL}) IS NULL) AS unpriced
         ${ModelCostsService.AVEC_COMPTE}
        WHERE ${where}
        GROUP BY m.operation, m.model
        ORDER BY cost DESC`,
      params,
    );
    const n = ModelCostsService.nombre;
    return rows.map((r: any) => ({
      operation: r.operation,
      model: r.model,
      calls: n(r.calls),
      items: n(r.items),
      inputTokens: n(r.inputTokens),
      cachedInputTokens: n(r.cachedInputTokens),
      outputTokens: n(r.outputTokens),
      reasoningTokens: n(r.reasoningTokens),
      webSearchCalls: n(r.webSearchCalls),
      costUsd: r.cost === null ? null : ModelCostsService.usd(r.cost),
      unpricedCalls: n(r.unpriced),
    }));
  }

  private async periode(debut: Date, fin: Date): Promise<CoutsPeriode> {
    const where = `${ModelCostsService.MESURES} AND m.createdAt >= ? AND m.createdAt <= ?`;
    const params = [debut, fin];
    const [byOperation, totaux] = await Promise.all([
      this.parOperation(where, params),
      this.dataSource.query(
        `SELECT COUNT(*) AS calls,
                SUM(${COUT_DE_L_APPEL}) AS cost,
                SUM((${COUT_DE_L_APPEL}) IS NULL) AS unpriced,
                SUM(CASE WHEN u.keycloakId IS NULL THEN ${COUT_DE_L_APPEL} END) AS unattributed,
                COUNT(DISTINCT u.keycloakId) AS accounts
           ${ModelCostsService.AVEC_COMPTE}
          WHERE ${where}`,
        params,
      ),
    ]);
    const t = totaux[0] ?? {};
    return {
      from: debut.toISOString(),
      to: fin.toISOString(),
      costUsd: ModelCostsService.usd(t.cost),
      calls: ModelCostsService.nombre(t.calls),
      unpricedCalls: ModelCostsService.nombre(t.unpriced),
      unattributedCostUsd: ModelCostsService.usd(t.unattributed),
      accounts: ModelCostsService.nombre(t.accounts),
      byOperation,
    };
  }

  /**
   * Coût hebdomadaire par opération, sur `nb` semaines.
   *
   * Les semaines antérieures au relevé valent `null` : elles n'ont pas été
   * mesurées, et une barre à zéro les ferait passer pour gratuites. La semaine
   * à cheval sur le démarrage l'est aussi, pour la même raison qu'ailleurs au
   * tableau de bord — ses seuls jours mesurés se liraient comme un creux.
   */
  private async semaines(nb: number, where: string, params: unknown[], since: string | null): Promise<SemaineCouts[]> {
    const lundiCourant = lundiDe(new Date());
    const lundis: string[] = [];
    for (let k = nb - 1; k >= 0; k--) {
      const d = new Date(lundiCourant);
      d.setDate(d.getDate() - 7 * k);
      lundis.push(jourISO(d));
    }

    const rows = await this.dataSource.query(
      `SELECT ${semaineSql('m.createdAt')} AS semaine, m.operation AS operation,
              SUM(${COUT_DE_L_APPEL}) AS cost
         ${ModelCostsService.AVEC_COMPTE}
        WHERE ${where} AND m.createdAt >= ?
        GROUP BY semaine, m.operation`,
      [...params, lundis[0]],
    );

    const parSemaine = new Map<string, Record<string, number>>();
    for (const r of rows) {
      // Une opération sans tarif n'a pas de coût : l'afficher à zéro la dirait gratuite.
      if (r.cost === null) continue;
      const s = String(r.semaine);
      const ops = parSemaine.get(s) ?? {};
      ops[r.operation] = ModelCostsService.usd(r.cost);
      parSemaine.set(s, ops);
    }

    const premiereMesuree = since ? jourISO(lundiDe(new Date(`${since}T00:00:00`))) : null;
    return lundis.map((lundi) => {
      const mesuree = premiereMesuree !== null && lundi > premiereMesuree;
      const ops = parSemaine.get(lundi) ?? {};
      const total = Object.values(ops).reduce((a, b) => a + b, 0);
      return {
        week: lundi,
        costUsd: mesuree ? Math.round(total * 10000) / 10000 : null,
        byOperation: mesuree ? ops : {},
      };
    });
  }

  private async debutDuReleve(): Promise<string | null> {
    const rows = await this.dataSource.query(
      `SELECT DATE_FORMAT(MIN(createdAt), '%Y-%m-%d') AS d FROM model_usage`,
    );
    return rows[0]?.d ?? null;
  }

  /** Le tarif en vigueur de chaque modèle : la base du simulateur de l'interface. */
  private async tarifsCourants(): Promise<{ prices: TarifCourant[]; webSearchPerCall: number | null }> {
    const rows = await this.dataSource.query(
      `SELECT model, DATE_FORMAT(effectiveFrom, '%Y-%m-%d') AS effectiveFrom,
              inputPerM, cachedInputPerM, outputPerM, perCall
         FROM model_price
        WHERE effectiveFrom <= NOW()
        ORDER BY effectiveFrom`,
    );
    const derniers = new Map<string, any>();
    for (const r of rows) derniers.set(r.model, r); // trié par date : le dernier gagne
    const web = derniers.get('web_search');
    derniers.delete('web_search');
    return {
      prices: [...derniers.values()].map((r) => ({
        model: r.model,
        effectiveFrom: r.effectiveFrom,
        inputPerM: Number(r.inputPerM),
        cachedInputPerM: r.cachedInputPerM === null ? null : Number(r.cachedInputPerM),
        outputPerM: Number(r.outputPerM),
      })),
      webSearchPerCall: web?.perCall == null ? null : Number(web.perCall),
    };
  }

  /**
   * Le relevé du tableau de bord : période choisie, période précédente de même
   * durée, série hebdomadaire et tarifs courants.
   */
  async getCosts(from?: Date, to?: Date, weeks = 26): Promise<AdminModelCosts> {
    const fin = to ?? new Date();
    const debut = from ?? new Date(fin.getTime() - 7 * 24 * 60 * 60 * 1000);
    // Mêmes bornes que `AdminService.getStats` : les deux fenêtres se
    // touchent sans se chevaucher.
    const duree = fin.getTime() - debut.getTime();
    const finPrec = new Date(debut.getTime() - 1);
    const debutPrec = new Date(debut.getTime() - duree);
    const nb = Math.min(Math.max(Math.trunc(weeks) || 26, 2), 104);

    const since = await this.debutDuReleve();
    const [period, previous, serie, tarifs] = await Promise.all([
      this.periode(debut, fin),
      this.periode(debutPrec, finPrec),
      this.semaines(nb, ModelCostsService.MESURES, [], since),
      this.tarifsCourants(),
    ]);
    return { since, period, previous, weeks: serie, ...tarifs };
  }

  /**
   * Le détail d'un compte, depuis le début du relevé.
   *
   * Sans filtre « compte mesuré » : on consulte ici UN compte, interne ou non,
   * et l'écarter rendrait sa fiche vide sans dire pourquoi.
   */
  async getUserCosts(userId: number, weeks = 26): Promise<UserModelCosts> {
    const rows = await this.dataSource.query(`SELECT keycloakId FROM user WHERE id = ?`, [userId]);
    const keycloakId: string | undefined = rows[0]?.keycloakId;
    if (!keycloakId) throw new NotFoundException(`User ${userId} not found`);

    const where = 'u.keycloakId = ?';
    const since = await this.debutDuReleve();
    const [byOperation, serie] = await Promise.all([
      this.parOperation(where, [keycloakId]),
      this.semaines(Math.min(Math.max(Math.trunc(weeks) || 26, 2), 104), where, [keycloakId], since),
    ]);
    return {
      keycloakId,
      since,
      costUsd: ModelCostsService.usd(byOperation.reduce((s, l) => s + (l.costUsd ?? 0), 0)),
      calls: byOperation.reduce((s, l) => s + l.calls, 0),
      unpricedCalls: byOperation.reduce((s, l) => s + l.unpricedCalls, 0),
      byOperation,
      weeks: serie,
    };
  }

  /** Coût cumulé de chaque compte d'une page d'utilisateurs, en une requête. */
  async coutsParCompte(keycloakIds: string[]): Promise<Map<string, CoutCompte>> {
    if (!keycloakIds.length) return new Map();
    const rows = await this.dataSource.query(
      `SELECT ${COMPTE_DE_L_APPEL} AS compte,
              COUNT(*) AS calls,
              SUM(${COUT_DE_L_APPEL}) AS cost,
              SUM((${COUT_DE_L_APPEL}) IS NULL) AS unpriced
         ${APPELS}
        WHERE ${COMPTE_DE_L_APPEL} IN (?)
        GROUP BY compte`,
      [keycloakIds],
    );
    return new Map(rows.map((r: any) => [String(r.compte), {
      costUsd: ModelCostsService.usd(r.cost),
      calls: ModelCostsService.nombre(r.calls),
      unpricedCalls: ModelCostsService.nombre(r.unpriced),
    }]));
  }

  /**
   * Sous-requête corrélée du coût cumulé d'un compte `u`, pour le TRI de la
   * liste : la pagination doit se faire sur cette valeur, qu'une agrégation
   * après coup ne connaît pas encore.
   */
  static readonly TRI_COUT = `(SELECT SUM(${COUT_DE_L_APPEL}) ${APPELS} WHERE ${COMPTE_DE_L_APPEL} = u.keycloakId)`;
}
