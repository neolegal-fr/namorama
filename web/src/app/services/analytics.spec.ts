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

/**
 * Rejets non gérés remontés par le navigateur.
 * Chantier `telemetrie-sans-annulations`, tâches 1.1 et 1.2.
 */
describe('AnalyticsService — rejets non gérés', () => {
  let beacon: ReturnType<typeof vi.fn>;
  let rejet: (e: { reason: unknown }) => void;
  const envois = () =>
    Promise.all(beacon.mock.calls.map(([, blob]) => (blob as Blob).text().then(JSON.parse)));

  beforeEach(() => {
    beacon = vi.fn(() => true);
    Object.defineProperty(navigator, 'sendBeacon', { value: beacon, configurable: true });
    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: ConfigService, useValue: { apiUrl: 'http://api' } },
      ],
    });
    // Le gestionnaire est capturé plutôt que déclenché sur `window` : ceux des
    // tests précédents y resteraient branchés et compteraient deux fois.
    const ajout = vi.spyOn(window, 'addEventListener').mockImplementation(() => {});
    TestBed.inject(AnalyticsService).installErrorReporting();
    rejet = ajout.mock.calls.find(([type]) => type === 'unhandledrejection')![1] as any;
  });

  afterEach(() => vi.restoreAllMocks());

  it('ne remonte pas une requête annulée par un désabonnement', async () => {
    rejet({ reason: new DOMException('signal is aborted without reason', 'AbortError') });
    expect(await envois()).toEqual([]);
  });

  it('remonte tout autre rejet, avec son message', async () => {
    rejet({ reason: new TypeError("undefined is not an object (evaluating 'n.length')") });
    const [envoi] = await envois();
    expect(envoi.name).toBe('client_unhandled_rejection');
    expect(envoi.meta.message).toBe("undefined is not an object (evaluating 'n.length')");
  });

  it('joint la pile d’une erreur, tronquée à 300 caractères', async () => {
    const erreur = new TypeError('n.length');
    erreur.stack = `TypeError: n.length\n    at n (https://namorama.com/main-ABC123.js:1:2345)${' '.repeat(400)}`;
    rejet({ reason: erreur });
    const [envoi] = await envois();
    expect(envoi.meta.stack).toContain('main-ABC123.js');
    expect(envoi.meta.stack.length).toBe(300);
  });

  it('remonte une valeur qui n’est pas une erreur, avec une pile vide', async () => {
    rejet({ reason: 'keycloak init timeout' });
    const [envoi] = await envois();
    expect(envoi.meta).toMatchObject({ message: 'keycloak init timeout', stack: '' });
  });
});
