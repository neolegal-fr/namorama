/**
 * D'où vient une visite, et dans quel canal la ranger.
 *
 * Deux fonctions pures, sans base ni configuration :
 *
 * - {@link origineDeLaVisite} nettoie ce que le navigateur envoie avec le premier
 *   `page_viewed`. Le front a déjà réduit le référent à son domaine ; on refiltre
 *   quand même tout, parce que `POST /events` est public et qu'un client peut
 *   envoyer n'importe quoi.
 * - {@link canalDe} range une origine dans un canal. Le classement se fait à la
 *   LECTURE, jamais à l'écriture : corriger une liste ci-dessous vaut aussi pour
 *   les visites déjà enregistrées, sans migration.
 *
 * Chantier `mesurer-les-canaux-d-acquisition` : du 31/10 au 07/11/2026, 11 des 16
 * sessions enregistrées arrivaient par un lien `utm_source=chatgpt.com`, et rien
 * dans le journal des visites ne permettait de le savoir.
 */

/** Ce que la visite retient de son origine. `null` = inconnu ou refusé au filtre. */
export interface OrigineVisite {
  landingPath: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  referrerHost: string | null;
}

export const ORIGINE_VIDE: OrigineVisite = {
  landingPath: null, utmSource: null, utmMedium: null, utmCampaign: null, referrerHost: null,
};

const LONGUEUR_UTM = 60;
const LONGUEUR_CHEMIN = 120;
const LONGUEUR_DOMAINE = 120;

/** Lettres, chiffres, `.`, `_`, `-` et `+` : tout le reste fait rejeter la valeur. */
const FORMAT_UTM = /^[a-z0-9._+-]+$/;
/** Un nom de domaine : labels séparés par des points, au moins deux labels. */
const FORMAT_DOMAINE = /^(?=.{1,120}$)([a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z][a-z0-9-]*$/;
/** Segment de chemin admis tel quel. */
const FORMAT_SEGMENT = /^[A-Za-z0-9._~-]+$/;
/**
 * Segment qui a la forme d'un identifiant : UUID, nombre, ou longue chaîne
 * hexadécimale. Remplacé par `:id`, sans quoi chaque projet ouvert directement
 * deviendrait sa propre « page d'arrivée ».
 */
const FORMAT_IDENTIFIANT = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\d+|[0-9a-f]{16,})$/i;

function texte(valeur: unknown): string | null {
  return typeof valeur === 'string' && valeur.trim() ? valeur.trim() : null;
}

/** Paramètre de campagne : minuscules, jeu de caractères strict, 60 caractères. */
export function parametreDeCampagne(valeur: unknown): string | null {
  const v = texte(valeur)?.toLowerCase();
  if (!v || !FORMAT_UTM.test(v)) return null;
  return v.slice(0, LONGUEUR_UTM);
}

/**
 * Chemin d'arrivée : sans paramètres ni fragment, identifiants remplacés par
 * `:id`, segments au jeu de caractères inattendu rejetés en bloc.
 */
export function cheminDArrivee(valeur: unknown): string | null {
  const v = texte(valeur);
  if (!v || !v.startsWith('/')) return null;
  const chemin = v.split(/[?#]/)[0];
  const segments = chemin.split('/').filter(Boolean);
  if (segments.some((s) => !FORMAT_SEGMENT.test(s))) return null;
  const normalise = '/' + segments.map((s) => (FORMAT_IDENTIFIANT.test(s) ? ':id' : s)).join('/');
  return normalise.slice(0, LONGUEUR_CHEMIN);
}

/** Retire un éventuel `www.` de tête. */
function sansWww(domaine: string): string {
  return domaine.startsWith('www.') ? domaine.slice(4) : domaine;
}

/**
 * Domaine référent : minuscules, sans `www.`, et `null` s'il appartient au
 * produit (`domainesDuProduit`, sous-domaines compris). Accepte aussi une
 * adresse complète, réduite à son domaine — défense en profondeur : le front
 * n'envoie que le domaine.
 */
export function domaineReferent(valeur: unknown, domainesDuProduit: readonly string[]): string | null {
  let v = texte(valeur)?.toLowerCase();
  if (!v) return null;
  if (v.includes('/')) {
    // Seules les adresses web ont un domaine : `android-app://com.google.android.gm`
    // nomme une application, pas un site.
    if (v.includes('://') && !/^https?:\/\//.test(v)) return null;
    try {
      v = new URL(v.includes('://') ? v : `https://${v}`).hostname;
    } catch {
      return null;
    }
  }
  v = sansWww(v.replace(/\.$/, ''));
  if (v.length > LONGUEUR_DOMAINE || !FORMAT_DOMAINE.test(v)) return null;
  if (domainesDuProduit.some((d) => estOuSousDomaine(v!, sansWww(d.toLowerCase())))) return null;
  return v;
}

function estOuSousDomaine(domaine: string, parent: string): boolean {
  return !!parent && (domaine === parent || domaine.endsWith(`.${parent}`));
}

/** Nettoie l'origine reçue avec le premier `page_viewed`. */
export function origineDeLaVisite(
  meta: Record<string, unknown> | undefined,
  domainesDuProduit: readonly string[],
): OrigineVisite {
  if (!meta) return { ...ORIGINE_VIDE };
  return {
    landingPath: cheminDArrivee(meta['arrivee']),
    utmSource: parametreDeCampagne(meta['utmSource']),
    utmMedium: parametreDeCampagne(meta['utmMedium']),
    utmCampaign: parametreDeCampagne(meta['utmCampaign']),
    referrerHost: domaineReferent(meta['referent'], domainesDuProduit),
  };
}

/** Les domaines du produit, d'après la configuration. Un référent qui en vient est une navigation interne. */
export function domainesDuProduit(env: NodeJS.ProcessEnv = process.env): string[] {
  const domaines = ['namorama.com'];
  for (const url of [env.FRONTEND_URL, env.KEYCLOAK_AUTH_SERVER_URL]) {
    if (!url) continue;
    try {
      domaines.push(new URL(url).hostname.toLowerCase());
    } catch {
      /* variable mal formée : on garde les autres */
    }
  }
  return domaines;
}

// ─── Canaux ──────────────────────────────────────────────────────────────────

export type Canal = 'ia' | 'moteurs' | 'reseaux' | 'autres' | 'direct';

/** Ordre d'affichage par défaut, à volume égal. */
export const CANAUX: readonly Canal[] = ['ia', 'moteurs', 'reseaux', 'autres', 'direct'];

/**
 * Assistants conversationnels. Testés AVANT les moteurs : `gemini.google.com`
 * est un assistant, pas une recherche Google.
 */
const ASSISTANTS = [
  'chatgpt.com', 'chat.openai.com', 'openai.com', 'perplexity.ai', 'claude.ai',
  'gemini.google.com', 'bard.google.com', 'copilot.microsoft.com', 'chat.mistral.ai',
  'mistral.ai', 'deepseek.com', 'grok.com', 'meta.ai', 'you.com', 'poe.com', 'phind.com',
];

const MOTEURS = [
  'bing.com', 'duckduckgo.com', 'qwant.com', 'ecosia.org', 'search.brave.com',
  'startpage.com', 'baidu.com', 'ask.com', 'lilo.org', 'search.yahoo.com',
];

const RESEAUX = [
  'facebook.com', 'fb.com', 'instagram.com', 'linkedin.com', 'lnkd.in', 't.co', 'x.com',
  'twitter.com', 'reddit.com', 'youtube.com', 'youtu.be', 'tiktok.com', 'threads.net',
  'bsky.app', 'producthunt.com', 'news.ycombinator.com', 'quora.com',
];

/**
 * Moteurs présents sous de nombreux suffixes nationaux (`google.fr`,
 * `google.co.uk`). La marque doit être le PREMIER label : `mail.google.com` ou
 * `docs.google.com` ne sont pas des recherches.
 */
const MOTEURS_TOUS_PAYS = ['google', 'yahoo', 'yandex'];
/** Réseaux servis sous un sous-domaine de langue (`fr.pinterest.com`) ou un suffixe national. */
const RESEAUX_TOUS_PAYS = ['pinterest'];

/**
 * Une valeur (source de campagne ou domaine) correspond à un domaine quand elle
 * lui est égale, en est un sous-domaine, ou en est le premier label :
 * `utm_source=chatgpt` vaut `chatgpt.com`, `utm_source=perplexity` vaut
 * `perplexity.ai`. Le premier label ne compte que pour un domaine à deux
 * labels : sinon `chat.openai.com` ferait de `utm_source=chat` un assistant.
 */
function correspond(valeur: string, domaines: readonly string[]): boolean {
  return domaines.some((d) => {
    const labels = d.split('.');
    return valeur === d || valeur.endsWith(`.${d}`) || (labels.length === 2 && valeur === labels[0]);
  });
}

/** `google`, `google.fr`, `www.google.co.uk` — mais pas `mail.google.com`. */
function moteurTousPays(valeur: string): boolean {
  const premier = sansWww(valeur).split('.')[0];
  return MOTEURS_TOUS_PAYS.includes(premier);
}

/** `pinterest`, `pinterest.fr`, `fr.pinterest.com` : la marque, n'importe où sauf en suffixe. */
function reseauTousPays(valeur: string): boolean {
  const labels = sansWww(valeur).split('.');
  return RESEAUX_TOUS_PAYS.some((m) => {
    const i = labels.indexOf(m);
    return i >= 0 && (labels.length === 1 || i < labels.length - 1);
  });
}

function canalDeLaValeur(valeur: string): Exclude<Canal, 'direct'> {
  if (correspond(valeur, ASSISTANTS)) return 'ia';
  if (correspond(valeur, MOTEURS) || moteurTousPays(valeur)) return 'moteurs';
  if (correspond(valeur, RESEAUX) || reseauTousPays(valeur)) return 'reseaux';
  return 'autres';
}

/**
 * Le canal d'une visite. La source de campagne prime sur le référent : un lien
 * qu'on a balisé dit d'où il vient mieux qu'un en-tête que les navigateurs
 * tronquent ou suppriment. Ni l'une ni l'autre : « direct ou inconnu ».
 */
export function canalDe(origine: Pick<OrigineVisite, 'utmSource' | 'referrerHost'>): Canal {
  const source = origine.utmSource?.toLowerCase();
  if (source) return canalDeLaValeur(source);
  const referent = origine.referrerHost?.toLowerCase();
  if (referent) return canalDeLaValeur(referent);
  return 'direct';
}
