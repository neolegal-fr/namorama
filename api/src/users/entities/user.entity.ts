import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  keycloakId: string;

  @Column({ nullable: true })
  email: string;

  /** Crédits issus de l'abonnement mensuel (remis à zéro à chaque renouvellement) */
  @Column({ default: 100 })
  credits: number;

  /** Crédits achetés en extra (permanents, jamais remis à zéro) */
  @Column({ default: 0 })
  extraCredits: number;

  /** ID client Stripe (créé lors du premier checkout) */
  @Column({ nullable: true })
  stripeCustomerId: string;

  /** ID abonnement Stripe actif */
  @Column({ nullable: true })
  stripeSubscriptionId: string;

  /** Date de fin de la période d'abonnement en cours (mise à jour par webhook invoice.paid) */
  @Column({ nullable: true, type: 'datetime' })
  subscriptionCurrentPeriodEnd: Date | null;

  /** Date à laquelle l'abonnement sera annulé (cancel_at_period_end) ; null si actif normalement */
  @Column({ nullable: true, type: 'datetime' })
  subscriptionCancelledAt: Date | null;

  get totalCredits(): number {
    return this.credits + this.extraCredits;
  }
}
