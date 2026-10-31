import { Injectable, inject, signal } from '@angular/core';
import * as CookieConsentLib from 'vanilla-cookieconsent';
import { TranslateService } from '@ngx-translate/core';
import { AnalyticsService } from './analytics';

declare function gtag(...args: any[]): void;

/** Ce que le reste de l'application utilise de la bibliothèque — remplaçable en test. */
export type BibliothequeConsentement = Pick<
  typeof CookieConsentLib,
  'run' | 'setLanguage' | 'acceptedCategory' | 'showPreferences'
>;

/**
 * Bandeau de consentement (vanilla-cookieconsent) et lecture du choix par l'application.
 *
 * Deux catégories facultatives, volontairement séparées :
 * - `analytics` : Google Analytics (Consent Mode v2) ;
 * - `replay` : l'enregistrement de session (rejeu). Accepter « pages consultées »
 *   ne vaut pas accord pour enregistrer ses gestes à l'écran : une case par usage.
 *
 * Un compte qui avait déjà répondu avant l'ajout de `replay` n'est pas
 * redemandé : la catégorie reste refusée tant qu'il ne l'active pas depuis
 * « Gérer les cookies ». C'est le défaut le plus prudent.
 */
@Injectable({ providedIn: 'root' })
export class CookieConsentService {
  private readonly translate = inject(TranslateService);
  private readonly analytics = inject(AnalyticsService);

  /** Remplaçable en test : le module ES ne se simule pas proprement. */
  lib: BibliothequeConsentement = CookieConsentLib;

  /** Le visiteur a accepté l'enregistrement de session. Suivi par `SessionReplayService`. */
  readonly replayGranted = signal(false);

  init(): void {
    const lang = this.resolvedLang();

    // Synchroniser la langue si elle change après l'init
    this.translate.onLangChange.subscribe(e => {
      const l = e.lang.startsWith('en') ? 'en' : 'fr';
      this.lib.setLanguage(l);
    });

    void this.lib.run({
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
        replay: {
          enabled: false,
        },
      },

      // onConsent revient à chaque chargement de page : il applique le choix,
      // il ne le mesure pas. Seuls le premier choix et ses modifications
      // produisent un `consent_recorded`.
      onConsent: ({ cookie }) => this.appliquer(cookie.categories),
      onFirstConsent: ({ cookie }) => this.mesurer(cookie.categories, 'premier'),
      onChange: ({ cookie }) => {
        this.appliquer(cookie.categories);
        this.mesurer(cookie.categories, 'modification');
      },

      language: {
        default: lang,
        translations: { fr: TEXTES_FR, en: TEXTES_EN },
      },
    });

    // Un choix déjà enregistré lors d'une visite précédente.
    this.replayGranted.set(this.lib.acceptedCategory('replay'));
  }

  /** Rouvre les préférences : c'est ainsi qu'on retire un consentement. */
  ouvrirLesPreferences(): void {
    this.lib.showPreferences();
  }

  /** Applique un choix, qu'il soit nouveau ou relu à l'ouverture de la page. */
  appliquer(categories: string[]): void {
    this.updateGaConsent(categories.includes('analytics'));
    this.replayGranted.set(categories.includes('replay'));
  }

  /**
   * Mesure un choix : la part des visites enregistrables n'est connue que
   * comme ça. Les catégories acceptées, et rien d'autre.
   */
  mesurer(categories: string[], origine: 'premier' | 'modification'): void {
    this.analytics.track('consent_recorded', {
      analytics: categories.includes('analytics'),
      replay: categories.includes('replay'),
      origine,
    });
  }

  private resolvedLang(): 'fr' | 'en' {
    const l = this.translate.currentLang() || this.translate.getBrowserLang() || 'fr';
    return l.startsWith('en') ? 'en' : 'fr';
  }

  private updateGaConsent(granted: boolean) {
    if (typeof gtag !== 'function') return;
    gtag('consent', 'update', {
      analytics_storage: granted ? 'granted' : 'denied',
    });
  }
}

const TEXTES_FR = {
  consentModal: {
    title: '🍪 Nous utilisons des cookies',
    description:
      'Avec votre accord, nous mesurons l\'audience (Google Analytics) et enregistrons votre parcours dans l\'application, saisies masquées, pour repérer ce qui vous bloque. Aucune donnée n\'est vendue à des tiers.',
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
      {
        title: 'Enregistrement de session',
        description: 'Nous enregistrons vos actions dans l\'application (clics, défilement, pages, erreurs) pour comprendre ce qui vous gêne. Tout ce que vous tapez est masqué avant de quitter votre navigateur, ainsi que vos descriptions, mots-clés et adresses e-mail. Les enregistrements restent sur le serveur de Namorama, sans sous-traitant, et sont effacés après 30 jours.',
        linkedCategory: 'replay',
      },
    ],
  },
};

const TEXTES_EN = {
  consentModal: {
    title: '🍪 We use cookies',
    description:
      'With your consent, we measure audience (Google Analytics) and record your journey in the app, with typing masked, to find what gets in your way. No data is sold to third parties.',
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
      {
        title: 'Session recording',
        description: 'We record your actions in the app (clicks, scrolling, pages, errors) to understand what gets in your way. Everything you type is masked before it leaves your browser, as are your descriptions, keywords and email addresses. Recordings stay on Namorama\'s own server, with no third party, and are deleted after 30 days.',
        linkedCategory: 'replay',
      },
    ],
  },
};
