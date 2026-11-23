#!/usr/bin/env node
/**
 * Compile les articles Markdown du blog (`src/content/articles/*.md`).
 *
 * Produit `src/app/components/content/articles.generes.ts` (ignoré par git) : la
 * liste des articles, en-tête et corps déjà convertis en HTML, découpés en
 * segments (HTML, appel à l'action, « trois risques »). L'application en dérive
 * ses routes, son prérendu, l'index du blog et les données structurées. Réécrit
 * aussi les lignes d'articles de `public/sitemap.xml`, entre deux marqueurs.
 *
 * Toute erreur arrête la compilation en nommant le fichier : un article cassé ne
 * doit pas atteindre `main`. Guide d'écriture : `docs/ecrire-un-article.md`.
 *
 * Appelé par `prebuild`, `prestart` et `pretest` (package.json).
 */
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Marked } from 'marked';

export const CATEGORIES = ['Méthode', 'Secteurs', 'Marque & droit', 'Générateurs', 'Comparatifs'];
const CHAMPS = ['path', 'title', 'description', 'titre', 'extrait', 'categorie', 'publie', 'misAJour'];
const CLASSES_ADMISES = ['lead', 'yes', 'no'];
const BLOCS = { cta: ['heading', 'label'], 'trois-risques': ['heading'] };
const MOTS_PAR_MINUTE = 220;
const NBSP = ' ';

export class ErreurArticle extends Error {
  constructor(fichier, message) {
    super(`${fichier} : ${message}`);
    this.name = 'ErreurArticle';
  }
}

// ── Typographie ──────────────────────────────────────────────────────────────

// Marques provisoires de l'exposant (zone à usage privé d'Unicode) : posées sur
// le texte avant conversion, remplacées par <sup> après, quand le HTML de
// l'auteur a déjà été refusé.
const SUP_DEBUT = '\uE000';
const SUP_FIN = '\uE001';

/**
 * Typographie française, sur du texte (jamais du code ni une URL) : espaces
 * insécables, et « 1er » en exposant quand `exposants` est vrai (corps HTML ;
 * pas dans les blocs, affichés comme texte).
 */
export function typographie(texte, exposants = false) {
  const t = texte
    .replace(/ ([:;!?»])/g, `${NBSP}$1`)
    .replace(/« /g, `«${NBSP}`)
    .replace(/(\d) (€|%)/g, `$1${NBSP}$2`);
  return exposants ? t.replace(/(?<![\p{L}\p{N}])1er(?![\p{L}\p{N}])/gu, `1${SUP_DEBUT}er${SUP_FIN}`) : t;
}

const exposants = (html) => html.replaceAll(SUP_DEBUT, '<sup>').replaceAll(SUP_FIN, '</sup>');

// ── En-tête ──────────────────────────────────────────────────────────────────

function lireEnTete(fichier, source) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(source);
  if (!m) throw new ErreurArticle(fichier, "en-tête manquant (bloc --- … --- en début de fichier)");
  const entete = {};
  m[1].split(/\r?\n/).forEach((ligne, i) => {
    if (!ligne.trim() || ligne.trim().startsWith('#')) return;
    const kv = /^([A-Za-z]+):\s*(.*)$/.exec(ligne);
    if (!kv) throw new ErreurArticle(fichier, `ligne ${i + 2} de l'en-tête illisible : « ${ligne} »`);
    let v = kv[2].trim();
    // Sous-ensemble de YAML : valeur brute, 'entre apostrophes' ('' pour une
    // apostrophe) ou "entre guillemets" (\" et \\ échappés).
    if (v.length >= 2 && v.startsWith('"') && v.endsWith('"')) {
      v = v.slice(1, -1).replace(/\\(["\\])/g, '$1');
    } else if (v.length >= 2 && v.startsWith("'") && v.endsWith("'")) {
      v = v.slice(1, -1).replace(/''/g, "'");
    }
    if (!CHAMPS.includes(kv[1])) {
      throw new ErreurArticle(fichier, `champ d'en-tête inconnu « ${kv[1]} » (admis : ${CHAMPS.join(', ')})`);
    }
    entete[kv[1]] = v;
  });
  for (const c of CHAMPS) {
    if (!entete[c]) throw new ErreurArticle(fichier, `champ d'en-tête manquant : ${c}`);
  }
  if (!/^\/[a-z0-9][a-z0-9/-]*[a-z0-9]$/.test(entete.path)) {
    throw new ErreurArticle(fichier, `path invalide « ${entete.path} » (ex. /blog/mon-article)`);
  }
  if (!CATEGORIES.includes(entete.categorie)) {
    throw new ErreurArticle(fichier, `catégorie inconnue « ${entete.categorie} » (admises : ${CATEGORIES.join(', ')})`);
  }
  for (const d of ['publie', 'misAJour']) {
    const date = entete[d];
    const ok = /^\d{4}-\d{2}-\d{2}$/.test(date) && new Date(`${date}T00:00:00Z`).toISOString().startsWith(date);
    if (!ok) throw new ErreurArticle(fichier, `${d} doit être une date AAAA-MM-JJ, reçu « ${date} »`);
  }
  if (entete.misAJour < entete.publie) {
    throw new ErreurArticle(fichier, `misAJour (${entete.misAJour}) antérieure à publie (${entete.publie})`);
  }
  return { entete, corps: source.slice(m[0].length) };
}

// ── Conversion ───────────────────────────────────────────────────────────────

/** Sépare un suffixe `{#id .classe}` du contenu HTML d'un élément. */
function attributs(fichier, html) {
  const m = /\s*\{([^{}]*)\}\s*$/.exec(html);
  if (!m || !/^\s*[#.]/.test(m[1])) return { html, attrs: '' };
  let id = '';
  const classes = [];
  for (const t of m[1].trim().split(/\s+/)) {
    if (/^#[a-z0-9-]+$/.test(t)) id = t.slice(1);
    else if (/^\.[a-z-]+$/.test(t) && CLASSES_ADMISES.includes(t.slice(1))) classes.push(t.slice(1));
    else throw new ErreurArticle(fichier, `attribut non autorisé « ${t} » (admis : #identifiant, ${CLASSES_ADMISES.map((c) => '.' + c).join(', ')})`);
  }
  const attrs = (id ? ` id="${id}"` : '') + (classes.length ? ` class="${classes.join(' ')}"` : '');
  return { html: html.slice(0, m.index), attrs };
}

function convertisseur(fichier, cheminsConnus, programmes) {
  const marked = new Marked({ gfm: true, breaks: false });
  marked.use({
    walkTokens(token) {
      if (token.type === 'html') {
        throw new ErreurArticle(fichier, `HTML brut interdit : « ${token.raw.trim().slice(0, 60)} »`);
      }
      if (token.type === 'text' && !token.tokens) token.text = typographie(token.text, true);
    },
    renderer: {
      heading({ tokens, depth }) {
        if (depth === 1) throw new ErreurArticle(fichier, 'un seul titre « # » par article, en première ligne');
        const { html, attrs } = attributs(fichier, this.parser.parseInline(tokens));
        return `<h${depth}${attrs}>${html}</h${depth}>\n`;
      },
      paragraph({ tokens }) {
        const { html, attrs } = attributs(fichier, this.parser.parseInline(tokens));
        return `<p${attrs}>${html}</p>\n`;
      },
      // L'alignement de colonne (`:---:`) est ignoré : ce serait un style en
      // ligne, que le système de design proscrit.
      tablecell({ tokens, header }) {
        const balise = header ? 'th' : 'td';
        const { html, attrs } = attributs(fichier, this.parser.parseInline(tokens));
        return `<${balise}${attrs}>${html}</${balise}>\n`;
      },
      link({ href, title, tokens }) {
        const texte = this.parser.parseInline(tokens);
        const t = title ? ` title="${title}"` : '';
        if (href.startsWith('/')) {
          const chemin = href.split(/[?#]/)[0];
          if (programmes.has(chemin)) {
            throw new ErreurArticle(
              fichier,
              `lien vers ${href}, article programmé le ${programmes.get(chemin)} : un article ne renvoie qu'à des articles déjà parus`,
            );
          }
          if (!cheminsConnus.has(chemin)) {
            throw new ErreurArticle(fichier, `lien interne vers une adresse que le site ne sert pas : ${href}`);
          }
          return `<a href="${href}"${t}>${texte}</a>`;
        }
        if (/^https?:\/\//.test(href)) {
          return `<a href="${href}"${t} target="_blank" rel="noopener">${texte}</a>`;
        }
        if (href.startsWith('mailto:')) return `<a href="${href}"${t}>${texte}</a>`;
        throw new ErreurArticle(fichier, `lien non pris en charge : ${href} (chemin /…, https://… ou mailto:)`);
      },
    },
  });
  return marked;
}

function lireBloc(fichier, nom, args, lignes) {
  if (!BLOCS[nom]) {
    throw new ErreurArticle(fichier, `bloc inconnu « ::: ${nom} » (admis : ${Object.keys(BLOCS).join(', ')})`);
  }
  const bloc = { type: nom };
  const reste = args.replace(/([a-zA-Z]+)="([^"]*)"/g, (_, cle, valeur) => {
    if (!BLOCS[nom].includes(cle)) {
      throw new ErreurArticle(fichier, `attribut « ${cle} » inconnu pour ::: ${nom} (admis : ${BLOCS[nom].join(', ')})`);
    }
    bloc[cle] = typographie(valeur);
    return '';
  });
  if (reste.trim()) throw new ErreurArticle(fichier, `attributs illisibles après « ::: ${nom} » : ${reste.trim()}`);
  const texte = lignes.map((l) => l.trim()).filter(Boolean).join(' ');
  if (texte) bloc[nom === 'cta' ? 'subheading' : 'intro'] = typographie(texte);
  return bloc;
}

function compterMots(texte) {
  return texte
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .split(/\s+/)
    .filter((m) => /[\p{L}\p{N}]/u.test(m)).length;
}

/**
 * Compile un article. `cheminsConnus` : toutes les adresses servies par le site ;
 * `programmes` : chemin → date des articles pas encore parus.
 */
export function compilerArticle(fichier, source, cheminsConnus, programmes = new Map()) {
  const { entete, corps } = lireEnTete(fichier, source);
  const lignes = corps.split(/\r?\n/);
  while (lignes.length && !lignes[0].trim()) lignes.shift();
  const h1 = /^# (.+)$/.exec(lignes[0] ?? '');
  if (!h1) throw new ErreurArticle(fichier, 'le corps doit commencer par le titre « # … »');
  lignes.shift();

  const marked = convertisseur(fichier, cheminsConnus, programmes);
  const segments = [];
  let tampon = [];
  const viderTampon = () => {
    const md = tampon.join('\n').trim();
    if (md) segments.push({ type: 'html', html: exposants(marked.parse(md)).replace(/<table>/g, '<table class="compare">') });
    tampon = [];
  };
  for (let i = 0; i < lignes.length; i++) {
    const ouverture = /^:::\s*([a-z-]+)(.*)$/.exec(lignes[i]);
    if (!ouverture) {
      if (/^:::\s*$/.test(lignes[i])) throw new ErreurArticle(fichier, `ligne ${i + 1} du corps : « ::: » fermant sans ouverture`);
      tampon.push(lignes[i]);
      continue;
    }
    const fin = lignes.findIndex((l, j) => j > i && /^:::\s*$/.test(l));
    if (fin < 0) throw new ErreurArticle(fichier, `bloc « ::: ${ouverture[1]} » jamais fermé par « ::: »`);
    viderTampon();
    segments.push(lireBloc(fichier, ouverture[1], ouverture[2], lignes.slice(i + 1, fin)));
    i = fin;
  }
  viderTampon();

  const titre = exposants(marked.parseInline(h1[1].trim()));
  const texteComplet = [titre, ...segments.map((s) => (s.type === 'html' ? s.html : Object.values(s).join(' ')))].join(' ');
  return {
    ...entete,
    lecture: Math.max(1, Math.ceil(compterMots(texteComplet) / MOTS_PAR_MINUTE)),
    h1: titre,
    segments,
  };
}

// ── Date de publication ──────────────────────────────────────────────────────

/** Date du jour à Paris, AAAA-MM-JJ : la seule horloge du produit (CLAUDE.md). */
export function dateDeParis(maintenant = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(maintenant);
}

/**
 * Date qui décide des articles parus : `ARTICLES_JUSQU_AU` (prévisualisation
 * locale d'articles programmés), sinon la date du jour à Paris.
 */
export function dateDePublication(env = process.env, maintenant = new Date()) {
  const forcee = env.ARTICLES_JUSQU_AU;
  if (forcee === undefined || forcee === '') return dateDeParis(maintenant);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(forcee) || !new Date(`${forcee}T00:00:00Z`).toISOString().startsWith(forcee)) {
    throw new Error(`ARTICLES_JUSQU_AU doit être une date AAAA-MM-JJ, reçu « ${forcee} »`);
  }
  return forcee;
}

/**
 * Compile les articles parus au jour `jour` (AAAA-MM-JJ) ; vérifie l'unicité des
 * chemins. Un article dont `publie` est postérieur n'est pas compilé : il n'a ni
 * route, ni place dans l'index ou le plan du site. Un lien vers lui est une
 * erreur, pas un lien mort jusqu'à sa parution.
 */
export function compilerArticles(fichiers, cheminsDuSite, jour = '9999-12-31') {
  const chemins = new Set(cheminsDuSite);
  const declares = new Map();
  for (const { nom, source } of fichiers) {
    const p = /^path:\s*["']?([^"'\s]+)/m.exec(source)?.[1];
    if (!p) continue; // l'erreur sera nommée par la compilation de l'article
    if (declares.has(p)) throw new ErreurArticle(nom, `path ${p} déjà déclaré par ${declares.get(p)}`);
    if (chemins.has(p)) throw new ErreurArticle(nom, `path ${p} déjà servi par une autre page du site`);
    declares.set(p, nom);
  }
  const programmes = new Map();
  const parus = fichiers.filter(({ source }) => {
    const p = /^path:\s*["']?([^"'\s]+)/m.exec(source)?.[1];
    const publie = /^publie:\s*["']?(\d{4}-\d{2}-\d{2})/m.exec(source)?.[1];
    if (p && publie && publie > jour) {
      programmes.set(p, publie);
      return false;
    }
    return true;
  });
  for (const p of declares.keys()) if (!programmes.has(p)) chemins.add(p);
  return parus.map(({ nom, source }) => compilerArticle(nom, source, chemins, programmes));
}

// ── Plan du site ─────────────────────────────────────────────────────────────

const DEBUT = '<!-- articles:debut (généré par scripts/articles.mjs) -->';
const FIN = '<!-- articles:fin -->';

export function planDuSite(xml, articles) {
  const a = xml.indexOf(DEBUT);
  const b = xml.indexOf(FIN);
  if (a < 0 || b < a) throw new Error(`sitemap.xml : marqueurs « ${DEBUT} » et « ${FIN} » introuvables`);
  const lignes = [...articles]
    .sort((x, y) => y.publie.localeCompare(x.publie) || x.path.localeCompare(y.path))
    .map(
      (art) =>
        `  <url>\n    <loc>https://namorama.com${art.path}</loc>\n    <lastmod>${art.misAJour}</lastmod>\n` +
        `    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>\n`,
    )
    .join('');
  return `${xml.slice(0, a + DEBUT.length)}\n${lignes}  ${xml.slice(b)}`;
}

// ── Exécution ────────────────────────────────────────────────────────────────

/** Adresses déclarées en dur dans app.routes.ts (hors paramètres et joker). */
export function cheminsDesRoutes(sourceRoutes) {
  const chemins = new Set(['/']);
  for (const m of sourceRoutes.matchAll(/path:\s*'([^']*)'/g)) {
    if (m[1] && !m[1].includes(':') && !m[1].includes('*')) chemins.add('/' + m[1]);
  }
  return chemins;
}

function principal() {
  const web = join(dirname(fileURLToPath(import.meta.url)), '..');
  const dossier = join(web, 'src/content/articles');
  const fichiers = readdirSync(dossier)
    .filter((f) => f.endsWith('.md'))
    .sort()
    .map((f) => ({ nom: `src/content/articles/${f}`, source: readFileSync(join(dossier, f), 'utf-8') }));
  const routes = readFileSync(join(web, 'src/app/app.routes.ts'), 'utf-8');

  const jour = dateDePublication();
  let articles;
  try {
    articles = compilerArticles(fichiers, cheminsDesRoutes(routes), jour);
  } catch (e) {
    if (e instanceof ErreurArticle) {
      console.error(`\n✗ Article invalide — ${e.message}\n`);
      process.exit(1);
    }
    throw e;
  }

  const sortie = join(web, 'src/app/components/content/articles.generes.ts');
  const contenu =
    `// Généré par scripts/articles.mjs depuis src/content/articles/ — ne pas modifier.\n` +
    `import type { ArticleMarkdown } from './articles';\n\n` +
    `export const ARTICLES_MARKDOWN: ArticleMarkdown[] = ${JSON.stringify(articles, null, 2)};\n`;
  if (!existsSync(sortie) || readFileSync(sortie, 'utf-8') !== contenu) writeFileSync(sortie, contenu);

  const plan = join(web, 'public/sitemap.xml');
  const xml = readFileSync(plan, 'utf-8');
  const nouveau = planDuSite(xml, articles);
  if (nouveau !== xml) writeFileSync(plan, nouveau);

  const programmes = fichiers.length - articles.length;
  console.log(
    `✓ ${articles.length} article(s) Markdown compilé(s) au ${jour}` +
      (programmes ? `, ${programmes} programmé(s) pour plus tard` : ''),
  );
}

if (process.argv[1] && basename(process.argv[1]) === 'articles.mjs') principal();
