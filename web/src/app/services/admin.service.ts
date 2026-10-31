import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ConfigService } from './config';

export interface AdminUser {
  id: number;
  keycloakId: string;
  email: string;
  firstName: string;
  lastName: string;
  credits: number;
  extraCredits: number;
  totalCredits: number;
  /**
   * Quota du mois dû mais pas encore écrit : le compte n'est pas revenu depuis
   * le 1er. `credits` affiche déjà le quota, que l'utilisateur retrouvera.
   */
  freeCreditsRenewalPending: boolean;
  createdAt: string;
  lastLogin: string | null;
  projectCount: number;
  /** Rapports de marque produits (les demandes bloquées/en échec ne sont visibles que dans les logs). */
  brandReportCount: number;
  /**
   * Compte interne (le vôtre, une démonstration, un test) : écarté de toutes
   * les statistiques. Se coche à la main — rien dans les données ne le trahit.
   */
  isInternal: boolean;
  /**
   * Coût cumulé des appels au modèle imputés au compte, en dollars, au tarif de
   * chaque appel. `null` : aucun appel relevé — pas « zéro dollar ».
   */
  aiCostUsd: number | null;
  /** Appels sans tarif connu, absents de `aiCostUsd`. */
  aiUnpricedCalls: number;
  /** Crédits consommés depuis la création du compte — le dénominateur du coût par crédit. */
  creditsConsumed: number;
  /** Suggestions de ses projets notées 👍 / 👎. */
  likes: number;
  dislikes: number;
  /** Dernier courriel écrit depuis l'admin et remis. */
  lastMailAt: string | null;
  lastMailSubject: string | null;
  lastMailReplied: boolean;
  /** Demande de retour automatique envoyée (ou tentée), 24 h après l'inscription. */
  demandeRetourAt: string | null;
  /** Réponse au « Namorama vous a-t-il été utile ? ». */
  utilite: 'oui' | 'non' | null;
  /** Désinscrit des demandes de retour : plus aucun envoi, même manuel. */
  desinscritRetoursAt: string | null;
}

/** Consommation d'une opération sur un modèle. Voir `LigneConsommation` côté API. */
export interface LigneConsommation {
  operation: string;
  model: string;
  calls: number;
  /** Éléments traités (noms d'un lot d'analyse). */
  items: number;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  webSearchCalls: number;
  /** `null` : aucun tarif connu pour ce modèle. */
  costUsd: number | null;
  unpricedCalls: number;
}

export interface CoutsPeriode {
  from: string;
  to: string;
  costUsd: number;
  calls: number;
  unpricedCalls: number;
  /** Appels sans compte : visiteurs jamais connectés, comptes supprimés. */
  unattributedCostUsd: number;
  accounts: number;
  byOperation: LigneConsommation[];
}

export interface SemaineCouts {
  week: string;
  /** `null` avant le début du relevé : non mesuré, pas gratuit. */
  costUsd: number | null;
  byOperation: Record<string, number>;
}

export interface TarifCourant {
  model: string;
  effectiveFrom: string;
  inputPerM: number;
  cachedInputPerM: number | null;
  outputPerM: number;
}

export interface AdminModelCosts {
  since: string | null;
  period: CoutsPeriode;
  previous: CoutsPeriode;
  weeks: SemaineCouts[];
  prices: TarifCourant[];
  webSearchPerCall: number | null;
}

/** Un courriel écrit depuis l'administration à un utilisateur. */
export interface AdminMail {
  id: number;
  userId: number;
  subject: string;
  body: string;
  aiDrafted: boolean;
  /** Version des consignes du brouillon de départ ; `null` pour un texte écrit à la main. */
  promptVersion: string | null;
  /** Le SMTP l'a accepté. */
  delivered: boolean;
  /** La réponse reçue par courriel, enregistrée comme feedback. */
  feedbackId: string | null;
  createdAt: string;
}

export interface BrouillonMail {
  subject: string;
  body: string;
  promptVersion: string;
  /** Contrôles mécaniques : liens et promesse bien recopiés. */
  avertissements: string[];
}

export interface UserModelCosts {
  keycloakId: string;
  since: string | null;
  costUsd: number;
  calls: number;
  unpricedCalls: number;
  byOperation: LigneConsommation[];
  weeks: SemaineCouts[];
}

/** Un tarif du modèle. Voir `TarifDto` côté API. */
export interface TarifModele {
  id: number;
  model: string;
  /** `AAAA-MM-JJ`. */
  effectiveFrom: string;
  inputPerM: number;
  cachedInputPerM: number | null;
  outputPerM: number;
  /** Pour un outil (`web_search`) : $ par appel. */
  perCall: number | null;
  note: string | null;
  /** Tarif appliqué aujourd'hui à ce modèle. */
  current: boolean;
}

export interface NouveauTarif {
  model: string;
  effectiveFrom: string;
  inputPerM: number;
  cachedInputPerM: number | null;
  outputPerM: number;
  perCall: number | null;
  note: string;
}

/** Des inscrits qui ont eu le temps de revenir (J+N passé), et ceux qui l'ont fait. */
export interface TauxDeRetour {
  eligibles: number;
  revenus: number;
}

export interface Tranche {
  libelle: string;
  comptes: number;
}

/** Un mois civil d'activité, décomposé. Voir `MoisActif` côté API. */
export interface MoisActif {
  /** `AAAA-MM`. */
  mois: string;
  actifs: number;
  nouveaux: number;
  /** `null` le premier mois du journal : le mois précédent n'a pas été mesuré. */
  retenus: number | null;
  reactives: number | null;
  perdus: number | null;
  /** Le journal a commencé en cours de mois. */
  debutDuJournal: boolean;
  enCours: boolean;
}

/** Une case du triangle de cohortes. */
export interface CaseCohorte {
  decalage: number;
  mois: string;
  actifs: number;
  enCours: boolean;
}

/** Qui revient, et combien de temps on reste. Voir `AdminRetention` côté API. */
export interface AdminRetention {
  journalDepuis: string | null;
  sous7Jours: TauxDeRetour;
  sous30Jours: TauxDeRetour;
  mensuel: MoisActif[];
  cohortes: { mois: string; inscrits: number; suivants: CaseCohorte[] }[];
}

export interface FeedbackItem {
  id: string;
  keycloakId: string | null;
  email: string | null;
  message: string;
  creditAwarded: boolean;
  rejected: boolean;
  createdAt: string;
}

/**
 * L'entonnoir d'une fenêtre, en volumétrie brute. Voir `FunnelMetrics` côté API.
 *
 * Les taux se calculent ici, à l'affichage : deux dénominateurs coexistent, et
 * seul l'écran sait lequel il montre. Une visite arrivée avec un compte ouvert
 * ne pouvait pas en créer un — la rapporter au total diluerait l'inscription.
 */
export interface FunnelMetrics {
  visits: number;
  /** Visites arrivées SANS compte ouvert — dénominateur de l'étape « inscription ». */
  visitsAnonymous: number;
  searched: number;
  accountsCreated: number;
  /** Demandes de rapport, refus faute de crédits compris : c'est l'intention qu'on compte. */
  reportsRequested: number;
  /** Visites rattachées à un compte encore existant — dénominateur de la fidélité. */
  visitsIdentified: number;
  /** Parmi elles, celles dont le compte existait déjà au début de la fenêtre. */
  visitsReturning: number;
  /** Visites ayant ouvert le dialogue des packs — la « page tarifs ». */
  pricingViewed: number;
  /** Visites ayant lancé un paiement Stripe, abouti ou non. */
  checkoutStarted: number;
}

/** Ce qu'on mesure sur une fenêtre. Voir `PeriodMetrics` côté API. */
export interface PeriodMetrics {
  from: string;
  to: string;
  /** `null` = non mesurable sur cette fenêtre, PAS zéro. */
  activeUsers: number | null;
  newUsers: number;
  newProjects: number;
  suggestions: number;
  brandReports: number;
  creditsConsumed: number;
  activatedUsers: number;
  /** En %, ou `null` si personne ne s'est inscrit sur la fenêtre. */
  activationRate: number | null;
  /** 👍 / 👎 sur les suggestions générées dans la fenêtre. Voir `PeriodMetrics` côté API. */
  likes: number;
  dislikes: number;
  /** Comptes dont les projets portent ces notes — un seul compte peut faire le taux. */
  ratingAccounts: number;
  /** `null` = calcul en échec (pas « zéro visiteur »). Voir `PeriodMetrics` côté API. */
  funnel: FunnelMetrics | null;
  /** `null` quand le journal d'activité ne couvre pas toute la fenêtre. */
  engagement: Engagement | null;
  succes: SuccesMetrics;
  /** `null` : registre des paiements indisponible — pas « 0 € ». */
  revenu: RevenuMetrics | null;
}

/** Fréquence d'usage des comptes actifs. Voir `Engagement` côté API. */
export interface Engagement {
  joursActifs: number;
  joursMesures: number;
  /** `null` sous 28 jours. */
  dauMoyen: number | null;
  /** En % ; `null` sous 28 jours. */
  dauSurMau: number | null;
  tranches: { unJour: number; deuxATrois: number; quatreEtPlus: number };
  nouveaux: number;
  recurrents: number;
}

/** Projets de la fenêtre et ceux qui portent un favori. Voir `SuccesMetrics` côté API. */
export interface SuccesMetrics {
  projets: number;
  projetsReussis: number;
  comptesAvecProjet: number;
  comptesMultiProjets: number;
  /** `null` : requête en échec. */
  retoursEcrits: number | null;
}

/** Chiffre d'affaires d'une fenêtre. Montants en centimes, par devise. */
export interface RevenuMetrics {
  parDevise: { devise: string; centimes: number }[];
  paiements: number;
  payants: number;
}

export interface AdminStats {
  period: PeriodMetrics;
  /** Mois civil précédent pour un mois, même durée immédiatement avant sinon. */
  previous: PeriodMetrics;
  /** `AAAA-MM` quand la période est un mois civil. */
  month: string | null;
  /** Comptes mesurés, tous temps. */
  totalUsers: number;
  /** Comptes mesurés ayant payé au moins une fois ; `null` : registre indisponible. */
  payingUsersEver: number | null;
  /** `AAAA-MM-JJ` du premier jour mesuré par le journal d'activité, ou `null`. */
  activityTrackingSince: string | null;
  /**
   * `AAAA-MM-JJ` de la première visite enregistrée, ou `null` si le journal des
   * visites est vide. Avant cette date il n'y a pas « zéro visiteur » : il n'y
   * a pas de mesure, et l'entonnoir ne doit pas afficher 0 %.
   */
  visitTrackingSince: string | null;
  /** `AAAA-MM-JJ` : avant ce jour, les ouvertures du dialogue des packs ne sont pas connues. */
  pricingTrackingSince: string;
}

/** Un point mensuel. `month` au format `AAAA-MM`. Voir `MonthlyPoint` côté API. */
export interface MonthlyPoint {
  month: string;
  /** Mois en cours : estompé, exclu des moyennes. */
  current: boolean;
  newUsers: number;
  /** `null` avant le journal d'activité. */
  active: MoisActif | null;
  /** `null` : registre indisponible. */
  revenue: { devise: string; centimes: number }[] | null;
  /** `null` avant le relevé : non mesuré, pas gratuit. */
  aiCostUsd: number | null;
  aiCostPartial: boolean;
}

export interface AdminSeries {
  months: MonthlyPoint[];
  activityTrackingSince: string | null;
  aiCostTrackingSince: string | null;
}

/**
 * Une période du tableau de bord : fenêtre glissante, mois civil ou plage libre.
 * C'est elle que l'URL porte, et que partagent le tableau de bord et Coûts IA.
 */
export type PeriodeAdmin =
  | { type: 'glissante'; jours: 7 | 30 }
  | { type: 'mois'; mois: string }
  | { type: 'plage'; du: string; au: string };

@Injectable({ providedIn: 'root' })
export class AdminService {
  private get base() { return `${this.config.apiUrl}/admin`; }

  constructor(private http: HttpClient, private config: ConfigService) {}

  getUsers(
    page: number,
    limit: number,
    search: string,
    sort = 'createdAt',
    dir: 'ASC' | 'DESC' = 'DESC',
  ): Observable<{ data: AdminUser[]; total: number }> {
    // Le tri est fait par le SERVEUR : la liste est paginée, trier les vingt
    // lignes affichées donnerait « le plus récemment actif de cette page-ci »,
    // ce qui n'est pas la question qu'on pose au tableau.
    const params = new HttpParams()
      .set('page', page)
      .set('limit', limit)
      .set('search', search)
      .set('sort', sort)
      .set('dir', dir);
    return this.http.get<{ data: AdminUser[]; total: number }>(`${this.base}/users`, { params });
  }

  adjustCredits(userId: number, delta: number, reason: string): Observable<AdminUser> {
    return this.http.patch<AdminUser>(`${this.base}/users/${userId}/credits`, { delta, reason });
  }

  /** Indicateurs d'une période : un mois civil passe par `month`, le reste par `from`/`to`. */
  getStats(from?: Date, to?: Date, month?: string): Observable<AdminStats> {
    let params = new HttpParams();
    if (month) params = params.set('month', month);
    else {
      if (from) params = params.set('from', from.toISOString());
      if (to) params = params.set('to', to.toISOString());
    }
    return this.http.get<AdminStats>(`${this.base}/stats`, { params });
  }

  /**
   * Historique mensuel. Appel distinct de `getStats` : la série ne dépend
   * pas de la période choisie et n'a donc pas à être rejouée à chaque clic.
   */
  getSeries(months = 12): Observable<AdminSeries> {
    return this.http.get<AdminSeries>(`${this.base}/series`, {
      params: new HttpParams().set('months', months),
    });
  }

  /**
   * Coût des appels au modèle sur la période, comparé à la précédente, avec la
   * série hebdomadaire et les tarifs courants. Appel distinct de `getStats` :
   * il peut échouer seul sans vider le reste du tableau de bord.
   */
  getModelCosts(from?: Date, to?: Date, weeks = 26): Observable<AdminModelCosts> {
    let params = new HttpParams().set('weeks', weeks);
    if (from) params = params.set('from', from.toISOString());
    if (to) params = params.set('to', to.toISOString());
    return this.http.get<AdminModelCosts>(`${this.base}/model-costs`, { params });
  }

  getUserModelCosts(userId: number): Observable<UserModelCosts> {
    return this.http.get<UserModelCosts>(`${this.base}/users/${userId}/model-costs`);
  }

  getModelPrices(): Observable<TarifModele[]> {
    return this.http.get<TarifModele[]>(`${this.base}/model-prices`);
  }

  addModelPrice(t: NouveauTarif): Observable<TarifModele> {
    return this.http.post<TarifModele>(`${this.base}/model-prices`, t);
  }

  deleteModelPrice(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/model-prices/${id}`);
  }

  /** Indépendant de la période choisie : chargé une fois, comme l'historique. */
  getRetention(): Observable<AdminRetention> {
    return this.http.get<AdminRetention>(`${this.base}/retention`);
  }

  getFeedback(): Observable<FeedbackItem[]> {
    return this.http.get<FeedbackItem[]>(`${this.base}/feedback`);
  }

  awardFeedbackCredits(feedbackId: string): Observable<FeedbackItem> {
    return this.http.post<FeedbackItem>(`${this.base}/feedback/${feedbackId}/award-credits`, {});
  }

  rejectFeedback(feedbackId: string): Observable<FeedbackItem> {
    return this.http.post<FeedbackItem>(`${this.base}/feedback/${feedbackId}/reject`, {});
  }

  deleteFeedback(feedbackId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/feedback/${feedbackId}`);
  }

  /**
   * Marque un compte comme interne, ou l'en retire.
   *
   * L'état voulu est envoyé EXPLICITEMENT plutôt qu'une bascule : deux clics
   * rapides, ou deux onglets ouverts, laisseraient sinon le compte dans l'état
   * inverse de celui qu'on voit à l'écran.
   */
  setInternal(userId: number, internal: boolean): Observable<AdminUser> {
    return this.http.patch<AdminUser>(`${this.base}/users/${userId}/internal`, { internal });
  }

  getUserMails(userId: number): Observable<AdminMail[]> {
    return this.http.get<AdminMail[]>(`${this.base}/users/${userId}/mails`);
  }

  /** Brouillon rédigé par le modèle : rien n'est envoyé. */
  draftUserMail(userId: number, note?: string): Observable<BrouillonMail> {
    return this.http.post<BrouillonMail>(`${this.base}/users/${userId}/mails/draft`, { note });
  }

  sendUserMail(userId: number, mail: { subject: string; body: string; promptVersion: string | null }): Observable<AdminMail> {
    return this.http.post<AdminMail>(`${this.base}/users/${userId}/mails`, mail);
  }

  /** La réponse reçue par courriel devient un feedback, à valider dans l'onglet Feedbacks. */
  recordMailReply(mailId: number, message: string): Observable<AdminMail> {
    return this.http.post<AdminMail>(`${this.base}/mails/${mailId}/reply`, { message });
  }

  deleteUser(userId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/users/${userId}`);
  }
}
