import { Injectable } from '@angular/core';
import * as CookieConsent from 'vanilla-cookieconsent';
import { TranslateService } from '@ngx-translate/core';

declare function gtag(...args: any[]): void;

@Injectable({ providedIn: 'root' })
export class CookieConsentService {
  constructor(private translate: TranslateService) {}

  init(): void {
    const lang = this.resolvedLang();

    // Synchroniser la langue si elle change après l'init
    this.translate.onLangChange.subscribe(e => {
      const l = e.lang.startsWith('en') ? 'en' : 'fr';
      CookieConsent.setLanguage(l);
    });

    CookieConsent.run({
      categories: {
        necessary: {
          enabled: true,
          readOnly: true,
        },
        analytics: {
          enabled: false,
          services: {
            ga4: { label: 'Google Analytics 4' },
          },
        },
      },

      onConsent: ({ cookie }) => {
        this.updateGaConsent(cookie.categories.includes('analytics'));
      },

      onChange: ({ cookie }) => {
        this.updateGaConsent(cookie.categories.includes('analytics'));
      },

      language: {
        default: lang,
        translations: {
          fr: {
            consentModal: {
              title: '🍪 Nous utilisons des cookies',
              description:
                'Nous utilisons des cookies analytiques (Google Analytics) pour comprendre comment vous utilisez Namorama et améliorer notre service. Aucune donnée n\'est vendue à des tiers.',
              acceptAllBtn: 'Tout accepter',
              acceptNecessaryBtn: 'Refuser',
              showPreferencesBtn: 'Personnaliser',
              footer: '<a href="https://namorama.com/privacy" target="_blank">Politique de confidentialité</a>',
            },
            preferencesModal: {
              title: 'Préférences de cookies',
              acceptAllBtn: 'Tout accepter',
              acceptNecessaryBtn: 'Tout refuser',
              savePreferencesBtn: 'Enregistrer',
              closeIconLabel: 'Fermer',
              sections: [
                {
                  title: 'Cookies strictement nécessaires',
                  description: 'Ces cookies sont indispensables au fonctionnement du site (session, authentification). Ils ne peuvent pas être désactivés.',
                  linkedCategory: 'necessary',
                },
                {
                  title: 'Cookies analytiques',
                  description: 'Google Analytics nous aide à comprendre comment les visiteurs utilisent Namorama (pages consultées, durée de session). Ces données sont anonymisées.',
                  linkedCategory: 'analytics',
                  cookieTable: {
                    headers: { name: 'Cookie', domain: 'Domaine', desc: 'Description' },
                    body: [
                      { name: '_ga', domain: 'google.com', desc: 'Identifiant de session Analytics (2 ans)' },
                      { name: '_ga_*', domain: 'google.com', desc: 'Identifiant de session GA4 (2 ans)' },
                    ],
                  },
                },
              ],
            },
          },
          en: {
            consentModal: {
              title: '🍪 We use cookies',
              description:
                'We use analytics cookies (Google Analytics) to understand how you use Namorama and improve our service. No data is sold to third parties.',
              acceptAllBtn: 'Accept all',
              acceptNecessaryBtn: 'Reject all',
              showPreferencesBtn: 'Manage preferences',
              footer: '<a href="https://namorama.com/privacy" target="_blank">Privacy policy</a>',
            },
            preferencesModal: {
              title: 'Cookie preferences',
              acceptAllBtn: 'Accept all',
              acceptNecessaryBtn: 'Reject all',
              savePreferencesBtn: 'Save preferences',
              closeIconLabel: 'Close',
              sections: [
                {
                  title: 'Strictly necessary cookies',
                  description: 'These cookies are required for the site to work (session, authentication). They cannot be disabled.',
                  linkedCategory: 'necessary',
                },
                {
                  title: 'Analytics cookies',
                  description: 'Google Analytics helps us understand how visitors use Namorama (pages visited, session duration). Data is anonymised.',
                  linkedCategory: 'analytics',
                  cookieTable: {
                    headers: { name: 'Cookie', domain: 'Domain', desc: 'Description' },
                    body: [
                      { name: '_ga', domain: 'google.com', desc: 'Analytics session identifier (2 years)' },
                      { name: '_ga_*', domain: 'google.com', desc: 'GA4 session identifier (2 years)' },
                    ],
                  },
                },
              ],
            },
          },
        },
      },
    });
  }

  private resolvedLang(): 'fr' | 'en' {
    const l = this.translate.currentLang || this.translate.getBrowserLang() || 'fr';
    return l.startsWith('en') ? 'en' : 'fr';
  }

  private updateGaConsent(granted: boolean) {
    if (typeof gtag !== 'function') return;
    gtag('consent', 'update', {
      analytics_storage: granted ? 'granted' : 'denied',
    });
  }
}
