import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Un appel au modèle, et ce qu'il a consommé.
 *
 * On stocke des TOKENS, jamais des montants. Un montant figé ment dès que le
 * tarif change, et ne permet pas de se demander ce qu'aurait coûté un autre
 * modèle ; des tokens multipliés par la table `model_price` répondent aux deux,
 * y compris pour le passé.
 *
 * Une ligne n'est écrite QUE pour un appel réellement parti : une réponse
 * servie depuis un cache (analyse déjà en base, repérage du marché) n'a rien
 * coûté et n'apparaît pas.
 */
@Entity('model_usage')
export class ModelUsage {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Index()
  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;

  /**
   * Compte débité : le `sub` du jeton, ou le propriétaire du projet quand
   * c'est lui qui paie les crédits (projet partagé en écriture).
   *
   * `null` sur les routes publiques de l'étape 1 : l'appel est alors rattaché
   * après coup par `sessionId`, via `visitor_session.keycloakId`.
   */
  @Index()
  @Column({ type: 'varchar', length: 64, nullable: true })
  keycloakId: string | null;

  /** Visite d'origine (`X-Session-Id`). C'est elle qui rattache un appel anonyme à son futur compte. */
  @Index()
  @Column({ type: 'varchar', length: 64, nullable: true })
  sessionId: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  projectId: string | null;

  /** Route qui a déclenché l'appel — distingue une analyse de liste d'une analyse de rapport. */
  @Column({ type: 'varchar', length: 120, nullable: true })
  route: string | null;

  /** Ce que l'appel faisait : `refine`, `analyze`, `competitors`… Voir `OperationModele`. */
  @Column({ type: 'varchar', length: 32 })
  operation: string;

  /** Modèle tel que l'API l'a nommé dans sa réponse (instantané daté compris). */
  @Column({ type: 'varchar', length: 64 })
  model: string;

  /** Tokens d'entrée, cache compris — c'est ainsi qu'OpenAI les compte. */
  @Column({ type: 'int', default: 0 })
  inputTokens: number;

  /** Part de l'entrée servie par le cache de prompt, facturée à part. */
  @Column({ type: 'int', default: 0 })
  cachedInputTokens: number;

  /** Tokens de sortie, raisonnement compris — facturés au même tarif. */
  @Column({ type: 'int', default: 0 })
  outputTokens: number;

  /** Part de la sortie consacrée au raisonnement : invisible, mais payée. */
  @Column({ type: 'int', default: 0 })
  reasoningTokens: number;

  /** Appels à l'outil `web_search` : des frais à l'appel, en plus des tokens. */
  @Column({ type: 'smallint', default: 0 })
  webSearchCalls: number;

  /** Éléments traités par l'appel (noms d'un lot d'analyse) — pour un coût à l'unité. */
  @Column({ type: 'smallint', default: 1 })
  items: number;

  @Column({ type: 'int', default: 0 })
  durationMs: number;
}
