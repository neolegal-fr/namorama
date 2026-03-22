import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ConfigService } from './config';

@Injectable({
  providedIn: 'root'
})
export class DomainService {
  private get apiUrl() { return `${this.config.apiUrl}/domain`; }

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

  analyzeName(suggestionId: string, lang?: string): Observable<{ analysis: string }> {
    return this.http.post<{ analysis: string }>(`${this.apiUrl}/analyze`, { suggestionId, lang });
  }

  pickBest(suggestions: { name: string; analysis: string | null; extensions: Record<string, any> }[], lang: string): Observable<{ recommended: string; reason: string }> {
    return this.http.post<{ recommended: string; reason: string }>(`${this.apiUrl}/pick-best`, { suggestions, lang });
  }

  recheckDomains(names: string[], extensions: string[]): Observable<{ domains: { name: string; allExtensions: Record<string, boolean> }[] }> {
    return this.http.post<any>(`${this.apiUrl}/recheck`, { names, extensions });
  }

  searchDomains(description: string, keywords: string[], extensions: string[], matchMode: string, projectId?: string, projectName?: string, locale?: string | null): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/search`, { description, keywords, extensions, matchMode, projectId, projectName, ...(locale ? { locale } : {}) });
  }

  searchDomainsStream(
    params: { description: string; keywords: string[]; extensions: string[]; matchMode: string; projectId?: string; projectName?: string; locale?: string | null; excludeNames?: string[]; descriptiveNames?: boolean; culturalNames?: boolean; likedNames?: string[]; dislikedNames?: string[] },
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
