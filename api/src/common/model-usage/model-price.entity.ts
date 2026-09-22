import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Tarif d'un modèle, à partir d'une date.
 *
 * Un changement de prix est une LIGNE DE PLUS, jamais une mise à jour : le
 * coût d'un appel se calcule au tarif en vigueur le jour où il est parti, et
 * réécrire un tarif réécrirait l'historique.
 *
 * `model` est un PRÉFIXE : `gpt-5.6-luna` couvre `gpt-5.6-luna-2026-07-01`,
 * l'instantané daté que l'API renvoie dans sa réponse. Le préfixe le plus long
 * l'emporte. La ligne `web_search` porte les frais d'outil, à l'appel.
 *
 * Montants en DOLLARS, la devise de la facture OpenAI.
 */
@Entity('model_price')
@Index(['model', 'effectiveFrom'], { unique: true })
export class ModelPrice {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 64 })
  model: string;

  @Column({ type: 'datetime' })
  effectiveFrom: Date;

  /** $ par million de tokens d'entrée. */
  @Column({ type: 'decimal', precision: 10, scale: 4, default: 0 })
  inputPerM: string;

  /** $ par million de tokens d'entrée servis par le cache. `null` ⇒ tarif plein, par prudence. */
  @Column({ type: 'decimal', precision: 10, scale: 4, nullable: true })
  cachedInputPerM: string | null;

  /** $ par million de tokens de sortie (raisonnement compris). */
  @Column({ type: 'decimal', precision: 10, scale: 4, default: 0 })
  outputPerM: string;

  /** $ par appel — pour un outil (`web_search`), pas pour un modèle. */
  @Column({ type: 'decimal', precision: 10, scale: 4, nullable: true })
  perCall: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  note: string | null;
}
