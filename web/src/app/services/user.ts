import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, tap } from 'rxjs';
import { ConfigService } from './config';

export interface CreditInfo {
  freeCredits: number;
  packCredits: number;
  freeResetDate: string;
}

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private get apiUrl() { return `${this.config.apiUrl}/users`; }

  private creditsSubject = new BehaviorSubject<number>(0);
  credits$ = this.creditsSubject.asObservable();

  private creditInfoSubject = new BehaviorSubject<CreditInfo>({
    freeCredits: 0,
    packCredits: 0,
    freeResetDate: '',
  });
  creditInfo$ = this.creditInfoSubject.asObservable();

  constructor(private http: HttpClient, private config: ConfigService) {}

  getCredits(): Observable<{ credits: number; freeCredits: number; packCredits: number }> {
    return this.http.get<any>(`${this.apiUrl}/credits`).pipe(
      tap(res => {
        this.creditsSubject.next(res.credits);
      })
    );
  }

  getSubscription(): Observable<CreditInfo> {
    return this.http.get<CreditInfo>(`${this.apiUrl}/me/subscription`).pipe(
      tap(res => {
        this.creditInfoSubject.next(res);
        this.creditsSubject.next(res.freeCredits + res.packCredits);
      })
    );
  }

  updateCredits(amount: number) {
    this.creditsSubject.next(amount);
  }

  getMe(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/me`);
  }

  deleteAccount(): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/me`);
  }
}
