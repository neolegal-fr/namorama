/**
 * Registre des articles du blog.
 *
 * Deux sources :
 * - **la base**, lue par l'API (`ArticlesApi`) : tous les articles textuels, écrits et
 *   publiés depuis l'administration ou par Claude (chantier `articles-en-base`) ;
 * - **les entrées écrites à la main** ci-dessous, pour les pages qui restent des
 *   composants parce qu'elles ont une logique propre.
 *
 * Les adresses des articles antérieurs au blog (`/guides/…`, `/generateur-…`) ne
 * changent pas : elles sont indexées (`CHEMINS_HISTORIQUES`).
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

/** Un morceau du corps d'un article Markdown, dans l'ordre du texte. */
export type SegmentArticle =
  | { type: 'html'; html: string }
  | { type: 'cta'; heading?: string; subheading?: string; label?: string }
  | { type: 'trois-risques'; heading?: string; intro?: string };

/** Article servi par l'API : en-tête, titre et corps compilés à l'enregistrement. */
export interface ArticleMarkdown extends Article {
  /** `<title>` et `og:title` (sans le suffixe « — Namorama »). */
  title: string;
  /** Meta description. */
  description: string;
  /** Titre H1, en HTML (en ligne). */
  h1: string;
  segments: SegmentArticle[];
}

export const AUTEUR = {
  nom: 'Nicolas Riousset',
  role: 'créateur de Namorama',
};

export const ARTICLES_ECRITS_A_LA_MAIN: Article[] = [
  {
    path: '/verifier-disponibilite-nom-de-marque',
    titre: "Vérifier la disponibilité d'un nom de marque",
    extrait: 'Domaine, réseaux sociaux et marques INPI + EUIPO : le test en une saisie.',
    categorie: 'Marque & droit',
    publie: '2026-08-05',
    misAJour: '2026-09-03',
    lecture: 4,
  },
];

/**
 * Index du blog : les articles parus (API) et les entrées écrites à la main, du plus
 * récent au plus ancien — à date égale, les articles de la base d'abord, dans l'ordre
 * où l'API les rend.
 */
export function indexDuBlog(parus: readonly Article[]): Article[] {
  return [...parus, ...ARTICLES_ECRITS_A_LA_MAIN].sort((a, b) => b.publie.localeCompare(a.publie));
}

/** Entrée écrite à la main servie à ce chemin (query string et slash final ignorés). */
export function articleEcritALaMainDe(chemin: string): Article | undefined {
  const propre = chemin.split(/[?#]/)[0].replace(/(.)\/$/, '$1');
  return ARTICLES_ECRITS_A_LA_MAIN.find((a) => a.path === propre);
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
