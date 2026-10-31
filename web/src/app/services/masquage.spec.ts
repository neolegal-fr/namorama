import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import wizard from '../components/wizard/wizard.html' with { loader: 'text' };
import { CLASSE_PRIVEE } from './session-replay';

/**
 * Le rejeu masque d'office les SAISIES. Ce qui reste exposé, ce sont les
 * textes AFFICHÉS qui reprennent une saisie ou une adresse : chacun doit être
 * sous `nm-prive`. Un oubli ne casse rien de visible — il envoie une
 * description en clair au serveur. D'où ce test, sur les gabarits eux-mêmes.
 */

/**
 * Gabarit en ligne d'un composant, lu dans sa source : compilés AOT, les
 * composants n'en gardent pas le texte. Chemin relatif au dossier `web/`, d'où
 * `ng test` est lancé.
 */
function gabaritDe(source: string): string {
  const ts = readFileSync(source, 'utf-8');
  const m = ts.match(/template:\s*`([\s\S]*?)`\s*,\s*\n/);
  if (!m) throw new Error(`gabarit en ligne introuvable dans ${source}`);
  return m[1];
}

function analyser(html: string): Document {
  return new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
}

/**
 * Éléments dont le texte PROPRE (hors descendants) AFFICHE l'expression, dans
 * une interpolation `{{ … }}` — un `@if (expression)` est lui aussi du texte
 * pour le parseur HTML, mais n'affiche rien.
 */
function porteurs(doc: Document, expression: string): Element[] {
  const affiche = (texte: string) =>
    Array.from(texte.matchAll(/\{\{([\s\S]*?)\}\}/g)).some(m => m[1].includes(expression));
  return Array.from(doc.body.querySelectorAll('*')).filter(el =>
    Array.from(el.childNodes).some(n => n.nodeType === Node.TEXT_NODE && affiche(n.textContent ?? '')),
  );
}

function verifier(doc: Document, expression: string) {
  const trouves = porteurs(doc, expression);
  expect(trouves.length, `« ${expression} » absent du gabarit : liste à mettre à jour`).toBeGreaterThan(0);
  for (const el of trouves) {
    expect(el.closest(`.${CLASSE_PRIVEE}`), `« ${expression} » affiché hors de .${CLASSE_PRIVEE}`).not.toBeNull();
  }
}

describe('masquage des textes personnels (rejeu)', () => {
  describe('wizard', () => {
    const doc = analyser(wizard);

    for (const expression of [
      'proprietaireDuProjet()', // bannière « projet de … »
      'refinedDescription()',
      'project.description',
      'shared.ownerEmail',
      'p.email',
    ]) {
      it(`masque ${expression}`, () => verifier(doc, expression));
    }

    it('masque les puces de mots-clés (texte porté par [label])', () => {
      const puces = Array.from(doc.body.querySelectorAll('p-chip')).filter(
        el => el.getAttribute('*ngfor')?.includes('keywords()'),
      );
      expect(puces.length).toBe(1);
      expect(puces[0].closest(`.${CLASSE_PRIVEE}`)).not.toBeNull();
    });

    it('bloque les éléments dont un ATTRIBUT porte une adresse', () => {
      const attributs = Array.from(doc.body.querySelectorAll('*')).filter(el =>
        Array.from(el.attributes).some(a => a.name.startsWith('[attr.') && /email/i.test(a.value)),
      );
      expect(attributs.length).toBeGreaterThan(0);
      for (const el of attributs) expect(el.closest('.nm-bloque')).not.toBeNull();
    });

    it('laisse lisibles les cartes de résultats : sans les noms, le rejeu ne dit rien', () => {
      const cartes = Array.from(doc.body.querySelectorAll('app-results-grid'));
      expect(cartes.length).toBeGreaterThan(0);
      for (const el of cartes) expect(el.closest(`.${CLASSE_PRIVEE}`)).toBeNull();
      expect(readFileSync('src/app/components/results/results-grid.ts', 'utf-8')).not.toContain(CLASSE_PRIVEE);
    });
  });

  it('application : prénom et adresse de la fiche compte', () => {
    const doc = analyser(gabaritDe('src/app/app.ts'));
    verifier(doc, 'userName()');
    verifier(doc, 'userEmail()');
  });

  it('application : le prénom du menu de profil', () => {
    const ts = readFileSync('src/app/app.ts', 'utf-8');
    expect(ts).toMatch(/label: this\.userName\(\),\s*\n\s*styleClass: 'nm-prive'/);
  });

  it('rapport de marque : description citée', () => {
    verifier(analyser(gabaritDe('src/app/components/brand-report/brand-report-view.ts')), 'ctx.description');
  });
});
