import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity()
export class CreditAdjustment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  /** Delta appliqué (positif = ajout, négatif = retrait) */
  @Column()
  delta: number;

  @Column({ nullable: true })
  reason: string;

  /** Keycloak sub de l'admin qui a effectué l'ajustement */
  @Column()
  adminSub: string;

  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;
}
