import { Component, input, output, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { SafeHtml } from '@angular/platform-browser';
import { BrandReportSummary } from '../../services/brand-report';
import { VisibleOnceDirective } from './visible-once.directive';

/** Une extension et son verdict, tels qu'affichés sur une carte. */
interface ExtVerdict {
  ext: string;
  domain: string;
  /** true = libre · false = pris · null = non vérifiable · undefined = en cours */
  state: boolean | null | undefined;
  key: 'free' | 'taken' | 'unknown' | 'pending';
}

/**
 * Grille de cartes de résultats — étape 3 de la refonte.
 *
 * Remplace la matrice `p-table` (noms × extensions) par des cartes, comme le
 * demande la maquette. Composant PRÉSENTATIONNEL et séparé, volontairement :
 * le wizard fait 1760 lignes de logique (crédits, favoris, projets,
 * paiements) et réécrire son gabarit en place aurait mêlé un changement
 * d'apparence à du code critique. Ici, il ne passe que des données et reçoit
 * des événements — sa logique reste intacte.
 *
 * Ce que la maquette ne montre pas mais qui est CONSERVÉ, parce que ce sont
 * des fonctions réelles du produit : les notes pouce haut/bas (qui nourrissent
 * la génération suivante), les badges de style, et l'analyse en étoiles
 * dépliable.
 *
 * Ce que la maquette montre et qui n'est PAS repris : le bouton « Réserver »
 * vers le registrar. Il avait été retiré du produit au profit du rapport de
 * marque (US-054) ; le réintroduire serait une décision produit, pas un
 * habillage.
 */
@Component({
  selector: 'app-results-grid',
  standalone: true,
  imports: [CommonModule, TranslatePipe, VisibleOnceDirective],
  template: `
    <!-- Bandeau de crédits — pièce maîtresse du modèle économique : le débit
         doit être incontestable, donc énoncé avant les résultats. -->
    <!-- Filtres. Aucun ne porte sur une donnée payante (INPI, réseaux) :
         elle n'existe pas sur les noms dont le rapport n'est pas acheté. -->
    <div class="rg-filters" role="group" aria-label="Filtrer les résultats">
      @for (f of filters; track f.key) {
        <button type="button"
                class="nm-filter"
                [class.nm-filter--on]="filter() === f.key"
                [attr.aria-pressed]="filter() === f.key"
                (click)="filter.set(f.key)">
          {{ f.label | translate }} <span class="nm-filter__n">{{ count(f.key) }}</span>
        </button>
      }

      <!-- À part : c'est la seule vue qui montre ce qu'on a écarté. Absente
           tant qu'aucun nom n'a été rejeté. -->
      @if (count('rejected') > 0) {
        <span class="rg-filters__sep" aria-hidden="true"></span>
        <button type="button"
                class="nm-filter nm-filter--rejected"
                [class.nm-filter--on]="filter() === 'rejected'"
                [attr.aria-pressed]="filter() === 'rejected'"
                (click)="filter.set('rejected')">
          {{ 'WIZARD.STEP3.GRID_FILTER_REJECTED' | translate }} <span class="nm-filter__n">{{ count('rejected') }}</span>
        </button>
      }
    </div>

    @if (visible().length === 0) {
      <p class="rg-empty">{{ 'WIZARD.STEP3.GRID_EMPTY' | translate }}</p>
    }

    <div class="rg-grid">
      <!-- Suivi par le NOM, pas par l'identifiant. Pendant le streaming, les
           cartes arrivent sans identifiant et ne le reçoivent qu'à la fin de
           la recherche : suivre l'identifiant revenait à donner la même clé
           (nulle) à toutes les cartes d'un même flux. Le nom est unique dans
           la liste — l'API écarte les noms déjà testés, l'ajout manuel les
           doublons — et existe dès la première image. -->
      @for (d of visible(); track d.name) {
        <!-- La directive porte le NOM et non l'identifiant : pendant le
             streaming, la carte s'affiche avant que le serveur n'ait rendu
             l'identifiant de sa suggestion. Le nom, lui, existe dès la
             première image. -->
        <article class="rg-card" [class.rg-card--strong]="allFree(d)"
                 [nmVisibleOnce]="d.name" (visibleOnce)="carteVue.emit($event)">

          <!-- En-tête sur UNE ligne, toujours.
               Il enveloppait quand le nom était long : les pouces passaient
               dessous, l'en-tête gagnait la hauteur d'un bouton, et toutes les
               lignes des cartes voisines cessaient de s'aligner — or la
               comparaison ligne à ligne est l'objet même de cet écran. -->
          <header class="rg-card__head">
            <div class="rg-card__id">
              <h3 class="rg-card__name">{{ d.name }}</h3>
              @if (d.isManual) {
                <i class="pi pi-pencil rg-card__manual" [attr.aria-label]="'WIZARD.STEP3.MANUAL_TOOLTIP' | translate"></i>
              }
            </div>

            <!--
              Les pouces vivent DANS l'en-tête, à droite du nom : ils portent
              sur le nom, pas sur le rapport. Près du bouton d'achat, leur objet
              devenait ambigu.
            -->
            <div class="rg-rate" *ngIf="!readOnly()">
              <button type="button" class="rg-icon"
                      [class.rg-icon--on]="isLiked(d)"
                      [attr.aria-label]="'WIZARD.STEP3.RATE_LIKED' | translate"
                      [attr.aria-pressed]="isLiked(d)"
                      (click)="rate.emit({ result: d, rating: isLiked(d) ? 'neutral' : 'liked' })">
                <i class="pi" [class.pi-thumbs-up-fill]="isLiked(d)" [class.pi-thumbs-up]="!isLiked(d)"></i>
              </button>
              <button type="button" class="rg-icon"
                      [class.rg-icon--off]="d.rating === 'disliked'"
                      [attr.aria-label]="'WIZARD.STEP3.RATE_DISLIKED' | translate"
                      [attr.aria-pressed]="d.rating === 'disliked'"
                      (click)="rate.emit({ result: d, rating: d.rating === 'disliked' ? 'neutral' : 'disliked' })">
                <i class="pi" [class.pi-thumbs-down-fill]="d.rating === 'disliked'" [class.pi-thumbs-down]="d.rating !== 'disliked'"></i>
              </button>
            </div>
          </header>

          <!-- Plus de pastille de synthèse.
               « à surveiller », « 3 obstacles » : l'utilisateur ne sait pas
               d'où sort le chiffre ni ce qu'il recouvre, et la carte le lui dit
               déjà ligne par ligne, en nommant chaque source. Un résumé qu'on
               ne peut pas vérifier d'un coup d'œil n'aide pas à décider. -->
          <!--
            Règle d'alignement : toutes les lignes existent dans LES DEUX
            états, au même endroit et dans le même ordre. Seule la colonne de
            droite change — de « non vérifié » au verdict réel. Rien ne se
            déplace après l'achat, ce qui rend comparables un nom vérifié et un
            nom qui ne l'est pas.
          -->
          <!-- La QUALITÉ d'abord : c'est ce que l'outil apporte et que les
               registrars ne donnent pas. La disponibilité vient ensuite — elle
               ne vaut d'être lue que si le nom, lui, vaut quelque chose. -->
          <ul class="rg-rows">
            <li class="rg-row rg-row--analysis">
              <span class="rg-row__label">{{ 'WIZARD.STEP3.GRID_ANALYSIS' | translate }}</span>
              @if (d.analysisPending) {
                <span class="rg-row__value rg-row__value--pending"><i class="pi pi-spin pi-spinner"></i></span>
              } @else if (d.analysis) {
                <button type="button" class="rg-stars" (click)="toggleAnalysis.emit(d.id)"
                        [attr.aria-expanded]="expandedAnalysisId() === d.id"
                        [attr.aria-label]="('WIZARD.STEP3.ANALYSIS_TOGGLE' | translate) + ' — ' + starScore(d.analysis) + '/5'">
                  @for (filled of stars(d.analysis); track $index) {
                    <i class="pi" [class.pi-star-fill]="filled" [class.pi-star]="!filled" aria-hidden="true"></i>
                  }
                  <span class="sr-only">{{ starScore(d.analysis) }}/5</span>
                  <i class="pi pi-chevron-down rg-stars__chev" aria-hidden="true"
                     [style.transform]="expandedAnalysisId() === d.id ? 'rotate(180deg)' : 'rotate(0deg)'"></i>
                </button>
              } @else {
                <!-- Un tiret ne disait rien : ni « pas encore », ni « jamais »,
                     ni comment l'obtenir — il se lisait comme une panne. Le
                     calcul reste à la demande (un appel au modèle par nom, sur
                     trente cartes, pour une donnée que personne ne lit
                     toujours), mais il s'annonce et se déclenche d'un clic. -->
                <button type="button" class="rg-analyse" *ngIf="!readOnly()" (click)="analyse.emit(d.id)">
                  {{ 'WIZARD.STEP3.GRID_ANALYSE_NOW' | translate }}
                </button>
              }
            </li>
          </ul>

          <ul class="rg-rows">
            @for (v of verdicts(d); track v.ext) {
              <li class="rg-row">
                <span class="rg-row__label">{{ v.domain }}</span>
                @switch (v.key) {
                  @case ('pending') {
                    <span class="rg-row__value rg-row__value--pending">
                      <i class="pi pi-spin pi-spinner"></i> {{ 'WIZARD.STEP3.GRID_CHECKING' | translate }}
                    </span>
                  }
                  @default {
                    <span class="rg-row__value" [class]="'rg-v--' + v.key">{{ stateLabel(v.key) | translate }}</span>
                  }
                }
              </li>
            }

            <!--
              L'analyse est une LIGNE LIBELLÉE, présente sur TOUTES les cartes.
              Sans libellé, on lit les étoiles comme une note de disponibilité
              ou un avis d'autres utilisateurs. Et une ligne qui n'existe que
              sur certaines cartes décale les suivantes : les noms cessent
              d'être comparables, ce qui est l'objet même de cet écran.
              Pas encore calculée : un tiret. JAMAIS cinq étoiles vides, qui se
              lisent comme une note nulle.
            -->
          </ul>

          @if (expandedAnalysisId() === d.id && d.analysis) {
            <div class="rg-analysis" [innerHTML]="analysisHtml(d.analysis)"></div>
          }

          <div class="rg-sep" aria-hidden="true"></div>

          <!-- Palier payant : trois lignes, jamais une seule mention. Elles
               nomment les registres et les plateformes, ce qui dispense le
               bouton de les répéter. -->
          <!-- Les trois lignes du palier payant sont CLIQUABLES tant qu'elles
               sont verrouillées : c'est là que le regard se pose en se demandant
               « et pour ce nom ? ». Répondre « allez chercher le bouton en bas »
               à un geste aussi naturel, c'est perdre l'intention au moment où
               elle existe. Une fois vérifiées, elles redeviennent du texte : il
               n'y a plus rien à déclencher. -->
          <ul class="rg-rows" [class.rg-rows--locked]="!summaryOf(d)"
              [attr.role]="!summaryOf(d) ? 'button' : null"
              [attr.tabindex]="!summaryOf(d) ? 0 : null"
              [attr.aria-label]="!summaryOf(d) ? (('WIZARD.STEP3.GRID_VERIFY' | translate) + ' — ' + d.name) : null"
              (click)="!summaryOf(d) && !readOnly() && verify.emit(d.name)"
              (keydown.enter)="!summaryOf(d) && !readOnly() && verify.emit(d.name)"
              (keydown.space)="!summaryOf(d) && !readOnly() && verify.emit(d.name)">
            <li class="rg-row">
              <span class="rg-row__label">{{ 'WIZARD.STEP3.GRID_TM_INPI' | translate }}</span>
              @if (summaryOf(d); as sum) {
                <span class="rg-row__value" [class]="'rg-v--' + tmTone(sum, 'inpi')">{{ tmKey(sum, 'inpi') | translate }}</span>
              } @else {
                <span class="rg-row__value rg-row__value--locked"><i class="pi pi-lock"></i> {{ 'WIZARD.STEP3.GRID_UNVERIFIED' | translate }}</span>
              }
            </li>
            <li class="rg-row">
              <span class="rg-row__label">{{ 'WIZARD.STEP3.GRID_TM_EUIPO' | translate }}</span>
              @if (summaryOf(d); as sum) {
                <span class="rg-row__value" [class]="'rg-v--' + tmTone(sum, 'euipo')">{{ tmKey(sum, 'euipo') | translate }}</span>
              } @else {
                <span class="rg-row__value rg-row__value--locked"><i class="pi pi-lock"></i> {{ 'WIZARD.STEP3.GRID_UNVERIFIED' | translate }}</span>
              }
            </li>

            <!--
              Une ligne de pastilles plutôt qu'une ligne par plateforme : quatre
              lignes de plus par carte feraient un mur sur neuf cartes, alors que
              les pastilles nomment chaque réseau et montrent chaque état.
              Le détail compte — un produit B2B se soucie de LinkedIn, une marque
              grand public de TikTok.
              Accessibilité : la couleur ne porte jamais l'information seule, un
              symbole l'accompagne ; le nom complet et l'état sont dans « title »,
              et le symbole est aria-hidden.
            -->
            <li class="rg-row">
              <span class="rg-row__label">{{ 'WIZARD.STEP3.GRID_SOCIALS' | translate }}</span>
              <span class="rg-socials">
                @for (s of socialsOf(d); track s.name) {
                  <span class="rg-social" [class]="'rg-social--' + s.tone" [attr.title]="s.title">
                    @if (s.icon === 'x') {
                      <svg class="rg-social__logo" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                        <path fill="currentColor" [attr.d]="X_LOGO"></path>
                      </svg>
                    } @else {
                      <i class="rg-social__logo pi" [class]="'rg-social__logo pi ' + s.icon" aria-hidden="true"></i>
                    }
                    <span class="sr-only">{{ s.name }}</span>
                    <!-- Une ICÔNE de la police du produit, et non un emoji :
                         « 🔒 » sortait en carré vide partout où aucune police
                         d'emoji n'est installée — six carrés par carte. « ✓ »
                         et « ✗ » ont le même défaut dans une police d'affichage
                         incomplète. -->
                    <i class="rg-social__mark pi" [class]="'rg-social__mark pi ' + s.mark" aria-hidden="true"></i>
                  </span>
                }
              </span>
            </li>
          </ul>

          <div class="rg-actions">
            <!-- La date porte sur CE QUE LA CARTE MONTRE, domaines compris :
                 un registre bouge, un nom libre hier peut être déposé
                 aujourd'hui. Le geste de réactualiser tient dans une icône —
                 un libellé pour une action secondaire pesait autant que les
                 boutons du dessous. -->
            <p class="rg-checked">
              @if (checkedLabel(d); as label) {
                <span>{{ label.key | translate:label.params }}</span>
              } @else {
                <span class="rg-checked--none">{{ 'WIZARD.STEP3.GRID_CHECKED_UNKNOWN' | translate }}</span>
              }
              <!-- Le title est porté par le SPAN, pas par le bouton : un
                   bouton « disabled » n'émet aucun événement de souris, donc son
                   infobulle ne s'affiche jamais — l'utilisateur voit une icône
                   grisée sans savoir pourquoi. -->
              <span class="rg-refresh__wrap" *ngIf="!readOnly()"
                    [attr.title]="(checkTooRecent(d) ? 'WIZARD.STEP3.GRID_RECHECK_SOON' : 'WIZARD.STEP3.GRID_RECHECK_DOMAINS') | translate">
                <button type="button" class="rg-refresh"
                        [disabled]="checkTooRecent(d)"
                        [attr.aria-label]="((checkTooRecent(d) ? 'WIZARD.STEP3.GRID_RECHECK_SOON' : 'WIZARD.STEP3.GRID_RECHECK_DOMAINS') | translate) + ' — ' + d.name"
                        (click)="summaryOf(d) ? refresh.emit(d.name) : refreshDomains.emit(d.name)">
                  <i class="pi pi-refresh" aria-hidden="true"></i>
                </button>
              </span>
            </p>

            <!-- UNE rangée, toujours de la même hauteur : deux boutons tant que
                 marque et réseaux restent à acheter, un seul ensuite. Ce qui
                 disparaît, c'est l'ACTION D'ACHAT — elle n'a plus d'objet — et
                 non la ligne, dont la hauteur garde les cartes comparables. -->
            <div class="rg-actions__row">
              @if (!summaryOf(d) && !readOnly()) {
                <button type="button" class="rg-btn rg-btn--buy" (click)="verify.emit(d.name)">
                  <i class="pi pi-search" aria-hidden="true"></i>
                  {{ 'WIZARD.STEP3.GRID_VERIFY_SHORT' | translate }}
                </button>
              }
              <button type="button" class="rg-btn rg-btn--ghost" (click)="openReport.emit(d.name)">
                <i class="pi pi-file-pdf" aria-hidden="true"></i>
                {{ 'WIZARD.STEP3.GRID_FULL_REPORT' | translate }}
              </button>
            </div>
          </div>
        </article>
      }
    </div>
  `,
  styleUrl: './results-grid.css',
})
export class ResultsGridComponent {
  private readonly translate = inject(TranslateService);
  /**
   * Entrées SIGNAL et non `@Input` classiques : `visible()` est
   * des `computed`, qui ne suivent que des signaux. Avec des entrées ordinaires
   * ils auraient été calculés une fois puis figés — la grille aurait cessé de
   * se mettre à jour dès la première vérification de domaine arrivée.
   */
  readonly domains = input.required<any[]>();
  readonly extensions = input.required<string[]>();
  /** Synthèses des noms vérifiés, indexées par nom normalisé. */
  readonly summaries = input<BrandReportSummary[]>([]);
  readonly reportCost = input(50);
  /**
   * Projet consulté en LECTURE SEULE : on masque ce qui écrit ou dépense.
   *
   * Le serveur refuse déjà ces gestes ; les proposer quand même reviendrait à
   * promettre une action qui échouera. On garde tout ce qui se lit — verdicts,
   * rapport déjà acheté — car c'est précisément ce qu'un partage en lecture
   * donne le droit de voir.
   */
  readonly readOnly = input(false);
  readonly expandedAnalysisId = input<string | null>(null);
  readonly analysisRenderer = input<(a: string | null) => SafeHtml>(() => '' as unknown as SafeHtml);

  /**
   * Lecture de la note, fournie par le wizard.
   *
   * La grille en avait sa PROPRE version : une expression régulière cherchant
   * « n/5 » dans le texte. Or l'analyse arrive aujourd'hui en JSON, où ce motif
   * n'existe pas — toute carte analysée affichait donc cinq étoiles vides, ce
   * qui se lit comme une note nulle, exactement ce que la refonte interdit.
   * Une seule lecture, celle du wizard, qui connaît les deux formats.
   */
  readonly analysisScorer = input<(a: string | null) => number>(() => 0);
  /**
   * Normalisation des noms. Doit rester identique à `normName()` du wizard,
   * qui alimente les synthèses — sans quoi un nom vérifié ne serait pas
   * reconnu sur sa carte.
   */
  readonly normalize = input<(n: string) => string>((n) => (n || '').trim().toLowerCase());

  readonly rate = output<{ result: any; rating: 'liked' | 'disliked' | 'neutral' }>();
  readonly openReport = output<string>();
  readonly verify = output<string>();
  readonly refresh = output<string>();
  /** Réactualiser la seule disponibilité des domaines de ce nom. */
  readonly refreshDomains = output<string>();
  /** Calculer l'analyse de ce nom, à la demande (identifiant de suggestion). */
  readonly analyse = output<string>();
  readonly toggleAnalysis = output<string>();

  /**
   * Cette carte vient d'entrer dans le champ de vision (nom de domaine).
   *
   * C'est ce qui déclenche le calcul de l'analyse, plutôt que la fin de la
   * recherche : voir {@link VisibleOnceDirective} pour ce que l'ancien
   * déclenchement coûtait.
   */
  readonly carteVue = output<string>();

  readonly filter = signal<'all' | 'free' | 'report' | 'fav' | 'rejected'>('all');

  /**
   * Filtres EXCLUSIFS : une seule vue à la fois.
   *
   * « Rejetés » en fait partie plutôt que d'être une bascule à côté. Une
   * bascule « afficher aussi les rejetés » impose deux modèles mentaux dans la
   * même barre — un choix exclusif ET un cumul — et son libellé doit
   * s'expliquer lui-même. Or le besoin réel est de REVOIR ce qu'on a écarté,
   * pour se raviser : c'est une vue, pas un ajout à la vue courante. On y
   * entre, on remet un pouce à zéro, le nom quitte la liste.
   *
   * Il est séparé des quatre autres et n'apparaît qu'en cas de besoin : un
   * filtre qui ne renverrait jamais rien serait du bruit permanent.
   */
  readonly filters = [
    { key: 'all' as const,    label: 'WIZARD.STEP3.GRID_FILTER_ALL' },
    { key: 'free' as const,   label: 'WIZARD.STEP3.GRID_FILTER_FREE' },
    { key: 'report' as const, label: 'WIZARD.STEP3.GRID_FILTER_REPORT' },
    { key: 'fav' as const,    label: 'WIZARD.STEP3.GRID_FILTER_FAV' },
  ];

  /**
   * Combien de noms chaque filtre renverrait.
   *
   * Affiché sur la pastille : sans le compte, on clique pour découvrir une
   * liste vide, et on ne sait pas si « Favoris » vaut le détour. Le compte
   * répond avant le clic.
   */
  count(key: string): number {
    return this.domains().filter((d) => this.matches(d, key)).length;
  }

  private matches(d: any, f: string): boolean {
    const rejete = d.rating === 'disliked';
    if (f === 'rejected') return rejete;
    if (rejete) return false; // les rejetés ne reviennent que par leur propre vue
    if (f === 'free') return this.allFree(d);
    if (f === 'report') return !!this.summaryOf(d);
    if (f === 'fav') return this.isLiked(d);
    return true;
  }

  private readonly byName = computed(() => {
    const m = new Map<string, BrandReportSummary>();
    for (const s of this.summaries()) m.set(s.nameKey, s);
    return m;
  });

  summaryOf(d: any): BrandReportSummary | undefined {
    return this.byName().get(this.normalize()(d.name));
  }

  /**
   * Vérifier vaut approbation : dépenser 50 crédits sur un nom est le signal
   * d'intérêt le plus fort du produit, bien plus fiable qu'un clic sur un
   * pouce. Le pouce s'affiche donc actif sur une carte vérifiée — et reste
   * cliquable pour se dédire.
   */
  isLiked(d: any): boolean {
    return d.rating === 'liked' || (!!this.summaryOf(d) && d.rating !== 'disliked');
  }

  /**
   * Filtrage LOCAL à l'affichage, puis tri par ENGAGEMENT — vérifiés, aimés,
   * puis ordre de génération. La grille remonte ainsi d'elle-même la liste
   * courte : après deux vérifications, les finalistes sont les deux premières
   * cartes, sans tri manuel.
   *
   * Tri STABLE, obligatoire : deux noms de même rang gardent leur ordre de
   * génération. Sans cela les cartes se réordonnent sous le curseur à chaque
   * notation. `Array.prototype.sort` est stable depuis ES2019, mais on trie
   * une copie — trier `domains()` en place muterait l'entrée du parent.
   */
  readonly visible = computed(() => {
    const f = this.filter();
    const kept = this.domains().filter((d) => this.matches(d, f));
    const rank = (d: any) => (this.summaryOf(d) ? 0 : this.isLiked(d) ? 1 : 2);
    return [...kept].sort((a, b) => rank(a) - rank(b));
  });

  /** Toutes les extensions demandées sont libres — le cas que l'on cherche. */
  allFree(d: any): boolean {
    const exts = this.extensions();
    return exts.length > 0 && this.freeCount(d) === exts.length;
  }

  freeCount(d: any): number {
    return this.extensions().filter((e) => d.allExtensions?.[e] === true).length;
  }

  verdicts(d: any): ExtVerdict[] {
    return this.extensions().map((ext) => {
      const state = d.allExtensions?.[ext];
      const key: ExtVerdict['key'] =
        state === true ? 'free' : state === false ? 'taken' : state === null ? 'unknown' : 'pending';
      const suffix = ext.startsWith('.') ? ext : '.' + ext;
      return { ext, domain: d.name.toLowerCase() + suffix, state, key };
    });
  }

  /**
   * Trois états, jamais deux. « non vérifiable » ne se confond ni avec
   * « libre » ni avec « pris » : c'est la règle de fond du produit.
   */
  stateLabel(key: ExtVerdict['key']): string {
    return key === 'free'
      ? 'WIZARD.STEP3.GRID_FREE'
      : key === 'taken'
        ? 'WIZARD.STEP3.GRID_TAKEN'
        : 'WIZARD.STEP3.GRID_UNKNOWN';
  }

  /**
   * Verdict de marque par office. L'API n'expose qu'un `match` couvrant les
   * deux : on ne l'éclate pas en deux verdicts inventés — chaque office reprend
   * le verdict global, et la présence de dépôts dans sa collection le nuance.
   * Sur une question juridique, mieux vaut répéter que deviner.
   */
  tmTone(sum: BrandReportSummary, office: 'inpi' | 'euipo'): string {
    const hits = office === 'inpi' ? sum.inpiHits : sum.euipoHits;
    if (sum.trademark === 'exact' && hits) return 'taken';
    if (sum.trademark === 'unknown') return 'unknown';
    if (sum.trademark === 'similar' && hits) return 'watch';
    return 'free';
  }

  tmKey(sum: BrandReportSummary, office: 'inpi' | 'euipo'): string {
    const t = this.tmTone(sum, office);
    return t === 'taken'
      ? 'WIZARD.STEP3.GRID_TM_FILED'
      : t === 'watch'
        ? 'WIZARD.STEP3.GRID_TM_CLOSE'
        : t === 'unknown'
          ? 'WIZARD.STEP3.GRID_UNKNOWN'
          : 'WIZARD.STEP3.GRID_TM_NONE';
  }

  /**
   * Pastilles de réseaux — les SIX réellement interrogées.
   *
   * Instagram et Facebook en sont absents tant que leur adaptateur renvoie
   * `unknown` par construction (voir `ACTIVE_PLATFORMS` côté API) : une
   * plateforme non interrogée qui s'affiche quand même dévalue les autres.
   *
   * Les marques officielles, en MONOCHROME. Les abréviations qui les
   * précédaient — « GH », « in », « TG », « TT » — demandaient d'être décodées
   * une par une ; un logo se reconnaît sans lecture.
   *
   * Monochrome et jamais en couleurs de marque : le rose d'Instagram et le
   * cyan de TikTok entreraient en concurrence avec le code libre/pris, qui est
   * l'information utile. Le logo dit DE QUEL réseau il s'agit, la couleur dit
   * son état — deux rôles, jamais mélangés.
   *
   * X a son propre glyphe : PrimeIcons ne propose que `pi-twitter`, l'oiseau,
   * abandonné en 2023. Afficher l'ancien logo d'un réseau renommé sèmerait le
   * doute sur la fraîcheur de la vérification elle-même.
   */
  /** Marque officielle de X, PrimeIcons n'ayant que l'ancien oiseau Twitter. */
  readonly X_LOGO =
    'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z';

  private readonly PLATFORMS = [
    { icon: 'pi-github',   name: 'GitHub' },
    { icon: 'pi-linkedin', name: 'LinkedIn' },
    { icon: 'pi-telegram', name: 'Telegram' },
    { icon: 'pi-tiktok',   name: 'TikTok' },
    { icon: 'x',           name: 'X' },
    { icon: 'pi-youtube',  name: 'YouTube' },
  ];

  socialsOf(d: any): { icon: string; name: string; tone: string; mark: string; title: string }[] {
    const sum = this.summaryOf(d);
    const t = (k: string) => this.translate.instant(k) as string;
    return this.PLATFORMS.map((p) => {
      const found = sum?.socials.find((s) => s.platform.toLowerCase() === p.name.toLowerCase());
      if (!sum || !found) {
        return { icon: p.icon, name: p.name, tone: 'locked', mark: 'pi-lock', title: `${p.name} — ${t('WIZARD.STEP3.GRID_UNVERIFIED')}` };
      }
      const tone = found.status === 'free' ? 'free' : found.status === 'taken' ? 'taken' : 'unknown';
      const mark = tone === 'free' ? 'pi-check' : tone === 'taken' ? 'pi-times' : 'pi-question';
      const label = t(tone === 'free' ? 'WIZARD.STEP3.GRID_FREE' : tone === 'taken' ? 'WIZARD.STEP3.GRID_TAKEN' : 'WIZARD.STEP3.GRID_UNKNOWN');
      return { icon: p.icon, name: p.name, tone, mark, title: `${p.name} — ${label}` };
    });
  }

  /** Synthèse : le pire signal l'emporte, jamais adouci. */
  synthTone(sum: BrandReportSummary): 'ok' | 'watch' | 'risk' {
    const blockers = [this.tmTone(sum, 'inpi'), this.tmTone(sum, 'euipo')].filter((t) => t === 'taken').length
      + sum.socials.filter((s) => s.status === 'taken').length;
    if (blockers >= 2) return 'risk';
    if (blockers === 1 || sum.trademark === 'similar' || sum.trademark === 'unknown') return 'watch';
    return 'ok';
  }

  synthKey(sum: BrandReportSummary): string {
    const t = this.synthTone(sum);
    if (t === 'ok') return 'WIZARD.STEP3.GRID_SYNTH_OK';
    if (t === 'watch') return 'WIZARD.STEP3.GRID_SYNTH_WATCH';
    // Le singulier a sa propre clé : « 1 obstacles » se remarque.
    return this.blockerCount(sum) === 1 ? 'WIZARD.STEP3.GRID_SYNTH_RISK_ONE' : 'WIZARD.STEP3.GRID_SYNTH_RISK';
  }

  /**
   * Depuis quand le contenu de la carte tient.
   *
   * Deux sources, et la plus ANCIENNE l'emporte : la carte annonce une seule
   * date pour tout ce qu'elle montre, et dire « vérifié aujourd'hui » parce
   * que la marque l'a été, alors que les domaines datent de la semaine
   * dernière, serait faux là où ça compte.
   */
  checkedAt(d: any): Date | null {
    const dates = [d.checkedAt, this.summaryOf(d)?.verifiedAt]
      .filter(Boolean)
      .map((v: any) => new Date(v))
      .filter((x) => !isNaN(x.getTime()));
    if (!dates.length) return null;
    return new Date(Math.min(...dates.map((x) => x.getTime())));
  }

  /** Libellé de fraîcheur : « à l'instant », « il y a 3 h », puis la date. */
  checkedLabel(d: any): { key: string; params?: Record<string, unknown> } | null {
    const at = this.checkedAt(d);
    if (!at) return null;
    const min = Math.floor((this.now - at.getTime()) / 60000);
    if (min < 2) return { key: 'WIZARD.STEP3.GRID_CHECKED_NOW' };
    if (min < 60) return { key: 'WIZARD.STEP3.GRID_CHECKED_MIN', params: { n: min } };
    const h = Math.floor(min / 60);
    if (h < 24) return { key: 'WIZARD.STEP3.GRID_CHECKED_HOURS', params: { n: h } };
    return { key: 'WIZARD.STEP3.GRID_CHECKED_ON', params: { date: at.toLocaleDateString() } };
  }

  /**
   * Marque et réseaux déjà vérifiés il y a moins de 24 h.
   *
   * On ne repasse pas : les registres de marques ne bougent pas d'un jour à
   * l'autre, et une requête INPI par carte et par heure viderait le quota
   * partagé du produit. Le bouton reste VISIBLE mais inerte — le faire
   * disparaître décalerait à nouveau les cartes entre elles.
   */
  checkTooRecent(d: any): boolean {
    const at = this.summaryOf(d)?.verifiedAt;
    if (!at) return false; // jamais vérifié : le bouton achète
    return this.now - new Date(at).getTime() < 24 * 3600 * 1000;
  }

  /** Instant du rendu, figé : recalculer à chaque cycle ferait clignoter les libellés. */
  private readonly now = Date.now();

  /** Nombre d'obstacles : « obstacles » sans chiffre n'est pas un libellé. */
  blockerCount(sum: BrandReportSummary): number {
    return [this.tmTone(sum, 'inpi'), this.tmTone(sum, 'euipo')].filter((t) => t === 'taken').length
      + sum.socials.filter((s) => s.status === 'taken').length;
  }

  /** Note sur 5, lue dans le texte d'analyse. Exposée aux lecteurs d'écran :
      cinq images d'étoiles ne disent rien à qui ne les voit pas. */
  starScore(analysis: string | null): number {
    return Math.round(this.analysisScorer()(analysis));
  }

  stars(analysis: string | null): boolean[] {
    const score = this.starScore(analysis);
    return Array.from({ length: 5 }, (_, i) => i < score);
  }

  analysisHtml(a: string | null): SafeHtml {
    return this.analysisRenderer()(a);
  }
}

