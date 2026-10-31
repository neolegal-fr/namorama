/**
 * Lecture du champ « tester un nom » des résultats.
 *
 * Le champ découpait sur les espaces, et chaque morceau partait au registre
 * puis aux favoris. Relevé du 31/10/2026 : un projet affichait en favoris
 * `mon`, `porte`, `choix`, `se`, `sur` à côté de `goldelis` — l'utilisateur
 * avait écrit « mon choix se porte sur goldelis ». Les noms se séparent
 * désormais par des virgules, des points-virgules ou des retours à la ligne ;
 * un nom en deux ou trois mots est collé ; au-delà, c'est une phrase, et rien
 * n'est vérifié.
 */

/** Au-delà, une entrée est une phrase, pas un nom. */
export const MOTS_MAX_PAR_NOM = 3;

export interface NomsSaisis {
  /** Noms normalisés, dédoublonnés, prêts à vérifier. */
  noms: string[];
  /** Entrées refusées parce qu'elles ont la forme d'une phrase. */
  refus: string[];
}

export function lireNomsSaisis(texte: string): NomsSaisis {
  const entrees = String(texte ?? '')
    .split(/[,;\n\r]+/)
    .map((e) => e.trim())
    .filter((e) => e.length > 0);
  const refus = entrees.filter((e) => e.split(/\s+/).length > MOTS_MAX_PAR_NOM);
  if (refus.length) return { noms: [], refus };
  const noms = entrees
    .map((e) => e.toLowerCase().replace(/^\./, '').replace(/\.[a-z]{2,10}$/, '').replace(/\s+/g, ''))
    .filter((n) => n.length > 0);
  return { noms: [...new Set(noms)], refus: [] };
}
