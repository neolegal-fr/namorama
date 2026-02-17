import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ProjectService {
  private apiUrl = 'http://localhost:3000/projects';

  constructor(private http: HttpClient) {}

  getProjects(): Observable<any[]> {
    return this.http.get<any[]>(this.apiUrl);
  }

  getProject(id: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${id}`);
  }

  toggleFavorite(suggestionId: string): Observable<{ isFavorite: boolean }> {
    return this.http.patch<{ isFavorite: boolean }>(`${this.apiUrl}/suggestions/${suggestionId}/favorite`, {});
  }
}