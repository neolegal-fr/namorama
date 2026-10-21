import type { OperationModele } from '../model-usage/model-usage.service';

/** Les fournisseurs que la configuration sait désigner. */
export type Fournisseur = 'openai' | 'anthropic';
export const FOURNISSEURS: readonly Fournisseur[] = ['openai', 'anthropic'];

/**
 * Le rôle d'un appel, qui choisit son modèle chez chaque fournisseur.
 *
 * - `simple` : reformulation, mots-clés, contraintes, nom de projet, découpage ;
 * - `creatif` : génération de noms, pick-best, repérage du marché, brouillon admin ;
 * - `analyse` : notation des noms.
 */
export type Role = 'simple' | 'creatif' | 'analyse';

export type ModelesParRole = Record<Role, string>;

/**
 * Le raisonnement demandé, dans le vocabulaire d'aujourd'hui. Chaque
 * adaptateur le traduit : `reasoning_effort` chez OpenAI, `thinking` et
 * `effort` chez Anthropic, selon ce que le modèle accepte.
 */
export type Raisonnement = 'none' | 'low';

/**
 * Ce qu'une opération attend en retour. `json` porte le schéma de la forme que
 * son parseur lit : OpenAI n'en a pas besoin (`json_object` suffit), Anthropic
 * n'a pas de mode JSON sans schéma.
 */
export type Format = { type: 'texte' } | { type: 'json'; schema: Record<string, unknown> };

/** Une demande au modèle, décrite sans rien d'un SDK. */
export interface Demande {
  role: Role;
  /** Consigne système, facultative : plusieurs appels mettent tout dans le message. */
  systeme?: string;
  message: string;
  format: Format;
  /** Budget de sortie, raisonnement compris, au compte d'OpenAI. */
  maxSortie: number;
  raisonnement: Raisonnement;
  /** Éléments traités, pour le coût à l'unité du relevé (noms d'un lot). */
  items?: number;
}

/**
 * Ce que l'opération reçoit. `texte` est vide quand la réponse est tronquée
 * ou refusée : une réponse partielle ne s'interprète jamais, l'opération
 * applique son repli comme pour une réponse vide.
 */
export interface Reponse {
  texte: string;
  tronque: boolean;
  refuse: boolean;
  fournisseur: Fournisseur;
  modele: string;
}

export interface ReponseWeb extends Reponse {
  /** Recherches web effectivement faites. `source: 'web'` en exige au moins une. */
  recherchesWeb: number;
}

/** Ce que chaque fournisseur sait faire. Un adaptateur enveloppe lui-même ses appels dans le relevé. */
export interface Adaptateur {
  readonly fournisseur: Fournisseur;
  readonly modeles: ModelesParRole;
  completer(operation: OperationModele, demande: Demande): Promise<Reponse>;
  chercherSurLeWeb(operation: OperationModele, demande: Omit<Demande, 'format'>): Promise<ReponseWeb>;
  /** L'erreur dit-elle que le compte n'a plus de crédit ? Seul ce cas déclenche le secours. */
  estCreditEpuise(erreur: unknown): boolean;
}
