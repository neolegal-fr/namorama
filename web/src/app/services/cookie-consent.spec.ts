import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AnalyticsService } from './analytics';
import { BibliothequeConsentement, CookieConsentService } from './cookie-consent';

describe('CookieConsentService', () => {
  let service: CookieConsentService;
  let track: ReturnType<typeof vi.fn>;
  let options: any;
  let dejaAccepte: string[];

  beforeEach(() => {
    track = vi.fn();
    dejaAccepte = [];
    TestBed.configureTestingModule({
      providers: [
        { provide: AnalyticsService, useValue: { track } },
        {
          provide: TranslateService,
          useValue: { onLangChange: new Subject(), currentLang: () => 'fr', getBrowserLang: () => 'fr' },
        },
      ],
    });
    service = TestBed.inject(CookieConsentService);
    const lib: BibliothequeConsentement = {
      run: vi.fn(async (o: any) => { options = o; }) as any,
      setLanguage: vi.fn() as any,
      acceptedCategory: vi.fn((c: string) => dejaAccepte.includes(c)) as any,
      showPreferences: vi.fn() as any,
    };
    service.lib = lib;
  });

  it('déclare une catégorie replay désactivée par défaut, distincte de analytics', () => {
    service.init();
    expect(options.categories.replay).toEqual({ enabled: false });
    expect(options.categories.analytics.enabled).toBe(false);
    for (const t of [options.language.translations.fr, options.language.translations.en]) {
      expect(t.preferencesModal.sections.some((s: any) => s.linkedCategory === 'replay')).toBe(true);
    }
  });

  it('relit un consentement donné lors d’une visite précédente', () => {
    dejaAccepte = ['necessary', 'replay'];
    service.init();
    expect(service.replayGranted()).toBe(true);
  });

  it('passe à vrai à l’acceptation, et à faux au retrait', () => {
    service.init();
    expect(service.replayGranted()).toBe(false);

    options.onConsent({ cookie: { categories: ['necessary', 'analytics', 'replay'] } });
    expect(service.replayGranted()).toBe(true);

    options.onChange({ cookie: { categories: ['necessary', 'analytics'] } });
    expect(service.replayGranted()).toBe(false);
  });

  it('accepter l’audience n’accepte pas l’enregistrement', () => {
    service.init();
    options.onConsent({ cookie: { categories: ['necessary', 'analytics'] } });
    expect(service.replayGranted()).toBe(false);
  });

  it('mesure le premier choix et chaque modification, jamais un simple chargement', () => {
    service.init();
    options.onConsent({ cookie: { categories: ['necessary'] } });
    expect(track).not.toHaveBeenCalled();

    options.onFirstConsent({ cookie: { categories: ['necessary'] } });
    expect(track).toHaveBeenLastCalledWith('consent_recorded', { analytics: false, replay: false, origine: 'premier' });

    options.onChange({ cookie: { categories: ['necessary', 'analytics', 'replay'] } });
    expect(track).toHaveBeenLastCalledWith('consent_recorded', { analytics: true, replay: true, origine: 'modification' });
    expect(track).toHaveBeenCalledTimes(2);
  });
});
