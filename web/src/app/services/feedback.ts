import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ConfigService } from './config';

@Injectable({ providedIn: 'root' })
export class FeedbackService {
  private readonly apiUrl: string;

  constructor(private http: HttpClient, config: ConfigService) {
    this.apiUrl = `${config.apiUrl}/feedback`;
  }

  submit(message: string, email?: string): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(this.apiUrl, { message, email });
  }
}
