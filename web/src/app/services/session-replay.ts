import { Injectable, Injector, PLATFORM_ID, effect, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { NavigationStart, Router } from '@angular/router';
import { AnalyticsService } from './analytics';
import { ConfigService } from './config';
import { CookieConsentService } from './cookie-consent';
import { masquerLesAttributs } from './masquage-attributs';

/** Ce que l'on utilise de rrweb : chargé à la demande, jamais dans le bundle initial. */
export interface Enregistreur {
  record: (options: Record<string, unknown>) => (() => void) | undefined;
  getRecordConsolePlugin: (options: Record<string, unknown>) => unknown;
}

/**
 * Un lot part toutes les 3 s, dès 200 événements, et IMMÉDIATEMENT après un
 * instantané complet.
 *
 * Mesuré le 31/10/2026 : l'instantané pèse 700 à 900 ko de JSON (feuilles de
 * style comprises). Avec un envoi toutes les 10 s, il restait dans le tampon
 * quand la page partait vers Keycloak, trop gros pour `keepalive` (64 ko) : la
 * navigation annulait l'envoi, et tout le parcours avant la connexion était
 * perdu. Envoyé sur-le-champ, il part pendant que la page est ouverte ; ce qui
 * reste à la fermeture, quelques secondes d'événements, tient en `keepalive`.
 */
export const INTERVALLE_ENVOI_MS = 3_000;
export const EVENEMENTS_PAR_LOT = 200;
/** Au-delà, `fetch(..., { keepalive })` est refusé par le navigateur (64 ko, partagés). */
const LIMITE_KEEPALIVE = 60_000;
/** Type rrweb de l'instantané complet. */
const INSTANTANE_COMPLET = 2;
const CLE_SEGMENT = 'nm_replay_seg';

/**
 * Classe à poser sur tout texte AFFICHÉ qui reprend une saisie de l'utilisateur
 * (description, mots-clés) ou une adresse e-mail. Les saisies elles-mêmes sont
 * masquées d'office (`maskAllInputs`).
 */
export const CLASSE_PRIVEE = 'nm-prive';

/**
 * Enregistrement de session (rejeu), avec rrweb.
 *
 * Trois conditions, réévaluées à chaque changement : le visiteur a accepté la
 * catégorie `replay`, il n'est pas administrateur, la page n'est pas sous
 * `/admin`. Le masquage se fait ICI, avant tout envoi : le serveur ne reçoit
 * jamais une saisie en clair.
 *
 * Tout est best-effort : un envoi refusé ou perdu ne gêne jamais l'utilisateur.
 * Un refus du serveur (4xx — plafond atteint, visite inconnue) arrête
 * l'enregistrement pour la visite, plutôt que de réessayer en boucle.
 */
@Injectable({ providedIn: 'root' })
export class SessionReplayService {
  private readonly injector = inject(Injector);
  private readonly router = inject(Router);
  private readonly consent = inject(CookieConsentService);
  private readonly analytics = inject(AnalyticsService);
  private readonly config = inject(ConfigService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Remplaçable en test. */
  charger: () => Promise<Enregistreur> = async () => {
    const [rrweb, consolePlugin] = await Promise.all([
      import('rrweb'),
      import('@rrweb/rrweb-plugin-console-record'),
    ]);
    return {
      record: rrweb.record as unknown as Enregistreur['record'],
      getRecordConsolePlugin: consolePlugin.getRecordConsolePlugin as unknown as Enregistreur['getRecordConsolePlugin'],
    };
  };

  /** Enregistrement en cours (exposé pour les tests et le débogage). */
  readonly actif = signal(false);

  private estAdmin: () => boolean = () => true;
  private sousAdmin = false;
  /** Le serveur a refusé : plus rien pour cette visite. */
  private refuse = false;
  private arreter?: () => void;
  private demarrage?: Promise<void>;
  private tampon: unknown[] = [];
  /** Identifiants rrweb des nœuds sous `nm-prive` (cf. `masquerLesAttributs`). */
  private readonly noeudsPrives = new Set<number>();
  private segment = 0;
  private seq = 0;
  private minuterie?: ReturnType<typeof setInterval>;

  /**
   * À appeler une fois le rôle connu : avant, un administrateur pourrait être
   * enregistré le temps que Keycloak réponde.
   */
  installer(estAdmin: () => boolean): void {
    if (!this.isBrowser) return;
    this.estAdmin = estAdmin;
    this.sousAdmin = this.estSousAdmin(this.router.url);

    this.router.events.subscribe(e => {
      if (e instanceof NavigationStart) {
        this.sousAdmin = this.estSousAdmin(e.url);
        this.evaluer();
      }
    });

    effect(() => {
      this.consent.replayGranted();
      this.evaluer();
    }, { injector: this.injector });

    // `visibilitychange` d'abord : sur mobile, `pagehide` n'arrive pas toujours.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.envoyer(true);
    });
    window.addEventListener('pagehide', () => this.envoyer(true));
  }

  /** Démarre ou arrête selon les trois conditions. */
  evaluer(): void {
    const consenti = this.consent.replayGranted();
    const doitTourner = consenti && !this.refuse && !this.estAdmin() && !this.sousAdmin;

    if (doitTourner && !this.arreter && !this.demarrage) {
      this.demarrage = this.demarrer().finally(() => (this.demarrage = undefined));
    } else if (!doitTourner && (this.arreter || this.demarrage)) {
      // Retrait du consentement : ce qui n'est pas encore parti ne part pas.
      // Passage sous /admin : ce qui précède a été consenti, on l'envoie.
      this.stopper(consenti && !this.refuse);
    }
  }

  private async demarrer(): Promise<void> {
    let rrweb: Enregistreur;
    try {
      rrweb = await this.charger();
    } catch {
      return; // bloqué par une extension, réseau coupé : sans conséquence
    }
    // Les conditions ont pu changer pendant le téléchargement.
    if (!this.consent.replayGranted() || this.refuse || this.estAdmin() || this.sousAdmin) return;

    this.segment = this.prochainSegment();
    this.seq = 0;
    this.tampon = [];
    try {
      this.arreter = rrweb.record({
        emit: (e: unknown) => {
          // rrweb masque le texte privé, pas les attributs : on les masque ici, avant tout envoi.
          masquerLesAttributs(e, this.noeudsPrives, CLASSE_PRIVEE);
          this.tampon.push(e);
          if ((e as { type?: unknown })?.type === INSTANTANE_COMPLET || this.tampon.length >= EVENEMENTS_PAR_LOT) {
            this.envoyer(false);
          }
        },
        maskAllInputs: true,
        maskTextClass: CLASSE_PRIVEE,
        blockClass: 'nm-bloque',
        recordCanvas: false,
        collectFonts: false,
        inlineImages: false,
        sampling: { mousemove: 50, scroll: 150, input: 'last' },
        plugins: [
          rrweb.getRecordConsolePlugin({
            level: ['error'],
            lengthThreshold: 50,
            stringifyOptions: { stringLengthLimit: 500, numOfKeysLimit: 20, depthOfLimit: 2 },
          }),
        ],
      }) ?? undefined;
    } catch {
      this.arreter = undefined;
      return;
    }
    if (!this.arreter) return;
    this.actif.set(true);
    this.minuterie = setInterval(() => this.envoyer(false), INTERVALLE_ENVOI_MS);
  }

  private stopper(envoyerLeReste: boolean): void {
    try {
      this.arreter?.();
    } catch {
      /* rien à faire */
    }
    this.arreter = undefined;
    if (this.minuterie) clearInterval(this.minuterie);
    this.minuterie = undefined;
    if (envoyerLeReste) this.envoyer(false);
    this.tampon = [];
    this.actif.set(false);
  }

  /** Envoie le tampon. `fermeture` : la page se ferme, il faut `keepalive` si possible. */
  envoyer(fermeture: boolean): void {
    if (!this.tampon.length || this.refuse) return;
    const events = this.tampon;
    this.tampon = [];
    let body: string;
    try {
      body = JSON.stringify({
        sessionId: this.analytics.sessionId,
        segment: this.segment,
        seq: this.seq++,
        events,
      });
    } catch {
      return;
    }
    try {
      // `text/plain` : requête « simple » au sens de CORS, sans OPTIONS préalable.
      // Le lot envoyé à la fermeture (départ vers Keycloak) ne survit pas à un
      // aller-retour de plus. L'API le lit comme du JSON (`parseurDuRejeu`).
      void fetch(`${this.config.apiUrl}/replay`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body,
        keepalive: fermeture && body.length < LIMITE_KEEPALIVE,
      })
        .then(r => {
          if (r.status >= 400 && r.status < 500) this.abandonner();
        })
        .catch(() => {
          /* lot perdu : on n'insiste pas */
        });
    } catch {
      /* fetch indisponible : sans conséquence */
    }
  }

  /** Le serveur a refusé (plafond, visite inconnue) : on cesse pour la visite. */
  private abandonner(): void {
    this.refuse = true;
    this.stopper(false);
  }

  private prochainSegment(): number {
    try {
      const precedent = Number(sessionStorage.getItem(CLE_SEGMENT));
      const suivant = Number.isFinite(precedent) && sessionStorage.getItem(CLE_SEGMENT) !== null ? precedent + 1 : 0;
      sessionStorage.setItem(CLE_SEGMENT, String(suivant));
      return suivant;
    } catch {
      return 0;
    }
  }

  private estSousAdmin(url: string): boolean {
    return url === '/admin' || url.startsWith('/admin/') || url.startsWith('/admin?');
  }
}
