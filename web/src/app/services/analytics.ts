import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ConfigService } from './config';

declare function gtag(...args: any[]): void;

/** Origine d'une visite, telle que le navigateur la connaît à son arrivée. */
export interface OrigineDuDemarrage {
  arrivee: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  referent?: string;
}

/**
 * Lit l'origine d'une visite à partir de l'adresse d'arrivée et du référent.
 *
 * Le référent est réduit ICI à son domaine : son chemin peut porter une donnée
 * personnelle (`…/inbox?user=…`), qui ne doit transiter nulle part. Un référent
 * du même site est une navigation interne, et n'est pas une origine. Le serveur
 * refiltre tout de toute façon (`api/src/common/funnel/origine.ts`).
 */
export function origineDuDemarrage(adresse: string, referent: string): OrigineDuDemarrage {
  const url = new URL(adresse);
  const origine: OrigineDuDemarrage = { arrivee: url.pathname };
  for (const [param, cle] of [['utm_source', 'utmSource'], ['utm_medium', 'utmMedium'], ['utm_campaign', 'utmCampaign']] as const) {
    const valeur = url.searchParams.get(param);
    if (valeur) origine[cle] = valeur.slice(0, 100);
  }
  if (referent) {
    try {
      const ref = new URL(referent);
      if ((ref.protocol === 'http:' || ref.protocol === 'https:') && ref.hostname !== url.hostname) {
        origine.referent = ref.hostname;
      }
    } catch {
      /* référent illisible : ignoré */
    }
  }
  return origine;
}

/**
 * Traçage du parcours utilisateur.
 *
 * Deux destinations, volontairement :
 * - **notre API** (`POST /events`), toujours appelée. Anonyme, sans cookie :
 *   un identifiant de session éphémère vit en `sessionStorage` et disparaît à
 *   la fermeture de l'onglet. C'est ce qui permet de mesurer les abandons de
 *   ceux qui refusent les cookies — c'est-à-dire, justement, ceux qui partent
 *   le plus tôt ;
 * - **Google Analytics**, si présent et si le consentement a été donné (le
 *   Consent Mode s'en charge), pour les tableaux de bord d'audience.
 *
 * Le traçage ne doit jamais gêner l'utilisateur : tout échec est ignoré, et
 * l'envoi passe par `sendBeacon` quand c'est possible pour survivre à une
 * navigation immédiate.
 */
@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly config = inject(ConfigService);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  /**
   * Origine de la visite, lue À LA CRÉATION du service, au démarrage du
   * composant racine. Le premier `page_viewed` ne part qu'après la réponse de
   * Keycloak : d'ici là, l'adresse a pu perdre ses paramètres (`?avis` retiré,
   * fragments de Keycloak). Jointe au seul premier affichage, puis oubliée.
   */
  private origine: OrigineDuDemarrage | null = this.lireOrigine();

  private lireOrigine(): OrigineDuDemarrage | null {
    if (!this.isBrowser) return null;
    try {
      return origineDuDemarrage(window.location.href, document.referrer);
    } catch {
      return null;
    }
  }

  /**
   * Identifiant de la visite en cours, créé au besoin.
   *
   * Public : l'intercepteur HTTP le pose sur chaque appel à l'API, pour que le
   * serveur puisse rattacher une recherche ou une inscription à la visite qui
   * les a produites. Vide hors navigateur (prerender).
   */
  get sessionId(): string {
    if (!this.isBrowser) return '';
    let id = sessionStorage.getItem('nm_sid');
    if (!id) {
      id = (crypto.randomUUID?.() ?? String(Date.now() + Math.random())).slice(0, 36);
      sessionStorage.setItem('nm_sid', id);
    }
    return id;
  }

  /**
   * Enregistre l'affichage d'une page.
   *
   * C'est le SEUL événement qui compte une visite, et donc le dénominateur de
   * tout l'entonnoir : sans lui, quelqu'un qui arrive, lit et repart ne laisse
   * aucune trace nulle part — ni dans les logs, ni dans Google Analytics, qui
   * ne voit que ceux ayant accepté la bannière.
   *
   * `connecte` distingue les visites arrivées avec une session déjà ouverte :
   * elles ne peuvent pas créer de compte, et gonfleraient le dénominateur du
   * taux d'inscription.
   */
  pageView(path: string, connecte: boolean): void {
    // L'origine ne part qu'avec le premier affichage du document : le serveur
    // ne l'écrit qu'à la création de la visite, et la répéter à chaque page
    // n'ajouterait que du bruit dans les logs.
    const origine = this.origine;
    this.origine = null;
    this.track('page_viewed', { path, connecte, ...(origine ?? {}) });
  }

  /** Enregistre une étape de parcours ou une action notable. */
  track(name: string, meta: Record<string, unknown> = {}): void {
    if (!this.isBrowser) return;

    try {
      const body = JSON.stringify({ name, sessionId: this.sessionId, meta });
      const url = `${this.config.apiUrl}/events`;

      // sendBeacon survit à une navigation ou à une fermeture d'onglet, ce que
      // fetch ne garantit pas — indispensable pour tracer un abandon.
      if (navigator.sendBeacon) {
        navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
      } else {
        void fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          keepalive: true,
        }).catch(() => {});
      }
    } catch {
      /* le traçage ne doit jamais interrompre le parcours */
    }

    try {
      if (typeof gtag === 'function') gtag('event', name, meta);
    } catch {
      /* GA absent ou bloqué par un adblocker : sans conséquence */
    }
  }

  /**
   * Remonte les erreurs JavaScript non capturées : ce sont celles que
   * l'utilisateur subit sans qu'aucune trace n'arrive côté serveur.
   */
  installErrorReporting(): void {
    if (!this.isBrowser) return;

    window.addEventListener('error', (e) => {
      /*
       * « Script error. » sans fichier ni ligne n'est pas une erreur du
       * produit : c'est ce que le navigateur affiche quand le script fautif
       * vient d'une AUTRE origine sans en-tête CORS — une extension du
       * navigateur, un traceur tiers. Le détail est masqué par sécurité, et
       * aucun réglage de notre côté ne le révélera.
       *
       * On le dit dans l'événement plutôt que de laisser cinq lignes
       * indéchiffrables se lire comme cinq bogues à corriger. Et quand
       * l'erreur vient bien de notre code, la pile part avec : c'est elle qui
       * permet de retrouver l'appel, le nom de fichier minifié ne suffisant
       * pas.
       */
      const masquee = e.message === 'Script error.' && !e.filename;
      this.track('client_error', {
        message: e.message,
        source: `${e.filename}:${e.lineno}`,
        origin: masquee ? 'externe' : 'application',
        stack: String((e.error as Error | undefined)?.stack ?? '').slice(0, 300),
        path: location.pathname,
      });
    });

    window.addEventListener('unhandledrejection', (e) => {
      this.track('client_unhandled_rejection', {
        message: String((e.reason as any)?.message ?? e.reason).slice(0, 300),
        path: location.pathname,
      });
    });
  }
}
