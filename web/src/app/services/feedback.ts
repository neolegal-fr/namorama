import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import { ConfigService } from './config';

@Injectable({ providedIn: 'root' })
export class FeedbackService {
  private readonly apiUrl: string;

  /** Émis quand un composant enfant veut ouvrir le dialog de feedback */
  readonly openDialog$ = new Subject<void>();

  constructor(private http: HttpClient, config: ConfigService) {
    this.apiUrl = `${config.apiUrl}/feedback`;
  }

  openDialog() {
    this.openDialog$.next();
  }

  submit(message: string, email?: string): Observable<{ ok: boolean; creditsAwarded: boolean }> {
    return this.http.post<{ ok: boolean; creditsAwarded: boolean }>(this.apiUrl, { message, email });
  }
}
