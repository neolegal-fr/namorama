import { RenderMode, ServerRoute } from '@angular/ssr';
import { ARTICLES_MARKDOWN } from './components/content/articles.generes';

/**
 * Render modes par route pour la génération statique (SSG).
 *
 * Seule la landing page ('') est prérendue en HTML statique : c'est la page
 * de contenu indexée par Google. Tout le reste (wizard, admin, paiement…)
 * reste en rendu client (`RenderMode.Client`) — leur code dépendant du
 * navigateur (Keycloak, localStorage, gtag) ne s'exécute donc jamais au build.
 */
export const serverRoutes: ServerRoute[] = [
  { path: '', renderMode: RenderMode.Prerender },
  { path: 'en', renderMode: RenderMode.Prerender },
  { path: 'blog', renderMode: RenderMode.Prerender },
  // Un article Markdown est toujours prérendu : c'est ce HTML que lisent les moteurs.
  ...ARTICLES_MARKDOWN.map((a): ServerRoute => ({ path: a.path.slice(1), renderMode: RenderMode.Prerender })),
  { path: 'blog/nom-entreprise-artisan', renderMode: RenderMode.Prerender },
  { path: 'blog/noms-chatgpt-deja-pris', renderMode: RenderMode.Prerender },
  { path: 'guides/trouver-nom-de-marque', renderMode: RenderMode.Prerender },
  { path: 'guides/trouver-nom-entreprise', renderMode: RenderMode.Prerender },
  { path: 'guides/trouver-nom-de-produit', renderMode: RenderMode.Prerender },
  { path: 'guides/trouver-nom-de-startup', renderMode: RenderMode.Prerender },
  { path: 'generateur-nom-de-marque', renderMode: RenderMode.Prerender },
  { path: 'generateur-nom-entreprise', renderMode: RenderMode.Prerender },
  { path: 'generateur-nom-marque-vetement', renderMode: RenderMode.Prerender },
  { path: 'generateur-nom-de-domaine', renderMode: RenderMode.Prerender },
  { path: 'recherche-anteriorite-marque-inpi', renderMode: RenderMode.Prerender },
  { path: 'generateur-nom-startup-ia', renderMode: RenderMode.Prerender },
  { path: 'generateur-nom-ecommerce', renderMode: RenderMode.Prerender },
  { path: 'generateur-nom-saas', renderMode: RenderMode.Prerender },
  { path: 'generateur-nom-de-produit', renderMode: RenderMode.Prerender },
  { path: 'generateur-nom-marque-cosmetique', renderMode: RenderMode.Prerender },
  { path: 'nom-de-startup-court-invente', renderMode: RenderMode.Prerender },
  { path: 'comparatif-generateurs-de-noms', renderMode: RenderMode.Prerender },
  { path: 'namorama-vs-namelix', renderMode: RenderMode.Prerender },
  { path: 'namorama-vs-looka', renderMode: RenderMode.Prerender },
  { path: 'verifier-disponibilite-nom-de-marque', renderMode: RenderMode.Prerender },
  { path: 'rapport/:token', renderMode: RenderMode.Client },
  { path: 'legal', renderMode: RenderMode.Prerender },
  { path: 'privacy', renderMode: RenderMode.Prerender },
  { path: '**', renderMode: RenderMode.Client },
];
