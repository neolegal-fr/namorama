import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ConfigService } from './config';
import { AnalyticsService } from './analytics';

/** Contraintes de naming extraites du brief libre par l'IA. */
export interface NamingConstraints {
  minLength: number;
  maxLength: number;
  avoidWords: string[];
  referenceBrands: string[];
}

/** Produit existant du même secteur, avec son domaine. */
export interface CompetitorDomain {
  name: string;
  domain: string;
  note: string;
}

/** Résultat du repérage marché — `source` indique si la liste vient d'une recherche web live. */
export interface CompetitorsResult {
  competitors: CompetitorDomain[];
  source: 'web' | 'model';
}

@Injectable({
  providedIn: 'root'
})
export class DomainService {
  private get apiUrl() { return `${this.config.apiUrl}/domain`; }

  private readonly analytics = inject(AnalyticsService);

  constructor(private http: HttpClient, private config: ConfigService) {}

  refineDescription(description: string): Observable<{ refined: string }> {
    return this.http.post<{ refined: string }>(`${this.apiUrl}/refine`, { description });
  }

  suggestProjectName(description: string): Observable<{ suggestedName: string }> {
    return this.http.post<{ suggestedName: string }>(`${this.apiUrl}/suggest-name`, { description });
  }

  generateKeywords(description: string, locale?: string | null): Observable<{ keywords: string[] }> {
    return this.http.post<{ keywords: string[] }>(`${this.apiUrl}/keywords`, { description, ...(locale ? { locale } : {}) });
  }

  /** Contraintes de naming devinées depuis la description (longueur, mots à éviter…). */
  extractConstraints(description: string): Observable<NamingConstraints> {
    return this.http.post<NamingConstraints>(`${this.apiUrl}/constraints`, { description });
  }

  /** Produits existants du même secteur et leurs domaines (repères avant la recherche). */
  findCompetitors(description: string, locale?: string | null): Observable<CompetitorsResult> {
    return this.http.post<CompetitorsResult>(`${this.apiUrl}/competitors`, { description, ...(locale ? { locale } : {}) });
  }

  /**
   * Note plusieurs noms en UNE requête, et donc un seul appel au modèle.
   *
   * Un nom absent de `analyses` n'a pas été noté — suggestion inconnue, hors
   * des droits, ou sautée par le modèle. L'appelant laisse alors la carte sur
   * son bouton « Analyser » : pas de note inventée côté navigateur, elle se
   * lirait comme une vraie.
   */
  analyzeNames(suggestionIds: string[], lang?: string): Observable<{ analyses: Record<string, string> }> {
    return this.http.post<{ analyses: Record<string, string> }>(`${this.apiUrl}/analyze`, { suggestionIds, lang });
  }

  pickBest(suggestions: { name: string; analysis: string | null; extensions: Record<string, any> }[], lang: string): Observable<{ recommended: string; reason: string }> {
    return this.http.post<{ recommended: string; reason: string }>(`${this.apiUrl}/pick-best`, { suggestions, lang });
  }

  recheckDomains(names: string[], extensions: string[]): Observable<{ domains: { name: string; allExtensions: Record<string, boolean | null> }[] }> {
    return this.http.post<any>(`${this.apiUrl}/recheck`, { names, extensions });
  }

  searchDomains(description: string, keywords: string[], extensions: string[], matchMode: string, projectId?: string, projectName?: string, locale?: string | null): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/search`, { description, keywords, extensions, matchMode, projectId, projectName, ...(locale ? { locale } : {}) });
  }

  searchDomainsStream(
    params: { description: string; keywords: string[]; extensions: string[]; matchMode: string; projectId?: string; projectName?: string; locale?: string | null; excludeNames?: string[]; descriptiveNames?: boolean; culturalNames?: boolean; likedNames?: string[]; dislikedNames?: string[]; minLength?: number; likedExamples?: string[]; competitorDomains?: string[]; dislikedStyleDomains?: string[] },
    token: string,
  ): Observable<any> {
    return new Observable(observer => {
      const controller = new AbortController();

      (async () => {
        try {
          const response = await fetch(`${this.apiUrl}/search/stream`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
              // Posé à la main : cet appel est un `fetch` brut (flux SSE), il
              // ne passe donc pas par l'intercepteur qui ajoute l'en-tête aux
              // autres appels API. Sans lui, la recherche — l'étape centrale
              // de l'entonnoir — ne serait rattachée à aucune visite.
              'X-Session-Id': this.analytics.sessionId,
            },
            body: JSON.stringify({ ...params, locale: params.locale ?? undefined }),
            signal: controller.signal,
          });

          if (!response.ok) {
            observer.error({ status: response.status });
            return;
          }

          const reader = response.body!.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const parts = buffer.split('\n\n');
            buffer = parts.pop()!;

            for (const part of parts) {
              for (const line of part.split('\n')) {
                if (line.startsWith('data: ')) {
                  try { observer.next(JSON.parse(line.slice(6))); } catch { /* skip */ }
                }
              }
            }
          }

          observer.complete();
        } catch (err: any) {
          if (err.name !== 'AbortError') observer.error(err);
        }
      })();

      return () => controller.abort();
    });
  }
}
