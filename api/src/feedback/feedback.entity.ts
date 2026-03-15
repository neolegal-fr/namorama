import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity()
export class Feedback {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  keycloakId: string;

  @Column({ nullable: true })
  email: string | null;

  @Column({ type: 'text' })
  message: string;

  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;
}
