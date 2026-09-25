import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

/**
 * Un courriel écrit à la main par un administrateur à UN utilisateur.
 *
 * De la correspondance, pas de la prospection : un destinataire à la fois,
 * choisi dans la liste, et un message relu avant de partir. C'est ce qui le
 * dispense d'un consentement marketing — un envoi groupé, lui, en demanderait
 * un, ainsi qu'un lien de désinscription.
 *
 * Gardé en base plutôt que dans les logs (30 jours) : la question « lui a-t-on
 * déjà écrit ? » se pose des mois plus tard, et un second message sur le même
 * sujet se remarque chez celui qui le reçoit.
 */
@Entity('admin_mail')
@Index(['userId', 'createdAt'])
export class AdminMail {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  /** Le `sub` du destinataire : le compte peut être supprimé, l'envoi reste lisible au relevé. */
  @Column()
  keycloakId: string;

  /** Le `sub` de l'administrateur qui a envoyé. */
  @Column()
  adminSub: string;

  @Column({ length: 200 })
  subject: string;

  /** Le texte tel qu'envoyé, avant mise en page. */
  @Column({ type: 'text' })
  body: string;

  /**
   * Parti d'un brouillon du modèle — relu, éventuellement retouché. Dit si la
   * rédaction assistée sert vraiment, ou si on réécrit tout.
   */
  @Column({ default: false })
  aiDrafted: boolean;

  /**
   * Version des consignes qui ont produit le brouillon (`CONSIGNES_VERSION`).
   * Après une amélioration du prompt, dit à qui l'ancienne version a écrit —
   * ceux à qui il peut valoir la peine de réécrire.
   */
  @Column({ type: 'varchar', length: 20, nullable: true })
  promptVersion: string | null;

  /** Le SMTP a accepté le message. Un échec est gardé : on a voulu écrire, et on ne l'a pas fait. */
  @Column()
  delivered: boolean;

  /**
   * La réponse reçue par courriel, saisie depuis l'admin. Elle devient un
   * feedback ordinaire : les crédits promis se valident au même endroit que
   * ceux du formulaire.
   */
  @Column({ type: 'varchar', length: 36, nullable: true })
  feedbackId: string | null;

  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;
}
