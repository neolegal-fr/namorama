import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, tap, of } from 'rxjs';
import { ConfigService } from './config';

export interface BillingInfo {
  subscriptionCredits: number;
  extraCredits: number;
  totalCredits: number;
  hasActiveSubscription: boolean;
}

export interface SubscriptionInfo {
  plan: 'essential' | null;
  status: 'active' | 'cancelled' | 'expired' | 'none';
  subscriptionCredits: number;
  subscriptionCreditsTotal: number;
  extraCredits: number;
  currentPeriodEnd: string | null;
  nextBillingAmount: number | null;
}

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private get apiUrl() { return `${this.config.apiUrl}/users`; }
  private creditsSubject = new BehaviorSubject<number>(0);
  credits$ = this.creditsSubject.asObservable();

  private billingSubject = new BehaviorSubject<BillingInfo>({
    subscriptionCredits: 0,
    extraCredits: 0,
    totalCredits: 0,
    hasActiveSubscription: false,
  });
  billing$ = this.billingSubject.asObservable();

  private subscriptionSubject = new BehaviorSubject<SubscriptionInfo>({
    plan: null,
    status: 'none',
    subscriptionCredits: 0,
    subscriptionCreditsTotal: 0,
    extraCredits: 0,
    currentPeriodEnd: null,
    nextBillingAmount: null,
  });
  subscription$ = this.subscriptionSubject.asObservable();

  constructor(private http: HttpClient, private config: ConfigService) {}

  getCredits(): Observable<{ credits: number; subscriptionCredits: number; extraCredits: number; hasActiveSubscription: boolean }> {
    return this.http.get<any>(`${this.apiUrl}/credits`).pipe(
      tap(res => {
        this.creditsSubject.next(res.credits);
        this.billingSubject.next({
          subscriptionCredits: res.subscriptionCredits ?? 0,
          extraCredits: res.extraCredits ?? 0,
          totalCredits: res.credits,
          hasActiveSubscription: res.hasActiveSubscription ?? false,
        });
      })
    );
  }

  getSubscription(): Observable<SubscriptionInfo> {
    return this.http.get<SubscriptionInfo>(`${this.apiUrl}/me/subscription`).pipe(
      tap(res => this.subscriptionSubject.next(res))
    );
  }

  updateCredits(amount: number) {
    this.creditsSubject.next(amount);
  }

  getMe(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/me`);
  }
}
