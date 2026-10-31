import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AnalyticsService } from './analytics';
import { ConfigService } from './config';
import { CookieConsentService } from './cookie-consent';
import { EVENEMENTS_PAR_LOT, Enregistreur, INTERVALLE_ENVOI_MS, SessionReplayService } from './session-replay';

@Component({ template: '' })
class Vide {}

/** Laisse passer les promesses en attente (chargement simulé, fetch). */
const attendre = () => new Promise(r => setTimeout(r, 0));

describe('SessionReplayService', () => {
  let service: SessionReplayService;
  let consenti: ReturnType<typeof signal<boolean>>;
  let admin: boolean;
  let emit: ((e: unknown) => void) | undefined;
  let options: Record<string, any> | undefined;
  let arret: ReturnType<typeof vi.fn<() => void>>;
  let charger: ReturnType<typeof vi.fn<() => Promise<Enregistreur>>>;
  let fetchMock: ReturnType<typeof vi.fn>;
  let statut: number;

  const corps = (i: number) => JSON.parse(fetchMock.mock.calls[i][1].body);

  beforeEach(() => {
    sessionStorage.clear();
    consenti = signal(false);
    admin = false;
    emit = undefined;
    options = undefined;
    arret = vi.fn<() => void>();
    statut = 204;
    fetchMock = vi.fn(async () => ({ status: statut }));
    vi.stubGlobal('fetch', fetchMock);

    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: '', component: Vide },
          { path: 'admin/users', component: Vide },
          { path: 'projects/:id', component: Vide },
        ]),
        { provide: CookieConsentService, useValue: { replayGranted: consenti } },
        { provide: AnalyticsService, useValue: { sessionId: 'visite-12345678' } },
        { provide: ConfigService, useValue: { apiUrl: 'http://api' } },
      ],
    });
    service = TestBed.inject(SessionReplayService);
    const enregistreur: Enregistreur = {
      record: (o: Record<string, any>) => {
        options = o;
        emit = o['emit'];
        return arret;
      },
      getRecordConsolePlugin: (o: unknown) => ({ name: 'console', o }),
    };
    charger = vi.fn<() => Promise<Enregistreur>>(async () => enregistreur);
    service.charger = charger;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  async function installer() {
    service.installer(() => admin);
    TestBed.tick();
    await attendre();
  }

  it('ne télécharge rien sans consentement', async () => {
    await installer();
    expect(charger).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('ne démarre jamais pour un administrateur, même consentant', async () => {
    admin = true;
    consenti.set(true);
    await installer();
    expect(charger).not.toHaveBeenCalled();
  });

  it('démarre à l’acceptation, sans rechargement, avec saisies et textes privés masqués', async () => {
    await installer();
    consenti.set(true);
    TestBed.tick();
    await attendre();
    expect(charger).toHaveBeenCalledTimes(1);
    expect(service.actif()).toBe(true);
    expect(options?.['maskAllInputs']).toBe(true);
    expect(options?.['maskTextClass']).toBe('nm-prive');
    expect(options?.['recordCanvas']).toBe(false);
    expect(options?.['plugins'][0].o.level).toEqual(['error']);
  });

  it('au retrait, s’arrête et n’envoie pas ce qui restait', async () => {
    consenti.set(true);
    await installer();
    emit!({ type: 3 });
    consenti.set(false);
    TestBed.tick();
    expect(arret).toHaveBeenCalled();
    expect(service.actif()).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('se suspend sous /admin et reprend ensuite, en un segment de plus', async () => {
    consenti.set(true);
    await installer();
    const router = TestBed.inject(Router);
    emit!({ type: 4 });

    await router.navigateByUrl('/admin/users');
    expect(arret).toHaveBeenCalled();
    expect(service.actif()).toBe(false);
    // ce qui précède /admin a été consenti : il part
    expect(corps(0).segment).toBe(0);

    await router.navigateByUrl('/projects/1');
    await attendre();
    expect(service.actif()).toBe(true);
    emit!({ type: 4 });
    service.envoyer(false);
    expect(corps(1).segment).toBe(1);
    expect(corps(1).seq).toBe(0);
  });

  it('découpe en lots numérotés : plein, puis à l’intervalle', async () => {
    vi.useFakeTimers();
    consenti.set(true);
    service.installer(() => admin);
    TestBed.tick();
    await vi.runOnlyPendingTimersAsync().catch(() => {});
    await Promise.resolve();
    await Promise.resolve();
    expect(service.actif()).toBe(true);

    for (let i = 0; i < EVENEMENTS_PAR_LOT; i++) emit!({ type: 3, i });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(corps(0)).toMatchObject({ sessionId: 'visite-12345678', segment: 0, seq: 0 });
    expect(corps(0).events).toHaveLength(EVENEMENTS_PAR_LOT);

    emit!({ type: 3 });
    vi.advanceTimersByTime(INTERVALLE_ENVOI_MS);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(corps(1).seq).toBe(1);
    expect(corps(1).events).toHaveLength(1);

    // l'intervalle sans rien de neuf n'envoie rien
    vi.advanceTimersByTime(INTERVALLE_ENVOI_MS);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('envoie l’instantané complet sur-le-champ, sans attendre l’intervalle', async () => {
    consenti.set(true);
    await installer();
    emit!({ type: 4, timestamp: 1 }); // méta
    expect(fetchMock).not.toHaveBeenCalled();
    emit!({ type: 2, timestamp: 2 }); // instantané complet : 700 à 900 ko en pratique
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(corps(0).events.map((e: any) => e.type)).toEqual([4, 2]);
    // requête simple au sens de CORS : pas d'OPTIONS qui retarderait l'envoi de fermeture
    expect(fetchMock.mock.calls[0][1].headers['Content-Type']).toMatch(/^text\/plain/);
  });

  it('un 413 arrête l’enregistrement pour la visite', async () => {
    consenti.set(true);
    await installer();
    statut = 413;
    emit!({ type: 3 });
    service.envoyer(false);
    await attendre();
    expect(arret).toHaveBeenCalled();
    expect(service.actif()).toBe(false);

    service.evaluer();
    await attendre();
    expect(charger).toHaveBeenCalledTimes(1); // pas de redémarrage
  });

  it('une erreur réseau ne remonte jamais', async () => {
    consenti.set(true);
    await installer();
    fetchMock.mockImplementation(async () => { throw new TypeError('Failed to fetch'); });
    emit!({ type: 3 });
    expect(() => service.envoyer(false)).not.toThrow();
    await attendre();
    expect(service.actif()).toBe(true);
  });

  it('un rrweb introuvable (bloqué) ne remonte pas', async () => {
    charger.mockImplementation(async () => { throw new Error('chunk bloqué'); });
    consenti.set(true);
    await installer();
    expect(service.actif()).toBe(false);
  });
});
