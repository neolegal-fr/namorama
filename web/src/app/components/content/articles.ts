/**
 * Registre des articles du blog.
 *
 * Source unique des métadonnées d'un article : l'index `/blog`, l'en-tête
 * (`<app-article-entete>`), les données structurées (`applyContentSeo`) et le
 * plan du site les lisent ici. Un article qui n'y figure pas n'a ni date, ni
 * auteur, ni place dans l'index.
 *
 * Les dates viennent de l'historique git : `publie` = premier commit du
 * fichier, `misAJour` = dernier commit qui touche au texte. Le temps de lecture
 * est le nombre de mots du gabarit divisé par 220, arrondi au supérieur.
 *
 * Les adresses des articles antérieurs au blog (`/guides/…`,
 * `/generateur-…`) ne changent pas : elles sont indexées.
 */

export type CategorieArticle = 'Méthode' | 'Générateurs' | 'Secteurs' | 'Marque & droit' | 'Comparatifs';

export const CATEGORIES: readonly CategorieArticle[] = [
  'Méthode',
  'Secteurs',
  'Marque & droit',
  'Générateurs',
  'Comparatifs',
];

export interface Article {
  /** Chemin canonique, ex. '/guides/trouver-nom-de-marque'. */
  path: string;
  /** Titre affiché dans l'index (souvent plus court que le H1). */
  titre: string;
  /** Une ou deux phrases pour la carte de l'index. */
  extrait: string;
  categorie: CategorieArticle;
  /** Date de publication, AAAA-MM-JJ. */
  publie: string;
  /** Date de dernière mise à jour du texte, AAAA-MM-JJ. */
  misAJour: string;
  /** Temps de lecture, en minutes. */
  lecture: number;
}

export const AUTEUR = {
  nom: 'Nicolas Riousset',
  role: 'créateur de Namorama',
};

const ARTICLES_NON_TRIES: Article[] = [
  {
    path: '/blog/nom-entreprise-artisan',
    titre: "Nom d'entreprise d'artisan : électricien, nettoyage, rénovation…",
    extrait:
      "Dénomination obligatoire, nom commercial facultatif, marque à part : ce qu'un artisan doit choisir, et pourquoi « elecservices » est déjà pris en .fr comme en .com.",
    categorie: 'Secteurs',
    publie: '2026-11-23',
    misAJour: '2026-11-23',
    lecture: 6,
  },
  {
    path: '/blog/noms-chatgpt-deja-pris',
    titre: 'Velora, Nuvira, Avelis : pourquoi les noms de ChatGPT sont déjà pris',
    extrait:
      "Nous avons testé douze noms proposés par des assistants IA : aucun n'avait son .com libre. Pourquoi, et comment vérifier les vôtres en une minute.",
    categorie: 'Méthode',
    publie: '2026-11-23',
    misAJour: '2026-11-23',
    lecture: 5,
  },
  {
    path: '/blog/deposer-marque-inpi-prix-delais',
    titre: 'Déposer sa marque à l’INPI : prix, délais et opposition',
    extrait:
      '190 € pour une classe, 40 € par classe en plus, deux mois d’opposition : le calendrier réel d’un dépôt, et ce qu’il faut vérifier avant de payer.',
    categorie: 'Marque & droit',
    publie: '2026-11-23',
    misAJour: '2026-11-23',
    lecture: 5,
  },
  {
    path: '/guides/trouver-nom-de-marque',
    titre: 'Trouver un nom de marque disponible',
    extrait: 'La méthode en 5 étapes pour un nom mémorable dont le domaine est encore libre.',
    categorie: 'Méthode',
    publie: '2026-06-10',
    misAJour: '2026-09-03',
    lecture: 9,
  },
  {
    path: '/guides/trouver-nom-entreprise',
    titre: "Trouver un nom d'entreprise",
    extrait: 'Un nom solide, libre au registre (INPI, RNE) et disponible en domaine.',
    categorie: 'Méthode',
    publie: '2026-06-16',
    misAJour: '2026-09-03',
    lecture: 5,
  },
  {
    path: '/guides/trouver-nom-de-produit',
    titre: 'Trouver un nom de produit',
    extrait: 'Descriptif, évocateur ou inventé : nommer un produit qui marque les esprits.',
    categorie: 'Méthode',
    publie: '2026-06-16',
    misAJour: '2026-08-20',
    lecture: 4,
  },
  {
    path: '/guides/trouver-nom-de-startup',
    titre: 'Trouver un nom de startup',
    extrait: 'Court, brandable, disponible en .com, .io ou .ai dès le premier jour.',
    categorie: 'Méthode',
    publie: '2026-06-16',
    misAJour: '2026-08-20',
    lecture: 4,
  },
  {
    path: '/nom-de-startup-court-invente',
    titre: 'Nom court et inventé, façon Qonto ou Stripe',
    extrait: 'La méthode pour un nom arbitraire, premium et disponible en .com — et ce que coûtent vraiment cinq lettres.',
    categorie: 'Méthode',
    publie: '2026-07-31',
    misAJour: '2026-08-20',
    lecture: 4,
  },
  {
    path: '/generateur-nom-de-marque',
    titre: 'Générateur de nom de marque',
    extrait: "Des noms générés par IA, avec le domaine vérifié libre en direct. Gratuit à l'essai.",
    categorie: 'Générateurs',
    publie: '2026-09-03',
    misAJour: '2026-09-03',
    lecture: 5,
  },
  {
    path: '/generateur-nom-entreprise',
    titre: "Générateur de nom d'entreprise et de société",
    extrait: 'Dénomination, nom commercial, marque : trois noms différents, et où vérifier chacun.',
    categorie: 'Générateurs',
    publie: '2026-09-03',
    misAJour: '2026-09-03',
    lecture: 5,
  },
  {
    path: '/generateur-nom-de-domaine',
    titre: 'Générateur de nom de domaine',
    extrait: 'RDAP puis Whois, sur 30 extensions — et aucun domaine à vous vendre.',
    categorie: 'Générateurs',
    publie: '2026-09-03',
    misAJour: '2026-09-03',
    lecture: 5,
  },
  {
    path: '/generateur-nom-de-produit',
    titre: 'Générateur de nom de produit',
    extrait: 'Trois familles de noms de produit, et les critères qui comptent vraiment selon le secteur.',
    categorie: 'Générateurs',
    publie: '2026-08-01',
    misAJour: '2026-08-20',
    lecture: 6,
  },
  {
    path: '/generateur-nom-startup-ia',
    titre: 'Nom pour une startup IA',
    extrait: 'Un nom premium pour votre startup d’intelligence artificielle, sans les clichés du secteur.',
    categorie: 'Secteurs',
    publie: '2026-07-31',
    misAJour: '2026-08-20',
    lecture: 4,
  },
  {
    path: '/generateur-nom-ecommerce',
    titre: 'Nom pour une boutique en ligne',
    extrait: 'Un nom de marque e-commerce qui tient sur le site, les réseaux et le colis.',
    categorie: 'Secteurs',
    publie: '2026-07-31',
    misAJour: '2026-09-03',
    lecture: 4,
  },
  {
    path: '/generateur-nom-saas',
    titre: 'Nom pour un SaaS ou un logiciel B2B',
    extrait: 'Un nom de produit crédible et évolutif, et ce que change vraiment .com, .io ou .fr.',
    categorie: 'Secteurs',
    publie: '2026-07-31',
    misAJour: '2026-08-20',
    lecture: 4,
  },
  {
    path: '/generateur-nom-marque-vetement',
    titre: 'Nom de marque de vêtements',
    extrait: 'Streetwear ou prêt-à-porter : la classe 25 est saturée, et cela change votre méthode.',
    categorie: 'Secteurs',
    publie: '2026-09-03',
    misAJour: '2026-09-03',
    lecture: 4,
  },
  {
    path: '/generateur-nom-marque-cosmetique',
    titre: 'Nom de marque cosmétique et beauté',
    extrait: 'Un nom élégant pour vos soins, cosmétiques ou bijoux — et les deux contraintes propres au secteur.',
    categorie: 'Secteurs',
    publie: '2026-07-31',
    misAJour: '2026-09-03',
    lecture: 5,
  },
  {
    path: '/recherche-anteriorite-marque-inpi',
    titre: "Recherche d'antériorité de marque (INPI)",
    extrait: "L'INPI ne vérifie pas à votre place : comment chercher, et où la recherche gratuite s'arrête.",
    categorie: 'Marque & droit',
    publie: '2026-09-03',
    misAJour: '2026-09-03',
    lecture: 5,
  },
  {
    path: '/verifier-disponibilite-nom-de-marque',
    titre: "Vérifier la disponibilité d'un nom de marque",
    extrait: 'Domaine, réseaux sociaux et marques INPI + EUIPO : le test en une saisie.',
    categorie: 'Marque & droit',
    publie: '2026-08-05',
    misAJour: '2026-09-03',
    lecture: 4,
  },
  {
    path: '/comparatif-generateurs-de-noms',
    titre: 'Comparatif des générateurs de noms',
    extrait: 'Quel outil choisir, et pourquoi la vérification de disponibilité réelle change tout.',
    categorie: 'Comparatifs',
    publie: '2026-06-10',
    misAJour: '2026-09-03',
    lecture: 7,
  },
  {
    path: '/namorama-vs-namelix',
    titre: 'Namorama vs Namelix',
    extrait: 'Disponibilité réelle, extension locale et suggestions en français : le comparatif détaillé.',
    categorie: 'Comparatifs',
    publie: '2026-06-17',
    misAJour: '2026-08-20',
    lecture: 3,
  },
  {
    path: '/namorama-vs-looka',
    titre: 'Namorama vs Looka',
    extrait: 'Nom de marque ou logo : que privilégier, et pourquoi le domaine passe d’abord.',
    categorie: 'Comparatifs',
    publie: '2026-06-17',
    misAJour: '2026-08-20',
    lecture: 5,
  },
];

/** Articles du plus récent au plus ancien (à date égale, ordre de déclaration). */
export const ARTICLES: readonly Article[] = [...ARTICLES_NON_TRIES].sort((a, b) =>
  b.publie.localeCompare(a.publie),
);

/** Article servi à ce chemin (query string et slash final ignorés). */
export function articleDe(chemin: string): Article | undefined {
  const propre = chemin.split(/[?#]/)[0].replace(/(.)\/$/, '$1');
  return ARTICLES.find((a) => a.path === propre);
}

const MOIS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

/** « 2026-09-03 » → « 3 septembre 2026 », sans dépendre de la locale du runtime. */
export function dateLongue(iso: string): string {
  const [a, m, j] = iso.split('-').map(Number);
  return `${j === 1 ? '1er' : j} ${MOIS[m - 1]} ${a}`;
}
