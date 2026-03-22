import { Entity, Column, PrimaryGeneratedColumn, ManyToOne } from 'typeorm';
import { Project } from './project.entity';

@Entity()
export class DomainSuggestion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  domainName: string; // Le nom sans extension

  @Column({ type: 'json' })
  availability: Record<string, boolean>;

  @Column({ type: 'varchar', length: 10, default: 'neutral' })
  rating: 'liked' | 'disliked' | 'neutral';

  @Column({ nullable: true, type: 'text' })
  analysis: string | null;

  @Column({ nullable: true, default: 'standard' })
  style: string;

  @ManyToOne(() => Project, (project) => project.suggestions, { onDelete: 'CASCADE' })
  project: Project;
}
