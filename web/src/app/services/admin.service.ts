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

/** Qui revient, et combien de temps on reste. Voir `AdminRetention` côté API. */
export interface AdminRetention {
  journalDepuis: string | null;
  sous7Jours: TauxDeRetour;
  sous30Jours: TauxDeRetour;
  joursActifs: Tranche[];
  dureeDeVie: { comptes: number; medianeMinutes: number | null; tranches: Tranche[] };
  cohortes: { mois: string; inscrits: number; sous7Jours: TauxDeRetour; sous30Jours: TauxDeRetour }[];
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
  /** `null` = calcul en échec (pas « zéro visiteur »). Voir `PeriodMetrics` côté API. */
  funnel: FunnelMetrics | null;
}

export interface AdminStats {
  period: PeriodMetrics;
  /** Même durée, immédiatement avant la période choisie. */
  previous: PeriodMetrics;
  totalUsers: number;
  totalProjects: number;
  totalSuggestions: number;
  totalBrandReports: number;
  avgSuggestionsPerProject: number;
  avgFavoritesPerProject: number;
  totalFreeCredits: number;
  totalPackCredits: number;
  /** `AAAA-MM-JJ` du premier jour mesuré par le journal d'activité, ou `null`. */
  activityTrackingSince: string | null;
  /**
   * `AAAA-MM-JJ` de la première visite enregistrée, ou `null` si le journal des
   * visites est vide. Avant cette date il n'y a pas « zéro visiteur » : il n'y
   * a pas de mesure, et l'entonnoir ne doit pas afficher 0 %.
   */
  visitTrackingSince: string | null;
}

/** Un point hebdomadaire. `week` est le lundi, au format `AAAA-MM-JJ`. */
export interface WeeklyPoint {
  week: string;
  newUsers: number;
  /** `null` avant le démarrage du journal — un trou dans la courbe, pas un zéro. */
  activeUsers: number | null;
  projects: number;
  creditsConsumed: number;
  /** Visites de la semaine. `null` avant le démarrage du journal des visites. */
  visits: number | null;
}

export interface AdminSeries {
  weeks: WeeklyPoint[];
  activityTrackingSince: string | null;
  visitTrackingSince: string | null;
}

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

  getStats(from?: Date, to?: Date): Observable<AdminStats> {
    let params = new HttpParams();
    if (from) params = params.set('from', from.toISOString());
    if (to) params = params.set('to', to.toISOString());
    return this.http.get<AdminStats>(`${this.base}/stats`, { params });
  }

  /**
   * Historique hebdomadaire. Appel distinct de `getStats` : la série ne dépend
   * pas de la période choisie et n'a donc pas à être rejouée à chaque clic.
   */
  getSeries(weeks = 26): Observable<AdminSeries> {
    return this.http.get<AdminSeries>(`${this.base}/series`, {
      params: new HttpParams().set('weeks', weeks),
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

  deleteUser(userId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/users/${userId}`);
  }
}
