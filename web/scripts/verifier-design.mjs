#!/usr/bin/env node
/*
 * Contrôle du système de design — un cliquet, pas un idéal.
 *
 * Le système de design (docs/systeme-de-design.md) dit : on emploie les
 * jetons `--nm-*`, pas des valeurs. Le code ne le tient pas encore partout
 * — 207 attributs `style=` dans le seul wizard au 31/10/2026 — et le
 * corriger d'un coup serait un chantier à lui seul. Ce script fige donc
 * l'existant, fichier par fichier, et refuse toute hausse :
 *
 *   - un fichier ne peut pas gagner une couleur en dur, un style en ligne,
 *     une taille de police en px ou un `!important` ;
 *   - un fichier nouveau part de zéro ;
 *   - un fichier qui en PERD fait échouer le contrôle tant que la référence
 *     n'est pas resserrée (`--resserrer`) : sans quoi la marge regagnée
 *     resterait disponible pour la prochaine régression, sans que rien ne
 *     le signale.
 *
 * Relever une valeur de la référence est possible — c'est une édition à la
 * main de `design-reference.json`, donc visible dans la PR, et elle se
 * justifie dans le chantier OpenSpec. Le script ne le fait jamais.
 *
 * Sources de valeurs, exemptées : les fichiers de jetons et le preset
 * PrimeNG. C'est LÀ qu'une couleur doit naître.
 *
 * Usage :
 *   node web/scripts/verifier-design.mjs              # contrôle (CI, just design-check)
 *   node web/scripts/verifier-design.mjs --resserrer  # abaisse la référence, jamais ne la relève
 *   node web/scripts/verifier-design.mjs --detail     # liste les occurrences, fichier par fichier
 *
 * Aucune dépendance : il tourne en CI sans `npm ci`.
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(WEB, 'src');
const REFERENCE = join(WEB, 'design-reference.json');

/** Là où les valeurs ont le droit d'exister. */
const SOURCES_DE_VALEURS = new Set([
  'src/styles/tokens.css',
  'src/styles/theme.css',
  'src/styles/fonts.css',
  'src/app/app.config.ts',
]);

const MESURES = {
  couleurs: {
    libelle: 'couleur en dur (#hex, rgb(), hsl())',
    motif: /#[0-9a-fA-F]{3,8}\b|\b(?:rgb|hsl)a?\(\s*\d/g,
  },
  stylesEnLigne: {
    // `[style.width.px]="pct"` n'est pas compté : une liaison d'une seule
    // propriété porte une valeur CALCULÉE (barre de progression, opacité),
    // qu'aucun jeton ne remplace. Une couleur écrite dedans reste comptée
    // par la mesure `couleurs`.
    libelle: 'style en ligne (style="…", [style], [ngStyle])',
    motif: /\sstyle\s*=\s*["'`]|\[style\]\s*=|\[ngStyle\]\s*=/g,
  },
  taillesPx: {
    libelle: 'taille de police en px hors jeton',
    motif: /font-size\s*:\s*\d+(?:\.\d+)?px/g,
  },
  important: {
    libelle: '!important',
    motif: /!important/g,
  },
};

function sansCommentaires(texte, extension) {
  let t = texte.replace(/\/\*[\s\S]*?\*\//g, '');
  if (extension === '.html') t = t.replace(/<!--[\s\S]*?-->/g, '');
  // `//` en début de ligne seulement : ailleurs, c'est souvent une URL.
  if (extension === '.ts') t = t.replace(/^\s*\/\/.*$/gm, '');
  return t;
}

function fichiers(dossier) {
  const out = [];
  for (const nom of readdirSync(dossier)) {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) out.push(...fichiers(chemin));
    else if (/\.(css|html|ts)$/.test(nom) && !nom.endsWith('.spec.ts')) out.push(chemin);
  }
  return out;
}

function mesurer() {
  const resultat = {};
  const detail = {};
  for (const chemin of fichiers(SRC).sort()) {
    const rel = relative(WEB, chemin).split('\\').join('/');
    if (SOURCES_DE_VALEURS.has(rel)) continue;
    const ext = rel.slice(rel.lastIndexOf('.'));
    const texte = sansCommentaires(readFileSync(chemin, 'utf8'), ext);
    const compte = {};
    for (const [cle, { motif }] of Object.entries(MESURES)) {
      const trouves = texte.match(motif) ?? [];
      if (trouves.length) {
        compte[cle] = trouves.length;
        (detail[rel] ??= {})[cle] = [...new Set(trouves.map((s) => s.trim()))].slice(0, 12);
      }
    }
    if (Object.keys(compte).length) resultat[rel] = compte;
  }
  return { resultat, detail };
}

const args = new Set(process.argv.slice(2));
const { resultat: actuel, detail } = mesurer();
const reference = existsSync(REFERENCE) ? JSON.parse(readFileSync(REFERENCE, 'utf8')).fichiers ?? {} : {};

if (args.has('--detail')) {
  for (const [f, mesures] of Object.entries(detail)) {
    console.log(f);
    for (const [cle, ex] of Object.entries(mesures)) console.log(`  ${cle} ${actuel[f][cle]} — ${ex.join('  ')}`);
  }
}

if (args.has('--resserrer') || args.has('--initialiser')) {
  const initialiser = args.has('--initialiser') || !existsSync(REFERENCE);
  const nouvelle = {};
  for (const f of new Set([...Object.keys(reference), ...Object.keys(actuel)])) {
    for (const cle of Object.keys(MESURES)) {
      const a = actuel[f]?.[cle] ?? 0;
      const r = reference[f]?.[cle] ?? (initialiser ? a : 0);
      const v = Math.min(a, r);
      if (v > 0) (nouvelle[f] ??= {})[cle] = v;
    }
  }
  const doc = {
    _lisezmoi:
      'Référence du cliquet de web/scripts/verifier-design.mjs. Ne se relève qu’à la main, avec la justification dans le chantier OpenSpec. Voir docs/systeme-de-design.md §1.',
    fichiers: nouvelle,
  };
  writeFileSync(REFERENCE, JSON.stringify(doc, null, 2) + '\n');
  console.log(`Référence ${initialiser ? 'initialisée' : 'resserrée'} : ${relative(process.cwd(), REFERENCE)}`);
  process.exit(0);
}

const hausses = [];
const baisses = [];
for (const f of new Set([...Object.keys(reference), ...Object.keys(actuel)])) {
  for (const [cle, { libelle }] of Object.entries(MESURES)) {
    const a = actuel[f]?.[cle] ?? 0;
    const r = reference[f]?.[cle] ?? 0;
    if (a > r) hausses.push(`  ✗ ${f} : ${libelle} — ${r} → ${a}`);
    else if (a < r) baisses.push(`  ✓ ${f} : ${libelle} — ${r} → ${a}`);
  }
}

const total = (src) =>
  Object.values(src).reduce((s, m) => s + Object.values(m).reduce((x, y) => x + y, 0), 0);

if (hausses.length) {
  console.error('Système de design : valeurs en dur ajoutées.\n');
  console.error(hausses.join('\n'));
  console.error(
    '\nEmployer un jeton --nm-* (web/src/styles/tokens.css, theme.css) ou une classe de',
    '\nweb/src/styles/components.css. Une valeur qui manque devient un jeton, dans le même',
    '\nchantier. Détail : node web/scripts/verifier-design.mjs --detail',
  );
  process.exit(1);
}
if (baisses.length) {
  console.error('Système de design : des valeurs en dur ont disparu. Resserrer le cliquet :\n');
  console.error(baisses.join('\n'));
  console.error('\n  node web/scripts/verifier-design.mjs --resserrer   puis committer web/design-reference.json');
  process.exit(1);
}
console.log(`Système de design : aucune valeur en dur ajoutée (${total(actuel)} occurrences héritées, figées).`);
