import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsInt, IsObject, Matches, Max, Min } from 'class-validator';

/** Plafonds d'un lot : bien au-delà de ce que produit le navigateur (200 événements, 10 s). */
export const MAX_EVENEMENTS_PAR_LOT = 5_000;
export const MAX_SEGMENTS = 50;
export const MAX_LOTS_PAR_SEGMENT = 5_000;

/**
 * Un lot envoyé par le navigateur. Le contenu des événements n'est pas validé
 * un à un — c'est le format rrweb, et le serveur ne fait que le stocker — mais
 * leur nombre, comme la taille du corps (`main.ts`), est borné.
 */
export class ReplayChunkDto {
  /** Même format que l'identifiant de visite accepté par `FunnelService`. */
  @Matches(/^[A-Za-z0-9_-]{8,64}$/)
  sessionId: string;

  @IsInt()
  @Min(0)
  @Max(MAX_SEGMENTS)
  segment: number;

  @IsInt()
  @Min(0)
  @Max(MAX_LOTS_PAR_SEGMENT)
  seq: number;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(MAX_EVENEMENTS_PAR_LOT)
  @IsObject({ each: true })
  events: Record<string, unknown>[];
}
