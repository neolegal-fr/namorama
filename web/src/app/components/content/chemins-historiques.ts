/**
 * Les articles publiés avant le blog, hors de `/blog/` : leur adresse est indexée et ne
 * change plus (chantier `articles-en-base`).
 *
 * Ces routes sont déclarées en dur, rendues par le serveur à la demande : le routeur
 * Angular ne sait pas attendre une réponse de l'API pour décider qu'une adresse est un
 * article. Un nouvel article vit sous `/blog/<identifiant>` et n'a rien à ajouter ici.
 *
 * La même liste existe dans l'API (`api/src/articles/compilateur/chemins.ts`) et dans
 * `web/nginx.conf` ; `chemins-du-site.spec.ts` vérifie que les trois concordent.
 */
export const CHEMINS_HISTORIQUES: readonly string[] = [
  '/comparatif-generateurs-de-noms',
  '/generateur-nom-de-domaine',
  '/generateur-nom-de-marque',
  '/generateur-nom-de-produit',
  '/generateur-nom-ecommerce',
  '/generateur-nom-entreprise',
  '/generateur-nom-marque-cosmetique',
  '/generateur-nom-marque-vetement',
  '/generateur-nom-saas',
  '/generateur-nom-startup-ia',
  '/guides/trouver-nom-de-marque',
  '/guides/trouver-nom-de-produit',
  '/guides/trouver-nom-de-startup',
  '/guides/trouver-nom-entreprise',
  '/namorama-vs-looka',
  '/namorama-vs-namelix',
  '/nom-de-startup-court-invente',
  '/recherche-anteriorite-marque-inpi',
];
