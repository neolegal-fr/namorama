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

  generateKeywords(description: string): Observable<{ keywords: string[] }> {
    return this.http.post<{ keywords: string[] }>(`${this.apiUrl}/keywords`, { description });
  }

  searchDomains(description: string, keywords: string[]): Observable<{ domains: string[] }> {
    return this.http.post<{ domains: string[] }>(`${this.apiUrl}/search`, { description, keywords });
  }
}