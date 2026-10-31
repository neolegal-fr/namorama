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

  /**
   * Porteur du rôle realm `admin`, recopié du token à chaque passage.
   *
   * Le rôle vit dans Keycloak, mais les statistiques se calculent en SQL : sans
   * cette colonne, il faudrait interroger Keycloak pour chaque agrégat. La
   * valeur se resynchronise à chaque appel authentifié, donc un retrait de rôle
   * se propage à la connexion suivante.
   */
  @Column({ default: false })
  isAdmin: boolean;

  /**
   * Compte interne : le vôtre, une démonstration, un test.
   *
   * Écarté de TOUTES les statistiques d'administration, au même titre qu'un
   * compte admin. Contrairement à {@link isAdmin}, qui est recopié du token,
   * celui-ci se coche à la main depuis le tableau admin — rien dans les données
   * ne permet de reconnaître un compte de test. Relevé sur la production :
   * aucun alias `+`, et la majorité des comptes de test partagent le domaine de
   * messagerie des vrais utilisateurs.
   *
   * Le défaut est « mesuré ». Oublier de cocher gonfle les chiffres, ce qui se
   * remarque ; l'inverse les viderait sans bruit.
   */
  @Column({ default: false })
  isInternal: boolean;

  /** Dernière date de reset des crédits gratuits (lazy reset mensuel) */
  @Column({ nullable: true, type: 'datetime' })
  lastFreeReset: Date | null;

  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;

  @Column({ nullable: true, type: 'datetime' })
  lastLogin: Date | null;

  // ─── Demande de retour automatique (migration 2026-11-01-demande-de-retour-automatique) ───

  /** Envoi automatique réservé : posé AVANT l'envoi, il garantit un seul envoi par compte. */
  @Column({ nullable: true, type: 'datetime' })
  demandeRetourAt: Date | null;

  /** Réponse au « Namorama vous a-t-il été utile ? » du courriel. */
  @Column({ nullable: true, type: 'varchar', length: 3 })
  utilite: 'oui' | 'non' | null;

  /** Date de cette réponse : posée une seule fois, c'est le verrou des 100 crédits. */
  @Column({ nullable: true, type: 'datetime' })
  utiliteAt: Date | null;

  /** Désinscrit des demandes de retour, automatiques comme manuelles. */
  @Column({ nullable: true, type: 'datetime' })
  desinscritRetoursAt: Date | null;

  /** Langue du navigateur à la création du compte, parmi les langues traduites. */
  @Column({ nullable: true, type: 'varchar', length: 5 })
  langueInscription: string | null;

  @OneToMany('Project', 'user')
  projects: Project[];

  get totalCredits(): number {
    return this.credits + this.extraCredits;
  }
}
