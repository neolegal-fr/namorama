/**
 * Adresses que le site sert en dehors des articles, et adresses historiques.
 *
 * `CHEMINS_DU_SITE` : routes statiques de l'application (`web/src/app/app.routes.ts`).
 * Un lien interne d'article doit viser l'une d'elles ou un article. Un test du web
 * (`chemins-du-site.spec.ts`) vérifie que cette liste couvre les routes déclarées :
 * une route ajoutée au front sans être recopiée ici ferait refuser un lien juste.
 *
 * `CHEMINS_HISTORIQUES` : les articles publiés avant le blog, hors de `/blog/`. Leur
 * adresse est indexée et ne change plus. Un nouvel article vit sous `/blog/…` ; seul un
 * chemin de cette liste y échappe. La même liste existe côté web (routes rendues par le
 * serveur) et dans `web/nginx.conf` (adresses relayées au service du blog) : un test les
 * compare.
 */
export const CHEMINS_DU_SITE: readonly string[] = [
  '/',
  '/en',
  '/guides',
  '/blog',
  '/verifier-disponibilite-nom-de-marque',
  '/report',
  '/app',
  '/payment/success',
  '/payment/cancel',
  '/retour',
  '/desinscription',
  '/admin',
  '/legal',
  '/privacy',
];

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

/** Forme d'un chemin de nouvel article. */
export const FORME_DU_BLOG = /^\/blog\/[a-z0-9]+(?:-[a-z0-9]+)*$/;
