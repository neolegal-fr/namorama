import { mergeApplicationConfig, ApplicationConfig } from '@angular/core';
import { provideServerRendering, withRoutes } from '@angular/ssr';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { appConfig, PRERENDER_I18N, SITE_LANGS } from './app.config';
import { serverRoutes } from './app.routes.server';
import { URL_API_SERVEUR } from './components/content/articles-api';

/**
 * Dossier des dictionnaires, au build comme à l'exécution.
 *
 * Au prérendu (build), le processus tourne dans `web/` : `public/assets/i18n`. Dans
 * l'image du service du blog, il tourne ailleurs ; les dictionnaires y sont ceux copiés
 * à côté du bundle serveur, dans `browser/assets/i18n`. Lus sous le seul
 * `process.cwd()`, ils manquaient et la page sortait en clés brutes.
 */
function dossierI18n(): string | null {
  const candidats = [
    process.env['I18N_DIR'],
    join(dirname(fileURLToPath(import.meta.url)), '..', 'browser', 'assets', 'i18n'),
    join(process.cwd(), 'public', 'assets', 'i18n'),
  ];
  return candidats.find((d): d is string => !!d && existsSync(join(d, 'fr.json'))) ?? null;
}

/**
 * Dictionnaires i18n des langues du site, lus UNE fois sur le disque au
 * démarrage du prerender. Ce fichier n'est jamais embarqué dans le bundle
 * navigateur : c'est le seul endroit où `fs` est permis.
 *
 * Seules les langues de `SITE_LANGS` sont chargées — les autres n'ont pas
 * d'URL prérendue et n'en ont donc pas besoin ici.
 */
function loadPrerenderI18n(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const dossier = dossierI18n();
  if (!dossier) return out;
  for (const lang of SITE_LANGS) {
    try {
      out[lang] = JSON.parse(readFileSync(join(dossier, `${lang}.json`), 'utf8'));
    } catch {
      // Fichier absent : la langue se rendra en clés brutes, ce qui se voit
      // immédiatement au build plutôt que de casser silencieusement.
    }
  }
  return out;
}

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
    { provide: PRERENDER_I18N, useValue: loadPrerenderI18n() },
    // Le service du blog lit l'API par le réseau interne (`http://api:3000` en prod).
    { provide: URL_API_SERVEUR, useValue: process.env['API_INTERNE_URL'] ?? 'http://localhost:3000' },
  ],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
