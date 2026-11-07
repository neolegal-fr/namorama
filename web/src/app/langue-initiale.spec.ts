import { describe, expect, it } from 'vitest';
import { langueInitiale } from './app.config';
// Le gabarit tel quel : c'est son script qu'on exécute, pas une copie.
import gabarit from '../index.html' with { loader: 'text' };

/**
 * La langue déclarée avant le démarrage, et celle de l'application.
 *
 * Chantier `declarer-la-langue-affichee` : la coquille cliente pose `<html lang>`
 * par un script en ligne de `index.html`, qui ne peut pas importer de module. La
 * règle existe donc en deux exemplaires ; ce test exécute le vrai script et le
 * compare à `langueInitiale()` sur chaque cas.
 */
const script = gabarit.match(/<script id="nm-langue">([\s\S]*?)<\/script>/)?.[1] ?? '';

/** Exécute le script de `index.html` dans un document simulé, et rend la langue posée. */
function langueDuScript(chemin: string, langues: readonly string[], prerendue = false): string {
  const html = { lang: 'fr' };
  const racine = { hasAttribute: (a: string) => prerendue && a === 'ng-server-context' };
  const document = { querySelector: () => racine, documentElement: html };
  const location = { pathname: chemin };
  const navigator = { languages: langues, language: langues[0] };
  new Function('document', 'location', 'navigator', script)(document, location, navigator);
  return html.lang;
}

/** `getBrowserLang()` de ngx-translate : premier élément, réduit à son code. */
const reduite = (l: string | undefined) => l?.split('-')[0].split('_')[0];

const CAS: { chemin: string; langues: string[]; attendue: string }[] = [
  { chemin: '/app', langues: ['en-US', 'en'], attendue: 'en' },
  { chemin: '/app', langues: ['fr-FR', 'fr'], attendue: 'fr' },
  { chemin: '/projects/03c3d48d-cad6-4690-989f-499d0973e110', langues: ['de-DE'], attendue: 'en' },
  { chemin: '/app', langues: ['fr-CA'], attendue: 'fr' },
  { chemin: '/app', langues: ['pt_BR'], attendue: 'en' },
  { chemin: '/en/app', langues: ['fr-FR'], attendue: 'en' },
  { chemin: '/fr/quelque-chose', langues: ['en-US'], attendue: 'fr' },
  { chemin: '/admin/dashboard', langues: [], attendue: 'en' },
];

describe('langue initiale', () => {
  it('le script est bien présent dans index.html', () => {
    expect(script).toContain('ng-server-context');
  });

  for (const { chemin, langues, attendue } of CAS) {
    it(`${chemin}, navigateur ${langues[0] ?? '(aucune)'} → ${attendue}, des deux côtés`, () => {
      expect(langueInitiale(chemin, reduite(langues[0]))).toBe(attendue);
      expect(langueDuScript(chemin, langues)).toBe(attendue);
    });
  }

  it('une page prérendue garde la langue posée au rendu', () => {
    expect(langueDuScript('/', ['en-US'], true)).toBe('fr');
    expect(langueDuScript('/generateur-nom-de-marque', ['de-DE'], true)).toBe('fr');
  });
});
