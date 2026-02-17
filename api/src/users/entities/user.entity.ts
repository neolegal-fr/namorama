import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  keycloakId: string;

  @Column({ nullable: true })
  email: string;

  @Column({ default: 10 })
  credits: number;
}
