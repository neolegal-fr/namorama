import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, Subject } from 'rxjs';
import { ConfigService } from './config';

@Injectable({
  providedIn: 'root'
})
export class ProjectService {
  private get apiUrl() { return `${this.config.apiUrl}/projects`; }

  // État partagé
  showDrawer = signal(false);
  showCreditDialog = signal(false);
  projects = signal<any[]>([]);

  // Événements
  private resetWizardSource = new Subject<void>();
  resetWizard$ = this.resetWizardSource.asObservable();

  constructor(private http: HttpClient, private config: ConfigService) {}

  resetWizard() {
    this.resetWizardSource.next();
  }

  refreshProjects(): Observable<any[]> {
    return this.http.get<any[]>(this.apiUrl).pipe(
      tap(projects => this.projects.set(projects))
    );
  }

  getProject(id: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${id}`);
  }

  updateProject(id: string, data: any): Observable<any> {
    return this.http.patch<any>(`${this.apiUrl}/${id}`, data);
  }

  setRating(suggestionId: string, rating: 'liked' | 'disliked' | 'neutral'): Observable<{ rating: string }> {
    return this.http.patch<{ rating: string }>(`${this.apiUrl}/suggestions/${suggestionId}/rating`, { rating });
  }

  updateSuggestionsAvailability(updates: { id: string; availability: Record<string, boolean> }[]): Observable<any> {
    return this.http.patch<any>(`${this.apiUrl}/suggestions/availability`, { updates });
  }

  addSuggestion(projectId: string, domainName: string, availability: Record<string, boolean>): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/${projectId}/suggestions`, { domainName, availability });
  }

  deleteProject(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }
}