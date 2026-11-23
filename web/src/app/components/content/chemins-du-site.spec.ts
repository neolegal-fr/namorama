import { readFileSync } from 'node:fs';
import { routes } from '../../app.routes';
import { CHEMINS_HISTORIQUES } from './chemins-historiques';

/**
 * Les adresses du blog vivent en trois endroits qui doivent concorder (chantier
 * `articles-en-base`) :
 * - l'API, qui n'admet un article hors de `/blog/` que sur une adresse historique, et
 *   ne valide un lien interne que vers `CHEMINS_DU_SITE` ou un article ;
 * - le web, qui déclare une route rendue par le serveur pour chaque adresse historique ;
 * - nginx, qui relaie ces adresses au service du blog.
 *
 * Une adresse oubliée dans l'un d'eux donnerait un article refusé, une page blanche ou
 * un 404 de nginx — sans que rien d'autre ne le signale.
 */
const lireListe = (source: string, nom: string): string[] => {
  const m = new RegExp(`export const ${nom}[^=]*=\\s*\\[([\\s\\S]*?)\\];`).exec(source);
  if (!m) throw new Error(`${nom} introuvable`);
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
};

describe('adresses du blog : API, web et routes concordent', () => {
  const chemins = readFileSync('../api/src/articles/compilateur/chemins.ts', 'utf-8');

  it('les adresses historiques de l’API sont celles du web', () => {
    expect(lireListe(chemins, 'CHEMINS_HISTORIQUES')).toEqual([...CHEMINS_HISTORIQUES]);
  });

  it('nginx relaie au service du blog chaque adresse historique, et seulement elles', () => {
    const conf = readFileSync('nginx.conf', 'utf-8');
    const m = /# Adresses historiques[^\n]*\n\s*location ~ \^\/\(([^)]+)\)\$/.exec(conf);
    expect(m).not.toBeNull();
    const relayees = m![1].split('|').map((p) => '/' + p);
    // `/guides/…` est couvert par la règle générale du blog.
    const attendues = CHEMINS_HISTORIQUES.filter((p) => !p.startsWith('/guides/'));
    expect([...relayees].sort()).toEqual([...attendues].sort());
    expect(conf).toMatch(/location ~ \^\/\(blog\|blog\/\[a-z0-9-\]\+\|guides\/\[a-z0-9-\]\+\)\$/);
  });

  it('les routes statiques du site sont connues de l’API (liens internes)', () => {
    const duSite = new Set(lireListe(chemins, 'CHEMINS_DU_SITE'));
    const statiques = routes
      .map((r) => r.path ?? '')
      .filter((p) => !p.includes(':') && !p.includes('*'))
      .map((p) => '/' + p)
      .map((p) => (p === '/' ? '/' : p))
      .filter((p) => !CHEMINS_HISTORIQUES.includes(p));
    for (const p of statiques) expect(duSite.has(p) ? p : `manquant dans CHEMINS_DU_SITE : ${p}`).toBe(p);
  });
});
