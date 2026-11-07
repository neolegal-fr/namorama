import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { BrandReportRecord } from './entities/brand-report-record.entity';
import type { BrandReport } from './dto/brand-report.types';
import type { BrandReportSummary } from './dto/brand-report.types';

/** Persistance des rapports générés (cache par utilisateur + nom). */
@Injectable()
export class BrandReportStore {
  constructor(
    @InjectRepository(BrandReportRecord)
    private readonly repo: Repository<BrandReportRecord>,
  ) {}

  private key(name: string): string {
    return name.trim().toLowerCase();
  }

  /** Rapport déjà généré pour ce (compte, nom), ou `null`. */
  async find(keycloakId: string, name: string): Promise<BrandReport | null> {
    const row = await this.repo.findOne({ where: { keycloakId, nameKey: this.key(name) } });
    return row?.report ?? null;
  }

  /** Clés (noms normalisés) des rapports déjà générés par ce compte. */
  async listNames(keycloakId: string): Promise<string[]> {
    const rows = await this.repo.find({ where: { keycloakId }, select: { nameKey: true } });
    return rows.map((r) => r.nameKey);
  }

  /**
   * Synthèse par nom vérifié, pour la grille de résultats : verdicts de marque
   * et de réseaux, et date de vérification.
   *
   * Ces données sont DÉJÀ PAYÉES — le paywall porte sur la vérification, pas
   * sur sa relecture. N'expose que les noms pour lesquels ce compte a un
   * rapport : un nom non vérifié n'apparaît pas dans la réponse, donc rien ne
   * fuit.
   */
  async listSummaries(keycloakId: string): Promise<BrandReportSummary[]> {
    const rows = await this.repo.find({ where: { keycloakId } });
    return rows.map((r) => {
      const rep = r.report;
      const hits = rep?.trademark?.hits ?? [];
      const has = (c: string) => hits.some((h) => h.collection === c);
      // Un seul `match` couvre les deux offices : on ne l'éclate pas en deux
      // verdicts inventés. Chaque office reprend le verdict global, et le
      // détail des dépôts trouvés indique lequel est concerné.
      const tm = rep?.trademark?.match ?? 'unknown';
      return {
        nameKey: r.nameKey,
        verifiedAt: (rep?.generatedAt as string) ?? r.createdAt?.toISOString?.() ?? null,
        trademark: tm,
        inpiHits: has('FR'),
        euipoHits: has('EU'),
        socials: (rep?.socials ?? []).map((s) => ({ platform: s.platform, status: s.status })),
        score: rep?.score ?? null,
        costCredits: r.costCredits ?? null,
        shareToken: r.shareToken ?? null,
      };
    });
  }

  /** Rapport partagé publiquement via son jeton, ou `null`. */
  async findByToken(token: string): Promise<BrandReport | null> {
    if (!token) return null;
    const row = await this.repo.findOne({ where: { shareToken: token } });
    return row?.report ?? null;
  }

  /**
   * Mémorise (ou met à jour) le rapport pour ce (compte, nom). Garantit un jeton
   * de partage stable, embarqué dans le rapport renvoyé.
   */
  async save(keycloakId: string, name: string, report: BrandReport, costCredits?: number): Promise<void> {
    const nameKey = this.key(name);
    const existing = await this.repo.findOne({ where: { keycloakId, nameKey } });
    const shareToken = existing?.shareToken ?? randomUUID();
    report.shareToken = shareToken;
    if (existing) {
      existing.report = report;
      existing.name = name;
      existing.shareToken = shareToken;
      // Le coût n'est réécrit que s'il est fourni : une régénération forcée
      // redébite et le porte ; une simple mise à jour le laisse intact.
      if (costCredits !== undefined) existing.costCredits = costCredits;
      await this.repo.save(existing);
    } else {
      await this.repo.save(this.repo.create({ keycloakId, nameKey, name, report, shareToken, costCredits: costCredits ?? null }));
    }
  }
}
