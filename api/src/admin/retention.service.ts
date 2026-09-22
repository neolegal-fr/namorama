import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { comptesMesures } from './predicats';

/** Des inscrits qui ont eu le temps de revenir, et ceux qui l'ont fait. */
export interface TauxDeRetour {
  /** Inscrits assez anciens pour que la question se pose (J+N déjà passé). */
  eligibles: number;
  revenus: number;
}

/** Une cohorte mensuelle d'inscrits, et son retour à J+7 et J+30. */
export interface CohorteMensuelle {
  /** `AAAA-MM`. */
  mois: string;
  inscrits: number;
  sous7Jours: TauxDeRetour;
  sous30Jours: TauxDeRetour;
}

export interface Tranche {
  libelle: string;
  comptes: number;
}

export interface AdminRetention {
  /** Premier jour du journal d'activité (`AAAA-MM-JJ`) : les retours se mesurent depuis. */
  journalDepuis: string | null;
  /** Inscrits depuis le début du journal, revenus un autre jour dans les 7 jours. */
  sous7Jours: TauxDeRetour;
  /** Même chose sous 30 jours. */
  sous30Jours: TauxDeRetour;
  /** Jours d'activité distincts par compte, inscrits depuis le début du journal. */
  joursActifs: Tranche[];
  /**
   * Délai entre la création et la dernière activité, sur TOUT l'historique :
   * `lastLogin` existe depuis l'ouverture, là où le journal ne commence qu'en
   * août. Moins fin (seule la dernière activité compte), mais sans trou.
   */
  dureeDeVie: {
    comptes: number;
    /**
     * Médiane en MINUTES. Pas en jours : relevé le 22/09/2026, elle tient en
     * quelques minutes, et « 0,0 jour » effacerait précisément l'information.
     * L'interface choisit l'unité. `null` sans compte.
     */
    medianeMinutes: number | null;
    tranches: Tranche[];
  };
  cohortes: CohorteMensuelle[];
}

/**
 * Qui revient, et combien de temps on reste.
 *
 * « Revenir », c'est avoir une activité (un appel authentifié, cf.
 * `user_activity_day`) un AUTRE jour que celui de l'inscription. Ouvrir
 * l'application avec une session ouverte compte donc déjà : la mesure dit
 * « est revenu », pas « s'en est resservi ».
 *
 * Une règle tient tout le reste : un taux de retour à J+N ne compte que les
 * inscrits dont le J+N est PASSÉ. Un compte créé hier n'a pas « échoué à
 * revenir sous 7 jours » — il n'en a pas encore eu le temps, et le compter
 * ferait baisser le taux à chaque inscription récente.
 *
 * Indépendant de la période choisie au tableau de bord : à quelques
 * inscriptions par semaine, une fenêtre de sept jours ne contiendrait presque
 * jamais de compte assez ancien pour avoir un J+7.
 */
@Injectable()
export class RetentionService {
  constructor(private readonly dataSource: DataSource) {}

  /** « Revenu sous N jours » : une activité entre le lendemain de l'inscription et J+N. */
  private static revenuSous(n: number): string {
    return `EXISTS (SELECT 1 FROM user_activity_day a
                     WHERE a.userId = u.id
                       AND a.day > DATE(u.createdAt)
                       AND a.day <= DATE(u.createdAt) + INTERVAL ${n} DAY)`;
  }

  /** Le J+N de ce compte est passé : la question « est-il revenu sous N jours » a une réponse. */
  private static eligible(n: number): string {
    return `DATE(u.createdAt) + INTERVAL ${n} DAY < CURDATE()`;
  }

  async getRetention(): Promise<AdminRetention> {
    const rows = await this.dataSource.query(
      `SELECT DATE_FORMAT(MIN(day), '%Y-%m-%d') AS d FROM user_activity_day`,
    );
    const journalDepuis: string | null = rows[0]?.d ?? null;

    // Seuls les comptes nés APRÈS le début du journal ont un historique
    // d'activité complet ; un compte plus ancien a pu revenir avant, sans trace.
    const cohorte = `${comptesMesures()} AND u.createdAt >= ?`;
    const depuis = journalDepuis ?? '9999-12-31';

    const [taux, jours, vies, parMois] = await Promise.all([
      this.dataSource.query(
        `SELECT COALESCE(SUM(${RetentionService.eligible(7)}), 0) AS e7,
                COALESCE(SUM(${RetentionService.eligible(7)} AND ${RetentionService.revenuSous(7)}), 0) AS r7,
                COALESCE(SUM(${RetentionService.eligible(30)}), 0) AS e30,
                COALESCE(SUM(${RetentionService.eligible(30)} AND ${RetentionService.revenuSous(30)}), 0) AS r30
           FROM user u WHERE ${cohorte}`,
        [depuis],
      ),
      this.dataSource.query(
        `SELECT n, COUNT(*) AS comptes FROM (
           SELECT u.id, COUNT(a.day) AS n
             FROM user u LEFT JOIN user_activity_day a ON a.userId = u.id
            WHERE ${cohorte}
            GROUP BY u.id) t
          GROUP BY n`,
        [depuis],
      ),
      this.dataSource.query(
        `SELECT TIMESTAMPDIFF(MINUTE, u.createdAt, GREATEST(u.lastLogin, u.createdAt)) AS minutes
           FROM user u
          WHERE ${comptesMesures()} AND u.lastLogin IS NOT NULL`,
      ),
      this.dataSource.query(
        `SELECT DATE_FORMAT(u.createdAt, '%Y-%m') AS mois, COUNT(*) AS inscrits,
                COALESCE(SUM(${RetentionService.eligible(7)}), 0) AS e7,
                COALESCE(SUM(${RetentionService.eligible(7)} AND ${RetentionService.revenuSous(7)}), 0) AS r7,
                COALESCE(SUM(${RetentionService.eligible(30)}), 0) AS e30,
                COALESCE(SUM(${RetentionService.eligible(30)} AND ${RetentionService.revenuSous(30)}), 0) AS r30
           FROM user u WHERE ${cohorte}
          GROUP BY mois ORDER BY mois`,
        [depuis],
      ),
    ]);

    const t = taux[0] ?? {};
    const n = (v: unknown) => Number(v ?? 0);

    return {
      journalDepuis,
      sous7Jours: { eligibles: n(t.e7), revenus: n(t.r7) },
      sous30Jours: { eligibles: n(t.e30), revenus: n(t.r30) },
      joursActifs: RetentionService.tranchesJours(jours.map((r: any) => ({ jours: n(r.n), comptes: n(r.comptes) }))),
      dureeDeVie: RetentionService.dureeDeVie(vies.map((r: any) => n(r.minutes))),
      cohortes: parMois.map((r: any) => ({
        mois: String(r.mois),
        inscrits: n(r.inscrits),
        sous7Jours: { eligibles: n(r.e7), revenus: n(r.r7) },
        sous30Jours: { eligibles: n(r.e30), revenus: n(r.r30) },
      })),
    };
  }

  /**
   * Jours d'activité, en tranches plutôt qu'en moyenne : quand presque tout le
   * monde est à 1, une moyenne à 1,3 ne dit ni combien reviennent, ni combien
   * de fois.
   */
  static tranchesJours(parNombre: { jours: number; comptes: number }[]): Tranche[] {
    const somme = (f: (j: number) => boolean) =>
      parNombre.filter((r) => f(r.jours)).reduce((s, r) => s + r.comptes, 0);
    return [
      // Zéro jour : compte créé, mais le journal ne l'a jamais vu — possible
      // si l'écriture best-effort a échoué. Rangé avec « un seul jour ».
      { libelle: '1 jour', comptes: somme((j) => j <= 1) },
      { libelle: '2 à 3 jours', comptes: somme((j) => j >= 2 && j <= 3) },
      { libelle: '4 à 7 jours', comptes: somme((j) => j >= 4 && j <= 7) },
      { libelle: '8 jours et +', comptes: somme((j) => j >= 8) },
    ];
  }

  static dureeDeVie(minutes: number[]): AdminRetention['dureeDeVie'] {
    const tries = [...minutes].sort((a, b) => a - b);
    const jour = 24 * 60;
    let mediane: number | null = null;
    if (tries.length) {
      const m = tries.length >> 1;
      mediane = Math.round(tries.length % 2 ? tries[m] : (tries[m - 1] + tries[m]) / 2);
    }
    const compte = (f: (min: number) => boolean) => tries.filter(f).length;
    return {
      comptes: tries.length,
      medianeMinutes: mediane,
      tranches: [
        { libelle: 'moins d\'un jour', comptes: compte((x) => x < jour) },
        { libelle: '1 à 6 jours', comptes: compte((x) => x >= jour && x < 7 * jour) },
        { libelle: '7 à 29 jours', comptes: compte((x) => x >= 7 * jour && x < 30 * jour) },
        { libelle: '30 jours et +', comptes: compte((x) => x >= 30 * jour) },
      ],
    };
  }
}
