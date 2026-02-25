import { ApplicationConfig, provideBrowserGlobalErrorListeners, APP_INITIALIZER } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeuix/themes/aura';
import { ConfirmationService, MessageService } from 'primeng/api';
import { KeycloakService, KeycloakBearerInterceptor } from 'keycloak-angular';
import { HTTP_INTERCEPTORS, HttpClient } from '@angular/common/http';
import { TranslateModule, TranslateLoader, TranslateService } from '@ngx-translate/core';
import { importProvidersFrom } from '@angular/core';
import { Observable } from 'rxjs';

import { routes } from './app.routes';
import { ConfigService } from './services/config';

export class CustomTranslateLoader implements TranslateLoader {
  constructor(private http: HttpClient) {}
  getTranslation(lang: string): Observable<any> {
    return this.http.get(`./assets/i18n/${lang}.json`);
  }
}

export function HttpLoaderFactory(http: HttpClient) {
  return new CustomTranslateLoader(http);
}

function initializeApp(keycloak: KeycloakService, translate: TranslateService, config: ConfigService) {
  return async () => {
    // 1. Charger la config runtime (URLs d'env)
    await config.load();

    // 2. Initialiser Keycloak
    await keycloak.init({
      config: {
        url: config.keycloakUrl,
        realm: 'namespoter',
        clientId: 'namespoter-web'
      },
      initOptions: {
        onLoad: 'check-sso',
        silentCheckSsoRedirectUri:
          window.location.origin + '/assets/silent-check-sso.html',
        checkLoginIframe: false
      },
      bearerExcludedUrls: ['/assets']
    });

    // 2. Initialiser la langue
    translate.addLangs(['fr', 'en']);
    translate.setDefaultLang('fr');
    
    const browserLang = translate.getBrowserLang();
    translate.use(browserLang?.match(/en|fr/) ? browserLang : 'fr');
  };
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptorsFromDi()),
    provideAnimations(),
    providePrimeNG({
        theme: {
            preset: Aura,
            options: {
                darkModeSelector: false
            }
        }
    }),
    importProvidersFrom(
      TranslateModule.forRoot({
        loader: {
          provide: TranslateLoader,
          useFactory: HttpLoaderFactory,
          deps: [HttpClient]
        }
      })
    ),
    {
      provide: APP_INITIALIZER,
      useFactory: initializeApp,
      multi: true,
      deps: [KeycloakService, TranslateService, ConfigService]
    },
    KeycloakService,
    {
      provide: HTTP_INTERCEPTORS,
      useClass: KeycloakBearerInterceptor,
      multi: true
    },
    ConfirmationService,
    MessageService
  ]
};
