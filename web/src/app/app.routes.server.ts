import { RenderMode, ServerRoute } from '@angular/ssr';
import { CHEMINS_HISTORIQUES } from './components/content/chemins-historiques';

/**
 * Render modes par route.
 *
 * Les pages de contenu fixes (accueil, mentions, vérificateur) sont prérendues au
 * build. Le **blog** est rendu par le serveur à chaque visite (`RenderMode.Server`,
 * service `namorama-blog` derrière nginx) : ses articles vivent en base et changent sans
 * déploiement (chantier `articles-en-base`). Tout le reste (wizard, admin, paiement…)
 * reste en rendu client — leur code dépendant du navigateur (Keycloak, localStorage,
 * gtag) ne s'exécute jamais côté serveur.
 */
export const serverRoutes: ServerRoute[] = [
  { path: '', renderMode: RenderMode.Prerender },
  { path: 'en', renderMode: RenderMode.Prerender },
  { path: 'blog', renderMode: RenderMode.Server },
  { path: 'blog/:slug', renderMode: RenderMode.Server },
  ...CHEMINS_HISTORIQUES.map((p): ServerRoute => ({ path: p.slice(1), renderMode: RenderMode.Server })),
  { path: 'verifier-disponibilite-nom-de-marque', renderMode: RenderMode.Prerender },
  { path: 'rapport/:token', renderMode: RenderMode.Client },
  { path: 'legal', renderMode: RenderMode.Prerender },
  { path: 'privacy', renderMode: RenderMode.Prerender },
  { path: '**', renderMode: RenderMode.Client },
];
