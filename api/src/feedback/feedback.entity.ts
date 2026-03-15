import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity()
export class Feedback {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', nullable: true })
  keycloakId: string | null;

  /** Email de l'utilisateur Keycloak ou email saisi manuellement */
  @Column({ type: 'varchar', nullable: true })
  email: string | null;

  @Column({ type: 'text' })
  message: string;

  @Column({ default: false })
  creditAwarded: boolean;

  @Column({ default: false })
  rejected: boolean;

  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;
}
