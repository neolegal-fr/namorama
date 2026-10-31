import { BadRequestException } from '@nestjs/common';

/**
 * Retours sur les noms, saisis sous la liste des résultats (chantier
 * `affiner-par-retour-libre`). Ils s'additionnent : au-delà de dix, c'est à
 * l'utilisateur d'en retirer un — on n'en supprime jamais d'office.
 */
export const RETOURS_MAX = 10;
export const RETOUR_MAX_CARACTERES = 200;

/**
 * Valide une liste de retours venue du navigateur : textes non vides, rognés,
 * au plus `RETOURS_MAX` de `RETOUR_MAX_CARACTERES` chacun. Refuse plutôt que
 * de tronquer : un retour coupé changerait de sens sans que personne le voie.
 */
export function lireRetours(valeur: unknown): string[] {
  if (!Array.isArray(valeur)) throw new BadRequestException('Les retours doivent former une liste');
  const retours = valeur.map((r) => {
    if (typeof r !== 'string') throw new BadRequestException('Chaque retour doit être un texte');
    return r.trim();
  }).filter((r) => r.length > 0);
  if (retours.length > RETOURS_MAX) {
    throw new BadRequestException(`Au plus ${RETOURS_MAX} retours : retirez-en un avant d'en ajouter un autre`);
  }
  if (retours.some((r) => r.length > RETOUR_MAX_CARACTERES)) {
    throw new BadRequestException(`Un retour ne peut pas dépasser ${RETOUR_MAX_CARACTERES} caractères`);
  }
  return retours;
}
