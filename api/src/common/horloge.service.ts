import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppLoggerService } from './logging/app-logger.service';

/**
 * Vérifie au démarrage que l'API et la base ont la même heure.
 *
 * Les dates de ce produit viennent de deux sources : la base (`CURRENT_TIMESTAMP`,
 * `NOW()`) et l'API (`new Date()`, que le pilote sérialise dans le fuseau du
 * processus). Si les deux fuseaux divergent, chaque table mêle deux horloges
 * sans que rien ne casse : les dates restent plausibles, elles sont
 * simplement fausses. C'est arrivé — conteneur en UTC, base à l'heure de
 * Paris, jusqu'au 22/09/2026.
 *
 * Ne bloque pas le démarrage : l'écart se corrige par la configuration (`TZ`),
 * et un service indisponible coûterait plus qu'une date décalée. Il le dit, en
 * `error`, là où `python3 - errors` le verra.
 */
@Injectable()
export class HorlogeService implements OnApplicationBootstrap {
  constructor(
    private readonly dataSource: DataSource,
    private readonly logger: AppLoggerService,
  ) {}

  /** Écart base − UTC, et processus − UTC, en minutes. */
  static ecart(decalageBaseMin: number, maintenant = new Date()): number {
    const decalageProcessus = -maintenant.getTimezoneOffset();
    return decalageBaseMin - decalageProcessus;
  }

  async onApplicationBootstrap(): Promise<void> {
    try {
      const rows = await this.dataSource.query(
        `SELECT TIMESTAMPDIFF(MINUTE, UTC_TIMESTAMP(), NOW()) AS decalage`,
      );
      const decalageBase = Math.round(Number(rows[0]?.decalage ?? 0) / 15) * 15;
      const ecart = HorlogeService.ecart(decalageBase);
      if (ecart !== 0) {
        this.logger.error(
          `Horloges en désaccord : la base est à UTC${decalageBase >= 0 ? '+' : ''}${decalageBase / 60} h, `
            + `l'API à UTC${-new Date().getTimezoneOffset() >= 0 ? '+' : ''}${-new Date().getTimezoneOffset() / 60} h `
            + `(TZ=${process.env.TZ ?? 'non défini'}). Les dates écrites par l'API et celles écrites par la base `
            + 'ne seront pas comparables. Aligner TZ sur le fuseau de la base.',
          undefined,
          HorlogeService.name,
        );
      }
    } catch (e) {
      this.logger.warn(`Horloge de la base non vérifiée : ${e}`, HorlogeService.name);
    }
  }
}
