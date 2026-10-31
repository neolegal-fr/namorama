import { json } from 'express';
import type { NextFunction, Request, Response } from 'express';

/**
 * Taille maximale d'un lot du rejeu, JSON non compressé.
 *
 * Mesuré le 31/10/2026 : l'instantané complet d'une page du wizard pèse 700 à
 * 920 ko, feuilles de style comprises — à 1 Mo, une page plus chargée aurait
 * été refusée, et un seul refus arrête l'enregistrement de toute la visite. Ce
 * qui est STOCKÉ est compressé (~10 fois moins) et borné par les plafonds de
 * visite et de jour.
 */
export const LIMITE_CORPS_REJEU = '4mb';

/**
 * Parseur JSON de `POST /replay`, à la limite propre à la route.
 *
 * Renvoie une fonction NOMMÉE `parseurDuRejeu`, jamais le `jsonParser` de
 * body-parser lui-même : Nest ne pose son parseur global que s'il ne trouve
 * aucune couche de ce nom dans la pile Express (`isMiddlewareApplied`). Monté
 * tel quel, celui-ci désactivait le parsage JSON de toutes les autres routes.
 */
export function parseurDuRejeu() {
  // `text/plain` aussi : le navigateur envoie les lots sous ce type, que CORS
  // dispense de requête préalable (OPTIONS). Avec `application/json`, le lot
  // envoyé quand la page part vers Keycloak attendait son OPTIONS et se
  // perdait avec la page — relevé le 31/10/2026, une fois sur deux.
  const parseur = json({ limit: LIMITE_CORPS_REJEU, type: ['application/json', 'text/plain'] });
  return function parseurDuRejeu(req: Request, res: Response, next: NextFunction) {
    parseur(req, res, next);
  };
}
