/**
 * Calculs des indicateurs du tableau de bord, sans base de données.
 *
 * Les requêtes SQL ramènent des lignes brutes ; tout ce qui décide d'un chiffre
 * affiché — un taux, un seuil, une tranche, une borne de mois — vit ici, où un
 * test peut le vérifier sur les valeurs relevées en production.
 */

/**
 * Sous ce dénominateur, pas de taux : à 1 sur 3, un cas de plus déplace le
 * chiffre de 17 points. L'interface montre alors les valeurs brutes.
 */
export const SOCLE_TAUX = 5;

/**
 * Durée à partir de laquelle une période se lit comme un mois : la carte des
 * actifs s'intitule « MAU », et DAU moyen et DAU/MAU ont un sens. En deçà, un
 * DAU/MAU sur sept jours comparerait un jour à une semaine.
 */
export const FENETRE_MAU_JOURS = 28;

/** `n / d` en %, à une décimale ; `null` sous le socle. */
export function taux(n: number, d: number, socle = SOCLE_TAUX): number | null {
  if (d < socle || d <= 0) return null;
  return Math.round((n / d) * 1000) / 10;
}

/** Une ligne par compte actif sur la fenêtre. */
export interface ActiviteCompte {
  /** Jours distincts d'activité dans la fenêtre. */
  jours: number;
  createdAt: Date;
}

export interface Engagement {
  /** Somme des jours d'activité de tous les comptes actifs. */
  joursActifs: number;
  /** Jours couverts par la mesure (bornés à aujourd'hui). */
  joursMesures: number;
  /** `joursActifs / joursMesures` ; `null` sous {@link FENETRE_MAU_JOURS}. */
  dauMoyen: number | null;
  /** `dauMoyen / actifs` en % ; `null` sous {@link FENETRE_MAU_JOURS} ou sans actif. */
  dauSurMau: number | null;
  /** Répartition des actifs par nombre de jours d'activité. */
  tranches: { unJour: number; deuxATrois: number; quatreEtPlus: number };
  /** Actifs créés pendant la fenêtre. */
  nouveaux: number;
  /** Actifs créés avant la fenêtre. */
  recurrents: number;
}

/**
 * Ce que disent les jours d'activité d'une fenêtre.
 *
 * `nouveaux` et `recurrents` séparent ce que le MAU confond : relevé le
 * 31/10/2026, 51 des 52 comptes actifs sur 30 jours s'y étaient inscrits —
 * le MAU montait en ne mesurant que les inscriptions.
 */
export function engagement(comptes: ActiviteCompte[], debut: Date, joursMesures: number): Engagement {
  const joursActifs = comptes.reduce((s, c) => s + c.jours, 0);
  const mensuel = joursMesures >= FENETRE_MAU_JOURS;
  const dauMoyen = mensuel && joursMesures > 0 ? Math.round((joursActifs / joursMesures) * 10) / 10 : null;
  const exact = joursMesures > 0 ? joursActifs / joursMesures : 0;
  const nouveaux = comptes.filter((c) => c.createdAt.getTime() >= debut.getTime()).length;

  return {
    joursActifs,
    joursMesures,
    dauMoyen,
    dauSurMau: mensuel && comptes.length > 0 ? Math.round((exact / comptes.length) * 1000) / 10 : null,
    tranches: {
      unJour: comptes.filter((c) => c.jours <= 1).length,
      deuxATrois: comptes.filter((c) => c.jours >= 2 && c.jours <= 3).length,
      quatreEtPlus: comptes.filter((c) => c.jours >= 4).length,
    },
    nouveaux,
    recurrents: comptes.length - nouveaux,
  };
}

const MOIS = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** `true` si `mois` est de la forme `AAAA-MM`. */
export function estUnMois(mois: string): boolean {
  return MOIS.test(mois);
}

/**
 * Bornes d'un mois civil à l'heure du processus (Paris en production, cf.
 * « Une seule horloge ») : du 1er à 00:00:00.000 au dernier jour à 23:59:59.999,
 * inclusives comme toutes les bornes des agrégats.
 */
export function bornesDuMois(mois: string): { debut: Date; fin: Date } {
  const m = MOIS.exec(mois);
  if (!m) throw new Error(`Mois invalide : ${mois}`);
  const annee = Number(m[1]);
  const index = Number(m[2]) - 1;
  return {
    debut: new Date(annee, index, 1, 0, 0, 0, 0),
    fin: new Date(new Date(annee, index + 1, 1, 0, 0, 0, 0).getTime() - 1),
  };
}

/** Le mois civil qui précède, `AAAA-MM`. */
export function moisPrecedent(mois: string): string {
  const { debut } = bornesDuMois(mois);
  const d = new Date(debut.getFullYear(), debut.getMonth() - 1, 1);
  return moisDe(d);
}

/** `AAAA-MM` d'une date, à l'heure du processus. */
export function moisDe(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
