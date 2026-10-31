import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Un paiement Stripe abouti : qui, quel pack, combien, quand.
 *
 * Distinct de {@link StripeEvent}, qui n'est qu'un verrou d'idempotence écrit
 * avant toute vérification du paiement, pour tout type de session. Ici, une
 * ligne n'existe que pour une session `payment_status = 'paid'` — c'est la
 * seule source du chiffre d'affaires.
 *
 * Montant en centimes, dans la devise de la session : aucune conversion n'est
 * faite ni stockée (un taux figé finirait faux sans que rien ne le signale).
 *
 * Schéma : `api/migrations/2026-10-31-registre-des-paiements.sql`.
 */
@Entity('paiement')
export class Paiement {
  @PrimaryGeneratedColumn()
  id: number;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255 })
  sessionId: string;

  @Index()
  @Column({ type: 'varchar', length: 64 })
  keycloakId: string;

  @Column({ type: 'varchar', length: 32 })
  pack: string;

  @Column({ type: 'int' })
  credits: number;

  @Column({ type: 'int' })
  montantCentimes: number;

  @Column({ type: 'varchar', length: 3 })
  devise: string;

  @Index()
  @Column({ type: 'datetime' })
  payeLe: Date;
}
