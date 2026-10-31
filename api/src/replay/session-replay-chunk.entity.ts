import { Column, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

/**
 * Un lot d'événements rrweb d'une visite consentante.
 *
 * Une ligne par lot, pas par visite : le navigateur envoie toutes les 3 s ou
 * tous les 200 événements. `segment` change à chaque redémarrage de
 * l'enregistrement dans la même visite (retour de Keycloak, rechargement),
 * `seq` numérote les lots d'un segment. Schéma : `2026-10-31-rejeu-des-sessions.sql`.
 */
@Entity('session_replay_chunk')
@Unique('UQ_session_replay_chunk_lot', ['sessionId', 'segment', 'seq'])
export class SessionReplayChunk {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  /** L'identifiant de visite de `visitor_session` (`nm_sid` côté navigateur). */
  @Column({ type: 'varchar', length: 64 })
  sessionId: string;

  @Column({ type: 'smallint' })
  segment: number;

  @Column({ type: 'int' })
  seq: number;

  /** Horodatage rrweb (ms) du premier événement du lot. */
  @Column({ type: 'bigint' })
  firstTs: string;

  /** Horodatage rrweb (ms) du dernier événement du lot. */
  @Column({ type: 'bigint' })
  lastTs: string;

  @Column({ type: 'int' })
  eventCount: number;

  /** Un message console de niveau `error` figure dans le lot. */
  @Column({ type: 'boolean', default: false })
  hasError: boolean;

  /** Chemin de la page au premier instantané du lot, sans requête ni fragment. */
  @Column({ type: 'varchar', length: 255, nullable: true })
  href: string | null;

  /** Taille compressée de `data` : ce que bornent les plafonds. */
  @Column({ type: 'int' })
  bytes: number;

  /** JSON des événements, gzippé. */
  @Column({ type: 'mediumblob' })
  data: Buffer;

  @Index('IDX_session_replay_chunk_receivedAt')
  @Column({ type: 'datetime' })
  receivedAt: Date;
}
