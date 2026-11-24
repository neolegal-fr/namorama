import { json } from 'express';
import type { NextFunction, Request, Response } from 'express';

/**
 * Taille maximale d'un envoi d'articles.
 *
 * Un article pèse de 3 à 15 ko ; mais l'import envoie tout le blog en un lot (228 ko au
 * 23/11/2026), au-delà des 100 ko par défaut. Les articles se citent en boucle : le lot
 * ne peut pas être découpé sans faire refuser des liens justes.
 */
export const LIMITE_CORPS_ARTICLES = '2mb';

/**
 * Parseur JSON des routes de rédaction, à la limite propre à ces routes.
 *
 * Fonction NOMMÉE, jamais le `jsonParser` de body-parser lui-même : Nest ne pose son
 * parseur global que s'il ne trouve aucune couche de ce nom dans la pile Express — monté
 * tel quel, il désactivait le parsage JSON de toute l'API (voir `parseurDuRejeu`).
 */
export function parseurDesArticles() {
  const parseur = json({ limit: LIMITE_CORPS_ARTICLES });
  return function parseurDesArticles(req: Request, res: Response, next: NextFunction) {
    parseur(req, res, next);
  };
}
