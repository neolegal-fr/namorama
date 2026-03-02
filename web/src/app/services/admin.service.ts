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
  createdAt: string;
  lastLogin: string | null;
  projectCount: number;
}

export interface AdminStats {
  totalUsers: number;
  periodActiveUsers: number;
  periodNewUsers: number;
  totalProjects: number;
  totalSuggestions: number;
  avgSuggestionsPerProject: number;
  avgFavoritesPerProject: number;
  totalFreeCredits: number;
  totalPackCredits: number;
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private get base() { return `${this.config.apiUrl}/admin`; }

  constructor(private http: HttpClient, private config: ConfigService) {}

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

  getStats(from?: Date, to?: Date): Observable<AdminStats> {
    let params = new HttpParams();
    if (from) params = params.set('from', from.toISOString());
    if (to) params = params.set('to', to.toISOString());
    return this.http.get<AdminStats>(`${this.base}/stats`, { params });
  }
}
