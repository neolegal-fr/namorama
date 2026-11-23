#!/usr/bin/env node
/**
 * Rédaction des articles du blog par jeton (chantier `articles-en-base`).
 *
 * C'est l'outil de Claude pour lire, vérifier, enregistrer et publier un article sans
 * déploiement ; il sert aussi à l'import des anciens fichiers. Sans dépendance.
 *
 *   node scripts/article.mjs liste
 *   node scripts/article.mjs lire <chemin> [fichier.md]
 *   node scripts/article.mjs verifier <fichier.md> [--publier]
 *   node scripts/article.mjs envoyer <fichier.md> [--publier]
 *   node scripts/article.mjs publier <chemin>...
 *   node scripts/article.mjs depublier <chemin>
 *   node scripts/article.mjs importer <dossier>
 *
 * Variables :
 *   NAMORAMA_JETON_ARTICLES  jeton de rédaction (obligatoire, jamais dans le dépôt) ;
 *                            créé dans Administration → Articles → Jetons de rédaction
 *   NAMORAMA_API_URL         défaut https://api.namorama.com
 *
 * `lire` écrit l'en-tête avec une ligne `# revision: N`. `envoyer` la renvoie telle
 * quelle : si l'article a changé entre-temps (une correction à la main), l'envoi est
 * refusé au lieu de l'écraser. Sans cette ligne, `envoyer` crée un nouvel article.
 *
 * Sortie non nulle sur toute erreur, avec la cause renvoyée par l'API.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const VARIABLE_JETON = 'NAMORAMA_JETON_ARTICLES';

export class ErreurCommande extends Error {}

/** Message lisible d'une réponse d'erreur de l'API (causes de refus comprises). */
export function messageDErreur(statut, corps) {
  const c = corps && typeof corps === 'object' ? corps : {};
  const lignes = [`HTTP ${statut} : ${Array.isArray(c.message) ? c.message.join(' ; ') : (c.message ?? String(corps ?? ''))}`];
  for (const cause of c.causes ?? []) lignes.push(`  - ${cause}`);
  if (c.citants) lignes.push(`  cité par : ${c.citants.join(', ')}`);
  if (c.revisionCourante) lignes.push(`  révision en ligne : ${c.revisionCourante}${c.auteur ? `, par ${c.auteur}` : ''} — relire l'article (lire) avant de renvoyer`);
  return lignes.join('\n');
}

export function client(env = process.env, fetcher = globalThis.fetch) {
  const jeton = env[VARIABLE_JETON];
  if (!jeton) throw new ErreurCommande(`${VARIABLE_JETON} manquante : créer un jeton dans Administration → Articles, puis l'exporter dans l'environnement`);
  const base = (env.NAMORAMA_API_URL || 'https://api.namorama.com').replace(/\/$/, '');
  return async function appeler(methode, chemin, corps) {
    const rep = await fetcher(`${base}/redaction/articles${chemin}`, {
      method: methode,
      headers: { 'X-Namorama-Jeton': jeton, ...(corps ? { 'Content-Type': 'application/json' } : {}) },
      body: corps ? JSON.stringify(corps) : undefined,
    });
    const texte = await rep.text();
    let lu;
    try {
      lu = texte ? JSON.parse(texte) : null;
    } catch {
      lu = texte;
    }
    if (!rep.ok) throw new ErreurCommande(messageDErreur(rep.status, lu));
    return lu;
  };
}

/** Texte d'un fragment HTML compilé, pour l'affichage en console. */
const texte = (html) =>
  html
    .replace(/<[^>]+>/g, '')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

const lireFichier = (f) => {
  if (!f) throw new ErreurCommande('fichier Markdown attendu');
  return readFileSync(f, 'utf-8');
};

export async function executer(args, { env = process.env, fetcher = globalThis.fetch, ecrire = (t) => process.stdout.write(t) } = {}) {
  const [commande, ...reste] = args;
  const publier = reste.includes('--publier');
  const positionnels = reste.filter((a) => a !== '--publier');
  if (!commande || commande === 'aide' || commande === '--help') {
    ecrire('commandes : liste | lire <chemin> [fichier] | verifier <fichier> [--publier] | envoyer <fichier> [--publier] | publier <chemin>… | depublier <chemin> | importer <dossier>\n');
    return;
  }
  const appeler = client(env, fetcher);
  switch (commande) {
    case 'liste': {
      const tous = await appeler('GET', '');
      for (const a of tous) ecrire(`${a.etat.padEnd(10)} ${a.publie}  r${String(a.revision).padEnd(3)} ${a.path}  — ${a.titre}\n`);
      return;
    }
    case 'lire': {
      const [chemin, fichier] = positionnels;
      if (!chemin) throw new ErreurCommande('chemin attendu, ex. /blog/brief-de-naming');
      const { source, revision } = await appeler('GET', `/source?path=${encodeURIComponent(chemin)}`);
      if (fichier) {
        writeFileSync(fichier, source);
        ecrire(`${chemin} (révision ${revision}) écrit dans ${fichier}\n`);
      } else ecrire(source);
      return;
    }
    case 'verifier': {
      const v = await appeler('POST', '/verifier', { source: lireFichier(positionnels[0]), publier });
      if (!v.ok) throw new ErreurCommande(`article refusé :\n${v.causes.map((c) => `  - ${c}`).join('\n')}`);
      const a = v.article;
      const blocs = a.segments.filter((s) => s.type !== 'html').map((s) => s.type);
      const titres = a.segments
        .filter((s) => s.type === 'html')
        .flatMap((s) => [...s.html.matchAll(/<h2[^>]*>(.*?)<\/h2>/g)].map((m) => texte(m[1])));
      ecrire(`OK ${a.path} — ${a.categorie}, publié le ${a.publie}, ${a.lecture} min de lecture\n`);
      ecrire(`  titre : ${texte(a.h1)}\n`);
      for (const t of titres) ecrire(`  ## ${t}\n`);
      if (blocs.length) ecrire(`  blocs : ${blocs.join(', ')}\n`);
      return;
    }
    case 'envoyer': {
      const a = await appeler('PUT', '', { source: lireFichier(positionnels[0]), publier: publier || undefined });
      ecrire(`${a.path} : révision ${a.revision}, ${a.etat}\n`);
      return;
    }
    case 'publier': {
      if (!positionnels.length) throw new ErreurCommande('au moins un chemin attendu');
      const r = await appeler('POST', '/publier', { paths: positionnels });
      for (const a of r) ecrire(`${a.path} : ${a.etat} (le ${a.publie})\n`);
      return;
    }
    case 'depublier': {
      if (!positionnels[0]) throw new ErreurCommande('chemin attendu');
      const a = await appeler('POST', '/depublier', { path: positionnels[0] });
      ecrire(`${a.path} : ${a.etat}\n`);
      return;
    }
    case 'importer': {
      const dossier = positionnels[0];
      if (!dossier) throw new ErreurCommande('dossier de fichiers .md attendu');
      const fichiers = readdirSync(dossier).filter((f) => f.endsWith('.md')).sort();
      if (!fichiers.length) throw new ErreurCommande(`aucun fichier .md dans ${dossier}`);
      const sources = fichiers.map((f) => readFileSync(join(dossier, f), 'utf-8'));
      const r = await appeler('PUT', '/lot', { sources, publier: true });
      ecrire(`${fichiers.length} fichiers : ${r.crees.length} créés, ${r.inchanges.length} inchangés, ${r.publies.length} publiés\n`);
      return;
    }
    default:
      throw new ErreurCommande(`commande inconnue « ${commande} »`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  executer(process.argv.slice(2)).catch((e) => {
    process.stderr.write(`${e instanceof ErreurCommande ? e.message : e.stack ?? e}\n`);
    process.exit(1);
  });
}
