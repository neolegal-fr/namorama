#!/usr/bin/env node
/**
 * Retraduit une pile remontée par la production vers le code source.
 *
 *   node web/scripts/symboliser-pile.mjs <dossier-des-maps> < pile.txt
 *
 * Les maps sont celles de l'image web déployée, sous `/opt/sourcemaps` : la
 * compilation de production les produit « cachées » (aucun script ne les
 * référence) et le `Dockerfile` les sort du dossier servi. CLAUDE.md,
 * « Erreurs du navigateur », dit comment les extraire.
 *
 * Chaque `fichier.js:ligne:colonne` de la pile — formes Chrome
 * (`at n (https://…/main-X.js:1:2345)`) et Safari (`n@https://…/main-X.js:1:2345`)
 * — est complété par sa position dans le source. Une position qu'aucune map ne
 * couvre est laissée telle quelle et signalée.
 *
 * Chantier `telemetrie-sans-annulations`, tâche 2.3.
 */
import { existsSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { SourceMapConsumer } from 'source-map';

const dossier = process.argv[2];
if (!dossier || !existsSync(dossier)) {
  console.error('usage : node web/scripts/symboliser-pile.mjs <dossier-des-maps> < pile.txt');
  process.exit(2);
}

const pile = readFileSync(0, 'utf8');
const POSITION = /([^\s()@]+\.m?js):(\d+):(\d+)/g;

/** Une map lue au plus une fois, même si la pile cite dix fois le même fichier. */
const lecteurs = new Map();
async function lecteur(fichier) {
  const nom = basename(fichier.split('?')[0]);
  if (!lecteurs.has(nom)) {
    const chemin = join(dossier, `${nom}.map`);
    lecteurs.set(nom, existsSync(chemin)
      ? await new SourceMapConsumer(JSON.parse(readFileSync(chemin, 'utf8')))
      : null);
  }
  return lecteurs.get(nom);
}

const sortie = [];
for (const ligne of pile.split('\n')) {
  let rendue = ligne;
  for (const [, fichier, l, c] of ligne.matchAll(POSITION)) {
    const map = await lecteur(fichier);
    if (!map) {
      rendue += `   ⟵ pas de map pour ${basename(fichier)}`;
      continue;
    }
    // Les colonnes des piles commencent à 1, celles de source-map à 0.
    const p = map.originalPositionFor({ line: Number(l), column: Number(c) - 1 });
    rendue += p.source
      ? `   ⟵ ${p.source.replace(/^webpack:\/\/\/|^\.\//, '')}:${p.line}:${p.column + 1}${p.name ? ` (${p.name})` : ''}`
      : '   ⟵ position hors de la map';
  }
  sortie.push(rendue);
}
for (const map of lecteurs.values()) map?.destroy();
console.log(sortie.join('\n'));
