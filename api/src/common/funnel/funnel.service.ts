import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { Request } from 'express';

/**
 * Les étapes que peut franchir une visite, après son premier affichage.
 *
 * L'inscription n'en fait PAS partie : elle ne se marque pas depuis un
 * contrôleur, mais depuis {@link FunnelService.rattacher}, sur un fait daté
 * plutôt que sur l'appel qui se trouve passer là. Voir le commentaire de cette
 * méthode pour ce que l'ancienne approche coûtait.
 */
export type EtapeVisite = 'recherche' | 'rapport' | 'tarifs' | 'paiement';

/** Colonne portant chaque étape. Une seule table de correspondance, pour éviter le SQL en chaîne. */
const COLONNE: Record<EtapeVisite, string> = {
  recherche: 'searched',
  rapport: 'reportRequested',
  tarifs: 'pricingViewed',
  paiement: 'checkoutStarted',
};

/**
 * Identifiant de session tel qu'il arrive du navigateur.
 *
 * Filtré, parce qu'il finit en clé primaire : un en-tête est écrit par le
 * client, et rien n'oblige un client à envoyer un UUID. Le format accepté est
 * celui que produit `crypto.randomUUID()`, élargi aux identifiants de repli.
 */
const FORMAT_SESSION = /^[A-Za-z0-9_-]{8,64}$/;

/** Lit l'identifiant de session posé par l'intercepteur du front. */
export function sessionIdDeLaRequete(req: Request): string | undefined {
  const brut = req.headers['x-session-id'];
  const valeur = Array.isArray(brut) ? brut[0] : brut;
  return valeur && FORMAT_SESSION.test(valeur) ? valeur : undefined;
}

/**
 * Journal des visites : le dénominateur du tableau de bord.
 *
 * Deux entrées, et une seule table :
 *
 * - `visite()` — appelée par `POST /events` au premier affichage d'une page,
 *   sans jeton ni cookie. C'est la seule mesure qui voie ceux qui repartent ;
 * - `marquer()` — appelée par les contrôleurs authentifiés au moment où
 *   l'étape est réellement franchie. Le `sub` y est celui du jeton, pas une
 *   valeur déclarée par le navigateur : c'est ce qui permet d'écarter les
 *   comptes internes sans faire confiance au client ;
 * - `rattacher()` — relie la visite au compte, et déduit l'inscription d'une
 *   comparaison de dates plutôt que d'une course entre appels parallèles.
 *
 * Best-effort de bout en bout, comme les logs : une statistique qui ne s'écrit
 * pas ne doit jamais faire échouer la requête qui la portait.
 */
@Injectable()
export class FunnelService {
  private readonly logger = new Logger(FunnelService.name);

  /**
   * Étapes déjà écrites par CE processus, par session.
   *
   * `marquer('recherche')` part à chaque recherche, `rattacher()` à chaque
   * appel de `/users/credits` : sans ce garde, une visite active déclencherait
   * un UPDATE par clic pour réécrire un drapeau déjà levé. La base reste la
   * référence — ce cache n'évite que le trajet.
   *
   * Borné : au-delà de MAX_SESSIONS, on repart de zéro. Une entrée oubliée
   * coûte un UPDATE inutile, pas une donnée fausse.
   */
  private ecrites = new Map<string, Set<EtapeVisite | 'visite' | 'lien'>>();
  private static readonly MAX_SESSIONS = 5000;

  constructor(private readonly dataSource: DataSource) {}

  private dejaEcrit(sessionId: string, quoi: EtapeVisite | 'visite' | 'lien'): boolean {
    const vues = this.ecrites.get(sessionId);
    if (vues?.has(quoi)) return true;
    if (this.ecrites.size >= FunnelService.MAX_SESSIONS) this.ecrites.clear();
    if (vues) vues.add(quoi);
    else this.ecrites.set(sessionId, new Set([quoi]));
    return false;
  }

  /**
   * Enregistre une visite. Idempotent : la première page affichée fait foi.
   *
   * `connecte` dit si la session est arrivée avec un compte ouvert. La valeur
   * ne s'écrase pas ensuite : une session qui se connecte en cours de route
   * reste une visite arrivée sans compte, ce qui est justement l'information.
   */
  async visite(sessionId: string | undefined, connecte = false): Promise<void> {
    if (!sessionId || !FORMAT_SESSION.test(sessionId)) return;
    if (this.dejaEcrit(sessionId, 'visite')) return;
    await this.ecrire(
      `INSERT INTO visitor_session (sessionId, firstSeenAt, loggedInAtStart)
       VALUES (?, NOW(), ?)
       ON DUPLICATE KEY UPDATE sessionId = sessionId`,
      [sessionId, connecte ? 1 : 0],
    );
  }

  /**
   * Marque une étape franchie, en créant la visite si elle manque.
   *
   * Le repli de création compte : une balise `sendBeacon` peut être bloquée par
   * une extension du navigateur là où l'appel métier, lui, passe forcément. La
   * visite existerait alors dans les faits sans exister dans la table, et
   * l'entonnoir afficherait plus d'étapes que de visiteurs.
   *
   * Dans ce repli, `loggedInAtStart` vaut 1 : une recherche comme un rapport
   * supposent une session ouverte. L'inscription, qui suppose l'inverse, ne
   * passe pas par ici — voir {@link rattacher}.
   */
  async marquer(sessionId: string | undefined, etape: EtapeVisite, keycloakId?: string): Promise<void> {
    if (!sessionId || !FORMAT_SESSION.test(sessionId)) return;
    if (this.dejaEcrit(sessionId, etape)) return;
    const col = COLONNE[etape];
    await this.ecrire(
      `INSERT INTO visitor_session (sessionId, firstSeenAt, loggedInAtStart, ${col}, keycloakId)
       VALUES (?, NOW(), 1, 1, ?)
       ON DUPLICATE KEY UPDATE ${col} = 1, keycloakId = COALESCE(keycloakId, VALUES(keycloakId))`,
      [sessionId, keycloakId ?? null],
    );
  }

  /**
   * Rattache une visite au compte qui s'en sert, et note l'inscription si
   * c'en est une.
   *
   * Deux raisons d'exister, et la seconde a coûté cher :
   *
   * 1. **Écarter** des statistiques les visites des comptes admin et internes,
   *    comme le fait déjà chaque agrégat du tableau de bord. Le `sub` vient du
   *    jeton — le navigateur ne peut pas s'attribuer le compte d'un autre, ni
   *    se soustraire aux chiffres en se déclarant interne.
   * 2. **Marquer l'inscription.** Elle ne se déduit PAS de « c'est cet appel-ci
   *    qui a créé la ligne ». Au chargement de l'application, le front tire
   *    plusieurs appels authentifiés en parallèle, et n'importe lequel des
   *    vingt appelants de `findOrCreate` peut créer le compte en premier ;
   *    seuls les deux d'ici relayaient l'information, les autres l'avalaient.
   *    Relevé en production sur les 9 comptes créés du 05 au 12/09/2026 : **2
   *    marqués sur 9**, le compte étant créé par `GET /brand-report/summaries`
   *    quelques dizaines de millisecondes avant `GET /users/credits`. La
   *    marche « compte créé » de l'entonnoir sous-comptait d'un facteur quatre.
   *
   * D'où le critère actuel, qui est un fait daté et non une course : le compte
   * a-t-il été créé APRÈS le début de cette visite ? Il redonne les 2 marquages
   * corrects, rattrape les 7 manqués, et laisse la visite de retour d'un compte
   * existant (`createdAt` antérieur au `firstSeenAt`) hors du numérateur.
   *
   * Crée la ligne si elle manque : l'appel authentifié prouve la visite là où
   * la balise `sendBeacon`, elle, a pu être bloquée par une extension. Dans ce
   * repli seulement, faute de `firstSeenAt` à comparer, on retombe sur ce que
   * sait l'appel en cours.
   */
  async rattacher(
    sessionId: string | undefined,
    keycloakId: string,
    compteCreeA: Date,
    creeParCetAppel: boolean,
  ): Promise<void> {
    if (!sessionId || !FORMAT_SESSION.test(sessionId)) return;
    if (this.dejaEcrit(sessionId, 'lien')) return;
    await this.ecrire(
      `INSERT INTO visitor_session (sessionId, firstSeenAt, loggedInAtStart, keycloakId, accountCreated)
       VALUES (?, NOW(), ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         keycloakId     = COALESCE(keycloakId, VALUES(keycloakId)),
         -- IFNULL et non IF : une date absente rendrait la comparaison NULL,
         -- GREATEST renverrait NULL, et l'UPDATE échouerait sur une colonne
         -- NOT NULL — sans bruit, puisque l'écriture est best-effort.
         accountCreated = GREATEST(accountCreated, IFNULL(? >= firstSeenAt, 0))`,
      [sessionId, creeParCetAppel ? 0 : 1, keycloakId, creeParCetAppel ? 1 : 0, compteCreeA],
    );
  }

  private async ecrire(sql: string, params: unknown[]): Promise<void> {
    try {
      await this.dataSource.query(sql, params);
    } catch (e) {
      this.logger.warn(`Visite non enregistrée : ${e}`);
    }
  }
}
