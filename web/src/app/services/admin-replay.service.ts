import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ConfigService } from './config';

export type FiltreRejeu = 'cherche_sans_compte' | 'erreur' | 'tarifs_vus' | 'rapport';

/** Une visite enregistrée, telle que la liste l'affiche (`GET /admin/replays`). */
export interface LigneRejeu {
  sessionId: string;
  /** Horodatage rrweb (ms) du premier événement. */
  debut: number;
  dureeMs: number;
  segments: number;
  lots: number;
  octets: number;
  /** Un message console de niveau `error` a été enregistré. */
  erreur: boolean;
  /** Chemin de la première page enregistrée. */
  entree: string | null;
  recuLe: string;
  connecteAuDepart: boolean;
  recherche: boolean;
  compteCree: boolean;
  rapport: boolean;
  tarifsVus: boolean;
  keycloakId: string | null;
}

export interface PageRejeux {
  total: number;
  lignes: LigneRejeu[];
}

/** Les événements d'une visite, un tableau par segment (`GET /admin/replays/:id`). */
export interface Rejeu {
  sessionId: string;
  segments: Record<string, unknown>[][];
}

@Injectable({ providedIn: 'root' })
export class AdminReplayService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ConfigService);

  private get base() {
    return `${this.config.apiUrl}/admin/replays`;
  }

  lister(options: { filtre?: FiltreRejeu | null; compte?: string | null; page?: number }): Observable<PageRejeux> {
    let params = new HttpParams().set('page', String(options.page ?? 0));
    if (options.filtre) params = params.set('filtre', options.filtre);
    if (options.compte) params = params.set('compte', options.compte);
    return this.http.get<PageRejeux>(this.base, { params });
  }

  /** Comptes (identifiants Keycloak) ayant au moins une visite enregistrée. */
  comptes(): Observable<string[]> {
    return this.http.get<string[]>(`${this.base}/comptes`);
  }

  lire(sessionId: string): Observable<Rejeu> {
    return this.http.get<Rejeu>(`${this.base}/${encodeURIComponent(sessionId)}`);
  }
}
