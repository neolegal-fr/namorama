import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ConfigService {
  apiUrl = 'http://localhost:3000';
  keycloakUrl = 'http://localhost:8080';

  async load(): Promise<void> {
    try {
      const res = await fetch('./assets/config.json');
      if (res.ok) {
        const cfg = await res.json();
        if (cfg.apiUrl) this.apiUrl = cfg.apiUrl;
        if (cfg.keycloakUrl) this.keycloakUrl = cfg.keycloakUrl;
      }
    } catch {
      // defaults kept
    }
  }
}
