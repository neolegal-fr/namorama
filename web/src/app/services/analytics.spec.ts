import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AnalyticsService, origineDuDemarrage } from './analytics';
import { ConfigService } from './config';

/**
 * Origine d'une visite côté navigateur.
 * Chantier `mesurer-les-canaux-d-acquisition`, tâche 2.1.
 */
describe('origineDuDemarrage', () => {
  it('lit la page d’arrivée et les paramètres de campagne', () => {
    expect(origineDuDemarrage('https://namorama.com/generateur-nom-de-marque?utm_source=chatgpt.com&x=1', '')).toEqual({
      arrivee: '/generateur-nom-de-marque',
      utmSource: 'chatgpt.com',
    });
  });

  it('réduit le référent à son domaine, sans chemin ni paramètre', () => {
    const o = origineDuDemarrage('https://namorama.com/', 'https://mail.example.com/inbox?user=x');
    expect(o.referent).toBe('mail.example.com');
    expect(JSON.stringify(o)).not.toContain('user=x');
  });

  it('ignore un référent du même site', () => {
    expect(origineDuDemarrage('https://namorama.com/app', 'https://namorama.com/').referent).toBeUndefined();
  });

  it('ignore un référent qui n’est pas une adresse web', () => {
    expect(origineDuDemarrage('https://namorama.com/', 'android-app://com.google.android.gm').referent).toBeUndefined();
  });
});

describe('AnalyticsService.pageView', () => {
  let beacon: ReturnType<typeof vi.fn>;
  const envois = () => beacon.mock.calls.map(([, blob]) => blob as Blob);

  beforeEach(() => {
    window.history.replaceState(null, '', '/generateur-nom-de-marque?utm_source=chatgpt.com');
    vi.spyOn(document, 'referrer', 'get').mockReturnValue('https://www.google.fr/search?q=nom');
    beacon = vi.fn(() => true);
    Object.defineProperty(navigator, 'sendBeacon', { value: beacon, configurable: true });
    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: ConfigService, useValue: { apiUrl: 'http://api' } },
      ],
    });
  });

  afterEach(() => vi.restoreAllMocks());

  it('joint l’origine au seul premier affichage', async () => {
    const service = TestBed.inject(AnalyticsService);
    // L'adresse change avant le premier envoi : c'est celle du démarrage qui compte.
    window.history.replaceState(null, '', '/app');
    service.pageView('/app', false);
    service.pageView('/app/autre', false);

    const [premier, second] = await Promise.all(envois().map((b) => b.text().then(JSON.parse)));
    expect(premier.meta).toMatchObject({
      arrivee: '/generateur-nom-de-marque', utmSource: 'chatgpt.com', referent: 'www.google.fr',
    });
    expect(second.meta).not.toHaveProperty('utmSource');
    expect(second.meta).not.toHaveProperty('referent');
    expect(second.meta).not.toHaveProperty('arrivee');
  });
});
