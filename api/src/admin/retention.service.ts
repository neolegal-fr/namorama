import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { comptesMesures } from './predicats';
import { moisDe } from './indicateurs';

/** Des inscrits qui ont eu le temps de revenir, et ceux qui l'ont fait. */
export interface TauxDeRetour {
  /** Inscrits assez anciens pour que la question se pose (J+N déjà passé). */
  eligibles: number;
  revenus: number;
}

/**
 * Un mois civil d'activité, décomposé.
 *
 * Les quatre flux répondent à la question que le MAU seul masque : relevé le
 * 31/10/2026, 52 actifs sur 30 jours dont 51 inscrits dans la fenêtre. Le MAU
 * montait en ne mesurant que les inscriptions.
 */
export interface MoisActif {
  /** `AAAA-MM`. */
  mois: string;
  actifs: number;
  /** Actifs inscrits ce mois-ci. */
  nouveaux: number;
  /**
   * Actifs ce mois ET le précédent, inscrits avant. `null` le premier mois du
   * journal : le mois précédent n'a pas été mesuré.
   */
  retenus: number | null;
  /** Actifs ce mois, inactifs le précédent, inscrits avant. `null` : idem. */
  reactives: number | null;
  /** Actifs le mois précédent, inactifs ce mois. `null` : idem. */
  perdus: number | null;
  /** Le journal a commencé en cours de mois : ses volumes sont partiels. */
  debutDuJournal: boolean;
  /** Le mois n'est pas terminé. */
  enCours: boolean;
}

/** Une case du triangle : la part d'une cohorte active N mois après son inscription. */
export interface CaseCohorte {
  /** Décalage en mois (1 = le mois qui suit l'inscription). */
  decalage: number;
  /** `AAAA-MM` du mois observé. */
  mois: string;
  actifs: number;
  /** Mois observé pas encore terminé : la case est provisoire. */
  enCours: boolean;
}

/** Les inscrits d'un mois, et ce qu'il en reste les mois suivants. */
export interface CohorteMensuelle {
  /** `AAAA-MM`. */
  mois: string;
  inscrits: number;
  /** Mois suivants déjà commencés, au plus {@link HORIZON_COHORTES} ; les mois à venir sont absents. */
  suivants: CaseCohorte[];
}

export interface AdminRetention {
  /** Premier jour du journal d'activité (`AAAA-MM-JJ`) : les retours se mesurent depuis. */
  journalDepuis: string | null;
  /** Inscrits depuis le début du journal, revenus un autre jour dans les 7 jours. */
  sous7Jours: TauxDeRetour;
  /** Même chose sous 30 jours. */
  sous30Jours: TauxDeRetour;
  /** Un élément par mois civil, du premier mois du journal au mois en cours. */
  mensuel: MoisActif[];
  cohortes: CohorteMensuelle[];
}

/** Mois suivis après l'inscription, dans le triangle. */
export const HORIZON_COHORTES = 5;

/** Un compte actif un mois donné. */
export interface PresenceMensuelle {
  userId: number;
  /** `AAAA-MM` d'activité. */
  mois: string;
  /** `AAAA-MM` de création du compte. */
  cree: string;
}

/** `AAAA-MM` décalé de `n` mois. */
function decaler(mois: string, n: number): string {
  const [a, m] = mois.split('-').map(Number);
  return moisDe(new Date(a, m - 1 + n, 1));
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
 * Indépendant de la période choisie au tableau de bord. Au mois, pas à la
 * semaine : à quelques inscriptions par semaine, chaque case vaudrait 0, 20
 * ou 50 %.
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

    const [taux, presences, inscrits] = await Promise.all([
      this.dataSource.query(
        `SELECT COALESCE(SUM(${RetentionService.eligible(7)}), 0) AS e7,
                COALESCE(SUM(${RetentionService.eligible(7)} AND ${RetentionService.revenuSous(7)}), 0) AS r7,
                COALESCE(SUM(${RetentionService.eligible(30)}), 0) AS e30,
                COALESCE(SUM(${RetentionService.eligible(30)} AND ${RetentionService.revenuSous(30)}), 0) AS r30
           FROM user u WHERE ${cohorte}`,
        [depuis],
      ),
      // Tous les comptes mesurés, anciens compris : la décomposition mensuelle
      // parle des ACTIFS d'un mois, quelle que soit leur date d'inscription.
      this.dataSource.query(
        `SELECT DISTINCT a.userId AS userId,
                DATE_FORMAT(a.day, '%Y-%m') AS mois,
                DATE_FORMAT(u.createdAt, '%Y-%m') AS cree
           FROM user_activity_day a
           INNER JOIN user u ON u.id = a.userId
          WHERE ${comptesMesures()}`,
      ),
      this.dataSource.query(
        `SELECT DATE_FORMAT(u.createdAt, '%Y-%m') AS mois, COUNT(*) AS n
           FROM user u WHERE ${cohorte}
          GROUP BY mois ORDER BY mois`,
        [depuis],
      ),
    ]);

    const t = taux[0] ?? {};
    const n = (v: unknown) => Number(v ?? 0);
    const { mensuel, cohortes } = RetentionService.decomposer(
      presences.map((r: any) => ({ userId: n(r.userId), mois: String(r.mois), cree: String(r.cree) })),
      new Map(inscrits.map((r: any) => [String(r.mois), n(r.n)])),
      journalDepuis,
      moisDe(new Date()),
    );

    return {
      journalDepuis,
      sous7Jours: { eligibles: n(t.e7), revenus: n(t.r7) },
      sous30Jours: { eligibles: n(t.e30), revenus: n(t.r30) },
      mensuel,
      cohortes,
    };
  }

  /**
   * Décomposition mensuelle des actifs et triangle de cohortes.
   *
   * @param presences   un élément par (compte, mois d'activité), comptes mesurés
   * @param inscrits    inscrits par mois, depuis le début du journal
   * @param journalDepuis premier jour du journal (`AAAA-MM-JJ`)
   * @param moisCourant `AAAA-MM` d'aujourd'hui
   */
  static decomposer(
    presences: PresenceMensuelle[],
    inscrits: Map<string, number>,
    journalDepuis: string | null,
    moisCourant: string,
  ): { mensuel: MoisActif[]; cohortes: CohorteMensuelle[] } {
    if (!journalDepuis) return { mensuel: [], cohortes: [] };
    const premierMois = journalDepuis.slice(0, 7);

    const actifsDe = new Map<string, Set<number>>();
    const creeDe = new Map<number, string>();
    for (const p of presences) {
      if (!actifsDe.has(p.mois)) actifsDe.set(p.mois, new Set());
      actifsDe.get(p.mois)!.add(p.userId);
      creeDe.set(p.userId, p.cree);
    }
    const actifs = (mois: string) => actifsDe.get(mois) ?? new Set<number>();

    const mensuel: MoisActif[] = [];
    for (let mois = premierMois; mois <= moisCourant; mois = decaler(mois, 1)) {
      const ici = actifs(mois);
      const premier = mois === premierMois;
      const avant = actifs(decaler(mois, -1));
      let nouveaux = 0, retenus = 0, reactives = 0;
      for (const id of ici) {
        if (creeDe.get(id) === mois) nouveaux++;
        else if (avant.has(id)) retenus++;
        else reactives++;
      }
      let perdus = 0;
      for (const id of avant) if (!ici.has(id)) perdus++;

      mensuel.push({
        mois,
        actifs: ici.size,
        nouveaux,
        retenus: premier ? null : retenus,
        reactives: premier ? null : reactives,
        perdus: premier ? null : perdus,
        debutDuJournal: premier && !journalDepuis.endsWith('-01'),
        enCours: mois === moisCourant,
      });
    }

    const cohortes: CohorteMensuelle[] = [...inscrits.entries()]
      .filter(([mois]) => mois >= premierMois && mois <= moisCourant)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mois, n]) => {
        const membres = new Set([...creeDe.entries()].filter(([, c]) => c === mois).map(([id]) => id));
        const suivants: CaseCohorte[] = [];
        for (let k = 1; k <= HORIZON_COHORTES; k++) {
          const observe = decaler(mois, k);
          if (observe > moisCourant) break;
          let n2 = 0;
          for (const id of actifs(observe)) if (membres.has(id)) n2++;
          suivants.push({ decalage: k, mois: observe, actifs: n2, enCours: observe === moisCourant });
        }
        return { mois, inscrits: n, suivants };
      });

    return { mensuel, cohortes };
  }
}
