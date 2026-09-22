import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ModelPrice } from '../common/model-usage/model-price.entity';

export interface NouveauTarif {
  model: string;
  /** `AAAA-MM-JJ`, lu comme un jour civil du fuseau du serveur. */
  effectiveFrom: string;
  inputPerM: number;
  cachedInputPerM?: number | null;
  outputPerM: number;
  perCall?: number | null;
  note?: string | null;
}

export interface TarifDto {
  id: number;
  model: string;
  /** `AAAA-MM-JJ`. */
  effectiveFrom: string;
  inputPerM: number;
  cachedInputPerM: number | null;
  outputPerM: number;
  perCall: number | null;
  note: string | null;
  /** Tarif appliqué aujourd'hui à ce modèle — le dernier dont la date est passée. */
  current: boolean;
}

/**
 * Les tarifs du modèle, tels que l'administration les saisit.
 *
 * Pas de modification : un changement de prix est une ligne de plus, datée, et
 * le passé garde le prix qu'il a payé (cf. `cout-sql.ts`). La suppression
 * existe pour corriger une saisie erronée — elle recalcule alors tous les
 * appels que la ligne couvrait, et l'interface le dit avant.
 */
@Injectable()
export class ModelPricesService {
  constructor(@InjectRepository(ModelPrice) private readonly repo: Repository<ModelPrice>) {}

  private static nombre(v: string | null): number | null {
    return v === null ? null : Number(v);
  }

  private static jour(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  async lister(): Promise<TarifDto[]> {
    const lignes = await this.repo.find({ order: { model: 'ASC', effectiveFrom: 'DESC' } });
    const maintenant = Date.now();
    // Trié par date décroissante : la première ligne déjà en vigueur de chaque
    // modèle est son tarif courant.
    const courants = new Set<number>();
    const vus = new Set<string>();
    for (const l of lignes) {
      if (vus.has(l.model) || new Date(l.effectiveFrom).getTime() > maintenant) continue;
      vus.add(l.model);
      courants.add(l.id);
    }
    return lignes.map((l) => ({
      id: l.id,
      model: l.model,
      effectiveFrom: ModelPricesService.jour(new Date(l.effectiveFrom)),
      inputPerM: Number(l.inputPerM),
      cachedInputPerM: ModelPricesService.nombre(l.cachedInputPerM),
      outputPerM: Number(l.outputPerM),
      perCall: ModelPricesService.nombre(l.perCall),
      note: l.note,
      current: courants.has(l.id),
    }));
  }

  async ajouter(t: NouveauTarif): Promise<TarifDto> {
    const model = t.model.trim();
    // Minuit local : la date d'effet est un jour civil, dans le fuseau où les
    // appels sont datés. `new Date('2026-10-01')` serait minuit UTC, et un
    // serveur à l'heure de Paris l'appliquerait dès la veille à 22 h.
    const effet = new Date(`${t.effectiveFrom}T00:00:00`);
    // Le format a été vérifié, pas le calendrier : « 2026-02-30 » passerait
    // le motif et deviendrait silencieusement le 2 mars.
    if (Number.isNaN(effet.getTime()) || ModelPricesService.jour(effet) !== t.effectiveFrom) {
      throw new BadRequestException(`Date d'effet invalide : ${t.effectiveFrom}`);
    }

    const existe = await this.repo.findOne({ where: { model, effectiveFrom: effet } });
    if (existe) {
      throw new ConflictException(
        `Un tarif ${model} existe déjà au ${ModelPricesService.jour(effet)} : supprimez-le d'abord s'il est erroné.`,
      );
    }

    const outil = model === 'web_search';
    await this.repo.insert({
      model,
      effectiveFrom: effet,
      // Un outil se facture à l'appel, un modèle au token : les champs de
      // l'autre catégorie sont neutralisés plutôt que laissés à l'appréciation
      // de la saisie.
      inputPerM: outil ? '0' : String(t.inputPerM),
      cachedInputPerM: outil || t.cachedInputPerM == null ? null : String(t.cachedInputPerM),
      outputPerM: outil ? '0' : String(t.outputPerM),
      perCall: outil && t.perCall != null ? String(t.perCall) : null,
      note: t.note?.trim() || null,
    });
    const cree = (await this.lister()).find((l) => l.model === model && l.effectiveFrom === ModelPricesService.jour(effet));
    return cree!;
  }

  async supprimer(id: number): Promise<void> {
    const r = await this.repo.delete({ id });
    if (!r.affected) throw new NotFoundException(`Tarif ${id} introuvable`);
  }
}
