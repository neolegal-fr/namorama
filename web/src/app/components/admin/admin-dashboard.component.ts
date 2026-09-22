import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { SelectButtonModule } from 'primeng/selectbutton';
import { DatePickerModule } from 'primeng/datepicker';
import { AdminModelCosts, AdminService, AdminSeries, AdminStats, PeriodMetrics } from '../../services/admin.service';
import { AdminWeeklyChartComponent, ChartPoint } from './admin-weekly-chart.component';
import { AdminModelCostsComponent } from './admin-model-costs.component';

interface PeriodOption { label: string; days: number | null; }

/**
 * Un indicateur et son pendant sur la période précédente.
 *
 * `value` et `previous` acceptent `null` — « non mesurable » n'est pas zéro, et
 * la carte doit pouvoir le dire au lieu d'afficher un chiffre inventé.
 */
interface Kpi {
  label: string;
  value: number | null;
  previous: number | null;
  /** `pct` change la lecture de l'écart : des POINTS, pas un pourcentage de pourcentage. */
  unit?: 'count' | 'pct';
  /** Précision sous la valeur (« 3 sur 7 inscrits »). */
  detail?: string;
  /** Pourquoi la valeur manque, quand elle manque. */
  indispo?: string;
}

/**
 * Une marche de l'entonnoir.
 *
 * `pourcentage` peut manquer : sans visiteur sur la période, un taux de
 * conversion n'a pas de dénominateur, et afficher 0 % ferait passer une
 * absence de trafic pour un échec de conversion.
 */
interface EtapeEntonnoir {
  label: string;
  pourcentage: number | null;
  /** Le compte brut et son dénominateur — un pourcentage seul se lit mal à ces volumes. */
  detail: string;
}

interface Ecart {
  affiche: boolean;
  texte: string;
  sens: 'hausse' | 'baisse' | 'stable';
  /** Ce que le badge résume, en clair, au survol. */
  titre: string;
}

/** Nombre de semaines d'historique demandées à l'API. Six mois. */
const SEMAINES = 26;

/**
 * Sous ce socle, un pourcentage ment.
 *
 * À une poignée d'événements par semaine, passer de 1 à 4 s'afficherait
 * « +300 % » et 0 → 1 n'aurait pas de pourcentage du tout. En dessous, la carte
 * montre l'écart absolu — « +3 » — qui est la seule chose que la donnée dit.
 */
const SOCLE_POURCENTAGE = 5;

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [
    CommonModule, FormsModule, TranslatePipe,
    ButtonModule, SelectButtonModule, DatePickerModule,
    AdminWeeklyChartComponent, AdminModelCostsComponent,
  ],
  template: `
    <div style="display: flex; flex-direction: column; gap: 1.5rem; padding-top: 1rem">

      <!-- Sélecteur de période : une seule barre de filtre, au-dessus de tout
           ce qu'elle cadre. Les graphiques d'historique, plus bas, ne sont
           PAS cadrés par elle — d'où leur section séparée et son titre. -->
      <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 0.5rem; justify-content: flex-end">
        <p-selectButton [options]="periodOptions" [(ngModel)]="selectedPeriod"
                        optionLabel="label" (ngModelChange)="onPeriodChange()"
                        styleClass="text-sm">
        </p-selectButton>
        <ng-container *ngIf="selectedPeriod.days === null">
          <p-datepicker [(ngModel)]="customFrom" [showIcon]="false" dateFormat="dd/mm/yy"
                        [placeholder]="'ADMIN.FROM' | translate" inputStyleClass="text-sm"
                        style="width: 8rem">
          </p-datepicker>
          <span class="text-500 text-sm">→</span>
          <p-datepicker [(ngModel)]="customTo" [showIcon]="false" dateFormat="dd/mm/yy"
                        [placeholder]="'ADMIN.TO' | translate" inputStyleClass="text-sm"
                        style="width: 8rem">
          </p-datepicker>
          <p-button [label]="'ADMIN.APPLY' | translate" size="small" icon="pi pi-search"
                    (onClick)="loadStats()">
          </p-button>
        </ng-container>
      </div>

      <!-- Squelette : uniquement au tout premier chargement. Sur un
           rechargement, l'affichage précédent est conservé en retrait plutôt
           que remplacé par des blocs gris — sinon la page saute à chaque clic. -->
      <ng-container *ngIf="loadingStats() && !stats()">
        <div>
          <div class="nm-skel" style="height: 0.65rem; width: 12rem; margin-bottom: 0.75rem"></div>
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr)); gap: 0.75rem">
            <div *ngFor="let i of [1,2,3,4]" class="border-1 border-round-lg border-surface" style="padding: 0.875rem 1rem; background: white">
              <div class="nm-skel" style="height: 0.55rem; width: 5rem; margin-bottom: 0.6rem"></div>
              <div class="nm-skel" style="height: 1.5rem; width: 3rem"></div>
            </div>
          </div>
        </div>
        <div>
          <div class="nm-skel" style="height: 0.65rem; width: 8rem; margin-bottom: 0.75rem"></div>
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr)); gap: 0.75rem">
            <div *ngFor="let i of [1,2,3,4,5]" class="border-1 border-round-lg border-surface" style="padding: 0.875rem 1rem; background: white">
              <div class="nm-skel" style="height: 0.55rem; width: 5rem; margin-bottom: 0.6rem"></div>
              <div class="nm-skel" style="height: 1.5rem; width: 3rem"></div>
            </div>
          </div>
        </div>
      </ng-container>

      <ng-container *ngIf="stats() as s">
        <!-- ─── Période sélectionnée, comparée à la précédente ─────────── -->
        <div [style.opacity]="loadingStats() ? 0.55 : 1" style="transition: opacity 0.15s">
          <div style="display: flex; align-items: baseline; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.5rem">
            <span style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: var(--nm-text-light-3, #6a7470)">Sur la période sélectionnée</span>
            <span style="font-size: 0.7rem; color: var(--nm-text-light-3, #6a7470)">
              comparée aux {{ dureeLisible(s.previous) }} qui précèdent
            </span>
            <i *ngIf="loadingStats()" class="pi pi-spin pi-spinner" style="font-size: 0.8rem; color: var(--nm-text-light-3, #6a7470)"></i>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(10.5rem, 1fr)); gap: 0.75rem">
            <div *ngFor="let kpi of kpiPeriode()" class="nm-kpi nm-kpi-accent">
              <div class="nm-kpi-label">{{ kpi.label }}</div>
              <div class="nm-kpi-row">
                <div class="nm-kpi-value" *ngIf="kpi.value !== null">
                  {{ formate(kpi.value) }}<span class="nm-kpi-unit" *ngIf="kpi.unit === 'pct'"> %</span>
                </div>
                <div class="nm-kpi-value nm-kpi-vide" *ngIf="kpi.value === null">—</div>

                <span class="nm-ecart"
                      *ngIf="ecart(kpi) as e"
                      [class.nm-ecart-hausse]="e.sens === 'hausse'"
                      [class.nm-ecart-baisse]="e.sens === 'baisse'"
                      [hidden]="!e.affiche"
                      [title]="e.titre">
                  <i class="pi"
                     [class.pi-arrow-up-right]="e.sens === 'hausse'"
                     [class.pi-arrow-down-right]="e.sens === 'baisse'"
                     [class.pi-minus]="e.sens === 'stable'"></i>{{ e.texte }}
                </span>
              </div>
              <div class="nm-kpi-detail" *ngIf="kpi.detail">{{ kpi.detail }}</div>
              <div class="nm-kpi-detail" *ngIf="kpi.value === null && kpi.indispo">{{ kpi.indispo }}</div>
            </div>
          </div>
        </div>

        <!-- ─── Entonnoir : la seule vue qui rapporte tout au trafic ────────
             Les cartes ci-dessus comptent des faits ; celle-ci les rapporte au
             nombre de visiteurs, c'est-à-dire au dénominateur qui manquait. -->
        <div [style.opacity]="loadingStats() ? 0.55 : 1" style="transition: opacity 0.15s">
          <div style="display: flex; align-items: baseline; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.6rem">
            <span style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: var(--nm-text-light-3, #6a7470)">Entonnoir de conversion</span>
            <span style="font-size: 0.7rem; color: var(--nm-text-light-3, #6a7470)">
              sur la période sélectionnée — pour 100 visites
            </span>
          </div>

          <div *ngIf="entonnoirMesure(); else entonnoirAbsent" class="nm-kpi"
               style="display: flex; flex-direction: column; gap: 0.9rem">
            <div *ngFor="let e of entonnoir()">
              <div style="display: flex; align-items: baseline; justify-content: space-between; gap: 0.75rem">
                <span class="nm-kpi-label" style="margin-bottom: 0">{{ e.label }}</span>
                <span class="nm-etape-pct" [class.nm-kpi-vide]="e.pourcentage === null">
                  {{ e.pourcentage === null ? '—' : formate(e.pourcentage) + ' %' }}
                </span>
              </div>
              <div class="nm-etape-piste">
                <div class="nm-etape-barre" [style.width.%]="e.pourcentage ?? 0"></div>
              </div>
              <div class="nm-kpi-detail">{{ e.detail }}</div>
            </div>
          </div>

          <ng-template #entonnoirAbsent>
            <div class="nm-kpi" style="color: var(--nm-text-light-3, #6a7470); font-size: 0.78rem">
              <ng-container *ngIf="entonnoirEnEchec(); else jamaisMesure">
                Le calcul de l'entonnoir a échoué : les indicateurs ci-dessus restent
                justes, celui-ci n'a pas de réponse. Le détail est dans les logs de l'API.
              </ng-container>
              <ng-template #jamaisMesure>
                Le journal des visites n'a pas encore de données : sans visiteurs comptés,
                aucun de ces taux n'a de dénominateur.
              </ng-template>
            </div>
          </ng-template>

          <div class="nm-kpi-detail" style="margin-top: 0.5rem">{{ noteEntonnoir() }}</div>
        </div>

        <!-- ─── Coût du modèle : ce que la période a coûté en IA ────────────
             Chargé à part : son relevé peut échouer sans emporter le reste. -->
        <div [style.opacity]="loadingStats() ? 0.55 : 1" style="transition: opacity 0.15s">
          <app-admin-model-costs
            [donnees]="couts()"
            [erreur]="erreurCouts()"
            [creditsConsommes]="s.period.creditsConsumed">
          </app-admin-model-costs>
        </div>

        <!-- ─── Cumul, sans comparaison : un stock n'a pas d'« évolution » ── -->
        <div [style.opacity]="loadingStats() ? 0.55 : 1" style="transition: opacity 0.15s">
          <div style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: var(--nm-text-light-3, #6a7470); margin-bottom: 0.5rem">Total cumulé</div>
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(10.5rem, 1fr)); gap: 0.75rem">
            <div *ngFor="let kpi of kpiAbsolute(s)" class="nm-kpi">
              <div class="nm-kpi-label">{{ kpi.label }}</div>
              <div class="nm-kpi-value nm-kpi-neutre">{{ formate(kpi.value) }}</div>
            </div>
          </div>
        </div>

        <div style="font-size: 0.72rem; color: var(--nm-text-light-3, #6a7470); display: flex; align-items: center; gap: 0.375rem">
          <i class="pi pi-info-circle" style="font-size: 0.75rem"></i>
          <span>Les comptes administrateurs et les comptes marqués « interne » sont exclus de tous ces indicateurs.</span>
        </div>

        <!-- ─── Historique ────────────────────────────────────────────────
             Hors du sélecteur de période, et dit comme tel : ces graphiques
             couvrent toujours les six derniers mois. -->
        <div>
          <div style="display: flex; align-items: baseline; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.6rem">
            <span style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: var(--nm-text-light-3, #6a7470)">Historique hebdomadaire</span>
            <span style="font-size: 0.7rem; color: var(--nm-text-light-3, #6a7470)">
              {{ semaines }} dernières semaines — indépendant de la période choisie ci-dessus
            </span>
          </div>

          <div *ngIf="loadingSeries() && !series()"
               style="display: grid; grid-template-columns: repeat(auto-fill, minmax(20rem, 1fr)); gap: 0.75rem">
            <div *ngFor="let i of [1,2,3,4]" class="nm-skel" style="height: 14rem; border-radius: 10px"></div>
          </div>

          <div *ngIf="series() as serie"
               style="display: grid; grid-template-columns: repeat(auto-fill, minmax(20rem, 1fr)); gap: 0.75rem">
            <app-admin-weekly-chart
              title="Visites"
              unite="visites"
              [points]="pointsVisites()"
              [note]="noteVisites()">
            </app-admin-weekly-chart>

            <app-admin-weekly-chart
              title="Nouveaux comptes"
              unite="comptes"
              [points]="pointsNouveaux()">
            </app-admin-weekly-chart>

            <app-admin-weekly-chart
              title="Comptes cumulés"
              unite="comptes"
              forme="ligne"
              agregat="dernier"
              [points]="pointsCumul()"
              note="Trajectoire, et non rythme : la courbe porte le total atteint à la fin de chaque semaine.">
            </app-admin-weekly-chart>

            <app-admin-weekly-chart
              title="Comptes actifs"
              unite="comptes"
              [points]="pointsActifs()"
              [note]="noteActifs()">
            </app-admin-weekly-chart>

            <app-admin-weekly-chart
              title="Recherches"
              unite="projets"
              [points]="pointsProjets()"
              note="Un projet par recherche aboutie ou par nom soumis au test.">
            </app-admin-weekly-chart>

            <app-admin-weekly-chart
              title="Crédits consommés"
              unite="crédits"
              [points]="pointsCredits()"
              [note]="noteCredits">
            </app-admin-weekly-chart>
          </div>

          <div *ngIf="erreurSeries()" style="font-size: 0.75rem; color: var(--nm-verdict-taken-light-fg, #a33b3b)">
            L'historique n'a pas pu être chargé.
          </div>
        </div>
      </ng-container>

    </div>
  `,
  styles: [`
    .nm-skel {
      background: var(--nm-divider-light-1, #eef1f0);
      border-radius: 4px;
      animation: pulse 1.5s ease-in-out infinite;
    }

    .nm-kpi {
      background: var(--nm-surface-light, #fff);
      border: 1px solid var(--nm-border-light, #e3e7e5);
      border-radius: 10px;
      padding: 0.875rem 1rem;
    }
    .nm-kpi-accent { border-color: var(--nm-accent-border-light, #c9e9d8); }

    .nm-kpi-label {
      font-size: 0.72rem; font-weight: 600; text-transform: uppercase;
      letter-spacing: 0.05em; color: var(--nm-text-light-2, #5c6663);
      margin-bottom: 0.25rem;
    }
    .nm-kpi-row { display: flex; align-items: baseline; flex-wrap: wrap; gap: 0.5rem; }

    /* Chiffres proportionnels, pas tabulaires : à cette taille, des chasses
       égales font paraître « 121 » relâché. Le tabulaire est pour les colonnes
       qui s'alignent — celles du tableau des graphiques. */
    .nm-kpi-value { font-size: 1.5rem; font-weight: 800; color: var(--nm-accent-text-light, #0d7a4e); line-height: 1.1; }
    .nm-kpi-neutre { color: var(--nm-text-light, #0b0e10); }
    .nm-kpi-vide { color: var(--nm-text-light-3, #6a7470); font-weight: 600; }
    .nm-kpi-unit { font-size: 0.95rem; font-weight: 600; }

    .nm-kpi-detail {
      font-size: 0.68rem; color: var(--nm-text-light-3, #6a7470);
      margin-top: 0.3rem; line-height: 1.35;
    }

    /* La barre EST le chiffre : à ces volumes, lire « 12 % » et « 4 % » côte à
       côte demande un effort que la longueur épargne. */
    .nm-etape-pct {
      font-size: 1.15rem; font-weight: 800; line-height: 1.1;
      color: var(--nm-accent-text-light, #0d7a4e);
      font-variant-numeric: tabular-nums;
    }
    .nm-etape-piste {
      height: 0.5rem; border-radius: 999px; margin: 0.35rem 0 0.1rem;
      background: var(--nm-divider-light-1, #eef1f0);
      overflow: hidden;
    }
    .nm-etape-barre {
      height: 100%; border-radius: 999px;
      background: var(--nm-accent-text-light, #0d7a4e);
      transition: width 0.25s ease;
    }

    /* L'écart porte une flèche EN PLUS de sa couleur : la couleur seule ne dit
       rien à qui ne la distingue pas, et le sens est l'information. */
    .nm-ecart {
      display: inline-flex; align-items: center; gap: 0.2rem;
      font-size: 0.72rem; font-weight: 700;
      color: var(--nm-text-light-3, #6a7470);
      font-variant-numeric: tabular-nums; white-space: nowrap;
    }
    .nm-ecart i { font-size: 0.62rem; }
    .nm-ecart-hausse { color: var(--nm-verdict-free-light-fg, #0d7a4e); }
    .nm-ecart-baisse { color: var(--nm-verdict-taken-light-fg, #a33b3b); }
  `],
})
export class AdminDashboardComponent implements OnInit {
  stats = signal<AdminStats | null>(null);
  loadingStats = signal(false);

  couts = signal<AdminModelCosts | null>(null);
  erreurCouts = signal(false);

  series = signal<AdminSeries | null>(null);
  loadingSeries = signal(false);
  erreurSeries = signal(false);

  readonly semaines = SEMAINES;

  readonly noteCredits =
    'Une suggestion vaut 1 crédit ; un rapport, ce qu\'il a réellement coûté. '
    + 'Deux angles morts : les suggestions créées avant le 23/08/2026 sont datées '
    + 'de leur projet, et les rapports antérieurs au 19/08/2026 n\'ont pas gardé '
    + 'leur coût — ils ne sont pas comptés.';

  periodOptions: PeriodOption[] = [
    { label: '24h', days: 1 },
    { label: '7j', days: 7 },
    { label: '30j', days: 30 },
    { label: 'Personnalisé', days: null },
  ];
  selectedPeriod: PeriodOption = this.periodOptions[1];
  customFrom: Date | null = null;
  customTo: Date | null = null;

  constructor(private adminService: AdminService) {}

  ngOnInit() {
    this.loadStats();
    this.loadSeries();
  }

  private getPeriodDates(): { from?: Date; to?: Date } {
    if (this.selectedPeriod.days !== null) {
      const to = new Date();
      const from = new Date(to.getTime() - this.selectedPeriod.days * 24 * 60 * 60 * 1000);
      return { from, to };
    }
    return { from: this.customFrom ?? undefined, to: this.customTo ?? undefined };
  }

  loadStats() {
    this.loadingStats.set(true);
    const { from, to } = this.getPeriodDates();
    this.adminService.getStats(from, to).subscribe({
      next: s => { this.stats.set(s); this.loadingStats.set(false); },
      error: () => this.loadingStats.set(false),
    });
    this.adminService.getModelCosts(from, to, SEMAINES).subscribe({
      next: c => { this.couts.set(c); this.erreurCouts.set(false); },
      error: () => this.erreurCouts.set(true),
    });
  }

  /** Chargé une seule fois : la série ne dépend pas de la période choisie. */
  loadSeries() {
    this.loadingSeries.set(true);
    this.adminService.getSeries(SEMAINES).subscribe({
      next: s => { this.series.set(s); this.loadingSeries.set(false); },
      error: () => { this.erreurSeries.set(true); this.loadingSeries.set(false); },
    });
  }

  onPeriodChange() {
    if (this.selectedPeriod.days !== null) this.loadStats();
  }

  // ─── Indicateurs ──────────────────────────────────────────────────────────

  formate(n: number | null): string {
    return n === null ? '—' : n.toLocaleString('fr-FR');
  }

  /** « 7 jours », « 24 heures » — la durée réelle de la fenêtre de comparaison. */
  dureeLisible(p: PeriodMetrics): string {
    const ms = new Date(p.to).getTime() - new Date(p.from).getTime();
    const jours = Math.round(ms / (24 * 60 * 60 * 1000));
    if (jours >= 1) return `${jours} jour${jours > 1 ? 's' : ''}`;
    const heures = Math.max(1, Math.round(ms / (60 * 60 * 1000)));
    return `${heures} heure${heures > 1 ? 's' : ''}`;
  }

  kpiPeriode(): Kpi[] {
    const s = this.stats();
    if (!s) return [];
    const p = s.period;
    const q = s.previous;

    return [
      {
        label: 'Comptes actifs',
        value: p.activeUsers,
        previous: q.activeUsers,
        indispo: this.indisponibiliteActifs(),
      },
      { label: 'Nouveaux inscrits', value: p.newUsers, previous: q.newUsers },
      {
        label: 'Taux d\'activation',
        value: p.activationRate,
        previous: q.activationRate,
        unit: 'pct',
        detail: p.newUsers > 0
          ? `${p.activatedUsers} sur ${p.newUsers} ont créé un projet`
          : undefined,
        indispo: 'aucune inscription sur la période',
      },
      {
        label: 'Visiteurs déjà inscrits',
        value: this.partRevenants(p),
        previous: this.partRevenants(q),
        unit: 'pct',
        detail: this.detailRevenants(p),
        indispo: this.indisponibiliteRevenants(p),
      },
      { label: 'Recherches', value: p.newProjects, previous: q.newProjects },
      { label: 'Suggestions générées', value: p.suggestions, previous: q.suggestions },
      { label: 'Rapports de marque', value: p.brandReports, previous: q.brandReports },
      { label: 'Crédits consommés', value: p.creditsConsumed, previous: q.creditsConsumed },
    ];
  }

  // ─── Fidélité : la part des identifiés qui n'étaient pas nouveaux ─────────

  /**
   * Parmi les visites rattachées à un compte, celles d'un compte ANTÉRIEUR à la
   * fenêtre. En clair : est-ce que ceux qui reviennent reviennent vraiment, ou
   * l'usage n'est-il que le premier jour des nouveaux inscrits ?
   *
   * Le dénominateur n'est ni les visites, ni les comptes : ce sont les visites
   * qu'un appel authentifié a permis de rattacher à un compte encore existant.
   * Les visites anonymes — la grande majorité — n'ont pas d'âge de compte, et
   * les compter ferait dire au taux qu'il y a peu de revenants alors qu'il n'y
   * a surtout aucune information.
   *
   * `null` dans trois cas, et aucun n'est zéro :
   *
   * 1. l'entonnoir n'a pas de réponse (la jointure a échoué) ;
   * 2. aucune visite de la fenêtre n'a été rattachée à un compte ;
   * 3. il y en a moins de {@link SOCLE_POURCENTAGE}. À trois visites
   *    identifiées, 2 sur 3 s'afficherait « 67 % » et une seule visite de plus
   *    ferait bouger le taux de 17 points — le badge d'écart, lui, l'annoncerait
   *    en points comme s'il s'agissait d'une tendance.
   */
  private partRevenants(p: PeriodMetrics): number | null {
    const f = p.funnel;
    if (!f || f.visitsIdentified < SOCLE_POURCENTAGE) return null;
    return Math.round((f.visitsReturning / f.visitsIdentified) * 1000) / 10;
  }

  private detailRevenants(p: PeriodMetrics): string | undefined {
    const f = p.funnel;
    if (!f || f.visitsIdentified < SOCLE_POURCENTAGE) return undefined;
    return `${this.formate(f.visitsReturning)} sur ${this.formate(f.visitsIdentified)}`
      + ' visites rattachées à un compte créé avant la période';
  }

  private indisponibiliteRevenants(p: PeriodMetrics): string {
    const f = p.funnel;
    if (!f) return 'entonnoir indisponible';
    if (f.visitsIdentified === 0) return 'aucune visite rattachée à un compte';
    return `${f.visitsIdentified} visite${f.visitsIdentified > 1 ? 's' : ''} identifiée${f.visitsIdentified > 1 ? 's' : ''}`
      + ' — trop peu pour un taux';
  }

  // ─── Entonnoir ────────────────────────────────────────────────────────────

  /**
   * Y a-t-il un entonnoir à montrer ?
   *
   * Deux façons de n'en pas avoir, et le message diffère : le journal des
   * visites n'a pas commencé, ou son calcul a échoué. Dans les deux cas, pas de
   * 0 % — une absence de mesure n'est pas un échec de conversion.
   */
  entonnoirMesure = computed(() => {
    const s = this.stats();
    return s != null && s.visitTrackingSince != null && s.period.funnel != null;
  });

  /** `true` quand le journal existe mais que le calcul n'a pas abouti. */
  entonnoirEnEchec = computed(() => {
    const s = this.stats();
    return s != null && s.visitTrackingSince != null && s.period.funnel == null;
  });

  /**
   * Part de `n` dans `base`, ou `null` quand la question ne se pose pas.
   *
   * Zéro visiteur ne donne pas « 0 % de conversion » : il ne donne pas de taux
   * du tout. La distinction est celle entre « personne n'a converti » et
   * « personne n'est venu ».
   */
  private part(n: number, base: number): number | null {
    return base > 0 ? Math.round((n / base) * 1000) / 10 : null;
  }

  /**
   * Les quatre marches, rapportées au trafic.
   *
   * L'inscription se rapporte aux visites arrivées SANS compte ouvert, et non
   * au total : quelqu'un déjà connecté ne peut pas s'inscrire, le compter au
   * dénominateur ne ferait qu'écraser le taux à mesure que les habitués
   * reviennent — le chiffre baisserait quand le produit marche.
   */
  entonnoir(): EtapeEntonnoir[] {
    const f = this.stats()?.period.funnel;
    if (!f) return [];

    return [
      {
        // « Visites », pas « visiteurs » : l'unité est la session de navigateur.
        // Une même personne qui revient demain compte deux fois — dédoublonner
        // demanderait un cookie, c'est-à-dire un consentement, c'est-à-dire de
        // perdre la moitié de la mesure pour gagner un peu de précision.
        label: 'Visites',
        pourcentage: f.visits > 0 ? 100 : null,
        detail: `${this.formate(f.visits)} visite${f.visits > 1 ? 's' : ''}`
          + ` — dont ${this.formate(f.visitsAnonymous)} arrivée${f.visitsAnonymous > 1 ? 's' : ''} sans compte ouvert`,
      },
      {
        label: 'Lancent une recherche',
        pourcentage: this.part(f.searched, f.visits),
        detail: `${this.formate(f.searched)} sur ${this.formate(f.visits)} visites`,
      },
      {
        label: 'Créent un compte',
        pourcentage: this.part(f.accountsCreated, f.visitsAnonymous),
        detail: `${this.formate(f.accountsCreated)} sur ${this.formate(f.visitsAnonymous)} visites arrivées sans compte`,
      },
      {
        label: 'Demandent un rapport de marque',
        pourcentage: this.part(f.reportsRequested, f.visits),
        detail: `${this.formate(f.reportsRequested)} sur ${this.formate(f.visits)} visites`
          + ' — demandes, refus faute de crédits compris',
      },
    ];
  }

  /**
   * Ce que l'entonnoir ne dit pas, dit sous l'entonnoir.
   *
   * Une période antérieure au journal n'invalide pas les TAUX — numérateur et
   * dénominateur manquent des mêmes jours — mais elle sous-estime les volumes.
   * Le silence, ici, laisserait lire « 3 visiteurs » comme un fait.
   */
  noteEntonnoir(): string {
    const s = this.stats();
    const depuis = s?.visitTrackingSince;
    if (!depuis) return 'Mesure des visites non démarrée.';
    if (s?.period.funnel == null) return '';

    const base = 'Une visite = une session de navigateur, sans cookie ni consentement requis.'
      + ' Les comptes administrateurs et internes sont écartés, comme partout ailleurs.';
    const debutPeriode = s ? new Date(s.period.from) : null;
    const debutMesure = new Date(`${depuis}T00:00:00`);

    return debutPeriode && debutPeriode < debutMesure
      ? `${base} Mesuré depuis le ${this.dateCourte(depuis)} seulement :`
        + ' les taux restent justes, les volumes sont sous-estimés sur cette période.'
      : `${base} Mesuré depuis le ${this.dateCourte(depuis)}.`;
  }

  /** Pourquoi « comptes actifs » peut ne pas avoir de valeur. */
  private indisponibiliteActifs(): string {
    const depuis = this.stats()?.activityTrackingSince;
    return depuis
      ? `mesuré depuis le ${this.dateCourte(depuis)}`
      : 'journal d\'activité pas encore démarré';
  }

  kpiAbsolute(s: AdminStats): { label: string; value: number }[] {
    return [
      { label: 'Utilisateurs', value: s.totalUsers },
      { label: 'Projets', value: s.totalProjects },
      { label: 'Suggestions', value: s.totalSuggestions },
      { label: 'Rapports de marque', value: s.totalBrandReports },
      { label: 'Moy. sugg./projet', value: s.avgSuggestionsPerProject },
      { label: 'Moy. favoris/projet', value: s.avgFavoritesPerProject },
      { label: 'Crédits gratuits', value: s.totalFreeCredits },
      { label: 'Crédits pack', value: s.totalPackCredits },
    ];
  }

  /**
   * L'évolution d'un indicateur, dans la forme que la donnée supporte.
   *
   * Un pourcentage n'est calculé qu'au-dessus de {@link SOCLE_POURCENTAGE} :
   * en dessous, il amplifie du bruit — « +300 % » pour un passage de 1 à 4 — et
   * n'existe même pas quand la période précédente valait zéro.
   *
   * Sur un indicateur déjà exprimé en pourcentage, l'écart se compte en POINTS.
   * Un taux passé de 40 % à 50 % a gagné 10 points, pas 25 %.
   */
  ecart(kpi: Kpi): Ecart {
    const muet: Ecart = { affiche: false, texte: '', sens: 'stable', titre: '' };
    const { value, previous } = kpi;
    if (value === null || previous === null) return muet;

    const brut = Math.round((value - previous) * 10) / 10;
    const sens: Ecart['sens'] = brut > 0 ? 'hausse' : brut < 0 ? 'baisse' : 'stable';
    const signe = brut > 0 ? '+' : '';
    const avant = kpi.unit === 'pct' ? `${previous} %` : previous.toLocaleString('fr-FR');
    const titre = `${avant} sur la période précédente`;

    if (kpi.unit === 'pct') {
      return { affiche: true, texte: `${signe}${brut} pts`, sens, titre };
    }
    if (previous < SOCLE_POURCENTAGE) {
      return {
        affiche: true,
        texte: `${signe}${brut}`,
        sens,
        titre: `${titre} — trop peu pour un pourcentage`,
      };
    }
    const pct = Math.round(((value - previous) / previous) * 100);
    return {
      affiche: true,
      texte: `${pct > 0 ? '+' : ''}${pct} %`,
      sens,
      titre,
    };
  }

  // ─── Séries ───────────────────────────────────────────────────────────────

  pointsNouveaux = computed<ChartPoint[]>(() =>
    (this.series()?.weeks ?? []).map(w => ({ week: w.week, value: w.newUsers })),
  );

  /**
   * Comptes au total, semaine par semaine.
   *
   * Part du total actuel et remonte le temps : la fenêtre ne commence pas à la
   * création du produit, donc un cumul reparti de zéro afficherait une base
   * fausse et une pente juste.
   */
  pointsCumul = computed<ChartPoint[]>(() => {
    const weeks = this.series()?.weeks ?? [];
    const total = this.stats()?.totalUsers;
    if (!weeks.length || total === undefined) return [];

    const cumul: number[] = new Array(weeks.length);
    let courant = total;
    for (let i = weeks.length - 1; i >= 0; i--) {
      cumul[i] = courant;
      courant -= weeks[i].newUsers;
    }
    return weeks.map((w, i) => ({ week: w.week, value: cumul[i] }));
  });

  pointsVisites = computed<ChartPoint[]>(() =>
    (this.series()?.weeks ?? []).map(w => ({ week: w.week, value: w.visits })),
  );

  noteVisites = computed(() => {
    const depuis = this.series()?.visitTrackingSince;
    return depuis
      ? `Une visite = une session de navigateur. Mesuré depuis le ${this.dateCourte(depuis)} :`
        + ' les semaines antérieures sont hachurées — non mesurées, pas vides.'
      : 'Le journal des visites n\'a pas encore de données : aucune semaine n\'est mesurée.';
  });

  pointsActifs = computed<ChartPoint[]>(() =>
    (this.series()?.weeks ?? []).map(w => ({ week: w.week, value: w.activeUsers })),
  );

  pointsProjets = computed<ChartPoint[]>(() =>
    (this.series()?.weeks ?? []).map(w => ({ week: w.week, value: w.projects })),
  );

  pointsCredits = computed<ChartPoint[]>(() =>
    (this.series()?.weeks ?? []).map(w => ({ week: w.week, value: w.creditsConsumed })),
  );

  noteActifs = computed(() => {
    const depuis = this.series()?.activityTrackingSince;
    return depuis
      ? `Mesuré depuis le ${this.dateCourte(depuis)}. Les semaines antérieures sont hachurées : non mesurées, pas vides.`
      : 'Le journal d\'activité n\'a pas encore de données : aucune semaine n\'est mesurée.';
  });

  private dateCourte(jour: string): string {
    return new Date(`${jour}T00:00:00`)
      .toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  }
}
