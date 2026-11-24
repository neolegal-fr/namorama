/**
 * Compilateur des articles du blog : Markdown à en-tête → segments affichables.
 *
 * Porté de `web/scripts/articles.mjs` (chantier `articles-en-base`), qui compilait les
 * fichiers du dépôt au build. Il tourne désormais à l'enregistrement : l'écran
 * d'administration, les jetons de rédaction (Claude) et l'import passent tous par lui.
 *
 * Deux différences avec le compilateur de build :
 * - **les causes s'accumulent** au lieu d'arrêter à la première : l'éditeur et Claude
 *   corrigent tout en un aller-retour ;
 * - **un lien vers un article dépend de la date** : à la publication, la cible doit
 *   paraître au plus tard le même jour que l'article qui la cite. Dans un brouillon, tout
 *   article existant est une cible admise ; c'est la publication qui tranche.
 *
 * Le rendu (HTML, typographie, blocs, temps de lecture) est celui de l'ancien
 * compilateur, à l'octet près : c'est ce qui garde les pages identiques après la
 * migration (exigence « Rendu inchangé par la migration »).
 */
import { Marked, type Tokens } from 'marked';
import { CHEMINS_HISTORIQUES, FORME_DU_BLOG } from './chemins';

export const CATEGORIES = ['Méthode', 'Secteurs', 'Marque & droit', 'Générateurs', 'Comparatifs'] as const;
export type Categorie = (typeof CATEGORIES)[number];

export const CHAMPS = ['path', 'title', 'description', 'titre', 'extrait', 'categorie', 'publie', 'misAJour'] as const;
type Champ = (typeof CHAMPS)[number];
export type EnTete = Record<Champ, string>;

const CLASSES_ADMISES = ['lead', 'yes', 'no'];
const BLOCS: Record<string, string[]> = { cta: ['heading', 'label'], 'trois-risques': ['heading'] };
const MOTS_PAR_MINUTE = 220;
const NBSP = '\u00A0';

export type Segment =
  | { type: 'html'; html: string }
  | { type: 'cta'; heading?: string; subheading?: string; label?: string }
  | { type: 'trois-risques'; heading?: string; intro?: string };

export interface ArticleCompile extends EnTete {
  lecture: number;
  h1: string;
  segments: Segment[];
  /** Chemins internes cités (sans ancre ni paramètres), pages du site comprises. */
  liens: string[];
}

/**
 * Ce que le compilateur doit savoir du reste du site.
 *
 * `articles` : chemin → date de parution prévue (`publie` d'un article publié), ou
 * `null` pour un brouillon. L'article compilé lui-même peut y figurer.
 */
export interface ContexteDeCompilation {
  cheminsDuSite: ReadonlySet<string>;
  articles: ReadonlyMap<string, string | null>;
  /**
   * Vrai à la publication : un lien vers un article qui ne sera pas paru le jour où
   * l'article cité est servi est refusé.
   */
  verifierParution: boolean;
  /**
   * Jour courant à Paris (AAAA-MM-JJ). Un article déjà paru est servi aujourd'hui : il
   * peut citer tout ce qui a paru depuis sa date — un guide de juin mis à jour en
   * septembre cite légitimement un article de septembre.
   */
  aujourdhui: string;
}

export type ResultatDeCompilation = { ok: true; article: ArticleCompile } | { ok: false; causes: string[] };

// ── Typographie ──────────────────────────────────────────────────────────────

const SUP_DEBUT = '\uE000';
const SUP_FIN = '\uE001';

/**
 * Typographie française, sur du texte (jamais du code ni une URL) : espaces
 * insécables, et « 1er » en exposant quand `exposants` est vrai.
 */
export function typographie(texte: string, exposants = false): string {
  const t = texte
    .replace(/ ([:;!?»])/g, `${NBSP}$1`)
    .replace(/« /g, `«${NBSP}`)
    .replace(/(\d) (€|%)/g, `$1${NBSP}$2`);
  return exposants ? t.replace(/(?<![\p{L}\p{N}])1er(?![\p{L}\p{N}])/gu, `1${SUP_DEBUT}er${SUP_FIN}`) : t;
}

const exposants = (html: string) => html.replaceAll(SUP_DEBUT, '<sup>').replaceAll(SUP_FIN, '</sup>');

// ── Dates ────────────────────────────────────────────────────────────────────

export function estDateIso(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && new Date(`${date}T00:00:00Z`).toISOString().startsWith(date);
}

/** Date du jour à Paris, AAAA-MM-JJ : la seule horloge du produit (CLAUDE.md). */
export function dateDeParis(maintenant = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(maintenant);
}

// ── En-tête ──────────────────────────────────────────────────────────────────

const REVISION = /^#\s*revision:\s*(\d+)\s*$/;

/**
 * Sépare l'en-tête du corps. Les lignes de commentaire (`# …`) sont admises ; la ligne
 * `# revision: N` qu'ajoute la lecture d'un article est rendue à part.
 */
export function lireEnTete(source: string): {
  entete: Partial<EnTete>;
  corps: string;
  revision: number | null;
  ligneDuCorps: number;
  causes: string[];
} {
  const causes: string[] = [];
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(source);
  if (!m) {
    return {
      entete: {},
      corps: source,
      revision: null,
      ligneDuCorps: 1,
      causes: ['en-tête manquant (bloc --- … --- en début de texte)'],
    };
  }
  const entete: Partial<EnTete> = {};
  let revision: number | null = null;
  m[1].split(/\r?\n/).forEach((ligne, i) => {
    const r = REVISION.exec(ligne.trim());
    if (r) {
      revision = Number(r[1]);
      return;
    }
    if (!ligne.trim() || ligne.trim().startsWith('#')) return;
    const kv = /^([A-Za-z]+):\s*(.*)$/.exec(ligne);
    if (!kv) {
      causes.push(`ligne ${i + 2} de l'en-tête illisible : « ${ligne} »`);
      return;
    }
    let v = kv[2].trim();
    if (v.length >= 2 && v.startsWith('"') && v.endsWith('"')) {
      v = v.slice(1, -1).replace(/\\(["\\])/g, '$1');
    } else if (v.length >= 2 && v.startsWith("'") && v.endsWith("'")) {
      v = v.slice(1, -1).replace(/''/g, "'");
    }
    if (!(CHAMPS as readonly string[]).includes(kv[1])) {
      causes.push(`champ d'en-tête inconnu « ${kv[1]} » (admis : ${CHAMPS.join(', ')})`);
      return;
    }
    entete[kv[1] as Champ] = v;
  });
  const ligneDuCorps = m[0].split(/\n/).length - (m[0].endsWith('\n') ? 0 : 1);
  return { entete, corps: source.slice(m[0].length), revision, ligneDuCorps, causes };
}

/** Retire la ligne `# revision: N` de l'en-tête : elle n'appartient pas au texte. */
export function sansRevision(source: string): string {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(source);
  if (!m) return source;
  const lignes = m[1].split(/\r?\n/).filter((l) => !REVISION.test(l.trim()));
  return `---\n${lignes.join('\n')}\n---` + source.slice(m[0].length);
}

/** Ajoute (ou remplace) la ligne `# revision: N` en tête de l'en-tête. */
export function avecRevision(source: string, revision: number): string {
  const propre = sansRevision(source);
  return propre.startsWith('---\n') ? `---\n# revision: ${revision}\n${propre.slice(4)}` : propre;
}

/** Contrôle des champs de l'en-tête. Le chemin est contrôlé à part (`controlerChemin`). */
function controlerEnTete(entete: Partial<EnTete>, causes: string[]): entete is EnTete {
  const avant = causes.length;
  for (const c of CHAMPS) {
    if (!entete[c]) causes.push(`champ d'en-tête manquant : ${c}`);
  }
  if (entete.path && !/^\/[a-z0-9][a-z0-9/-]*[a-z0-9]$/.test(entete.path)) {
    causes.push(`path invalide « ${entete.path} » (ex. /blog/mon-article)`);
  }
  if (entete.categorie && !(CATEGORIES as readonly string[]).includes(entete.categorie)) {
    causes.push(`catégorie inconnue « ${entete.categorie} » (admises : ${CATEGORIES.join(', ')})`);
  }
  let datesValides = true;
  for (const d of ['publie', 'misAJour'] as const) {
    const date = entete[d];
    if (date && !estDateIso(date)) {
      causes.push(`${d} doit être une date AAAA-MM-JJ, reçu « ${date} »`);
      datesValides = false;
    }
  }
  if (datesValides && entete.publie && entete.misAJour && entete.misAJour < entete.publie) {
    causes.push(`misAJour (${entete.misAJour}) antérieure à publie (${entete.publie})`);
  }
  return causes.length === avant;
}

/**
 * Un nouvel article vit sous `/blog/<identifiant>` ; les adresses antérieures au blog
 * gardent la leur (exigence « Adresses publiées immuables »).
 */
export function controlerChemin(chemin: string): string | null {
  if (FORME_DU_BLOG.test(chemin) || CHEMINS_HISTORIQUES.includes(chemin)) return null;
  return `path « ${chemin} » : un nouvel article a une adresse de la forme /blog/<identifiant> (minuscules, chiffres, tirets)`;
}

// ── Conversion ───────────────────────────────────────────────────────────────

/** Sépare un suffixe `{#id .classe}` du contenu HTML d'un élément. */
function attributs(html: string, causes: string[]): { html: string; attrs: string } {
  const m = /\s*\{([^{}]*)\}\s*$/.exec(html);
  if (!m || !/^\s*[#.]/.test(m[1])) return { html, attrs: '' };
  let id = '';
  const classes: string[] = [];
  for (const t of m[1].trim().split(/\s+/)) {
    if (/^#[a-z0-9-]+$/.test(t)) id = t.slice(1);
    else if (/^\.[a-z-]+$/.test(t) && CLASSES_ADMISES.includes(t.slice(1))) classes.push(t.slice(1));
    else causes.push(`attribut non autorisé « ${t} » (admis : #identifiant, ${CLASSES_ADMISES.map((c) => '.' + c).join(', ')})`);
  }
  const attrs = (id ? ` id="${id}"` : '') + (classes.length ? ` class="${classes.join(' ')}"` : '');
  return { html: html.slice(0, m.index), attrs };
}

interface EtatDeConversion {
  causes: string[];
  liens: Set<string>;
  /** Lignes du texte complet, pour désigner la ligne d'une faute. */
  lignesSource: string[];
}

function ligneDe(lignesSource: string[], extrait: string): string {
  const premiere = extrait.trim().split(/\r?\n/)[0];
  const i = lignesSource.findIndex((l) => l.includes(premiere));
  return i >= 0 ? `ligne ${i + 1} : ` : '';
}

function convertisseur(entete: EnTete, contexte: ContexteDeCompilation, etat: EtatDeConversion): Marked {
  const { causes } = etat;
  const marked = new Marked({ gfm: true, breaks: false });
  marked.use({
    walkTokens(token) {
      if (token.type === 'html') {
        causes.push(`${ligneDe(etat.lignesSource, token.raw)}HTML brut interdit : « ${token.raw.trim().slice(0, 60)} »`);
      }
      if (token.type === 'text' && !(token as Tokens.Text).tokens) {
        (token as Tokens.Text).text = typographie((token as Tokens.Text).text, true);
      }
    },
    renderer: {
      // Le HTML brut est déjà signalé par `walkTokens` : il n'est pas recopié.
      html() {
        return '';
      },
      heading({ tokens, depth }) {
        if (depth === 1) causes.push('un seul titre « # » par article, en première ligne');
        const { html, attrs } = attributs(this.parser.parseInline(tokens), causes);
        return `<h${depth}${attrs}>${html}</h${depth}>\n`;
      },
      paragraph({ tokens }) {
        const { html, attrs } = attributs(this.parser.parseInline(tokens), causes);
        return `<p${attrs}>${html}</p>\n`;
      },
      // L'alignement de colonne (`:---:`) est ignoré : ce serait un style en ligne.
      tablecell({ tokens, header }) {
        const balise = header ? 'th' : 'td';
        const { html, attrs } = attributs(this.parser.parseInline(tokens), causes);
        return `<${balise}${attrs}>${html}</${balise}>\n`;
      },
      link({ href, title, tokens }) {
        const texte = this.parser.parseInline(tokens);
        const t = title ? ` title="${title}"` : '';
        if (href.startsWith('/')) {
          const chemin = href.split(/[?#]/)[0];
          etat.liens.add(chemin);
          if (contexte.cheminsDuSite.has(chemin)) return `<a href="${href}"${t}>${texte}</a>`;
          if (!contexte.articles.has(chemin)) {
            causes.push(`lien interne vers une adresse que le site ne sert pas : ${href}`);
          } else if (contexte.verifierParution && chemin !== entete.path) {
            const parution = contexte.articles.get(chemin);
            if (parution === null || parution === undefined) {
              causes.push(`lien vers ${href}, article en brouillon : un article ne renvoie qu'à des articles parus`);
            } else if (parution > (entete.publie > contexte.aujourdhui ? entete.publie : contexte.aujourdhui)) {
              causes.push(
                `lien vers ${href}, article programmé le ${parution} : un article ne renvoie qu'à des articles déjà parus`,
              );
            }
          }
          return `<a href="${href}"${t}>${texte}</a>`;
        }
        if (/^https?:\/\//.test(href)) {
          return `<a href="${href}"${t} target="_blank" rel="noopener">${texte}</a>`;
        }
        if (href.startsWith('mailto:')) return `<a href="${href}"${t}>${texte}</a>`;
        causes.push(`lien non pris en charge : ${href} (chemin /…, https://… ou mailto:)`);
        return texte;
      },
    },
  });
  return marked;
}

function lireBloc(nom: string, args: string, lignes: string[], causes: string[]): Segment | null {
  if (!BLOCS[nom]) {
    causes.push(`bloc inconnu « ::: ${nom} » (admis : ${Object.keys(BLOCS).join(', ')})`);
    return null;
  }
  const bloc: Record<string, string> = { type: nom };
  const reste = args.replace(/([a-zA-Z]+)="([^"]*)"/g, (_, cle: string, valeur: string) => {
    if (!BLOCS[nom].includes(cle)) {
      causes.push(`attribut « ${cle} » inconnu pour ::: ${nom} (admis : ${BLOCS[nom].join(', ')})`);
    } else {
      bloc[cle] = typographie(valeur);
    }
    return '';
  });
  if (reste.trim()) causes.push(`attributs illisibles après « ::: ${nom} » : ${reste.trim()}`);
  const texte = lignes
    .map((l) => l.trim())
    .filter(Boolean)
    .join(' ');
  if (texte) bloc[nom === 'cta' ? 'subheading' : 'intro'] = typographie(texte);
  return bloc as unknown as Segment;
}

function compterMots(texte: string): number {
  return texte
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .split(/\s+/)
    .filter((m) => /[\p{L}\p{N}]/u.test(m)).length;
}

/**
 * Compile un article. Ne lève pas : rend l'article compilé, ou toutes les causes de
 * refus trouvées.
 */
export function compilerArticle(source: string, contexte: ContexteDeCompilation): ResultatDeCompilation {
  const lu = lireEnTete(source);
  const causes = [...lu.causes];
  if (!controlerEnTete(lu.entete, causes)) return { ok: false, causes };
  const entete = lu.entete as EnTete;
  const cheminRefuse = controlerChemin(entete.path);
  if (cheminRefuse) causes.push(cheminRefuse);
  if (contexte.cheminsDuSite.has(entete.path)) causes.push(`path ${entete.path} déjà servi par une autre page du site`);

  const lignes = lu.corps.split(/\r?\n/);
  while (lignes.length && !lignes[0].trim()) lignes.shift();
  const h1 = /^# (.+)$/.exec(lignes[0] ?? '');
  if (!h1) {
    causes.push('le corps doit commencer par le titre « # … »');
    return { ok: false, causes };
  }
  lignes.shift();

  const etat: EtatDeConversion = { causes, liens: new Set(), lignesSource: source.split(/\r?\n/) };
  const marked = convertisseur(entete, contexte, etat);
  const segments: Segment[] = [];
  let tampon: string[] = [];
  const viderTampon = () => {
    const md = tampon.join('\n').trim();
    if (md) {
      const html = exposants(marked.parse(md) as string).replace(/<table>/g, '<table class="compare">');
      segments.push({ type: 'html', html });
    }
    tampon = [];
  };
  for (let i = 0; i < lignes.length; i++) {
    const ouverture = /^:::\s*([a-z-]+)(.*)$/.exec(lignes[i]);
    if (!ouverture) {
      if (/^:::\s*$/.test(lignes[i])) causes.push(`${ligneDe(etat.lignesSource, lignes[i])}« ::: » fermant sans ouverture`);
      else tampon.push(lignes[i]);
      continue;
    }
    const fin = lignes.findIndex((l, j) => j > i && /^:::\s*$/.test(l));
    if (fin < 0) {
      causes.push(`bloc « ::: ${ouverture[1]} » jamais fermé par « ::: »`);
      break;
    }
    viderTampon();
    const bloc = lireBloc(ouverture[1], ouverture[2], lignes.slice(i + 1, fin), causes);
    if (bloc) segments.push(bloc);
    i = fin;
  }
  viderTampon();

  const titre = exposants(marked.parseInline(h1[1].trim()) as string);
  if (causes.length) return { ok: false, causes: [...new Set(causes)] };

  const texteComplet = [titre, ...segments.map((s) => (s.type === 'html' ? s.html : Object.values(s).join(' ')))].join(' ');
  return {
    ok: true,
    article: {
      ...entete,
      lecture: Math.max(1, Math.ceil(compterMots(texteComplet) / MOTS_PAR_MINUTE)),
      h1: titre,
      segments,
      liens: [...etat.liens],
    },
  };
}
