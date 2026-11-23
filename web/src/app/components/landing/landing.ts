import { Component, signal, inject, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { applyContentSeo } from '../content/content-seo';

/**
 * Accueil — étape 2 de la refonte.
 *
 * Prérendue en HTML statique (SSG), en français à `/` et en anglais à `/en`.
 * Tout le texte passe par des clés `HOME.*` : au prerender, le bundle serveur
 * fournit le dictionnaire de la langue de l'URL (`PRERENDER_I18N`), donc le
 * HTML indexé contient le vrai contenu dans la bonne langue — et le même
 * composant sert les deux. C'est l'étape 8 du handoff, limitée aux deux
 * langues dont le contenu existe réellement.
 *
 * Aucune API navigateur : le composant doit rester rendu côté serveur.
 *
 * Ce qui est CONSERVÉ de la version précédente, volontairement : la FAQ, le
 * paragraphe « pour quels projets », les liens sectoriels et les liens de
 * guides. La maquette ne les montre pas, mais ce sont les seuls contenus
 * indexables du site — et la FAQ est adossée au bloc JSON-LD `FAQPage` de
 * `index.html`, qui exige que les questions soient visibles sur la page. Les
 * retirer aurait cassé le balisage en plus de vider la page de son texte.
 *
 * `p-button` n'est pas utilisé ici : les CTA de la maquette ont leurs propres
 * aplats, rayons et survols, et PrimeNG impose les siens sur ses composants.
 * Des `<a>` stylés donnent le rendu exact et restent des liens réels — donc
 * suivis par Google et ouvrables dans un nouvel onglet.
 */
@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterModule, TranslatePipe],
  template: `
    <article class="nm-landing">

      <!-- ═══ Héros — aplat sombre, pleine largeur ═══════════════════════ -->
      <section class="nm-hero">
        <div class="nm-hero__inner">

          <div class="nm-hero__col">
            <p class="nm-pill">
              <span class="nm-pill__dot" aria-hidden="true"></span>
              {{ 'HOME.PILL' | translate }}
            </p>

            <!--
              Les trois variantes sont dans le HTML prérendu (aucune injectée en
              JS) : Google et les lecteurs d'écran lisent la phrase complète
              « nom de produit / marque / société », le CSS n'en montre qu'une à
              la fois. Les séparateurs restent dans le texte, masqués à l'œil.
            -->
            <h1 class="nm-h1">
              {{ 'HOME.H1_A' | translate }} <span class="word-rotator"><span class="word-rotator__item word-rotator__item--1">{{ 'HOME.H1_W1' | translate }}</span><span class="sr-only"> / </span><span class="word-rotator__item word-rotator__item--2">{{ 'HOME.H1_W2' | translate }}</span><span class="sr-only"> / </span><span class="word-rotator__item word-rotator__item--3">{{ 'HOME.H1_W3' | translate }}</span></span><span class="sr-only">&nbsp;</span> {{ 'HOME.H1_B_PRE' | translate }} <em class="nm-h1__em">{{ 'HOME.H1_B_EM' | translate }}</em> {{ 'HOME.H1_B_POST' | translate }}
            </h1>

            <p class="nm-lead">
              {{ 'HOME.LEAD' | translate }}
            </p>

            <div class="nm-cta-row">
              <a routerLink="/app" class="nm-btn nm-btn--accent">{{ 'HOME.CTA_PRIMARY' | translate }}</a>
            </div>

            <ul class="nm-mentions">
              <li>{{ 'HOME.MENTION_1' | translate }}</li>
              <li>{{ 'HOME.MENTION_2' | translate }}</li>
              <li>{{ 'HOME.MENTION_3' | translate }}</li>
            </ul>
          </div>

          <!--
            Démonstration FIGÉE, pas un formulaire : décision explicite du
            handoff. Les segments changent le volet affiché, rien de plus —
            aucune saisie, aucun appel réseau. Les boutons portent donc
            « type="button" » et un « aria-controls » vers le panneau.
          -->
          <div class="nm-hero__col">
            <div class="nm-browser" role="group" [attr.aria-label]="'HOME.DEMO_LABEL' | translate">
              <div class="nm-browser__bar" aria-hidden="true">
                <span class="nm-browser__dot"></span>
                <span class="nm-browser__dot"></span>
                <span class="nm-browser__dot"></span>
                <span class="nm-browser__url">namorama.com/app</span>
              </div>

              <div class="nm-panel"
                   (mouseenter)="figerDemo()" (mouseleave)="reprendreDemo()"
                   (focusin)="figerDemo()">
                <!--
                  QUATRE étapes reliées par le même trait.
                  Le rapport de marque n'est pas une étape du wizard, mais
                  c'est lui qui distingue le produit : le sortir du fil rendait
                  la démonstration moins lisible qu'elle ne gagnait en
                  exactitude. Décision produit du 22/08/2026 — un visiteur
                  comprend un parcours en quatre temps ; il n'a pas à
                  apprendre, sur la page d'accueil, ce qui relève du wizard et
                  ce qui relève d'un achat.
                -->
                <div class="nm-steps">
                  @for (s of steps; track s.n) {
                    <button type="button"
                            class="nm-step"
                            [class.nm-step--on]="step() === s.n"
                            [attr.aria-pressed]="step() === s.n"
                            aria-controls="nm-demo-panel"
                            (click)="choisirEtape(s.n)">
                      <span class="nm-step__num">{{ s.n }}</span>
                      <span class="nm-step__label">{{ s.label | translate }}</span>
                    </button>
                  }
                </div>

                <p class="nm-overline">{{ ('HOME.OVERLINE_' + step()) | translate }}</p>

                <!-- Les QUATRE volets sont rendus, empilés dans une seule
                     cellule de grille : le bloc prend donc la hauteur du plus
                     grand, et ne bouge plus quand l'étape change. Un plancher
                     en pixels ne pouvait pas tenir cette promesse — la hauteur
                     d'un volet dépend de la largeur de l'écran, de la langue et
                     de la taille de police du visiteur. Les volets inactifs
                     sont masqués par « visibility », qui conserve la place et les
                     retire de l'ordre de tabulation comme de la vocalisation. -->
                <div id="nm-demo-panel" class="nm-panel__body">

                  <div class="nm-panel__pane" [class.is-active]="step() === 1">
                      <p class="nm-quote">{{ 'HOME.DEMO_QUOTE' | translate }}</p>
                      <p class="nm-note">{{ 'HOME.DEMO_NOTE_1' | translate }}</p>
                      <div class="nm-chips">
                        @for (c of chips('HOME.DEMO_CHIPS_1'); track c) { <span class="nm-chip">{{ c }}</span> }
                        <span class="nm-chip nm-chip--accent">{{ 'HOME.DEMO_CHIP_ADD' | translate }}</span>
                      </div>
                  </div>

                  <div class="nm-panel__pane" [class.is-active]="step() === 2">
                      <div class="nm-chips">
                        @for (c of chips('HOME.DEMO_CHIPS_2'); track $index) {
                          <span class="nm-chip" [class.nm-chip--accent]="$index < 2">{{ c }}</span>
                        }
                      </div>
                      <p class="nm-note">{{ 'HOME.DEMO_NOTE_2A' | translate }}</p>
                      <p class="nm-note">{{ 'HOME.DEMO_NOTE_2B' | translate }}</p>
                  </div>

                  <div class="nm-panel__pane" [class.is-active]="step() === 3">
                      <!-- Une CARTE par nom, verdict de tête à droite, reste
                           des extensions en retrait : c'est la ligne du vrai
                           écran de résultats. Les classes existaient déjà dans
                           ce gabarit sans qu'aucune règle ne les vise — les
                           lignes retombaient sur le rendu par défaut du
                           navigateur, sans cadre ni alignement. -->
                      <div class="nm-democards">
                        @for (c of demoCards; track c.name) {
                          <div class="nm-democard">
                            <span class="nm-democard__name">{{ c.name }}</span>
                            <span class="nm-democard__verdicts">
                              <span class="nm-verdict__state" [class]="'nm-verdict__state--' + c.state">@if (c.ext) {<span>{{ c.ext }} </span>}{{ c.label | translate }}</span>
                              <span class="nm-democard__rest">{{ c.rest | translate }}</span>
                            </span>
                          </div>
                        }
                      </div>
                      <p class="nm-note">{{ 'HOME.DEMO_NOTE_3' | translate }}</p>
                  </div>

                  <div class="nm-panel__pane" [class.is-active]="step() === 4">
                      <!-- Le MODÈLE du rapport, pas son prix : ce qu'on achète
                           se montre, il ne s'annonce pas.
                           Et la STRUCTURE du vrai document : deux lignes de
                           marque, les réseaux nommés. Les synthèses agrégées
                           (« Domaines libre · Réseaux libre ») ont été retirées
                           de l'application ; les vendre ici garantissait que la
                           première vraie carte déçoive. -->
                      <div class="nm-report-teaser">
                        <div class="nm-report-teaser__head">
                          <p class="nm-report-teaser__name">Roulio</p>
                          <span class="nm-report-teaser__tag">{{ 'HOME.DEMO_REPORT_TAG' | translate }}</span>
                        </div>
                        <ul class="nm-report-teaser__lines">
                          @for (l of reportLines; track l.key) {
                            <li>
                              <span>{{ l.key | translate }}</span>
                              <span class="nm-verdict__state" [class]="'nm-verdict__state--' + l.state">{{ l.value | translate }}</span>
                            </li>
                          }
                        </ul>
                        <p class="nm-note">{{ 'HOME.DEMO_NOTE_4' | translate }}</p>
                      </div>
                  </div>
                </div>

                <!-- Le vrai document, pas une maquette : quatre volets ne
                     remplacent pas la vue d'un rapport entier, verdicts
                     compris. Public, donc lisible sans compte. -->
                <p class="nm-panel__sample">
                  <a routerLink="/report" [queryParams]="{ exemple: 1 }">{{ 'HOME.SEE_SAMPLE' | translate }}</a>
                </p>
              </div>
            </div>
          </div>

        </div>
      </section>

      <!-- ═══ Sections claires ═══════════════════════════════════════════ -->
      <div class="nm-light">

        <!-- Les trois points de contrôle -->
        <section class="nm-section">
          <h2 class="nm-h2">{{ 'HOME.CONTROLS_H2' | translate }}</h2>
          <p class="nm-section__lead">{{ 'HOME.CONTROLS_LEAD' | translate }}</p>
          <div class="nm-grid-3">
            @for (c of controls; track c.overline) {
              <div class="nm-card">
                <p class="nm-card__overline">{{ c.overline | translate }}</p>
                <h3 class="nm-card__title">{{ c.title | translate }}</h3>
                <p class="nm-card__text">{{ c.text | translate }}</p>
              </div>
            }
          </div>
          <!-- Ce qui n'est pas un contrôle mais compte quand même : dit en une
               ligne, sous la grille, plutôt que déguisé en quatrième carte. -->
          <p class="nm-section__note">{{ 'HOME.CONTROLS_NOTE' | translate }}</p>

          <!-- L'appel à l'action ICI, et pas dans le héros.
               Le héros s'adresse à qui cherche un nom ; ce visiteur-là en a
               déjà un, et vient de lire pourquoi le .com libre ne suffit pas.
               C'est le moment exact où la question « et le mien ? » se pose —
               la poser trois écrans plus haut, avant l'argument, n'aurait
               répondu qu'à ceux qui la portaient déjà. -->
          <form class="nm-test" (submit)="testerNom($event)">
            <h3 class="nm-test__title">{{ 'HOME.HAVE_NAME_TITLE' | translate }}</h3>
            <p class="nm-test__lead">{{ 'HOME.HAVE_NAME_LEAD' | translate }}</p>
            <div class="nm-test__row">
              <label class="sr-only" for="nm-test-input">{{ 'HOME.HAVE_NAME_PLACEHOLDER' | translate }}</label>
              <input id="nm-test-input" name="nom" type="text" autocomplete="off"
                     [placeholder]="'HOME.HAVE_NAME_PLACEHOLDER' | translate">
              <button type="submit" class="nm-btn nm-btn--accent nm-test__btn">
                {{ 'HOME.HAVE_NAME_BTN' | translate }}
              </button>
            </div>
          </form>
        </section>

        <!-- Comparatif -->
        <section class="nm-section">
          <div class="nm-table-scroll" tabindex="0" role="region" [attr.aria-label]="'HOME.CMP_LABEL' | translate">
          <div class="nm-table" role="table">
            <div class="nm-table__row nm-table__row--head" role="row">
              <span role="columnheader">{{ 'HOME.CMP_HEAD' | translate }}</span>
              <span role="columnheader" class="nm-table__us">{{ 'HOME.CMP_US' | translate }}</span>
              <span role="columnheader">{{ 'HOME.CMP_AI' | translate }}</span>
              <span role="columnheader">{{ 'HOME.CMP_REG' | translate }}</span>
            </div>
            <!-- Chaque valeur porte le nom de sa colonne, masqué sur grand
                 écran. Sous 640px la rangée devient une carte : la colonne qui
                 nous distingue était hors champ, derrière un défilement
                 horizontal que personne ne déclenche. Les libellés portent
                 « aria-hidden » — la rangée d'en-têtes reste dans l'arbre
                 d'accessibilité, seulement masquée à l'œil, et les répéter les
                 ferait lire deux fois. -->
            @for (r of compareRows(); track r[0]) {
              <div class="nm-table__row" role="row">
                <span role="cell" class="nm-table__crit">{{ r[0] }}</span>
                <span role="cell" class="nm-table__cell nm-table__us">
                  <span class="nm-table__collabel" aria-hidden="true">{{ 'HOME.CMP_US' | translate }}</span>
                  <span>{{ r[1] }}</span>
                </span>
                <span role="cell" class="nm-table__cell">
                  <span class="nm-table__collabel" aria-hidden="true">{{ 'HOME.CMP_AI' | translate }}</span>
                  <span>{{ r[2] }}</span>
                </span>
                <span role="cell" class="nm-table__cell">
                  <span class="nm-table__collabel" aria-hidden="true">{{ 'HOME.CMP_REG' | translate }}</span>
                  <span>{{ r[3] }}</span>
                </span>
              </div>
            }
          </div>
          </div>
        </section>

        <!-- Pour qui — texte SEO conservé -->
        <section class="nm-section nm-section--narrow">
          <h2 class="nm-h2 nm-h2--alt">{{ 'HOME.WHO_H2' | translate }}</h2>
          <p class="nm-prose" [innerHTML]="'HOME.WHO_TEXT' | translate"></p>
        </section>

        <!-- FAQ — adossée au JSON-LD FAQPage d'index.html : les questions
             doivent rester visibles sur la page, sinon le balisage devient
             non conforme. -->
        <section class="nm-section nm-section--narrow">
          <h2 class="nm-h2 nm-h2--alt">{{ 'HOME.FAQ_H2' | translate }}</h2>
          <div class="nm-faq">
            @for (n of [1, 2, 3, 4]; track n) {
              <div class="nm-faq__item">
                <h3 class="nm-faq__q">{{ ('HOME.FAQ_Q' + n) | translate }}</h3>
                <p class="nm-faq__a">{{ ('HOME.FAQ_A' + n) | translate }}</p>
              </div>
            }
          </div>
        </section>

        <!-- Guides et générateurs sectoriels — maillage interne conservé.
             Hauteur minimale de 44px : ce sont des cibles tactiles. -->
        <section class="nm-section">
          <h2 class="nm-h2 nm-h2--alt">{{ 'HOME.GUIDES_H2' | translate }}</h2>
          <p class="nm-section__lead">
            {{ 'HOME.GUIDES_LEAD' | translate }}
            @if (lang !== 'fr') { <em>{{ 'HOME.GUIDES_NOTE_EN' | translate }}</em> }
          </p>
          <div class="nm-links">
            @for (l of guides; track l.path) {
              <a [routerLink]="l.path" class="nm-link-pill">{{ l.label }}</a>
            }
          </div>
        </section>

        <!-- CTA final -->
        <section class="nm-section">
          <div class="nm-final">
            <div>
              <!-- Une QUESTION, pas une affirmation : « Votre nom est encore
                   libre » annonçait un verdict sur un nom que le site ne
                   connaît pas — la phrase ne pouvait pas se comprendre avant
                   d'avoir saisi quelque chose. -->
              <h2 class="nm-final__title">{{ 'HOME.FINAL_H2' | translate }}</h2>
              <p class="nm-final__text">{{ 'HOME.FINAL_TEXT' | translate }}</p>
            </div>
            <!-- Le dernier écran demande un NOM, pas un clic. Un bouton
                 « Vérifiez votre nom maintenant » qui mène à un formulaire vide
                 ajoute une étape à qui a déjà sa réponse en tête. -->
            <form class="nm-final__form" (submit)="testerNom($event)">
              <label class="sr-only" for="nm-final-input">{{ 'HOME.HAVE_NAME_PLACEHOLDER' | translate }}</label>
              <input id="nm-final-input" name="nom" type="text" autocomplete="off"
                     [placeholder]="'HOME.HAVE_NAME_PLACEHOLDER' | translate">
              <button type="submit" class="nm-btn nm-btn--accent">{{ 'HOME.FINAL_CTA' | translate }}</button>
            </form>
          </div>
        </section>

      </div>
    </article>
  `,
  styleUrl: './landing.css',
})
export class LandingComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly translate = inject(TranslateService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  /** Langue de la page, tirée de l'URL : « /en » → en, sinon fr. */
  readonly lang: 'fr' | 'en' = this.route.snapshot.routeConfig?.path === 'en' ? 'en' : 'fr';

  constructor() {
    // Au prerender, l'APP_INITIALIZER ne connaît pas l'URL (pas de requête
    // HTTP en SSG) : c'est ici, où la route est connue, que la langue se
    // décide. `use()` est synchrone quand le dictionnaire est déjà chargé —
    // c'est le cas au prerender (PRERENDER_I18N) comme au runtime après
    // l'APP_INITIALIZER. Sans ce `use`, /en rendrait le contenu français.
    if (this.translate.currentLang() !== this.lang) {
      this.translate.use(this.lang);
    }

    // Métadonnées, canonical, <html lang> et hreflang réciproques, dans la
    // langue de l'URL. Posés au prerender, donc présents dans le HTML indexé
    // et dans les aperçus de partage — injecter côté client ne suffirait pas.
    const t = (k: string) => this.translate.instant(k) as string;
    applyContentSeo({
      title: t('HOME.META_TITLE').replace(/^Namorama — /, ''),
      description: t('HOME.META_DESC'),
      path: this.lang === 'fr' ? '/' : '/en',
      lang: this.lang,
      ogType: 'website',
      alternates: { fr: '/', en: '/en' },
      // La FAQ balisée est CELLE QUI EST AFFICHÉE : mêmes clés, même langue,
      // même page. Construite ici plutôt qu'écrite en dur dans index.html, où
      // elle contaminait les dix-neuf pages prérendues.
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        inLanguage: this.lang,
        mainEntity: [1, 2, 3, 4].map((n) => ({
          '@type': 'Question',
          name: t('HOME.FAQ_Q' + n),
          acceptedAnswer: { '@type': 'Answer', text: t('HOME.FAQ_A' + n) },
        })),
      },
    });
  }

  /** Volet affiché dans la démonstration figée du héros. */
  readonly step = signal(3);

  /**
   * Le fil de la démonstration reprend le wizard RÉEL : trois étapes, et les
   * MÊMES clés i18n — pas des libellés recopiés qui divergeraient à la
   * première retouche. Il en annonçait quatre (« Décrire · Cadrer · Domaines ·
   * Rapport ») sous d'autres mots : l'utilisateur qui cliquait « Trouver mon
   * nom » ne retrouvait ni le nombre d'étapes, ni le vocabulaire.
   *
   * Le rapport n'est pas une étape du wizard — c'est une action depuis une
   * carte. Il sort donc du fil, et se montre en volet supplémentaire.
   */
  /*
   * QUATRE étapes, alors que le fil du wizard n'en montre que trois.
   *
   * Ce n'est pas un écart : le wizard décrit la GÉNÉRATION, l'accueil décrit
   * le PRODUIT. S'arrêter aux domaines sur la page qui vend laisserait croire
   * que Namorama fait ce que font les registrars — or c'est la quatrième
   * étape, marque et réseaux, qui le distingue. Les libellés des trois
   * premières restent ceux du wizard, mot pour mot.
   */
  /**
   * Le fil défile SEUL, une étape toutes les cinq secondes.
   *
   * Quatre onglets muets supposent qu'on clique pour comprendre ; or on ne
   * clique pas sur une démonstration qu'on n'a pas encore comprise. Le
   * défilement montre le parcours sans rien demander.
   *
   * Il s'arrête dès qu'on survole, qu'on tabule dedans ou qu'on choisit une
   * étape : à partir de là c'est le visiteur qui pilote, et rien ne doit
   * bouger sous son curseur. Il ne démarre pas du tout si le système demande
   * moins d'animations.
   */
  private minuterie?: ReturnType<typeof setInterval>;
  private observateur?: IntersectionObserver;
  private pilotageManuel = false;

  ngOnInit(): void {
    this.demarrerDemo();
  }

  /**
   * Le défilement ne tourne que sous les yeux du visiteur.
   *
   * Une démonstration qui s'anime en haut de page pendant qu'on lit la FAQ ne
   * sert personne : elle consomme de la batterie et provoque un rendu toutes
   * les cinq secondes. On la met en pause dès qu'elle sort du champ.
   *
   * Sans `IntersectionObserver` (prérendu, navigateur ancien), rien ne change :
   * la minuterie lancée par `ngOnInit` continue, comme avant.
   */
  ngAfterViewInit(): void {
    if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') return;
    const panneau = document.getElementById('nm-demo-panel');
    if (!panneau) return;
    this.observateur = new IntersectionObserver(
      ([entree]) => (entree.isIntersecting ? this.reprendreDemo() : this.figerDemo()),
      { threshold: 0.15 },
    );
    this.observateur.observe(panneau);
  }

  ngOnDestroy(): void {
    this.figerDemo();
    this.observateur?.disconnect();
  }

  private demarrerDemo(): void {
    if (typeof window === 'undefined' || this.pilotageManuel) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    this.minuterie ??= setInterval(() => {
      this.step.update((n) => (n % this.steps.length) + 1);
    }, 5000);
  }

  figerDemo(): void {
    if (this.minuterie) { clearInterval(this.minuterie); this.minuterie = undefined; }
  }

  reprendreDemo(): void {
    this.demarrerDemo();
  }

  /** Un clic vaut prise en main : le défilement ne reprend plus. */
  choisirEtape(n: number): void {
    this.pilotageManuel = true;
    this.figerDemo();
    this.step.set(n);
  }

  readonly steps = [
    { n: 1, label: 'WIZARD.STEPS.DESCRIPTION' },
    { n: 2, label: 'WIZARD.STEPS.KEYWORDS' },
    // « Domaines » ici, « Résultats » dans le wizard : ce n'est pas un écart.
    // Le fil de l'accueil sépare en quatre ce que le wizard réunit en trois —
    // l'étape 3 y traite les seuls domaines, puisque marque et réseaux ont
    // leur propre étape juste après. Employer le libellé du wizard donnerait
    // « Résultats » suivi de « Marque et réseaux », c'est-à-dire un résultat
    // qui ne contient pas tout le résultat.
    { n: 3, label: 'HOME.STEP_3_DOMAINS' },
    { n: 4, label: 'WIZARD.STEPS.BRAND' },
  ];

  /**
   * Envoie le nom saisi vers l'application, qui fera le reste.
   *
   * L'accueil ne contrôle rien lui-même : le rapport public s'en charge, sans
   * demander de compte. Envoyer quelqu'un s'inscrire pour savoir si son .com
   * est libre, c'est lui faire payer d'avance une réponse gratuite.
   */
  testerNom(event: Event): void {
    event.preventDefault();
    const champ = (event.target as HTMLFormElement).elements.namedItem('nom') as HTMLInputElement | null;
    const nom = (champ?.value ?? '').trim();
    if (!nom) return;
    // Vers le rapport PUBLIC, pas vers l'application : personne n'a à créer un
    // compte pour savoir si un .com est libre. L'inscription se propose après
    // la réponse, pour ce qu'elle seule permet — marques, réseaux, suggestions.
    void this.router.navigate(['/report'], { queryParams: { name: nom } });
  }

  /** Listes courtes stockées en une clé, séparées par « | » — évite 20 clés de plus. */
  chips(key: string): string[] {
    const v = this.translate.instant(key) as string;
    return v && v !== key ? v.split('|') : [];
  }

  /** Lignes du comparatif : « critère|nous|ia|registrars;… ». */
  compareRows(): string[][] {
    const v = this.translate.instant('HOME.CMP_ROWS') as string;
    return v && v !== 'HOME.CMP_ROWS' ? v.split(';').map((r) => r.split('|')) : [];
  }

  /**
   * Trois états, jamais deux. « non vérifiable » a sa propre couleur parce
   * qu'il ne doit se confondre ni avec « libre » ni avec « pris » — et il
   * n'est jamais facturé, au même titre que « pris ».
   */
  /**
   * Plus de coût par ligne : le prix ne dépend pas des extensions. Une
   * suggestion retenue vaut 1 crédit, qu'on en vérifie une ou cinq — afficher
   * « 1 crédit » en face de chaque domaine libre suggérait l'inverse.
   */
  /**
   * Volet « domaines » — quatre noms, à l'image de l'écran de résultats.
   *
   * Le verdict de tête porte l'extension qui décide (« .com libre ») ; le
   * reste des extensions suit en retrait. Le quatrième cas est un registre
   * injoignable, et il est là exprès : c'est le troisième état du produit, et
   * il ne se déguise ni en libre ni en pris.
   */
  readonly demoCards = [
    { name: 'Roulio',  ext: '.com', state: 'free',    label: 'HOME.DEMO_FREE',    rest: 'HOME.DEMO_ALSO_FR' },
    { name: 'Velora',  ext: '.com', state: 'taken',   label: 'HOME.DEMO_TAKEN',   rest: 'HOME.DEMO_FR_FREE' },
    { name: 'Rekiclo', ext: '.com', state: 'free',    label: 'HOME.DEMO_FREE',    rest: 'HOME.DEMO_ALSO_FR_EU' },
    { name: 'Pedalio', ext: '',     state: 'unknown', label: 'HOME.DEMO_UNKNOWN', rest: 'HOME.DEMO_REGISTRY_DOWN' },
  ];

  /**
   * Volet « marque et réseaux » — les lignes du VRAI rapport.
   *
   * Deux lignes de marque, parce que le résumé n'expose que l'INPI et
   * l'EUIPO ; les réseaux nommés, groupés par verdict, parce que c'est ainsi
   * qu'on les lit. Aucun agrégat : le rapport n'en produit pas.
   */
  readonly reportLines = [
    { key: 'HOME.DEMO_REPORT_INPI',      value: 'HOME.DEMO_TM_NONE', state: 'free' },
    { key: 'HOME.DEMO_REPORT_EUIPO',     value: 'HOME.DEMO_TM_NONE', state: 'free' },
    { key: 'HOME.DEMO_REPORT_SOC_FREE',  value: 'HOME.DEMO_FREE_PL', state: 'free' },
    { key: 'HOME.DEMO_REPORT_SOC_TAKEN', value: 'HOME.DEMO_TAKEN',   state: 'taken' },
  ];

  /*
   * TROIS contrôles, et non quatre. Le quatrième — « 04 — EUROPE » — n'était
   * pas un contrôle mais un positionnement : rien n'y était vérifié. Rangé
   * parmi les vérifications, il affaiblissait les trois autres. Son contenu
   * descend en note sous la grille.
   */
  readonly controls = [
    { overline: 'HOME.C1_OVER', title: 'HOME.C1_TITLE', text: 'HOME.C1_TEXT' },
    { overline: 'HOME.C2_OVER', title: 'HOME.C2_TITLE', text: 'HOME.C2_TEXT' },
    /*
     * Le périmètre des marques est décrit par UNE chaîne, `TRADEMARK.SCOPE`,
     * partagée avec le rapport et le comparatif. Recopiée dans une clé
     * `HOME.C3_TITLE`, elle divergeait à la première retouche : l'accueil
     * annonçait trois registres pendant que la grille n'affichait que deux
     * lignes de verdict.
     */
    { overline: 'HOME.C3_OVER', title: 'TRADEMARK.SCOPE', text: 'HOME.C3_TEXT' },
  ];

  /** Liens de guides — en français seulement : ces pages n'existent que dans cette langue. */
  readonly guides = [
    { path: '/generateur-nom-de-marque',               label: 'Générateur de nom de marque' },
    { path: '/generateur-nom-entreprise',              label: "Nom d'entreprise et de société" },
    { path: '/generateur-nom-de-domaine',              label: 'Générateur de nom de domaine' },
    { path: '/recherche-anteriorite-marque-inpi',      label: "Recherche d'antériorité (INPI)" },
    { path: '/generateur-nom-marque-vetement',         label: 'Nom de marque de vêtements' },
    { path: '/generateur-nom-saas',                    label: 'Nom de startup SaaS' },
    { path: '/generateur-nom-marque-cosmetique',       label: 'Nom de marque cosmétique' },
    { path: '/generateur-nom-ecommerce',               label: 'Nom de boutique en ligne' },
    { path: '/nom-de-startup-court-invente',           label: 'Nom court inventé' },
    { path: '/generateur-nom-startup-ia',              label: 'Nom de startup IA' },
    { path: '/generateur-nom-de-produit',              label: 'Nom de produit' },
    { path: '/guides/trouver-nom-de-marque',           label: 'Trouver un nom de marque' },
    { path: '/guides/trouver-nom-entreprise',          label: "Trouver un nom d'entreprise" },
    { path: '/guides/trouver-nom-de-startup',          label: 'Trouver un nom de startup' },
    { path: '/verifier-disponibilite-nom-de-marque',   label: 'Vérifier une marque avant de déposer' },
    { path: '/comparatif-generateurs-de-noms',         label: 'Comparatif des générateurs' },
    { path: '/blog',                                   label: 'Tous les articles du blog' },
  ];
}

