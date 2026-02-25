import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ConfigService } from './config';

@Injectable({
  providedIn: 'root'
})
export class PaymentService {
  private get apiUrl() { return `${this.config.apiUrl}/payments`; }

  constructor(private http: HttpClient, private config: ConfigService) {}

  createSubscriptionCheckout(): Observable<{ url: string }> {
    return this.http.post<{ url: string }>(`${this.apiUrl}/checkout/subscription`, {});
  }

  createPackCheckout(): Observable<{ url: string }> {
    return this.http.post<{ url: string }>(`${this.apiUrl}/checkout/pack`, {});
  }

  openPortal(): Observable<{ url: string }> {
    return this.http.get<{ url: string }>(`${this.apiUrl}/portal`);
  }

  fulfillSession(sessionId: string): Observable<{ creditsAdded: number; totalCredits: number; subscriptionCredits: number; extraCredits: number; hasActiveSubscription: boolean }> {
    return this.http.post<any>(`${this.apiUrl}/fulfill-session`, { sessionId });
  }
}
