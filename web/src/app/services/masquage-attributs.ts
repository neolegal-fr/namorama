/**
 * Masquage des ATTRIBUTS des nœuds privés, que rrweb ne fait pas.
 *
 * rrweb masque le texte sous `maskTextClass` et les saisies, jamais les
 * attributs. Or des composants en recopient : relevé le 31/10/2026, la puce
 * PrimeNG d'un mot-clé (`p-chip`, classe `nm-prive`) porte son libellé en
 * `aria-label` — le mot-clé tapé partait en clair dans le lot.
 *
 * On suit donc les identifiants des nœuds sous `nm-prive` (dans l'instantané
 * complet et au fil des ajouts), et l'on remplace, dans chaque événement avant
 * envoi, les attributs porteurs de texte de ces nœuds par des étoiles de même
 * longueur — comme rrweb le fait pour le texte.
 */

/** Attributs qui peuvent porter un texte saisi ou une adresse. */
const ATTRIBUTS_TEXTUELS = ['aria-label', 'title', 'alt', 'value', 'label', 'aria-description', 'data-label'];

/** Types rrweb : événement 2 = instantané complet, 3 = incrémental ; source 0 = mutation. Nœud 2 = élément. */
const INSTANTANE_COMPLET = 2;
const INCREMENTAL = 3;
const SOURCE_MUTATION = 0;
const NOEUD_ELEMENT = 2;

interface NoeudSerialise {
  type?: number;
  id?: number;
  attributes?: Record<string, unknown>;
  childNodes?: NoeudSerialise[];
}

const etoiles = (v: unknown) => (typeof v === 'string' ? '*'.repeat(v.length) : v);

function estPrive(n: NoeudSerialise, classe: string): boolean {
  const c = n.attributes?.['class'];
  return typeof c === 'string' && c.split(/\s+/).includes(classe);
}

function masquer(attributs: Record<string, unknown> | undefined): void {
  if (!attributs) return;
  for (const a of ATTRIBUTS_TEXTUELS) {
    if (a in attributs && attributs[a] !== null) attributs[a] = etoiles(attributs[a]);
  }
}

/** Parcourt un arbre sérialisé : note les nœuds privés et masque leurs attributs. */
function parcourir(n: NoeudSerialise | undefined, herite: boolean, prives: Set<number>, classe: string): void {
  if (!n) return;
  const prive = herite || (n.type === NOEUD_ELEMENT && estPrive(n, classe));
  if (prive) {
    if (typeof n.id === 'number') prives.add(n.id);
    if (n.type === NOEUD_ELEMENT) masquer(n.attributes);
  }
  for (const enfant of n.childNodes ?? []) parcourir(enfant, prive, prives, classe);
}

/**
 * Masque, EN PLACE, les attributs textuels des nœuds privés d'un événement rrweb,
 * et tient à jour `prives` (identifiants des nœuds sous la classe privée).
 */
export function masquerLesAttributs(evenement: unknown, prives: Set<number>, classe: string): void {
  const e = evenement as { type?: number; data?: any };
  if (!e || typeof e !== 'object') return;

  if (e.type === INSTANTANE_COMPLET) {
    prives.clear(); // un nouvel instantané renumérote tout
    parcourir(e.data?.node, false, prives, classe);
    return;
  }

  if (e.type !== INCREMENTAL || e.data?.source !== SOURCE_MUTATION) return;

  for (const ajout of e.data.adds ?? []) {
    parcourir(ajout?.node, prives.has(ajout?.parentId), prives, classe);
  }
  for (const modif of e.data.attributes ?? []) {
    const devientPrive = typeof modif?.attributes?.['class'] === 'string'
      && modif.attributes['class'].split(/\s+/).includes(classe);
    if (devientPrive && typeof modif.id === 'number') prives.add(modif.id);
    if (prives.has(modif?.id)) masquer(modif.attributes);
  }
}
