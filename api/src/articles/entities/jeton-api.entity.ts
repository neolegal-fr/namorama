import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Jeton d'API de rédaction : ce qui permet à Claude (ou à un script) d'écrire un
 * article sans session Keycloak.
 *
 * La valeur n'est jamais stockée : seule son empreinte SHA-256. 256 bits d'entropie
 * rendent un hachage lent inutile, et la recherche se fait par l'empreinte. Le préfixe
 * sert à reconnaître un jeton dans la liste.
 */
@Entity('jeton_api')
export class JetonApi {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 80 })
  nom: string;

  /** Les premiers caractères de la valeur (`nmr_xxxx`), pour l'affichage. */
  @Column({ length: 12 })
  prefixe: string;

  @Index('IDX_jeton_api_empreinte', { unique: true })
  @Column({ length: 64 })
  empreinte: string;

  /** Seule portée à ce jour. */
  @Column({ length: 20, default: 'articles' })
  portee: string;

  /** `sub` de l'administrateur qui l'a créé. */
  @Column({ length: 64 })
  creePar: string;

  @CreateDateColumn()
  creeLe: Date;

  @Column({ type: 'datetime', nullable: true })
  derniereUtilisation: Date | null;

  @Column({ type: 'datetime', nullable: true })
  revoqueLe: Date | null;
}
