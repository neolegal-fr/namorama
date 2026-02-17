import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ProjectService {
  private apiUrl = 'http://localhost:3000/projects';
  
  // État partagé
  showDrawer = signal(false);
  projects = signal<any[]>([]);

  constructor(private http: HttpClient) {}

  refreshProjects(): Observable<any[]> {
    return this.http.get<any[]>(this.apiUrl).pipe(
      tap(projects => this.projects.set(projects))
    );
  }

  getProject(id: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${id}`);
  }

  toggleFavorite(suggestionId: string): Observable<{ isFavorite: boolean }> {
    return this.http.patch<{ isFavorite: boolean }>(`${this.apiUrl}/suggestions/${suggestionId}/favorite`, {});
  }
}