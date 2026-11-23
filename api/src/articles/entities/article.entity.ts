import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import type { Segment } from '../compilateur/compilateur';

/** JSON gardé en texte : MariaDB ne garantit pas l'ordre des clés d'une colonne `JSON`. */
const json = <T>() => ({
  to: (v: T) => JSON.stringify(v),
  from: (v: string | null) => (v ? (JSON.parse(v) as T) : ([] as unknown as T)),
});

export type EtatArticle = 'brouillon' | 'publie';

/**
 * Un article du blog (chantier `articles-en-base`).
 *
 * La **source** (Markdown à en-tête, au format des anciens fichiers) est la vérité ;
 * les autres colonnes en sont dérivées à l'enregistrement par le compilateur, pour que
 * la lecture publique ne compile rien. `segments` est exactement ce que rendent les
 * composants du blog.
 *
 * « A paru » = `premiereParution` non nulle et passée. C'est ce qui fige le chemin
 * (adresse indexée) et interdit la suppression.
 */
@Entity('article')
export class Article {
  @PrimaryGeneratedColumn()
  id: number;

  @Index('IDX_article_path', { unique: true })
  @Column({ length: 200 })
  path: string;

  /** `<title>` et `og:title`, sans le suffixe « — Namorama ». */
  @Column({ length: 300 })
  title: string;

  @Column({ length: 500 })
  description: string;

  /** Titre de la carte d'index. */
  @Column({ length: 300 })
  titre: string;

  @Column({ length: 500 })
  extrait: string;

  @Column({ length: 40 })
  categorie: string;

  /** AAAA-MM-JJ. Un article publié paraît ce jour-là, à l'heure de Paris. */
  @Column({ type: 'date' })
  publie: string;

  @Column({ type: 'date' })
  misAJour: string;

  @Column({ type: 'enum', enum: ['brouillon', 'publie'], default: 'brouillon' })
  etat: EtatArticle;

  @Column({ type: 'date', nullable: true })
  premiereParution: string | null;

  @Column({ type: 'mediumtext' })
  source: string;

  /** Titre H1, en HTML en ligne. */
  @Column({ type: 'text' })
  h1: string;

  @Column({ type: 'mediumtext', transformer: json<Segment[]>() })
  segments: Segment[];

  /** Chemins internes cités : sert à refuser la dépublication d'un article cité. */
  @Column({ type: 'text', transformer: json<string[]>() })
  liens: string[];

  /** Temps de lecture, en minutes. */
  @Column({ type: 'smallint' })
  lecture: number;

  /** Numéro de la dernière révision ; l'enregistrement suivant doit le citer. */
  @Column({ default: 1 })
  revision: number;

  @CreateDateColumn()
  creeLe: Date;

  @Column({ type: 'datetime' })
  majLe: Date;

  /** Libellé de l'auteur de la dernière révision (compte ou jeton). */
  @Column({ length: 120 })
  majPar: string;
}
