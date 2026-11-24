import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type TypeAuteur = 'compte' | 'jeton';

/**
 * Une version d'un article. Remplace l'historique Git des anciens fichiers : chaque
 * enregistrement qui modifie l'article en écrit une, avec la source complète — 228 Ko
 * pour tout le blog au 23/11/2026, un diff n'aurait rien fait gagner.
 */
@Entity('article_revision')
@Index('IDX_article_revision_numero', ['articleId', 'numero'], { unique: true })
export class ArticleRevision {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  articleId: number;

  @Column()
  numero: number;

  @Column({ type: 'mediumtext' })
  source: string;

  @Column({ type: 'enum', enum: ['compte', 'jeton'] })
  auteurType: TypeAuteur;

  /** `sub` Keycloak, ou identifiant du jeton. */
  @Column({ length: 64 })
  auteurId: string;

  /** Nom lisible : adresse du compte ou nom du jeton, au moment de l'écriture. */
  @Column({ length: 120 })
  auteurNom: string;

  @CreateDateColumn()
  creeLe: Date;
}
