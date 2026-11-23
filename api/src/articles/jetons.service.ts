import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'node:crypto';
import { IsNull, Repository } from 'typeorm';
import { AppLoggerService } from '../common/logging/app-logger.service';
import { JetonApi } from './entities/jeton-api.entity';

/** Préfixe des jetons : une fuite (dépôt, journal) se repère en cherchant `nmr_`. */
export const PREFIXE_JETON = 'nmr_';
const LONGUEUR_PREFIXE_AFFICHE = 12;
/** `derniereUtilisation` n'est réécrite qu'au plus une fois par minute. */
const PAS_DERNIERE_UTILISATION_MS = 60_000;

export const empreinteDe = (valeur: string) => createHash('sha256').update(valeur, 'utf8').digest('hex');

export interface JetonVue {
  id: number;
  nom: string;
  prefixe: string;
  portee: string;
  creeLe: Date;
  derniereUtilisation: Date | null;
  revoqueLe: Date | null;
}

/**
 * Jetons d'API de rédaction (chantier `articles-en-base`).
 *
 * La valeur est rendue une seule fois, à la création, et seule son empreinte SHA-256 est
 * gardée : 256 bits d'entropie rendent un hachage lent inutile. Révoquer prend effet à
 * la requête suivante — aucun cache.
 */
@Injectable()
export class JetonsService {
  constructor(
    @InjectRepository(JetonApi) private readonly repo: Repository<JetonApi>,
    private readonly events: AppLoggerService,
  ) {}

  async creer(nom: string, creePar: string): Promise<JetonVue & { valeur: string }> {
    const propre = (nom ?? '').trim();
    if (!propre) throw new BadRequestException('Donnez un nom au jeton (ex. « Claude Code — poste »)');
    const valeur = PREFIXE_JETON + randomBytes(32).toString('base64url');
    const jeton = await this.repo.save(
      this.repo.create({
        nom: propre.slice(0, 80),
        prefixe: valeur.slice(0, LONGUEUR_PREFIXE_AFFICHE),
        empreinte: empreinteDe(valeur),
        portee: 'articles',
        creePar,
        derniereUtilisation: null,
        revoqueLe: null,
      }),
    );
    this.events.event('api_token_created', { id: jeton.id, nom: jeton.nom, sub: creePar });
    return { ...vue(jeton), valeur };
  }

  async lister(): Promise<JetonVue[]> {
    const tous = await this.repo.find({ order: { creeLe: 'DESC' } });
    return tous.map(vue);
  }

  async revoquer(id: number, sub: string): Promise<JetonVue> {
    const j = await this.repo.findOne({ where: { id } });
    if (!j) throw new NotFoundException('Jeton introuvable');
    if (!j.revoqueLe) {
      j.revoqueLe = new Date();
      await this.repo.save(j);
      this.events.event('api_token_revoked', { id: j.id, nom: j.nom, sub });
    }
    return vue(j);
  }

  /** Le jeton actif correspondant à cette valeur, pour cette portée ; `null` sinon. */
  async authentifier(valeur: unknown, portee = 'articles'): Promise<JetonApi | null> {
    if (typeof valeur !== 'string' || !valeur.startsWith(PREFIXE_JETON) || valeur.length > 200) return null;
    const j = await this.repo.findOne({ where: { empreinte: empreinteDe(valeur), revoqueLe: IsNull() } });
    if (!j || j.portee !== portee) return null;
    const maintenant = new Date();
    if (!j.derniereUtilisation || maintenant.getTime() - new Date(j.derniereUtilisation).getTime() > PAS_DERNIERE_UTILISATION_MS) {
      j.derniereUtilisation = maintenant;
      // Best-effort : un échec d'écriture ne doit pas refuser une requête authentique.
      await this.repo.update(j.id, { derniereUtilisation: maintenant }).catch(() => undefined);
    }
    return j;
  }
}

function vue(j: JetonApi): JetonVue {
  return {
    id: j.id,
    nom: j.nom,
    prefixe: j.prefixe,
    portee: j.portee,
    creeLe: j.creeLe,
    derniereUtilisation: j.derniereUtilisation,
    revoqueLe: j.revoqueLe,
  };
}
