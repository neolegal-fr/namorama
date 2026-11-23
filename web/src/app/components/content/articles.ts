/**
 * Registre des articles du blog.
 *
 * L'index `/blog`, l'en-tête (`<app-article-entete>`), les données structurées
 * (`applyContentSeo`), les routes et le plan du site le lisent ici. Un article
 * qui n'y figure pas n'a ni date, ni auteur, ni place dans l'index.
 *
 * Deux sources :
 * - **les fichiers Markdown** de `src/content/articles/`, compilés au build par
 *   `scripts/articles.mjs` dans `articles.generes.ts` : en-tête, texte, temps de
 *   lecture calculé. C'est là qu'on écrit un article (`docs/ecrire-un-article.md`) ;
 * - **les entrées écrites à la main** ci-dessous, pour les pages qui restent des
 *   composants parce qu'elles ont une logique propre.
 *
 * Les adresses des articles antérieurs au blog (`/guides/…`,
 * `/generateur-…`) ne changent pas : elles sont indexées.
 */

import { ARTICLES_MARKDOWN } from './articles.generes';

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

/** Article compilé depuis un fichier Markdown. */
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

const ARTICLES_ECRITS_A_LA_MAIN: Article[] = [
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

/** Articles du plus récent au plus ancien (à date égale, ordre de déclaration). */
export const ARTICLES: readonly Article[] = [...ARTICLES_MARKDOWN, ...ARTICLES_ECRITS_A_LA_MAIN].sort((a, b) =>
  b.publie.localeCompare(a.publie),
);

/** Article Markdown servi à ce chemin. */
export function articleMarkdownDe(chemin: string): ArticleMarkdown | undefined {
  const propre = chemin.split(/[?#]/)[0].replace(/(.)\/$/, '$1');
  return ARTICLES_MARKDOWN.find((a) => a.path === propre);
}

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
