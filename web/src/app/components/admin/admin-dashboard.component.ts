import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  AdminModelCosts, AdminRetention, AdminService, AdminSeries, AdminStats, PeriodMetrics, PeriodeAdmin,
} from '../../services/admin.service';
import { AdminSerieChartComponent, ChartPoint } from './admin-serie-chart.component';
import { AdminRetentionComponent } from './admin-retention.component';
import { AdminPeriodeComponent } from './admin-periode.component';
import { bornesExplicites, bornesPeriode, dureeEnJours, libelleComparaison, PERIODE_DEFAUT } from './periode-admin';
import { usd, usdUnitaire } from './couts-modele';

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
  /** Mise en forme de la valeur (montants) ; par défaut, un nombre. */
  format?: (n: number) => string;
  /** Précision sous la valeur (« 3 sur 7 inscrits »). */
  detail?: string;
  /** Pourquoi la valeur manque, quand elle manque. */
  indispo?: string;
  /** L'écart n'a pas de sens pour cet indicateur (pas de comparaison). */
  sansEcart?: boolean;
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

/** Mois d'historique demandés à l'API. */
const MOIS_HISTORIQUE = 12;

/**
 * Sous ce dénominateur, pas de pourcentage — ni de taux, ni d'écart.
 *
 * À une poignée d'événements par semaine, passer de 1 à 4 s'afficherait
 * « +300 % » et 0 → 1 n'aurait pas de pourcentage du tout. En dessous, la carte
 * montre l'écart absolu — « +3 » — qui est la seule chose que la donnée dit.
 */
const SOCLE_POURCENTAGE = 5;

/** Durée à partir de laquelle la période se lit comme un mois (MAU, DAU/MAU). */
const FENETRE_MAU_JOURS = 28;

/**
 * Tableau de bord d'administration.
 *
 * Refondu le 31/10/2026 autour des indicateurs standard d'un SaaS : l'ancienne
 * page alignait une quarantaine d'éléments de même rang, sans MAU, sans revenu,
 * sans dire combien d'inscrits reviennent. Relevé ce jour-là : 52 MAU dont 1
 * seul inscrit depuis plus de 30 jours. D'où l'ordre : ce qui se mesure d'un
 * coup d'œil en tête, puis l'usage, la satisfaction, l'argent, la rétention.
 */
@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, AdminSerieChartComponent, AdminRetentionComponent, AdminPeriodeComponent],
  template: `
    <div style="display: flex; flex-direction: column; gap: 1.5rem; padding-top: 1rem">

      <app-admin-periode (periode)="changerPeriode($event)"></app-admin-periode>

      <!-- Squelette : uniquement au tout premier chargement. -->
      <div *ngIf="chargement() && !stats()" class="nm-grille">
        <div *ngFor="let i of [1,2,3,4,5]" class="nm-kpi">
          <div class="nm-skel" style="height: 0.55rem; width: 5rem; margin-bottom: 0.6rem"></div>
          <div class="nm-skel" style="height: 1.5rem; width: 3rem"></div>
        </div>
      </div>

      <div *ngIf="erreurStats() && !stats()" class="nm-kpi nm-muet">
        Les indicateurs n'ont pas pu être chargés. Le détail est dans les logs de l'API.
      </div>

      <ng-container *ngIf="stats() as s">
        <div [style.opacity]="chargement() ? 0.55 : 1" style="transition: opacity 0.15s; display: flex; flex-direction: column; gap: 1.5rem">

          <!-- ─── Bandeau : cinq chiffres, comparés à la période précédente ─── -->
          <section>
            <div class="nm-entete">
              <span class="nm-titre">L'essentiel</span>
              <span class="nm-sous-titre">{{ comparaison() }}</span>
            </div>
            <div class="nm-grille">
              <ng-container *ngFor="let k of bandeau()">
                <ng-container *ngTemplateOutlet="carte; context: { $implicit: k, accent: true }"></ng-container>
              </ng-container>
            </div>
          </section>

          <!-- ─── Engagement ─────────────────────────────────────────────── -->
          <section>
            <div class="nm-entete">
              <span class="nm-titre">Engagement</span>
              <span class="nm-sous-titre">à quelle fréquence, et jusqu'où, les comptes actifs se servent du produit</span>
            </div>
            <div class="nm-grille">
              <ng-container *ngFor="let k of engagement()">
                <ng-container *ngTemplateOutlet="carte; context: { $implicit: k }"></ng-container>
              </ng-container>
            </div>
          </section>

          <!-- ─── Satisfaction ──────────────────────────────────────────── -->
          <section>
            <div class="nm-entete">
              <span class="nm-titre">Satisfaction</span>
              <span class="nm-sous-titre">le taux de succès, en tête de page, dit si les gens trouvent un nom</span>
            </div>
            <div class="nm-grille">
              <ng-container *ngFor="let k of satisfaction()">
                <ng-container *ngTemplateOutlet="carte; context: { $implicit: k }"></ng-container>
              </ng-container>
              <a class="nm-kpi nm-lien-carte" routerLink="/admin/feedback">
                <div class="nm-kpi-label">Lire les retours</div>
                <div class="nm-kpi-detail">Onglet Feedbacks : texte, crédits accordés, rejets →</div>
              </a>
            </div>
          </section>

          <!-- ─── Monétisation ──────────────────────────────────────────── -->
          <section>
            <div class="nm-entete">
              <span class="nm-titre">Monétisation</span>
              <span class="nm-sous-titre">packs de crédits payés, depuis le registre des paiements</span>
            </div>
            <div class="nm-grille">
              <ng-container *ngFor="let k of monetisation()">
                <ng-container *ngTemplateOutlet="carte; context: { $implicit: k }"></ng-container>
              </ng-container>
              <div class="nm-kpi">
                <div class="nm-kpi-label">Parcours d'achat</div>
                <ng-container *ngIf="parcoursAchat() as pa; else parcoursAbsent">
                  <div class="nm-kpi-value nm-kpi-neutre" style="font-size: 1.25rem">
                    {{ pa.tarifs }} → {{ pa.lances }} → {{ pa.aboutis }}
                  </div>
                  <div class="nm-kpi-detail">
                    visites ayant ouvert les packs → paiements lancés → paiements aboutis
                  </div>
                </ng-container>
                <ng-template #parcoursAbsent>
                  <div class="nm-kpi-value nm-kpi-vide">—</div>
                  <div class="nm-kpi-detail">entonnoir ou registre indisponible</div>
                </ng-template>
              </div>
            </div>
          </section>

          <!-- ─── Coût IA, résumé : le détail vit dans l'onglet Coûts IA ─── -->
          <section>
            <div class="nm-entete">
              <span class="nm-titre">Coût du modèle</span>
              <span class="nm-sous-titre">en dollars, au tarif de chaque appel</span>
              <a routerLink="/admin/costs" queryParamsHandling="preserve" class="nm-sous-titre" style="margin-left: auto">
                Détail des coûts →
              </a>
            </div>
            <div *ngIf="erreurCouts()" class="nm-kpi nm-muet">
              Le relevé des coûts n'a pas pu être chargé ; les autres indicateurs restent justes.
            </div>
            <div class="nm-grille" *ngIf="!erreurCouts()">
              <ng-container *ngFor="let k of coutResume()">
                <ng-container *ngTemplateOutlet="carte; context: { $implicit: k }"></ng-container>
              </ng-container>
            </div>
          </section>

          <!-- ─── Entonnoir des visites ─────────────────────────────────── -->
          <section>
            <div class="nm-entete">
              <span class="nm-titre">Entonnoir de conversion</span>
              <span class="nm-sous-titre">sur la période — pour 100 visites</span>
            </div>
            <div *ngIf="entonnoir().length; else entonnoirAbsent" class="nm-kpi"
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
              <div class="nm-kpi nm-muet">
                {{ s.visitTrackingSince
                  ? 'Le calcul de l\\'entonnoir a échoué : le détail est dans les logs de l\\'API.'
                  : 'Le journal des visites n\\'a pas encore de données.' }}
              </div>
            </ng-template>
            <div class="nm-kpi-detail" style="margin-top: 0.5rem">{{ noteEntonnoir() }}</div>
          </section>
        </div>

        <!-- ─── Rétention : indépendante de la période ──────────────────── -->
        <app-admin-retention [retention]="retention()" [erreur]="erreurRetention()"></app-admin-retention>

        <!-- ─── Historique mensuel ──────────────────────────────────────── -->
        <section>
          <div class="nm-entete">
            <span class="nm-titre">Historique mensuel</span>
            <span class="nm-sous-titre">{{ moisHistorique }} derniers mois — indépendant de la période choisie</span>
          </div>
          <div *ngIf="series()" class="nm-grille-large">
            <app-admin-serie-chart title="Nouveaux inscrits" unite="comptes" pas="mois"
                                   [points]="pointsInscrits()"></app-admin-serie-chart>
            <app-admin-serie-chart title="Chiffre d'affaires" unite="€" pas="mois" [decimales]="2"
                                   [points]="pointsRevenu()" [note]="noteRevenu()"></app-admin-serie-chart>
            <app-admin-serie-chart title="Coût du modèle" unite="$" pas="mois" [decimales]="2"
                                   [points]="pointsCoutIa()" [note]="noteCoutIa()"></app-admin-serie-chart>
          </div>
          <div *ngIf="erreurSeries()" class="nm-kpi nm-muet">L'historique n'a pas pu être chargé.</div>
        </section>

        <div class="nm-kpi-detail" style="display: flex; align-items: center; gap: 0.375rem">
          <i class="pi pi-info-circle" style="font-size: 0.75rem"></i>
          <span>Les comptes administrateurs et les comptes marqués « interne » sont exclus de tous ces indicateurs.</span>
        </div>
      </ng-container>

      <!-- Une carte d'indicateur : valeur, écart, détail, ou raison de l'absence. -->
      <ng-template #carte let-k let-accent="accent">
        <div class="nm-kpi" [class.nm-kpi-accent]="accent">
          <div class="nm-kpi-label">{{ k.label }}</div>
          <div class="nm-kpi-row">
            <div class="nm-kpi-value" [class.nm-kpi-neutre]="!accent" *ngIf="k.value !== null">
              {{ valeur(k) }}<span class="nm-kpi-unit" *ngIf="k.unit === 'pct'"> %</span>
            </div>
            <div class="nm-kpi-value nm-kpi-vide" *ngIf="k.value === null">—</div>
            <!-- *ngIf et non [hidden] : le display du badge l'emporterait, et
                 une carte sans comparaison afficherait un tiret parasite. -->
            <ng-container *ngIf="ecart(k) as e">
              <span class="nm-ecart" *ngIf="e.affiche"
                    [class.nm-ecart-hausse]="e.sens === 'hausse'" [class.nm-ecart-baisse]="e.sens === 'baisse'"
                    [title]="e.titre">
                <i class="pi" [class.pi-arrow-up-right]="e.sens === 'hausse'"
                   [class.pi-arrow-down-right]="e.sens === 'baisse'" [class.pi-minus]="e.sens === 'stable'"></i>{{ e.texte }}
              </span>
            </ng-container>
          </div>
          <div class="nm-kpi-detail" *ngIf="k.detail">{{ k.detail }}</div>
          <div class="nm-kpi-detail" *ngIf="k.value === null && k.indispo">{{ k.indispo }}</div>
        </div>
      </ng-template>
    </div>
  `,
  styles: [`
    .nm-entete { display: flex; align-items: baseline; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.5rem; }
    .nm-titre {
      font-size: 0.72rem; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.07em; color: var(--nm-text-light-3, #6a7470);
    }
    .nm-sous-titre { font-size: 0.7rem; color: var(--nm-text-light-3, #6a7470); }
    .nm-grille { display: grid; grid-template-columns: repeat(auto-fill, minmax(10.5rem, 1fr)); gap: 0.75rem; }
    .nm-grille-large { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(20rem, 100%), 1fr)); gap: 0.75rem; }

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
      min-width: 0;
    }
    .nm-kpi-accent { border-color: var(--nm-accent-border-light, #c9e9d8); }
    .nm-muet { color: var(--nm-text-light-3, #6a7470); font-size: 0.78rem; }
    .nm-lien-carte { text-decoration: none; display: block; }
    .nm-lien-carte:hover { border-color: var(--nm-accent-border-light, #c9e9d8); }

    .nm-kpi-label {
      font-size: 0.72rem; font-weight: 600; text-transform: uppercase;
      letter-spacing: 0.05em; color: var(--nm-text-light-2, #5c6663);
      margin-bottom: 0.25rem;
    }
    .nm-kpi-row { display: flex; align-items: baseline; flex-wrap: wrap; gap: 0.5rem; }

    /* Chiffres proportionnels, pas tabulaires : à cette taille, des chasses
       égales font paraître « 121 » relâché. */
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
  private adminService = inject(AdminService);
  private route = inject(ActivatedRoute);

  periode = signal<PeriodeAdmin>(PERIODE_DEFAUT);

  stats = signal<AdminStats | null>(null);
  chargement = signal(false);
  erreurStats = signal(false);

  couts = signal<AdminModelCosts | null>(null);
  erreurCouts = signal(false);

  retention = signal<AdminRetention | null>(null);
  erreurRetention = signal(false);

  series = signal<AdminSeries | null>(null);
  erreurSeries = signal(false);

  readonly moisHistorique = MOIS_HISTORIQUE;

  ngOnInit() {
    // Indépendants de la période : chargés une fois.
    this.adminService.getSeries(MOIS_HISTORIQUE).subscribe({
      next: s => this.series.set(s),
      error: () => this.erreurSeries.set(true),
    });
    this.adminService.getRetention().subscribe({
      next: r => this.retention.set(r),
      error: () => this.erreurRetention.set(true),
    });
  }

  /** Appelé à l'ouverture et à chaque changement de période (l'URL fait foi). */
  changerPeriode(p: PeriodeAdmin) {
    this.periode.set(p);
    this.chargement.set(true);
    const b = bornesPeriode(p);
    this.adminService.getStats(b.from, b.to, b.month).subscribe({
      next: s => { this.stats.set(s); this.erreurStats.set(false); this.chargement.set(false); },
      error: () => { this.erreurStats.set(true); this.chargement.set(false); },
    });
    const e = bornesExplicites(p);
    // Deux semaines suffisent : seul le total de la période sert ici.
    this.adminService.getModelCosts(e.from, e.to, 2).subscribe({
      next: c => { this.couts.set(c); this.erreurCouts.set(false); },
      error: () => this.erreurCouts.set(true),
    });
  }

  comparaison = computed(() => libelleComparaison(this.periode()));

  /** La période se lit-elle comme un mois ? Libellé « MAU », DAU moyen, DAU/MAU. */
  private mensuelle = computed(() => dureeEnJours(this.periode()) >= FENETRE_MAU_JOURS);

  // ─── Mise en forme ────────────────────────────────────────────────────────

  formate(n: number | null): string {
    return n === null ? '—' : n.toLocaleString('fr-FR');
  }

  valeur(k: Kpi): string {
    return k.value === null ? '—' : k.format ? k.format(k.value) : this.formate(k.value);
  }

  private static euros(n: number): string {
    return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
  }

  /** « 1 paiement », « 3 paiements » ; `pluriel` explicite pour « nouveau → nouveaux ». */
  private static pluriel(n: number, mot: string, pluriel = `${mot}s`): string {
    return `${n.toLocaleString('fr-FR')} ${n > 1 ? pluriel : mot}`;
  }

  /** `n / d` en %, à une décimale ; `null` sous le socle. */
  private static taux(n: number, d: number): number | null {
    return d < SOCLE_POURCENTAGE ? null : Math.round((n / d) * 1000) / 10;
  }

  private static moyenne(n: number, d: number | null): number | null {
    return d === null || d === 0 ? null : Math.round((n / d) * 10) / 10;
  }

  /** Euros encaissés sur la période, `null` si le registre n'a pas répondu. */
  private static eurosDe(p: PeriodMetrics): number | null {
    if (!p.revenu) return null;
    const eur = p.revenu.parDevise.find(d => d.devise === 'EUR');
    return (eur?.centimes ?? 0) / 100;
  }

  // ─── Bandeau ──────────────────────────────────────────────────────────────

  bandeau = computed<Kpi[]>(() => {
    const s = this.stats();
    if (!s) return [];
    const p = s.period;
    const q = s.previous;
    const e = p.engagement;
    const autresDevises = (p.revenu?.parDevise ?? []).filter(d => d.devise !== 'EUR');

    return [
      {
        label: this.mensuelle() ? 'MAU' : 'Utilisateurs actifs',
        value: p.activeUsers,
        previous: q.activeUsers,
        detail: e
          ? `${AdminDashboardComponent.pluriel(e.nouveaux, 'nouveau', 'nouveaux')} · ${AdminDashboardComponent.pluriel(e.recurrents, 'récurrent')}`
          : undefined,
        indispo: this.indisponibiliteJournal(),
      },
      {
        label: 'Nouveaux inscrits',
        value: p.newUsers,
        previous: q.newUsers,
        detail: p.funnel && p.funnel.visitsAnonymous > 0
          ? `${(Math.round((p.funnel.accountsCreated / p.funnel.visitsAnonymous) * 1000) / 10).toLocaleString('fr-FR')} % des visites arrivées sans compte`
          : undefined,
      },
      {
        label: 'Taux d\'activation',
        value: p.activationRate,
        previous: q.activationRate,
        unit: 'pct',
        detail: p.newUsers > 0 ? `${p.activatedUsers} sur ${p.newUsers} ont créé un projet` : undefined,
        indispo: 'aucune inscription sur la période',
      },
      {
        label: 'Chiffre d\'affaires',
        value: AdminDashboardComponent.eurosDe(p),
        previous: AdminDashboardComponent.eurosDe(q),
        format: AdminDashboardComponent.euros,
        detail: p.revenu
          ? `${AdminDashboardComponent.pluriel(p.revenu.paiements, 'paiement')}`
            + (autresDevises.length ? ` · plus ${autresDevises.map(d => `${(d.centimes / 100).toLocaleString('fr-FR')} ${d.devise}`).join(', ')}` : '')
          : undefined,
        indispo: 'registre des paiements indisponible',
      },
      {
        label: 'Taux de succès',
        value: AdminDashboardComponent.taux(p.succes.projetsReussis, p.succes.projets),
        previous: AdminDashboardComponent.taux(q.succes.projetsReussis, q.succes.projets),
        unit: 'pct',
        detail: `${p.succes.projetsReussis} projet${p.succes.projetsReussis > 1 ? 's' : ''} sur ${p.succes.projets} avec au moins un favori`,
        indispo: p.succes.projets === 0 ? 'aucune recherche sur la période' : 'trop peu de recherches pour un taux',
      },
    ];
  });

  // ─── Engagement ───────────────────────────────────────────────────────────

  engagement = computed<Kpi[]>(() => {
    const s = this.stats();
    if (!s) return [];
    const p = s.period;
    const q = s.previous;
    const e = p.engagement;
    const ep = q.engagement;
    const sous28 = 'à partir d\'une période de 28 jours';
    const indispo = this.indisponibiliteJournal();

    return [
      {
        label: 'DAU moyen',
        value: e?.dauMoyen ?? null,
        previous: ep?.dauMoyen ?? null,
        detail: e?.dauMoyen != null ? `comptes actifs par jour, sur ${e.joursMesures} jours` : undefined,
        indispo: e ? sous28 : indispo,
      },
      {
        label: 'DAU / MAU',
        value: e?.dauSurMau ?? null,
        previous: ep?.dauSurMau ?? null,
        unit: 'pct',
        detail: e?.dauSurMau != null ? 'part des jours du mois où un actif revient' : undefined,
        indispo: e ? sous28 : indispo,
      },
      {
        label: 'Jours actifs par compte',
        value: e ? AdminDashboardComponent.moyenne(e.joursActifs, p.activeUsers) : null,
        previous: ep ? AdminDashboardComponent.moyenne(ep.joursActifs, q.activeUsers) : null,
        detail: e
          ? `1 jour : ${e.tranches.unJour} · 2-3 jours : ${e.tranches.deuxATrois} · 4 et + : ${e.tranches.quatreEtPlus}`
          : undefined,
        indispo,
      },
      {
        label: 'Recherches',
        value: p.newProjects,
        previous: q.newProjects,
        detail: p.activeUsers
          ? `${(AdminDashboardComponent.moyenne(p.newProjects, p.activeUsers) ?? 0).toLocaleString('fr-FR')} par compte actif`
          : undefined,
      },
      {
        label: 'Plusieurs recherches',
        value: p.succes.comptesMultiProjets,
        previous: q.succes.comptesMultiProjets,
        detail: `comptes, sur ${p.succes.comptesAvecProjet} ayant cherché`,
      },
    ];
  });

  // ─── Satisfaction ─────────────────────────────────────────────────────────

  satisfaction = computed<Kpi[]>(() => {
    const s = this.stats();
    if (!s) return [];
    const p = s.period;
    const q = s.previous;
    return [
      {
        label: 'Retours écrits',
        value: p.succes.retoursEcrits,
        previous: q.succes.retoursEcrits,
        detail: 'non rejetés, reçus sur la période',
        indispo: 'comptage en échec',
      },
      {
        // Pas de pourcentage de 👍 : relevé le 31/10/2026, 27 👍 pour 681 👎
        // venant de 8 comptes — le 👎 sert à écarter, pas à se plaindre.
        label: 'Comptes ayant noté',
        value: p.ratingAccounts,
        previous: q.ratingAccounts,
        detail: `${p.likes} 👍 · ${p.dislikes} 👎 — le 👎 sert surtout à écarter un nom`,
      },
    ];
  });

  // ─── Monétisation ─────────────────────────────────────────────────────────

  monetisation = computed<Kpi[]>(() => {
    const s = this.stats();
    if (!s) return [];
    const p = s.period;
    const q = s.previous;
    const conversion = s.payingUsersEver !== null && s.totalUsers > 0
      ? Math.round((s.payingUsersEver / s.totalUsers) * 1000) / 10
      : null;
    return [
      {
        label: 'Paiements',
        value: p.revenu?.paiements ?? null,
        previous: q.revenu?.paiements ?? null,
        detail: p.revenu ? `${AdminDashboardComponent.pluriel(p.revenu.payants, 'compte')} payant${p.revenu.payants > 1 ? 's' : ''} sur la période` : undefined,
        indispo: 'registre des paiements indisponible',
      },
      {
        label: 'Clients payants',
        value: s.payingUsersEver,
        previous: null,
        sansEcart: true,
        detail: conversion !== null
          ? `depuis l'origine — ${conversion.toLocaleString('fr-FR')} % des ${s.totalUsers} comptes`
          : undefined,
        indispo: 'registre des paiements indisponible',
      },
    ];
  });

  parcoursAchat = computed(() => {
    const p = this.stats()?.period;
    if (!p?.funnel || !p.revenu) return null;
    return { tarifs: p.funnel.pricingViewed, lances: p.funnel.checkoutStarted, aboutis: p.revenu.paiements };
  });

  // ─── Coût IA résumé ───────────────────────────────────────────────────────

  coutResume = computed<Kpi[]>(() => {
    const c = this.couts();
    const s = this.stats();
    if (!c || !s) return [];
    if (!c.since) {
      return [{ label: 'Coût du modèle', value: null, previous: null, indispo: 'aucun appel relevé pour l\'instant' }];
    }
    const p = s.period;
    const q = s.previous;
    const parActif = (cout: number, actifs: number | null) => (actifs ? cout / actifs : null);
    const parRecherche = (cout: number, n: number) => (n > 0 ? cout / n : null);
    return [
      {
        label: 'Coût du modèle',
        value: c.period.costUsd,
        previous: c.previous.costUsd,
        format: usd,
        detail: `${c.period.calls.toLocaleString('fr-FR')} appels`
          + (c.period.unpricedCalls ? ` — ${c.period.unpricedCalls} sans tarif, non comptés` : ''),
      },
      {
        label: 'Par compte actif',
        value: parActif(c.period.costUsd, p.activeUsers),
        previous: parActif(c.previous.costUsd, q.activeUsers),
        format: usdUnitaire,
        sansEcart: true,
        indispo: 'aucun compte actif mesuré',
      },
      {
        label: 'Par recherche',
        value: parRecherche(c.period.costUsd, p.newProjects),
        previous: parRecherche(c.previous.costUsd, q.newProjects),
        format: usdUnitaire,
        sansEcart: true,
        detail: `${p.newProjects} recherche${p.newProjects > 1 ? 's' : ''}`,
        indispo: 'aucune recherche sur la période',
      },
    ];
  });

  // ─── Entonnoir ────────────────────────────────────────────────────────────

  private part(n: number, d: number): number | null {
    return d > 0 ? Math.round((n / d) * 1000) / 10 : null;
  }

  /**
   * Visites → recherche → compte → rapport. Les tarifs consultés n'y figurent
   * plus : ils ont leur place dans la monétisation, et nulle part ailleurs.
   */
  entonnoir = computed<EtapeEntonnoir[]>(() => {
    const f = this.stats()?.period.funnel;
    if (!f) return [];
    return [
      {
        // « Visites », pas « visiteurs » : l'unité est la session de navigateur.
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
        detail: `${this.formate(f.reportsRequested)} sur ${this.formate(f.visits)} visites — refus faute de crédits compris`,
      },
    ];
  });

  noteEntonnoir = computed(() => {
    const s = this.stats();
    const depuis = s?.visitTrackingSince;
    if (!depuis) return 'Mesure des visites non démarrée.';
    const base = 'Une visite = une session de navigateur, sans cookie ni consentement requis.';
    const debutPeriode = s ? new Date(s.period.from) : null;
    return debutPeriode && debutPeriode < new Date(`${depuis}T00:00:00`)
      ? `${base} Mesuré depuis le ${this.dateCourte(depuis)} seulement : les taux restent justes, les volumes sont sous-estimés.`
      : `${base} Mesuré depuis le ${this.dateCourte(depuis)}.`;
  });

  /** Pourquoi les indicateurs du journal d'activité peuvent manquer. */
  private indisponibiliteJournal(): string {
    const depuis = this.stats()?.activityTrackingSince;
    return depuis ? `mesuré depuis le ${this.dateCourte(depuis)}` : 'journal d\'activité pas encore démarré';
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
    if (kpi.sansEcart || value === null || previous === null) return muet;

    const brut = Math.round((value - previous) * 100) / 100;
    const sens: Ecart['sens'] = brut > 0 ? 'hausse' : brut < 0 ? 'baisse' : 'stable';
    const signe = brut > 0 ? '+' : '';
    const avant = kpi.unit === 'pct' ? `${previous} %` : kpi.format ? kpi.format(previous) : previous.toLocaleString('fr-FR');
    const titre = `${avant} sur la période précédente`;

    if (kpi.unit === 'pct') {
      return { affiche: true, texte: `${signe}${Math.round(brut * 10) / 10} pts`, sens, titre };
    }
    if (previous < SOCLE_POURCENTAGE) {
      const absolu = kpi.format ? `${signe}${kpi.format(brut)}` : `${signe}${(Math.round(brut * 10) / 10).toLocaleString('fr-FR')}`;
      return { affiche: true, texte: absolu, sens, titre: `${titre} — trop peu pour un pourcentage` };
    }
    const pct = Math.round(((value - previous) / previous) * 100);
    return { affiche: true, texte: `${pct > 0 ? '+' : ''}${pct} %`, sens, titre };
  }

  // ─── Séries mensuelles ────────────────────────────────────────────────────

  pointsInscrits = computed<ChartPoint[]>(() =>
    (this.series()?.months ?? []).map(m => ({ week: m.month, value: m.newUsers })),
  );

  pointsRevenu = computed<ChartPoint[]>(() =>
    (this.series()?.months ?? []).map(m => ({
      week: m.month,
      value: m.revenue === null ? null : (m.revenue.find(d => d.devise === 'EUR')?.centimes ?? 0) / 100,
    })),
  );

  noteRevenu = computed(() => {
    const autres = (this.series()?.months ?? []).some(m => (m.revenue ?? []).some(d => d.devise !== 'EUR'));
    return 'Encaissements des packs, en euros, au mois du paiement.'
      + (autres ? ' Des paiements dans une autre devise existent : ils ne sont pas convertis ici.' : '');
  });

  pointsCoutIa = computed<ChartPoint[]>(() =>
    (this.series()?.months ?? []).map(m => ({ week: m.month, value: m.aiCostUsd })),
  );

  noteCoutIa = computed(() => {
    const depuis = this.series()?.aiCostTrackingSince;
    return depuis
      ? `Relevé depuis le ${this.dateCourte(depuis)} : les mois antérieurs sont hachurés, et le premier est partiel.`
      : 'Aucun appel relevé pour l\'instant.';
  });

  private dateCourte(jour: string): string {
    return new Date(`${jour}T00:00:00`)
      .toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  }
}
