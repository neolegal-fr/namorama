import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ConfigService } from './config';

export type Availability = 'free' | 'taken' | 'unknown';
export type TrademarkMatch = 'none' | 'exact' | 'similar' | 'unknown';

export interface DomainAvailability {
  extension: string;
  domain: string;
  status: Availability;
}

export interface SocialAvailability {
  platform: string;
  handle: string;
  url: string;
  status: Availability;
  planned?: boolean;
}

/**
 * Distance d'un dépôt au nom cherché. Absent sur les rapports produits avant
 * le 03/09/2026 : l'affichage retombe alors sur « other », qui n'affirme rien.
 */
export type TrademarkProximity = 'exact' | 'normalized' | 'other';

export interface TrademarkHit {
  name: string;
  proximity?: TrademarkProximity;
  classes: number[];
  status?: string;
  collection?: 'FR' | 'EU' | 'WO';
  applicationNumber?: string;
  noticeUrl?: string;
}

export interface TrademarkResult {
  office: 'INPI';
  match: TrademarkMatch;
  hits: TrademarkHit[];
  deepLink: string;
  note?: string;
}

export interface NameQuality {
  score: number; // 0-100
  scores: Record<string, number>; // critère -> note 1-5
  /** Une phrase par critère : pourquoi cette note. */
  comments?: Record<string, string>;
  /** Comment le nom est construit et ce qu'il évoque, en une phrase. */
  origin?: string;
  strengths?: string;
  watchout?: string;
}

/**
 * Ce que la page de rapport sait afficher.
 *
 * Un `BrandReport` complet en est un cas particulier. L'autre cas est la page
 * AVANT achat : on y connaît déjà les domaines et l'analyse du nom — ils ont
 * été collectés pendant la recherche — mais ni les marques ni les réseaux.
 * D'où les champs facultatifs : ils décrivent une page qui se remplit, pas un
 * document amputé.
 */
export interface ReportLike {
  name: string;
  handle: string;
  domains: DomainAvailability[];
  socials?: SocialAvailability[];
  trademark?: TrademarkResult;
  quality?: NameQuality;
  generatedAt?: string;
  disclaimer?: string;
  cached?: boolean;
}

export interface BrandReport {
  name: string;
  handle: string;
  domains: DomainAvailability[];
  socials: SocialAvailability[];
  trademark: TrademarkResult;
  quality?: NameQuality;
  score: number;
  generatedAt: string;
  disclaimer: string;
  /** Jeton de partage public (présent une fois le rapport mémorisé). */
  shareToken?: string;
  /** Présents uniquement sur le rapport de marque (authentifié). */
  remainingCredits?: number;
  emailed?: boolean;
  /** true = rapport déjà généré, renvoyé sans nouveau débit. */
  cached?: boolean;
  /** Crédits réellement débités — 0 sur une actualisation, déjà payée. */
  costCredits?: number;
}

/**
 * Ce que le serveur dit de l'offre pour un nom, AVANT achat. Aucun verdict :
 * seulement de quoi afficher le bon libellé et le bon bouton.
 */
export interface BrandReportOffer {
  deepReport: {
    purchased: boolean;
    priceCredits: number;
  };
  account: { credits: number };
}


/**
 * Synthèse d'un nom déjà vérifié, affichée sur sa carte de résultat.
 * N'existe que pour les noms dont le rapport est acquis.
 */
export interface BrandReportSummary {
  nameKey: string;
  verifiedAt: string | null;
  trademark: 'none' | 'exact' | 'similar' | 'unknown';
  inpiHits: boolean;
  euipoHits: boolean;
  socials: { platform: string; status: 'free' | 'taken' | 'unknown' }[];
  score: number | null;
  /** Crédits réellement débités au moment de l'achat. */
  costCredits: number | null;
  /** Jeton du lien public `/rapport/<jeton>` : la carte copie le lien sans ouvrir le rapport. */
  shareToken?: string | null;
}

/** Coût affiché du rapport de marque (aligné sur BRAND_REPORT_COST côté API). */
export const BRAND_REPORT_COST = 50;

@Injectable({ providedIn: 'root' })
export class BrandReportService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ConfigService);

  private get apiUrl() {
    return `${this.config.apiUrl}/brand-report`;
  }

  /** Aperçu public bridé (domaine phare + quelques réseaux) — pas d'auth. */
  preview(name: string): Observable<BrandReport> {
    return this.http.post<BrandReport>(`${this.apiUrl}/preview`, { name });
  }

  /** Rapport déjà généré pour ce nom (authentifié) — pour éviter un re-débit. */
  /** Synthèses des noms vérifiés — verdicts déjà payés, pour la grille. */
  /** Renvoie par email un rapport déjà acquis. Aucun débit côté serveur. */
  /** `projectId` : un rapport payé par le propriétaire d'un projet partagé est rangé sous lui. */
  sendByMail(name: string, emails: string[], projectId?: string | null): Observable<{ sent: boolean }> {
    return this.http.post<{ sent: boolean }>(`${this.apiUrl}/send`, projectId ? { name, emails, projectId } : { name, emails });
  }

  /*
   * `projectId` sur les lectures : un rapport payé par le propriétaire d'un
   * projet partagé doit être lisible par ses invités. Le rapprochement passe
   * par le PROJET — sans lui, deviner un nom suffirait à lire le rapport d'un
   * inconnu.
   */
  summaries(projectId?: string | null): Observable<{ summaries: BrandReportSummary[] }> {
    return this.http.get<{ summaries: BrandReportSummary[] }>(`${this.apiUrl}/summaries`, {
      params: projectId ? { projectId } : {},
    });
  }

  /** État de l'offre pour un nom : acheté, prix, droit gratuit, solde. Sans verdict. */
  offer(name: string, projectId?: string | null): Observable<BrandReportOffer> {
    return this.http.get<BrandReportOffer>(`${this.apiUrl}/offer`, {
      params: projectId ? { name, projectId } : { name },
    });
  }

  existing(name: string, projectId?: string | null): Observable<{ exists: boolean; report?: BrandReport }> {
    return this.http.get<{ exists: boolean; report?: BrandReport }>(`${this.apiUrl}/existing`, {
      params: projectId ? { name, projectId } : { name },
    });
  }

  /** Noms déjà rapportés par l'utilisateur (pour afficher « Voir le rapport »). */
  mine(projectId?: string | null): Observable<{ names: string[] }> {
    return this.http.get<{ names: string[] }>(`${this.apiUrl}/mine`, {
      params: projectId ? { projectId } : {},
    });
  }

  /** Rapport partagé en lecture seule (public, via jeton). */
  shared(token: string): Observable<BrandReport> {
    return this.http.get<BrandReport>(`${this.apiUrl}/shared/${token}`);
  }

  /** Rapport de marque (authentifié, payant ; le token est ajouté par l'intercepteur). */
  full(
    name: string,
    options?: {
      extensions?: string[];
      emails?: string[];
      force?: boolean;
      /** Projet et public cible : mémorisés AVEC le rapport, pour la relecture et l'email. */
      context?: { description?: string; audience?: { label: string; value: string }[] };
      /**
       * Projet d'où part la demande. Sur un projet PARTAGÉ en écriture, c'est
       * lui qui dit au serveur pour le compte de qui on agit : le rapport est
       * facturé au propriétaire, et rangé chez lui.
       */
      projectId?: string;
    },
  ): Observable<BrandReport> {
    return this.http.post<BrandReport>(this.apiUrl, {
      name,
      ...(options?.extensions ? { extensions: options.extensions } : {}),
      ...(options?.emails?.length ? { emails: options.emails } : {}),
      ...(options?.force ? { force: true } : {}),
      ...(options?.context ? { context: options.context } : {}),
      ...(options?.projectId ? { projectId: options.projectId } : {}),
    });
  }
}
