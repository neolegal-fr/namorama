import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { ReserverBoutonComponent } from '../shared/reserver-bouton';
import { BrandReport, ReportLike, Availability, NameQuality, TrademarkHit, TrademarkProximity } from '../../services/brand-report';

/**
 * Rapport de marque — état DÉBLOQUÉ, refonte étape 4.
 *
 * Affichage réutilisable et présentationnel. Utilisé par la page de partage
 * publique et par la page de vérification.
 *
 * Surface claire, contrairement à l'accueil et aux résultats : c'est un
 * document, fait pour être partagé, imprimé et relu. C'est aussi le levier
 * viral identifié dans le handoff, donc la seule page susceptible d'être vue
 * hors du produit.
 *
 * UNE section de marque et non deux, contrairement à la maquette. Celle-ci
 * montre « Marques françaises — INPI » et « Marques européennes — EUIPO » avec
 * un verdict chacune. Or l'API ne renvoie qu'un seul `trademark.match`, qui
 * couvre les deux offices ; ses `hits` portent bien une `collection` (FR / EU /
 * WO), mais pas de verdict par office. Scinder l'affichage supposerait
 * d'inventer deux verdicts à partir d'un seul — sur une question juridique,
 * c'est précisément ce qu'il ne faut pas faire. Les dépôts trouvés sont donc
 * listés avec leur office, et le périmètre est nommé explicitement.
 */
@Component({
  selector: 'app-brand-report-view',
  standalone: true,
  imports: [CommonModule, TranslatePipe, ReserverBoutonComponent],
  template: `
    @if (report; as r) {
      <article class="rv">

        <header class="rv-head">
          <div>
            <p class="rv-overline">
              {{ 'WIZARD.STEP3.REPORT_CTA' | translate }}
              @if (r.generatedAt) { · {{ r.generatedAt | date: 'd MMMM y, HH:mm' }} }
              <!-- Réactualiser se demande EN LISANT la date : c'est elle qui
                   fait douter de la fraîcheur. Icône seule et fond transparent,
                   la silhouette n'apparaissant qu'au survol — le geste est
                   secondaire, son poids visuel doit l'être aussi. -->
              <ng-content select="[refresh]"></ng-content>
            </p>
            <h2 class="rv-name">{{ r.name }}</h2>
          </div>
          <!-- Les ACTIONS du document, là où on les cherche : en haut à
               droite du document lui-même, pas dans la barre de la page.
               Elles remplacent la pastille de synthèse, qui répétait en un mot
               ce que les quatre sections disent en détail juste dessous — et
               qui, sur un document de décision, invitait à ne pas les lire. -->
          <div class="rv-head__actions rv-noprint">
            <ng-content select="[actions]"></ng-content>
          </div>
        </header>

        <!-- Le projet AVANT le nom : un rapport se relit des semaines plus
             tard, et se partage à un associé qui n'était pas là quand la
             recherche a tourné. Sans la description ni les contraintes, il
             faut deviner pourquoi ce nom a été proposé. -->
        @if (context; as ctx) {
          @if (ctx.description) {
            <section class="rv-section">
              <div class="rv-section__head">
                <h3 class="rv-section__title">{{ 'WIZARD.STEP3.REPORT_PROJECT' | translate }}</h3>
              </div>
              <!-- Nettoyée à l'AFFICHAGE, pas en base : la description peut
                   contenir du Markdown, soit collé tel quel par l'utilisateur,
                   soit hérité d'une reformulation d'avant le 05/08/2026, quand
                   l'IA en produisait encore. Réécrire ce que quelqu'un a saisi
                   serait pire que de l'afficher proprement. -->
              <p class="rv-quote nm-prive">{{ sansMarkdown(ctx.description) }}</p>
            </section>
          }
          @if (ctx.constraints?.length) {
            <section class="rv-section">
              <div class="rv-section__head">
                <h3 class="rv-section__title">{{ 'WIZARD.STEP3.REPORT_CONSTRAINTS' | translate }}</h3>
              </div>
              <div class="rv-criteria">
                @for (c of ctx.constraints; track c.label) {
                  <span class="rv-criterion">{{ c.label | translate }} <strong>{{ c.value }}</strong></span>
                }
              </div>
            </section>
          }
        }

        <!-- L'ordre du document suit celui de la décision : d'abord CE QUE
             VAUT le nom, ensuite ce qui peut l'empêcher. Les domaines et
             l'analyse sont acquis dès la recherche ; marques et réseaux
             viennent après, parce qu'ils s'achètent. -->
        @if (r.quality; as q) {
          <section class="rv-section">
            <div class="rv-section__head">
              <h3 class="rv-section__title">{{ 'WIZARD.STEP3.REPORT_QUALITY' | translate }}</h3>
              <!-- Le chiffre reste en couleur de texte ; c'est une PASTILLE
                   de verdict qui porte l'appréciation. Un nombre coloré se lit
                   comme un état sans dire lequel, et introduit des couleurs
                   ad hoc hors de l'échelle du produit. -->
              <span class="rv-section__meta">
                <span class="nm-verdict" [class]="'nm-verdict--' + scoreTone(q.score)">{{ scoreKey(q.score) | translate }}</span>
                <strong style="color: var(--nm-app-text)">{{ q.score }}/100</strong>
              </span>
            </div>
            <!-- D'ABORD ce que le nom raconte, ensuite ses notes. Les cinq
                 critères disent si le nom est bon ; ils ne disent pas ce qu'il
                 veut dire — et c'est la première question qu'on se pose devant
                 un nom inventé, celle qu'il faudra savoir répondre à un
                 associé. -->
            @if (q.origin) {
              <p class="rv-origin">{{ q.origin }}</p>
            }
            <!-- UNE seule présentation de la qualité, que le rapport soit
                 acquis ou non. La page verrouillée en avait une jolie (barres,
                 commentaire par critère) et la page acquise une liste plate de
                 « 4/5 » : deux rendus pour la même donnée, selon qu'on avait
                 payé. La barre situe la note d'un coup d'œil, et le commentaire
                 dit POURQUOI — « International 2/5 » ne se défend pas devant un
                 associé, « sens peu transparent hors du français » si. -->
            <div class="rv-criteria">
              @for (c of criteria(q); track c.label) {
                <div class="rv-criterion">
                  <div class="rv-criterion__head">
                    <span class="rv-criterion__label">{{ c.label }}</span>
                    <strong class="rv-criterion__score" [class]="'rv-criterion__score--' + c.tone">{{ c.value }}/5</strong>
                  </div>
                  <div class="rv-criterion__bar" aria-hidden="true">
                    <span [class]="'rv-criterion__fill rv-criterion__fill--' + c.tone" [style.width.%]="c.value * 20"></span>
                  </div>
                  @if (c.comment) { <span class="rv-criterion__note">{{ c.comment }}</span> }
                </div>
              }
            </div>
            @if (q.strengths) {
              <p class="rv-explain"><strong>{{ 'WIZARD.STEP3.REPORT_STRENGTHS' | translate }} :</strong> {{ q.strengths }}</p>
            }
            @if (q.watchout) {
              <p class="rv-explain"><strong>{{ 'WIZARD.STEP3.REPORT_WATCHOUT' | translate }} :</strong> {{ q.watchout }}</p>
            }
          </section>
        }

        <!-- Noms de domaine -->
        <section class="rv-section">
          <div class="rv-section__head">
            <h3 class="rv-section__title">{{ 'WIZARD.STEP3.REPORT_DOMAINS' | translate }}</h3>
            <!-- Ni « RDAP » ni l'heure : le nom du protocole ne dit rien à qui
                 lit le document, et la date de génération est déjà en tête. -->
          </div>
          @for (d of r.domains; track d.domain) {
            <div class="rv-row">
              <span class="rv-row__label">{{ d.domain }}</span>
              @if (d.status === 'free') {
                <!-- Le bureau se choisit SUR le bouton, pas dans un réglage à
                     part : au moment de réserver, la question « chez qui ? » est
                     la même que « je réserve ». Le choix est mémorisé, donc on
                     ne le repose pas à chaque ligne. -->
                <app-reserver class="rv-noprint" [query]="d.domain" campaign="brand_report"></app-reserver>
              }
              <span class="rv-badge" [class]="'rv-badge--' + badgeTone(d.status)">
                {{ statusKey(d.status) | translate }}
              </span>
            </div>
          }
        </section>

        <!-- Marques — périmètre nommé par la chaîne PARTAGÉE « TRADEMARK.SCOPE »,
             la même que sur l'accueil et dans le comparatif. Trois textes
             décrivaient trois périmètres différents pour un seul résultat. -->
        @if (r.trademark; as tm) {
        <section class="rv-section">
          <div class="rv-section__head">
            <h3 class="rv-section__title">{{ 'TRADEMARK.SCOPE' | translate }}</h3>
            @if (allClasses(tm.hits); as cls) {
              @if (cls) { <span class="rv-section__meta">{{ 'WIZARD.STEP3.REPORT_CLASSES' | translate:{ list: cls } }}</span> }
            }
          </div>

          <div class="rv-row">
            <span class="rv-row__label">{{ 'WIZARD.STEP3.REPORT_TM_IDENTICAL' | translate:{ name: r.name } }}</span>
            <span class="rv-badge" [class]="'rv-badge--' + tmTone(tm.match)">
              {{ tmHeadKey(tm.match) | translate }}
            </span>
          </div>

          <p class="rv-explain" [innerHTML]="tmExplainKey(tm.match) | translate"></p>

          <!-- La PORTÉE de ce qui vient d'être affirmé, sous le verdict et non
               en note de bas de page : « aucun dépôt identique » se lit comme
               « le nom est libre » si rien ne dit ce que la recherche n'a pas
               couvert. C'est la phrase qui protège juridiquement. -->
          <p class="rv-note rv-note--scope">{{ 'TRADEMARK.SCOPE_NOTE' | translate }}</p>

          <!-- La RAISON du « non vérifiable », quand le serveur la donne.
               Sans elle, une configuration manquante et une panne de l'INPI
               affichent le même texte : impossible de savoir s'il faut
               réessayer plus tard ou corriger un réglage. -->
          @if (tm.match === 'unknown' && tm.note) {
            <p class="rv-note">{{ r.trademark.note }}</p>
          }

          <!-- Les dépôts, RANGÉS par distance au nom cherché. À plat, la seule
               marque qui engage se noyait au milieu de dépôts remontés parce
               qu'ils partagent un mot avec le nom — ou, sur la base officielle,
               parce qu'ils ont le même mandataire. -->
          @for (g of HIT_GROUPS; track g.proximity) {
            @if (hitsOf(tm.hits, g.proximity); as group) {
              @if (group.length) {
                <div class="rv-hits-group">
                  <h4 class="rv-hits-group__title">{{ g.label | translate }}</h4>
                  <ul class="rv-hits">
                    @for (h of group; track h.name + h.applicationNumber) {
                      <li>
                        {{ h.name }}
                        <span style="color: var(--nm-app-text-2)">
                          ({{ officeLabel(h.collection) }}@if (h.classes.length) { · {{ 'WIZARD.STEP3.REPORT_CLASSES' | translate:{ list: h.classes.join(', ') } }} })
                        </span>
                      </li>
                    }
                  </ul>
                  @if (g.note) {
                    <p class="rv-note">{{ g.note | translate }}</p>
                  }
                </div>
              }
            }
          }

          <div class="rv-actions">
            @if (tm.match === 'none' || tm.match === 'similar') {
              <a class="rv-link" [href]="INPI_DEPOSIT_URL" target="_blank" rel="noopener noreferrer">
                <i class="pi pi-shield"></i> {{ 'WIZARD.STEP3.REPORT_DEPOSIT' | translate }}
              </a>
            }
            <a class="rv-link" [href]="tm.deepLink" target="_blank" rel="noopener noreferrer">
              <i class="pi pi-search"></i> {{ 'WIZARD.STEP3.REPORT_OFFICIAL' | translate }}
            </a>
          </div>
        </section>
        }

        <!-- Réseaux sociaux -->
        @if (r.socials?.length) {
          <section class="rv-section">
            <div class="rv-section__head">
              <h3 class="rv-section__title">{{ 'WIZARD.STEP3.REPORT_SOCIALS' | translate }}</h3>
              <!-- Les six plateformes NOMMÉES, et non « 6 plateformes » : le
                   lecteur qui paie doit pouvoir vérifier que la sienne y est
                   avant de payer, pas après. -->
              <span class="rv-section__meta">
                {{ 'WIZARD.STEP3.REPORT_PLATFORMS' | translate }}
              </span>
            </div>
            @for (s of r.socials ?? []; track s.platform) {
              <div class="rv-row">
                <span class="rv-row__label">
                  <!-- Le logo officiel, monochrome : il identifie le réseau
                       sans lecture. La couleur reste au verdict, à droite. -->
                  @if (socialIcon(s.platform) === 'x') {
                    <svg class="rv-social__logo" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                      <path fill="currentColor" [attr.d]="X_LOGO"></path>
                    </svg>
                  } @else {
                    <i [class]="'rv-social__logo pi ' + socialIcon(s.platform)" aria-hidden="true"></i>
                  }
                  <a [href]="s.url" target="_blank" rel="noopener noreferrer">{{ s.platform }} · &#64;{{ r.handle }}</a>
                </span>
                <span class="rv-badge" [class]="'rv-badge--' + badgeTone(s.status)">
                  {{ statusKey(s.status) | translate }}
                </span>
              </div>
            }
          </section>
        }

        <!-- Palier payant, PAS ENCORE ACQUIS.
             Il se pose là où marque et réseaux s'afficheront une fois achetés :
             la substitution se lit d'elle-même, sans qu'on ait à expliquer ce
             qui manque. Le contenu vient de l'appelant — la page ne connaît
             donc ni prix ni solde, et surtout aucun verdict payant. -->
        @if (locked) {
          <ng-content select="[locked]"></ng-content>
        }

        <!-- Pied : avertissement obligatoire + action de réservation -->
        <footer class="rv-foot">
          @if (r.disclaimer) {
            <p class="rv-disclaimer">
              {{ r.disclaimer }}
              {{ 'WIZARD.STEP3.REPORT_SCOPE_NOTE' | translate }}
            </p>
          }
          @if (heroFreeDomain(r); as hero) {
            <app-reserver class="rv-noprint" variant="cta"
                          [query]="hero.domain" [label]="hero.domain"
                          campaign="brand_report"></app-reserver>
          }
        </footer>
      </article>
    }
  `,
  styleUrl: './brand-report-view.css',
})
export class BrandReportViewComponent {
  @Input({ required: true }) report!: ReportLike;

  /**
   * Marque et réseaux pas encore achetés pour ce nom.
   *
   * La page reste LA MÊME : mêmes sections, même ordre, même mise en forme.
   * Seul le tiers payant est remplacé par la proposition de le débloquer.
   * C'est ce qui permet de dire « voici votre rapport, il se complète » plutôt
   * que de faire cohabiter deux écrans différents pour un même nom.
   */
  @Input() locked = false;

  /**
   * Le projet tel que l'utilisateur l'a décrit, et le cadre qu'il a posé.
   * Absent sur la page de partage publique, qui ne doit rien révéler du projet.
   */
  @Input() context: { description?: string; constraints?: { label: string; value: string }[] } | null = null;

  readonly INPI_DEPOSIT_URL = 'https://procedures.inpi.fr/?/marques/depot';
  /**
   * Retire la syntaxe Markdown d'un texte destiné à être lu tel quel.
   *
   * Le rapport n'interprète pas le Markdown — ce n'est pas un éditeur — donc
   * « ### Titre » et « **gras** » s'y affichent en clair, dièses et étoiles
   * compris. Les retirer rend le texte lisible sans rien réécrire à la source.
   */
  sansMarkdown(texte: string | undefined): string {
    return (texte ?? '')
      .replace(/^\s{0,3}#{1,6}\s+/gm, '')
      .replace(/^\s*([-*+]|\d+[.)])\s+/gm, '')
      .replace(/(\*\*|__)(.*?)\1/g, '$2')
      .replace(/(\*|_)(.*?)\1/g, '$2')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/^\s*>\s?/gm, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  heroFreeDomain(r: ReportLike): { extension: string; domain: string } | null {
    const free = r.domains.filter((d) => d.status === 'free');
    return free.find((d) => d.extension === 'com') ?? free[0] ?? null;
  }

  statusKey(s: Availability): string {
    return s === 'free'
      ? 'WIZARD.STEP3.STATUS_FREE'
      : s === 'taken'
        ? 'WIZARD.STEP3.STATUS_TAKEN'
        : 'WIZARD.STEP3.STATUS_UNKNOWN';
  }

  /**
   * « unknown » a sa propre pastille, distincte de « pris » : un registre
   * injoignable n'est pas un verdict.
   */
  badgeTone(s: Availability): string {
    return s === 'free' ? 'free' : s === 'taken' ? 'taken' : 'unknown';
  }

  tmTone(match: string): string {
    return match === 'none' ? 'free' : match === 'exact' ? 'taken' : match === 'similar' ? 'watch' : 'unknown';
  }

  tmHeadKey(match: string): string {
    return `WIZARD.STEP3.TM_${(match || 'unknown').toUpperCase()}_HEAD`;
  }

  tmExplainKey(match: string): string {
    return `WIZARD.STEP3.TM_${(match || 'unknown').toUpperCase()}_EXPLAIN`;
  }

  /** Synthèse d'en-tête : le pire signal l'emporte, sans jamais l'adoucir. */
  summaryTone(r: ReportLike): 'ok' | 'watch' | 'risk' {
    const match = r.trademark?.match;
    if (match === 'exact') return 'risk';
    if (match === 'similar' || match === 'unknown') return 'watch';
    if (r.domains.some((d) => d.status === 'unknown')) return 'watch';
    return 'ok';
  }

  summaryKey(r: ReportLike): string {
    const t = this.summaryTone(r);
    return t === 'ok'
      ? 'WIZARD.STEP3.REPORT_SUMMARY_OK'
      : t === 'watch'
        ? 'WIZARD.STEP3.REPORT_SUMMARY_WATCH'
        : 'WIZARD.STEP3.REPORT_SUMMARY_RISK';
  }

  /** Marque officielle de X : PrimeIcons n'a que l'ancien oiseau Twitter. */
  readonly X_LOGO =
    'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z';

  /**
   * Les SIX plateformes réellement interrogées, et elles seules.
   *
   * Instagram et Facebook y figuraient sans être interrogés (leur adaptateur
   * est marqué `planned` côté API). Une icône prête pour une plateforme muette
   * rendrait INVISIBLE le jour où l'une d'elles s'activerait à moitié : elle
   * s'afficherait comme les autres, avec un verdict qui ne vient de nulle
   * part. Sans elle, le repli `pi-globe` saute aux yeux.
   */
  private readonly SOCIAL_ICONS: Record<string, string> = {
    github: 'pi-github',
    linkedin: 'pi-linkedin',
    telegram: 'pi-telegram',
    tiktok: 'pi-tiktok',
    x: 'x',
    youtube: 'pi-youtube',
  };

  socialIcon(platform: string): string {
    return this.SOCIAL_ICONS[platform.trim().toLowerCase()] ?? 'pi-globe';
  }

  /** Appréciation d'un score, sur l'échelle de verdict du produit. */
  scoreTone(score: number): string {
    return score >= 66 ? 'free' : score >= 33 ? 'watch' : 'taken';
  }

  scoreKey(score: number): string {
    const t = this.scoreTone(score);
    return t === 'free'
      ? 'WIZARD.STEP3.SCORE_GOOD'
      : t === 'watch'
        ? 'WIZARD.STEP3.SCORE_FAIR'
        : 'WIZARD.STEP3.SCORE_WEAK';
  }

  /**
   * Les trois rangs d'affichage, du plus engageant au moins engageant.
   *
   * L'ordre est le message : ce qui porte le même nom se lit d'abord, le
   * bruit se lit en dernier et s'annonce comme tel.
   */
  readonly HIT_GROUPS = [
    { proximity: 'exact' as const, label: 'WIZARD.STEP3.TM_HITS_EXACT', note: '' },
    { proximity: 'normalized' as const, label: 'WIZARD.STEP3.TM_HITS_NORMALIZED', note: '' },
    { proximity: 'other' as const, label: 'WIZARD.STEP3.TM_HITS_OTHER', note: 'WIZARD.STEP3.TM_HITS_OTHER_NOTE' },
  ];

  /**
   * Les dépôts d'un rang donné, plafonnés.
   *
   * Un rapport antérieur au 03/09/2026 n'a pas de `proximity` : ses dépôts
   * retombent dans « autres », qui n'affirme rien — plutôt que d'être promus
   * à « même nom » sur la foi d'un champ absent.
   */
  hitsOf(hits: TrademarkHit[], proximity: TrademarkProximity): TrademarkHit[] {
    return hits.filter((h) => (h.proximity ?? 'other') === proximity).slice(0, 8);
  }

  officeLabel(c?: 'FR' | 'EU' | 'WO'): string {
    return c === 'EU' ? 'EUIPO' : c === 'WO' ? 'OMPI' : 'INPI';
  }

  /** Classes de Nice rencontrées, dédupliquées et triées. */
  allClasses(hits: TrademarkHit[]): string {
    const s = new Set<number>();
    hits.forEach((h) => h.classes?.forEach((c) => s.add(c)));
    return [...s].sort((a, b) => a - b).join(', ');
  }

  private readonly QUALITY_LABELS: Record<string, string> = {
    memorability: 'Mémorabilité',
    pronunciation: 'Prononciation',
    international: 'International',
    seo: 'SEO',
    distinctiveness: 'Distinctivité',
  };

  criteria(q: NameQuality): { label: string; value: number; comment?: string; tone: string }[] {
    return Object.entries(q.scores).map(([k, v]) => ({
      label: this.QUALITY_LABELS[k] ?? k,
      value: v,
      comment: q.comments?.[k],
      // Même échelle que les verdicts du produit : rien de neuf à apprendre.
      tone: v >= 4 ? 'free' : v === 3 ? 'watch' : 'taken',
    }));
  }
}

