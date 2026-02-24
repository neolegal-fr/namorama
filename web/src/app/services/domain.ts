import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class DomainService {
  private apiUrl = 'http://localhost:3000/domain';

  constructor(private http: HttpClient) {}

  refineDescription(description: string): Observable<{ refined: string }> {
    return this.http.post<{ refined: string }>(`${this.apiUrl}/refine`, { description });
  }

  suggestProjectName(description: string): Observable<{ suggestedName: string }> {
    return this.http.post<{ suggestedName: string }>(`${this.apiUrl}/suggest-name`, { description });
  }

  generateKeywords(description: string, locale?: string | null): Observable<{ keywords: string[] }> {
    return this.http.post<{ keywords: string[] }>(`${this.apiUrl}/keywords`, { description, ...(locale ? { locale } : {}) });
  }

  recheckDomains(names: string[], extensions: string[]): Observable<{ domains: { name: string; allExtensions: Record<string, boolean> }[] }> {
    return this.http.post<any>(`${this.apiUrl}/recheck`, { names, extensions });
  }

  searchDomains(description: string, keywords: string[], extensions: string[], matchMode: string, projectId?: string, projectName?: string, locale?: string | null): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/search`, { description, keywords, extensions, matchMode, projectId, projectName, ...(locale ? { locale } : {}) });
  }

  searchDomainsStream(
    params: { description: string; keywords: string[]; extensions: string[]; matchMode: string; projectId?: string; projectName?: string; locale?: string | null; excludeNames?: string[] },
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
