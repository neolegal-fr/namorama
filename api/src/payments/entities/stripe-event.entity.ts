import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

/**
 * Enregistre les sessions/événements Stripe déjà traités
 * pour garantir l'idempotence (webhook + fulfill-session ne créditent pas deux fois).
 */
@Entity()
export class StripeEvent {
  @PrimaryColumn()
  sessionId: string;

  @Column()
  type: string;

  @CreateDateColumn()
  processedAt: Date;
}
