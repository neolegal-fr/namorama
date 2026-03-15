import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, OneToMany } from 'typeorm';
import { Project } from '../../projects/entities/project.entity';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  keycloakId: string;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  firstName: string;

  @Column({ nullable: true })
  lastName: string;

  /** Crédits gratuits mensuels (remis à 100 chaque mois via lazy reset) */
  @Column({ default: 100 })
  credits: number;

  /** Crédits achetés en pack (permanents, jamais remis à zéro) */
  @Column({ default: 0 })
  extraCredits: number;

  /** ID client Stripe (créé lors du premier checkout) */
  @Column({ nullable: true })
  stripeCustomerId: string;

  /** Locale préférée (ex: 'fr', 'en'), peuplée depuis le token Keycloak */
  @Column({ nullable: true })
  locale: string;

  /** Dernière date de reset des crédits gratuits (lazy reset mensuel) */
  @Column({ nullable: true, type: 'datetime' })
  lastFreeReset: Date | null;

  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;

  @Column({ nullable: true, type: 'datetime' })
  lastLogin: Date | null;

  @OneToMany('Project', 'user')
  projects: Project[];

  get totalCredits(): number {
    return this.credits + this.extraCredits;
  }
}
