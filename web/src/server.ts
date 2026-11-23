/**
 * Service du blog (image `namorama-blog`) : rend à la demande les pages du blog, à
 * partir des articles en base (chantier `articles-en-base`).
 *
 * En production, nginx (image `namorama-web`) reste en frontal et ne relaie ici que
 * `/blog`, `/blog/…`, `/guides/…`, les adresses historiques des articles et
 * `/sitemap.xml` ; tout le reste du site est servi en statique, comme avant.
 *
 * Variables : `PORT` (4000), `API_INTERNE_URL` (`http://api:3000` en production),
 * `NG_ALLOWED_HOSTS` (remplace `security.allowedHosts` d'`angular.json`).
 *
 * Une ligne NDJSON par requête (`kind: http`, durée de rendu) sur la sortie standard,
 * lisible par `docker logs` : c'est ce qui dira si un cache devient nécessaire.
 */
import { AngularNodeAppEngine, createNodeRequestHandler, isMainModule, writeResponseToNodeResponse } from '@angular/ssr/node';
import express from 'express';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { absolutiser } from './absolutiser';
import { sansEnTetesDeProxy } from './en-tetes-de-proxy';
import { planDuSite, type LigneDuPlan } from './plan-du-site';

const dossierNavigateur = join(import.meta.dirname, '../browser');
const API = (process.env['API_INTERNE_URL'] ?? 'http://localhost:3000').replace(/\/$/, '');
const RETRY_AFTER_S = 120;

/**
 * Fichiers à la racine de la sortie : les seules cibles qu'`absolutiser` réécrit.
 * Lus à la première page, pas au chargement du module : le build importe ce fichier
 * pour extraire les routes, avant que `browser/` existe.
 */
let racine: Set<string> | null = null;
const aLaRacine = () =>
  // Sous `ng serve`, la sortie n'existe pas sur disque (servie en mémoire) : rien à
  // réécrire, et surtout pas une erreur — elle mettait TOUTES les pages en 500.
  (racine ??= existsSync(dossierNavigateur)
    ? new Set(readdirSync(dossierNavigateur).filter((f) => statSync(join(dossierNavigateur, f)).isFile()))
    : new Set<string>());

/** Gabarit du plan du site : celui de la sortie, ou celui des sources sous `ng serve`. */
const gabaritDuPlan = () => {
  const construit = join(dossierNavigateur, 'sitemap.xml');
  return readFileSync(existsSync(construit) ? construit : join(process.cwd(), 'public', 'sitemap.xml'), 'utf8');
};

const app = express();
const angularApp = new AngularNodeAppEngine();

app.disable('x-powered-by');

app.use((req, res, next) => {
  const debut = performance.now();
  res.on('finish', () => {
    process.stdout.write(
      JSON.stringify({
        ts: new Date().toISOString(),
        kind: 'http',
        level: res.statusCode >= 500 ? 'error' : 'info',
        context: 'blog',
        method: req.method,
        path: req.path,
        status: res.statusCode,
        durationMs: Math.round(performance.now() - debut),
      }) + '\n',
    );
  });
  next();
});

/** Plan du site : gabarit statique + articles parus. Panne de l'API → 503, jamais un plan amputé. */
app.get('/sitemap.xml', async (_req, res) => {
  try {
    const rep = await fetch(`${API}/articles`, { signal: AbortSignal.timeout(5000) });
    if (!rep.ok) throw new Error(`API ${rep.status}`);
    const articles = (await rep.json()) as LigneDuPlan[];
    const gabarit = gabaritDuPlan();
    res.type('application/xml').set('Cache-Control', 'no-cache').send(planDuSite(gabarit, articles));
  } catch (e) {
    console.error(
      JSON.stringify({
        ts: new Date().toISOString(),
        kind: 'event',
        level: 'error',
        context: 'blog_source_unavailable',
        url: '/sitemap.xml',
        cause: String((e as Error)?.message ?? e).slice(0, 200),
      }),
    );
    res.status(503).set('Retry-After', String(RETRY_AFTER_S)).type('text/plain').send('Plan du site momentanément indisponible');
  }
});

// Actifs : servis par nginx en production ; ici pour le développement et les essais.
app.use(express.static(dossierNavigateur, { maxAge: '1y', index: false, redirect: false }));

app.use((req, res, next) => {
  sansEnTetesDeProxy(req.headers);
  angularApp
    .handle(req)
    .then((reponse) => {
      if (!reponse) return next();
      // Une correction en base doit être servie à la visite suivante : revalidation
      // à chaque chargement, comme les pages HTML servies par nginx.
      if (!reponse.headers.has('Cache-Control')) reponse.headers.set('Cache-Control', 'no-cache');
      if (!reponse.headers.get('Content-Type')?.includes('text/html') || !reponse.body) {
        return writeResponseToNodeResponse(reponse, res);
      }
      return reponse.text().then((html) => {
        const corrige = absolutiser(html, aLaRacine());
        const entetes = new Headers(reponse.headers);
        entetes.delete('Content-Length');
        return writeResponseToNodeResponse(
          new Response(corrige, { status: reponse.status, statusText: reponse.statusText, headers: entetes }),
          res,
        );
      });
    })
    .catch(next);
});

if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = Number(process.env['PORT'] ?? 4000);
  app.listen(port, (erreur?: Error) => {
    if (erreur) throw erreur;
    process.stdout.write(JSON.stringify({ ts: new Date().toISOString(), kind: 'log', level: 'info', context: 'blog', message: `service du blog sur :${port}, API ${API}` }) + '\n');
  });
}

/** Point d'entrée de l'Angular CLI (`ng serve`) et des fonctions serverless. */
export const reqHandler = createNodeRequestHandler(app);
