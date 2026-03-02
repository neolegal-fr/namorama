import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AdminUser {
  id: number;
  keycloakId: string;
  email: string;
  credits: number;
  extraCredits: number;
  totalCredits: number;
  createdAt: string;
  lastLogin: string | null;
  projectCount: number;
}

export interface AdminStats {
  totalUsers: number;
  activeUsers7: number;
  activeUsers30: number;
  newUsers7: number;
  newUsers30: number;
  totalProjects: number;
  totalSuggestions: number;
  avgSuggestionsPerProject: number;
  avgFavoritesPerProject: number;
  totalFreeCredits: number;
  totalPackCredits: number;
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private base = `${environment.apiUrl}/admin`;

  constructor(private http: HttpClient) {}

  getUsers(page: number, limit: number, search: string): Observable<{ data: AdminUser[]; total: number }> {
    const params = new HttpParams()
      .set('page', page)
      .set('limit', limit)
      .set('search', search);
    return this.http.get<{ data: AdminUser[]; total: number }>(`${this.base}/users`, { params });
  }

  adjustCredits(userId: number, delta: number, reason: string): Observable<AdminUser> {
    return this.http.patch<AdminUser>(`${this.base}/users/${userId}/credits`, { delta, reason });
  }

  getStats(): Observable<AdminStats> {
    return this.http.get<AdminStats>(`${this.base}/stats`);
  }
}
