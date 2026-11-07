/**
 * Contrat du « Rapport de disponibilité de marque » (épic US-050→055).
 *
 * Trois états stricts, alignés sur la sémantique de disponibilité domaine :
 * un échec de source ne se déguise JAMAIS en « libre ». Tout doute reste
 * `unknown` — cf. règle de disponibilité dans CLAUDE.md.
 */
export type Availability = 'free' | 'taken' | 'unknown';

/** Disponibilité d'un domaine sur une extension donnée. */
export interface DomainAvailability {
  extension: string; // ex. 'com', 'fr'
  domain: string; // ex. 'namorama.com'
  status: Availability;
}

/** Disponibilité d'un pseudo sur une plateforme sociale. */
export interface SocialAvailability {
  platform: string; // ex. 'GitHub'
  handle: string; // pseudo testé
  url: string; // URL du profil (pris) ou d'inscription
  status: Availability;
  /** Adaptateur pas encore livré → toujours `unknown` (cf. spike US-050). */
  planned?: boolean;
}

export type TrademarkMatch = 'none' | 'exact' | 'similar' | 'unknown';

/**
 * À quelle distance du nom cherché se trouve un dépôt.
 *
 * Trois niveaux, parce que « proche » recouvre deux choses très différentes.
 * « Neo Legal » face à « neolegal » n'est pas un voisin : c'est le même nom,
 * un espace près — et l'INPI le traiterait comme tel. Alors qu'un dépôt
 * remonté parce qu'il partage un mot avec le nom cherché n'engage rien.
 *
 * Sans cette distinction, l'écran a le choix entre deux mensonges : tout
 * afficher à plat (la marque qui compte se noie), ou ne rien afficher hors
 * identité stricte (le faux négatif du 03/09/2026).
 */
export type TrademarkProximity =
  /** Même nom, à la casse et aux espaces de bordure près. */
  | 'exact'
  /** Même nom une fois accents, espaces et tirets retirés — « Neo Legal » vs « neolegal ». */
  | 'normalized'
  /** Remonté par la recherche, sans correspondance de nom. */
  | 'other';

/** Résultat de pré-vérification marque pour un registre (INPI/EUIPO/WO). */
export interface TrademarkResult {
  office: 'INPI'; // périmètre phase 1 : API INPI (couvre FR+EU+WO)
  match: TrademarkMatch;
  /** Dépôts trouvés (vide tant que la recherche INPI n'est pas débloquée). */
  hits: TrademarkHit[];
  /** Repli : recherche officielle à l'URL profonde tant que l'API est indisponible. */
  deepLink: string;
  note?: string;
}

export interface TrademarkHit {
  name: string;
  /**
   * Distance au nom cherché. Absent sur les rapports produits avant le
   * 03/09/2026 : l'affichage retombe alors sur « other », qui n'affirme rien.
   */
  proximity?: TrademarkProximity;
  classes: number[]; // classes de Nice (issues de la notice, pour les dépôts pertinents)
  status?: string;
  collection?: 'FR' | 'EU' | 'WO';
  applicationNumber?: string;
  /** URL de la notice officielle (ST66) — lien « voir la notice » dans le rapport. */
  noticeUrl?: string;
}

/** Qualité intrinsèque du nom (analyse IA : 5 critères notés 1-5). */
export interface NameQuality {
  /** Score global 0-100 (moyenne des 5 critères). */
  score: number;
  /** Notes par critère (memorability, pronunciation, international, seo, distinctiveness). */
  scores: Record<string, number>;
  /**
   * Une phrase par critère : POURQUOI cette note.
   *
   * « International 2/5 » ne se discute pas, ne s'améliore pas et ne se
   * défend pas devant un associé. « Sens peu transparent hors du français »,
   * si. Le modèle les produisait déjà ; elles étaient jetées à la lecture.
   */
  comments?: Record<string, string>;
  /**
   * Comment le nom est construit et ce qu'il évoque, en une phrase.
   *
   * Les cinq notes disent si le nom est BON ; elles ne disent pas ce qu'il
   * VEUT DIRE. Devant « Verdalya », la première question n'est pas « 4/5 en
   * mémorabilité ? » mais « ça vient d'où ? » — sans quoi on ne sait pas
   * défendre le nom devant un associé.
   */
  origin?: string;
  strengths?: string;
  watchout?: string;
}

/** Rapport complet consommé par l'affichage, le PDF (US-053) et l'email. */
/**
 * Le projet et son public, tels que l'utilisateur les a posés.
 *
 * Mémorisés AVEC le rapport : sans eux, relu des semaines plus tard ou reçu
 * par mail, le document ne dit pas pourquoi ce nom-là a été proposé.
 *
 * ⚠ Jamais rendus sur la page de partage publique : le lien se transfère, et
 * la description du projet n'a pas à voyager avec.
 */
export interface ReportContext {
  description?: string;
  audience?: { label: string; value: string }[];
}

export interface BrandReport {
  name: string;
  handle: string;
  domains: DomainAvailability[];
  socials: SocialAvailability[];
  trademark: TrademarkResult;
  /** Qualité du nom (présente sur le rapport complet, pas sur l'aperçu). */
  quality?: NameQuality;
  /** Contexte du projet, pour la relecture et l'email. */
  context?: ReportContext;
  /** Synthèse 0-100. Les items `unknown` n'améliorent jamais le score. */
  score: number;
  generatedAt: string; // ISO 8601
  /** Signal indicatif — jamais une recherche d'antériorité légale. */
  disclaimer: string;
  /** Jeton de partage public (présent une fois le rapport mémorisé). */
  shareToken?: string;
}

/**
 * Synthèse d'un nom déjà vérifié, pour la grille de résultats.
 *
 * Ne contient que des données ACQUISES : un nom non vérifié n'a pas de
 * synthèse, donc rien ne fuit avant achat. C'est la relecture d'un rapport
 * payé, pas un aperçu gratuit.
 */
export interface BrandReportSummary {
  /** Nom normalisé (minuscules, sans espaces autour) — clé de rapprochement. */
  nameKey: string;
  verifiedAt: string | null;
  /** Verdict de marque, commun aux deux offices (l'API n'en produit qu'un). */
  trademark: 'none' | 'exact' | 'similar' | 'unknown';
  /** Des dépôts trouvés relèvent-ils de cet office ? */
  inpiHits: boolean;
  euipoHits: boolean;
  socials: { platform: string; status: 'free' | 'taken' | 'unknown' }[];
  score: number | null;
  /**
   * Crédits RÉELLEMENT débités pour ce rapport — 0 s'il a consommé le rapport
   * offert du mois, sinon le tarif en vigueur au moment de l'achat.
   *
   * Exposé pour que l'écran de résultats puisse annoncer un total honnête :
   * multiplier le nombre de rapports par le tarif COURANT donnerait un chiffre
   * faux après un changement de prix, et ferait payer sur l'écran un rapport
   * qui était offert. `null` sur les enregistrements antérieurs à la colonne.
   */
  costCredits: number | null;
  /**
   * Jeton de l'adresse publique `/rapport/<jeton>`, pour que la carte copie le
   * lien PENDANT le clic : l'écrire dans le presse-papiers après un appel
   * réseau perd l'activation utilisateur sur Safari, et échoue sans bruit.
   * Rien de nouveau n'est exposé : la route ne rend que des rapports que
   * l'appelant peut déjà lire et partager depuis la page du rapport.
   */
  shareToken: string | null;
}
