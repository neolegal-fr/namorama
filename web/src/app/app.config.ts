import { ApplicationConfig, provideBrowserGlobalErrorListeners, APP_INITIALIZER, PLATFORM_ID, InjectionToken, LOCALE_ID } from '@angular/core';
import { isPlatformBrowser, registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';

// Sans cet enregistrement, `DatePipe` formate en en-US : « 19 Aug » au lieu de
// « 19 août » sur les cartes vérifiées. Les deux langues du site sont fr et en ;
// `en` est le défaut d'Angular, seul `fr` doit être ajouté.
registerLocaleData(localeFr);
import { provideRouter, withInMemoryScrolling, RouteReuseStrategy } from '@angular/router';
import { WizardReuseStrategy } from './wizard-reuse-strategy';
import { provideHttpClient, withInterceptorsFromDi, withFetch } from '@angular/common/http';
import { of, firstValueFrom, from, map } from 'rxjs';

/**
 * Dictionnaires des langues servies, chargés à la demande par le bundler :
 * chacun devient un fichier au nom haché, donc jamais servi périmé (voir
 * `CustomTranslateLoader`). Les autres langues du dépôt, non proposées,
 * gardent l'URL fixe.
 */
const DICTIONNAIRES_VERSIONNES: Record<string, () => Promise<unknown>> = {
  fr: () => import('../../public/assets/i18n/fr.json'),
  en: () => import('../../public/assets/i18n/en.json'),
};
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeuix/themes/aura';
import { definePreset } from '@primeuix/themes';
import { ConfirmationService, MessageService } from 'primeng/api';
import { KeycloakService, KeycloakBearerInterceptor } from 'keycloak-angular';
import { HTTP_INTERCEPTORS, HttpClient } from '@angular/common/http';
import { provideTranslateService, TranslateLoader, TranslateService } from '@ngx-translate/core';
import { importProvidersFrom } from '@angular/core';
import { Observable } from 'rxjs';

import { routes } from './app.routes';
import { ConfigService } from './services/config';
import { SessionKeeperService } from './services/session-keeper';
import { AnalyticsService } from './services/analytics';
import { SessionIdInterceptor } from './services/session-id.interceptor';

/**
 * Langues dont l'accueil existe VRAIMENT : il a une URL prérendue, ses
 * métadonnées et son contenu dans cette langue. Les 17 autres langues de
 * l'interface restent servies côté client, mais n'ont pas d'URL propre —
 * leur donner un `/de/` qui servirait du français créerait du contenu
 * dupliqué, ce que Google pénalise. À étendre langue par langue, quand le
 * contenu existe.
 */
export const SITE_LANGS = ['fr', 'en'] as const;
export type SiteLang = (typeof SITE_LANGS)[number];

/** Langue portée par l'URL (« /en », « /en/… »), `fr` par défaut — la racine est française. */
export function langFromPath(path: string): SiteLang {
  const seg = path.split('?')[0].split('#')[0].split('/').filter(Boolean)[0];
  return (SITE_LANGS as readonly string[]).includes(seg) ? (seg as SiteLang) : 'fr';
}

/**
 * Dictionnaires i18n fournis au PRERENDER, lus sur le disque par le bundle
 * serveur (voir `app.config.server.ts`). Vide côté navigateur. C'est ce qui
 * permet de prérendre l'accueil en anglais avec son vrai contenu, et non des
 * clés brutes — sans jamais embarquer `fs` dans le bundle client.
 */
export const PRERENDER_I18N = new InjectionToken<Record<string, unknown>>('PRERENDER_I18N', {
  providedIn: 'root',
  factory: () => ({}),
});

export class CustomTranslateLoader implements TranslateLoader {
  constructor(
    private http: HttpClient,
    private isBrowser: boolean,
    private prerendered: Record<string, unknown> = {},
  ) {}
  getTranslation(lang: string): Observable<any> {
    // Au prerender (SSG), aucune requête HTTP n'est possible : on sert le
    // dictionnaire chargé sur disque par le bundle serveur, ou rien.
    if (!this.isBrowser) return of(this.prerendered[lang] ?? {});

    // Chemin ABSOLU, impérativement. En relatif, « ./assets/… » se résout
    // contre l'URL courante : depuis /guides/xxx ou /projects/:id, la requête
    // partait vers /guides/assets/i18n/de.json, où le fallback SPA de nginx
    // renvoie index.html avec un code 200. ngx-translate recevait donc du HTML
    // au lieu du JSON, échouait sans bruit, et changer de langue ne faisait
    // plus rien dès qu'on n'était pas à la racine.
    //
    // Les deux langues servies passent par le BUNDLER, pas par une URL fixe.
    // `/assets/i18n/fr.json` garde son nom d'une version à l'autre : le
    // 31/10/2026, des navigateurs qui l'avaient en cache (servi sans
    // Cache-Control) faisaient tourner le nouveau code avec d'anciennes
    // traductions — l'ancien titre « Vos préférences » à côté de chaque clé
    // nouvelle, tombée sur le repli anglais. Importé, le dictionnaire devient
    // un fichier au nom haché : un texte modifié change l'URL, et le cache ne
    // peut plus mentir.
    const versionne = DICTIONNAIRES_VERSIONNES[lang];
    if (versionne) return from(versionne()).pipe(map((m: any) => m.default ?? m));
    return this.http.get(`/assets/i18n/${lang}.json`);
  }
}

export function HttpLoaderFactory(http: HttpClient, platformId: Object, prerendered: Record<string, unknown>) {
  return new CustomTranslateLoader(http, isPlatformBrowser(platformId), prerendered);
}

/**
 * Délai au-delà duquel on cesse d'attendre Keycloak au démarrage.
 *
 * 8 s : assez pour une connexion lente ou un serveur qui s'éveille, assez
 * court pour qu'un utilisateur n'ait pas le sentiment d'une page morte.
 */
const KEYCLOAK_INIT_TIMEOUT_MS = 8000;

function initializeApp(
  keycloak: KeycloakService,
  translate: TranslateService,
  config: ConfigService,
  platformId: Object,
  sessionKeeper: SessionKeeperService,
  analytics: AnalyticsService,

) {
  return async () => {
    /*
     * Les deux langues RÉELLEMENT servies. Les dix-sept autres fichiers
     * restent dans le dépôt mais ne sont plus proposés : à 158 clés sur 456,
     * ils donnaient un produit mi-traduit. Compléter l'un d'eux, c'est
     * l'ajouter ici et dans `AppComponent.languages`.
     *
     * Conséquence voulue : un navigateur en allemand reçoit désormais
     * l'anglais, entièrement, plutôt qu'un tiers d'allemand.
     */
    const supportedLangs = ['fr', 'en'];
    translate.addLangs(supportedLangs);
    /*
     * Repli en ANGLAIS, et non en français.
     *
     * Dix-sept des dix-neuf langues n'ont que 158 des 456 clés : tout le reste
     * tombe sur le repli. Un germanophone lisait donc du français au milieu de
     * son écran — une langue qu'il ne parle pas forcément, sur un produit qui
     * facture. L'anglais est complet (456/456) et se lit à peu près partout.
     *
     * Le français n'y perd rien : c'est la langue de RÉFÉRENCE, aucune de ses
     * clés ne manque, elle ne passe donc jamais par le repli.
     */
    translate.setFallbackLang('en');

    // Côté serveur (prerender SSG) : pas de Keycloak, pas de fetch relatif,
    // pas de navigator. Français par défaut ; une page anglaise (« /en ») bascule
    // elle-même la langue depuis sa route — au prerender statique il n'y a pas
    // de requête HTTP, donc `REQUEST` est nul et l'APP_INITIALIZER ne connaît
    // pas l'URL. Le dictionnaire étant déjà en mémoire (`PRERENDER_I18N`), la
    // bascule dans le composant est synchrone.
    if (!isPlatformBrowser(platformId)) {
      await firstValueFrom(translate.use('fr'));
      return;
    }

    // 1. Charger la config runtime (URLs d'env)
    await config.load();

    // 2. Initialiser Keycloak
    //
    // Le try/catch évite une page blanche sur Safari : ITP bloque l'iframe du
    // silent check-sso (Storage Access API), ce qui fait échouer keycloak.init()
    // et gèle l'APP_INITIALIZER si l'erreur n'est pas capturée.
    //
    // Mais il ne suffit pas : quand l'iframe est bloquée par une CSP
    // `frame-ancestors` plutôt que par une erreur réseau, `keycloak.init()` ne
    // rejette PAS — il attend un postMessage qui n'arrivera jamais. La promesse
    // reste alors en suspens, l'APP_INITIALIZER ne se résout jamais, et
    // l'application ne démarre pas : la page prérendue reste affichée, d'aspect
    // normal, mais AUCUN élément n'est interactif. C'est un mode de panne
    // silencieux, et d'autant plus trompeur que la page paraît correcte.
    //
    // D'où la course contre un délai : au-delà, on charge en mode non
    // authentifié, exactement comme le fait déjà le catch en cas d'échec.
    // Mieux vaut une application utilisable où l'utilisateur doit cliquer sur
    // « Connexion » qu'une application figée.
    try {
      await Promise.race([
        keycloak.init({
        config: {
          url: config.keycloakUrl,
          realm: 'namorama',
          clientId: 'namorama-web'
        },
        initOptions: {
          onLoad: 'check-sso',
          silentCheckSsoRedirectUri:
            window.location.origin + '/assets/silent-check-sso.html',
          checkLoginIframe: false
        },
        bearerExcludedUrls: ['/assets']
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('keycloak init timeout')), KEYCLOAK_INIT_TIMEOUT_MS),
        ),
      ]);
    } catch {
      // SSO check bloqué (Safari ITP, navigateur sans cookies tiers, etc.)
      // L'app charge en mode non-authentifié ; l'utilisateur peut se connecter manuellement.
    }

    // 2 bis. Renouvellement périodique du jeton tant que l'onglet est utilisé,
    // pour ne pas tomber sur le timeout d'inactivité entre deux appels API.
    sessionKeeper.start();

    // Remonte les erreurs JavaScript non capturées : sans ça, un plantage du
    // front ne laisse aucune trace côté serveur.
    analytics.installErrorReporting();

    // 3. Langue : l'URL prime (« /en » est une page anglaise, quoi qu'en dise
    // le navigateur) ; sinon, détection depuis le navigateur comme avant.
    /*
     * ATTENDRE le dictionnaire, ne pas seulement le demander.
     *
     * `use()` renvoie un observable : sans l'attendre, l'application démarre
     * pendant que le fichier de langue arrive encore. Tout ce qui lit une
     * traduction de façon IMPÉRATIVE à ce moment-là — `instant()` dans un
     * constructeur — reçoit le repli anglais, et ne se corrige jamais : les
     * gabarits, eux, se rafraîchissent tout seuls à l'arrivée du dictionnaire,
     * mais un titre d'onglet posé une fois reste posé.
     *
     * C'est ce qui affichait « Find a brand name that is genuinely free » sur
     * l'accueil FRANÇAIS, dont le HTML prérendu portait pourtant le bon titre.
     */
    const urlLang = window.location.pathname.split('/').filter(Boolean)[0];
    if ((SITE_LANGS as readonly string[]).includes(urlLang)) {
      await firstValueFrom(translate.use(urlLang));
      return;
    }
    const browserLang = translate.getBrowserLang() ?? '';
    /*
     * Langue du navigateur si elle est servie, sinon l'ANGLAIS.
     *
     * Le repli était le français : un navigateur allemand, italien ou japonais
     * recevait donc un produit en français. L'anglais se lit plus largement, et
     * un visiteur francophone n'est pas concerné — son navigateur annonce
     * « fr », qui est servi.
     */
    await firstValueFrom(translate.use(supportedLangs.includes(browserLang) ? browserLang : 'en'));
  };
}

/**
 * Préréglage PrimeNG aligné sur les tokens de la refonte.
 *
 * Sans cela, les tokens `--nm-*` ne toucheraient que le code écrit à la main :
 * les boutons, champs et badges PrimeNG resteraient sur l'émeraude `#10b981`
 * de l'ancienne marque, et deux verts cohabiteraient à l'écran.
 *
 * Les valeurs sont écrites en dur plutôt qu'en `var(--nm-…)` : PrimeNG dérive
 * ses propres jetons de cette palette (survols, états désactivés, halos de
 * focus) par des calculs de couleur, et ne sait pas le faire depuis une
 * référence CSS non résolue.
 *
 * L'échelle est construite autour des deux accents du design — `#3ddc91` pour
 * les surfaces sombres, `#0d9a63` pour les surfaces claires — placés
 * respectivement en 400 et 600, et non l'un des deux étiré sur dix nuances.
 */
const NamoramaPreset = definePreset(Aura, {
  semantic: {
    /**
     * Échelle de gris alignée sur celle du système.
     *
     * Aura est légèrement BLEUTÉE là où la palette du design est verdâtre :
     * côte à côte — un `p-card` à côté d'une carte de résultat, un `p-chip` à
     * côté d'une pilule — l'écart se voit. Comme `darkModeSelector` est
     * désormais actif, ces gris pilotent aussi le mode sombre de tous les
     * composants PrimeNG : sans cet alignement, le sombre de PrimeNG et le
     * nôtre coexisteraient à l'écran.
     */
    colorScheme: {
      /*
       * ⚠ Une rampe `surface` n'est PAS « nos surfaces rangées dans l'ordre » :
       * c'est une échelle de luminosité que PrimeNG parcourt DANS LES DEUX
       * SENS. En sombre, Aura prend `surface.0` pour le texte, `surface.400`
       * pour le texte secondaire et `surface.900/950` pour les fonds.
       *
       * La rampe sombre posée ici partait de nos fonds sombres dès l'indice
       * 300 : `text.mutedColor = {surface.400}` valait donc #2a3236, du
       * quasi-noir sur du quasi-noir. C'est ce qui rendait illisibles, en mode
       * sombre, le libellé « Projets » du menu (1,38:1), les étapes inactives
       * du fil (1,43:1) et le choix segmenté (1,48:1).
       *
       * Les deux rampes vont donc du plus clair (0) au plus foncé (950), comme
       * `slate` et `zinc` chez Aura, avec la teinte verdâtre du design. Chaque
       * correspondance sémantique d'Aura a été mesurée : toutes passent AA.
       */
      light: {
        surface: {
          0:   '#ffffff',
          50:  '#fbfcfb',
          100: '#f4f6f5',
          200: '#eef1f0',
          300: '#e3e7e5',
          400: '#aab3af',  // icônes et bordures au survol — plus décoratif que lisible
          500: '#5c6663',  // text.mutedColor : 5,94:1 sur blanc
          600: '#4a534f',
          700: '#2c3532',  // text.color : 12,63:1 sur blanc
          800: '#1b211f',
          900: '#0b0e10',
          950: '#070909',
        },
        /*
         * `primary.color` sert d'APLAT sous un libellé blanc. Aura le prend en
         * `{primary.500}` — notre #16c47a, soit 2,28:1 avec du blanc : tous les
         * boutons primaires du mode clair échouaient, ainsi que l'étape active
         * du fil. On force donc le vert d'aplat déjà retenu pour nos propres
         * boutons (`--nm-app-accent-fill`), mesuré à 5,37:1.
         */
        primary: {
          color: '#0d7a4e',
          contrastColor: '#ffffff',
          hoverColor: '#0a6b44',
          activeColor: '#075437',
        },
      },
      dark: {
        surface: {
          0:   '#f2f5f3',  // text.color : 16,45:1 sur nos cartes sombres
          50:  '#e4e9e6',
          100: '#c9d3ce',
          200: '#b0bcb7',
          300: '#9aa5a0',  // text.hoverMutedColor
          400: '#8a938f',  // text.mutedColor : 5,72:1 sur nos cartes sombres
          500: '#7c8782',  // indications de saisie : 5,20:1 sur le fond de page
          600: '#3a4448',  // bordures au survol
          700: '#232b2f',  // bordures
          800: '#1b2225',
          900: '#12171a',  // fond de contenu = --nm-surface-dark
          950: '#0b0e10',  // fond de champ = --nm-bg-dark
        },
      },
    },
    primary: {
      50:  '#eafaf2',
      100: '#c9f3de',
      200: '#a3ebc8',
      300: '#6ee7a8',  // --nm-accent-hover
      400: '#3ddc91',  // --nm-accent — surfaces sombres
      500: '#16c47a',
      600: '#0d9a63',  // --nm-accent-on-light — surfaces claires (AA sur blanc)
      700: '#0b8355',  // --nm-accent-on-light-hover
      800: '#0a6b46',
      900: '#075437',
      950: '#062018',  // --nm-on-accent
    },
  },
});

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // La langue d'affichage des dates suit l'URL, comme le reste du site.
    { provide: LOCALE_ID, useFactory: () => (typeof window !== 'undefined' && window.location.pathname.split('/')[1] === 'en' ? 'en' : 'fr') },
    // Par défaut, Angular conserve la position de défilement d'une route à
    // l'autre : un lien situé en bas de la page d'accueil ouvrait donc la page
    // suivante à la même hauteur, c'est-à-dire au milieu ou en bas de l'article.
    // 'enabled' remet en haut à chaque nouvelle navigation, tout en restaurant
    // la position d'origine lors d'un retour arrière.
    provideRouter(
      routes,
      withInMemoryScrolling({
        scrollPositionRestoration: 'enabled',
        anchorScrolling: 'enabled',
      }),
    ),
    { provide: RouteReuseStrategy, useClass: WizardReuseStrategy },
    provideHttpClient(withInterceptorsFromDi(), withFetch()),
    /*
     * PAS de `provideAnimations()`.
     *
     * Il enveloppe le moteur de rendu : les suppressions de nœuds ne sont plus
     * appliquées tout de suite, elles sont mises en file et vidées au prochain
     * cycle de détection de changement. Le voile du tiroir, que PrimeNG retire
     * par ce moteur, restait donc sur `document.body` après l'ouverture d'un
     * projet — et comme il avale tous les clics, plus rien ne déclenchait le
     * cycle qui l'aurait effacé : la page restait grisée jusqu'au F5.
     *
     * Personne ne le réclame : `@angular/animations` n'est importé nulle part
     * dans `src/`, et PrimeNG 21 anime en CSS (directive `pMotion`).
     */
    providePrimeNG({
        theme: {
            preset: NamoramaPreset,
            options: {
                // MÊME attribut que celui posé par ThemeService et par le
                // script synchrone d'index.html. Sans cela, p-select, p-dialog,
                // p-drawer, p-chip et les tooltips resteraient clairs quoi que
                // fassent nos jetons : deux thèmes superposés.
                //
                // Les surfaces choisies pour des raisons éditoriales — héros de
                // l'accueil, CTA final, encart de démonstration — ne basculent
                // pas pour autant : elles portent les jetons `--nm-*-dark` en
                // dur, indépendamment du mode.
                darkModeSelector: '[data-theme="dark"]'
            }
        }
    }),
    // ngx-translate 18 a retiré `TranslateModule` : la configuration passe par
    // des providers autonomes, et les composants importent `TranslatePipe`.
    provideTranslateService({
      loader: {
        provide: TranslateLoader,
        useFactory: HttpLoaderFactory,
        deps: [HttpClient, PLATFORM_ID, PRERENDER_I18N]
      }
    }),
    {
      provide: APP_INITIALIZER,
      useFactory: initializeApp,
      multi: true,
      deps: [KeycloakService, TranslateService, ConfigService, PLATFORM_ID, SessionKeeperService, AnalyticsService]
    },
    KeycloakService,
    {
      provide: HTTP_INTERCEPTORS,
      useClass: KeycloakBearerInterceptor,
      multi: true
    },
    // Rattache chaque appel API à la visite en cours : c'est ce qui permet au
    // tableau de bord de compter « sur 100 visiteurs, combien lancent une
    // recherche ». Anonyme, sans cookie — cf. SessionIdInterceptor.
    {
      provide: HTTP_INTERCEPTORS,
      useClass: SessionIdInterceptor,
      multi: true
    },
    ConfirmationService,
    MessageService
  ]
};
