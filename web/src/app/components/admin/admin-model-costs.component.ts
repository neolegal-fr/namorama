import { Component, Input, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AdminModelCosts, LigneConsommation } from '../../services/admin.service';
import { AdminWeeklyChartComponent, ChartPoint } from './admin-weekly-chart.component';
import { coutAuTarif, libelleOperation, tarifDe, tokens, usd, usdUnitaire } from './couts-modele';

/** Une ligne du relevé, et ce qu'elle deviendrait sur le modèle choisi. */
interface LigneSimulee {
  cle: string;
  ligne: LigneConsommation;
  /** Même tokens, même modèle, au tarif du jour : la base de comparaison. */
  base: number | null;
  /** Modèle choisi dans le simulateur — par défaut, celui de l'appel. */
  cible: string;
  simule: number | null;
}

/**
 * Ce qu'ont coûté les appels au modèle, et ce qu'ils coûteraient sur un autre.
 *
 * Tout part des TOKENS relevés appel par appel : le coût réel les multiplie par
 * le tarif en vigueur le jour de chaque appel (calculé par l'API), la projection
 * par le tarif courant du modèle qu'on choisit ici. Aucun montant n'est stocké.
 */
@Component({
  selector: 'app-admin-model-costs',
  standalone: true,
  imports: [CommonModule, RouterLink, AdminWeeklyChartComponent],
  template: `
    <div>
      <div style="display: flex; align-items: baseline; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.5rem">
        <span class="nm-titre">Coût du modèle</span>
        <span class="nm-sous-titre">
          sur la période sélectionnée, en dollars au tarif de chaque appel
          <ng-container *ngIf="couts()?.since as depuis"> — mesuré depuis le {{ dateCourte(depuis) }}</ng-container>
        </span>
        <a routerLink="/admin/prices" class="nm-sous-titre" style="margin-left: auto">Gérer les tarifs →</a>
      </div>

      <div *ngIf="erreur" class="nm-carte nm-muet">
        Le relevé des coûts n'a pas pu être chargé. Les autres indicateurs restent justes ; le détail est dans les logs de l'API.
      </div>

      <div *ngIf="!erreur && couts() && !couts()!.since" class="nm-carte nm-muet">
        Aucun appel au modèle relevé pour l'instant : le relevé commence au déploiement de cette version.
        Rien n'est rétroactif — ni les logs ni la base ne gardaient les tokens.
      </div>

      <ng-container *ngIf="!erreur && couts() as c">
        <ng-container *ngIf="c.since">
          <!-- ─── Indicateurs ─────────────────────────────────────────── -->
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(10.5rem, 1fr)); gap: 0.75rem">
            <div class="nm-carte nm-accent">
              <div class="nm-label">Coût du modèle</div>
              <div style="display: flex; align-items: baseline; flex-wrap: wrap; gap: 0.5rem">
                <div class="nm-valeur">{{ usd(c.period.costUsd) }}</div>
                <span *ngIf="ecart() as e" class="nm-ecart" [class.nm-hausse]="e.sens > 0" [class.nm-baisse]="e.sens < 0"
                      [title]="usd(c.previous.costUsd) + ' sur la période précédente'">
                  <i class="pi" [class.pi-arrow-up-right]="e.sens > 0" [class.pi-arrow-down-right]="e.sens < 0"
                     [class.pi-minus]="e.sens === 0"></i>{{ e.texte }}
                </span>
              </div>
              <div class="nm-detail">{{ c.period.calls.toLocaleString('fr-FR') }} appels</div>
            </div>

            <div class="nm-carte nm-accent">
              <div class="nm-label">Par crédit consommé</div>
              <div class="nm-valeur" [class.nm-vide]="parCredit() === null">{{ usdUnitaire(parCredit()) }}</div>
              <div class="nm-detail">
                {{ creditsConsommes === null ? 'crédits de la période indisponibles'
                   : (creditsConsommes.toLocaleString('fr-FR') + ' crédits consommés') }}
              </div>
            </div>

            <div class="nm-carte nm-accent">
              <div class="nm-label">Par compte servi</div>
              <div class="nm-valeur" [class.nm-vide]="parCompte() === null">{{ usd(parCompte()) }}</div>
              <div class="nm-detail">{{ c.period.accounts }} compte{{ c.period.accounts > 1 ? 's' : '' }} — hors visiteurs sans compte</div>
            </div>

            <div class="nm-carte nm-accent">
              <div class="nm-label">Visiteurs sans compte</div>
              <div class="nm-valeur">{{ usd(c.period.unattributedCostUsd) }}</div>
              <div class="nm-detail">
                {{ partSansCompte() === null ? '—' : partSansCompte() + ' % du total' }}
                — étape 1 jamais suivie d'une connexion, ou compte supprimé
              </div>
            </div>
          </div>

          <div *ngIf="c.period.unpricedCalls > 0" class="nm-alerte">
            <i class="pi pi-exclamation-triangle"></i>
            {{ c.period.unpricedCalls }} appel{{ c.period.unpricedCalls > 1 ? 's' : '' }} sur un modèle sans tarif
            ({{ modelesSansTarif() }}) : absent{{ c.period.unpricedCalls > 1 ? 's' : '' }} des totaux.
            <a routerLink="/admin/prices">Ajouter son tarif</a> pour le chiffrer.
          </div>

          <!-- ─── Relevé par opération, et simulateur ─────────────────── -->
          <div class="nm-carte" style="margin-top: 0.75rem; padding: 0; overflow-x: auto">
            <table class="nm-table">
              <thead>
                <tr>
                  <th style="text-align: left">Opération</th>
                  <th style="text-align: left">Modèle</th>
                  <th>Appels</th>
                  <th title="Tokens d'entrée, dont la part servie par le cache">Entrée <span class="nm-dont">(cache)</span></th>
                  <th title="Tokens de sortie, dont la part de raisonnement">Sortie <span class="nm-dont">(raisonnement)</span></th>
                  <th title="Appels à l'outil web_search">Web</th>
                  <th>Coût</th>
                  <th>Part</th>
                  <th class="nm-sim" style="text-align: left">Sur le modèle…</th>
                  <th class="nm-sim">Simulé</th>
                  <th class="nm-sim">Écart</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let s of lignes(); trackBy: parCle">
                  <td style="text-align: left; font-weight: 600">
                    {{ libelle(s.ligne.operation) }}
                    <div class="nm-dont" *ngIf="s.ligne.items > s.ligne.calls">
                      {{ s.ligne.items }} noms — {{ usdUnitaire(parElement(s.ligne)) }} / nom
                    </div>
                  </td>
                  <td style="text-align: left; font-family: monospace; font-size: 0.72rem">{{ s.ligne.model }}</td>
                  <td>{{ s.ligne.calls.toLocaleString('fr-FR') }}</td>
                  <td>{{ tokens(s.ligne.inputTokens) }} <span class="nm-dont" *ngIf="s.ligne.cachedInputTokens">({{ tokens(s.ligne.cachedInputTokens) }})</span></td>
                  <td>{{ tokens(s.ligne.outputTokens) }} <span class="nm-dont" *ngIf="s.ligne.reasoningTokens">({{ tokens(s.ligne.reasoningTokens) }})</span></td>
                  <td>{{ s.ligne.webSearchCalls || '' }}</td>
                  <td style="font-weight: 700" [class.nm-vide]="s.ligne.costUsd === null">{{ usd(s.ligne.costUsd) }}</td>
                  <td>{{ part(s.ligne.costUsd) }}</td>
                  <td class="nm-sim" style="text-align: left">
                    <!-- « [selected] » par option, et non « [value] » sur le select : la
                         valeur serait posée avant que les options existent, et le
                         navigateur retomberait sur la première. -->
                    <select class="nm-select" (change)="choisir(s.cle, $any($event.target).value)">
                      <option *ngIf="!s.cible" value="" selected>—</option>
                      <option *ngFor="let t of c.prices" [value]="t.model" [selected]="t.model === s.cible">{{ t.model }}</option>
                    </select>
                  </td>
                  <td class="nm-sim" [class.nm-vide]="s.simule === null">{{ usd(s.simule) }}</td>
                  <td class="nm-sim">
                    <span *ngIf="s.simule !== null && s.base !== null && s.cible !== tarifCourant(s.ligne.model)"
                          [class.nm-hausse-txt]="s.simule > s.base" [class.nm-baisse-txt]="s.simule < s.base">
                      {{ s.simule - s.base >= 0 ? '+' : '' }}{{ usd(s.simule - s.base) }}
                    </span>
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="6" style="text-align: left">Total</td>
                  <td style="font-weight: 800">{{ usd(c.period.costUsd) }}</td>
                  <td></td>
                  <td class="nm-sim" style="text-align: left; font-weight: 400">
                    <span class="nm-dont">au tarif du jour : {{ usd(totalBase()) }}</span>
                    <div class="nm-dont" *ngIf="lignesHorsSimulation()">hors {{ lignesHorsSimulation() }} ligne(s) sans tarif</div>
                  </td>
                  <td class="nm-sim" style="font-weight: 800">{{ usd(totalSimule()) }}</td>
                  <td class="nm-sim">
                    <span *ngIf="totalSimule() !== null && totalBase() !== null && totalSimule() !== totalBase()"
                          [class.nm-hausse-txt]="totalSimule()! > totalBase()!" [class.nm-baisse-txt]="totalSimule()! < totalBase()!">
                      {{ pctEcart() }}
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div class="nm-detail" style="margin-top: 0.5rem; max-width: 60rem">
            La simulation applique le tarif courant du modèle choisi aux <strong>mêmes tokens</strong>.
            C'est juste à <code>reasoning_effort: none</code> ; pour « Meilleur choix » et « Repérage du marché »
            (à <code>low</code>), le volume de raisonnement dépend du modèle — un ordre de grandeur, pas un devis.
            Le tokenizer peut aussi différer d'un modèle à l'autre. Pour trancher, un essai de quelques jours via
            <code>OPENAI_MODEL_ANALYSIS</code> se mesure ici tout seul.
          </div>

          <div style="margin-top: 0.75rem; max-width: 36rem">
            <app-admin-weekly-chart
              title="Coût du modèle"
              unite="$"
              [decimales]="2"
              [points]="pointsSemaines()"
              [note]="'Six derniers mois, indépendamment de la période choisie. Semaines antérieures au relevé hachurées : non mesurées, pas gratuites.'">
            </app-admin-weekly-chart>
          </div>
        </ng-container>
      </ng-container>
    </div>
  `,
  styles: [`
    .nm-titre { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: var(--nm-text-light-3, #6a7470); }
    .nm-sous-titre { font-size: 0.7rem; color: var(--nm-text-light-3, #6a7470); }
    .nm-carte {
      background: var(--nm-surface-light, #fff);
      border: 1px solid var(--nm-border-light, #e3e7e5);
      border-radius: 10px;
      padding: 0.875rem 1rem;
    }
    .nm-accent { border-color: var(--nm-accent-border-light, #c9e9d8); }
    .nm-muet { color: var(--nm-text-light-3, #6a7470); font-size: 0.78rem; }
    .nm-label {
      font-size: 0.72rem; font-weight: 600; text-transform: uppercase;
      letter-spacing: 0.05em; color: var(--nm-text-light-2, #5c6663); margin-bottom: 0.25rem;
    }
    .nm-valeur { font-size: 1.5rem; font-weight: 800; color: var(--nm-accent-text-light, #0d7a4e); line-height: 1.1; }
    .nm-vide { color: var(--nm-text-light-3, #6a7470); font-weight: 600; }
    .nm-detail { font-size: 0.68rem; color: var(--nm-text-light-3, #6a7470); margin-top: 0.3rem; line-height: 1.35; }
    .nm-dont { font-size: 0.66rem; color: var(--nm-text-light-3, #6a7470); font-weight: 400; }

    /* Une dépense qui monte est une mauvaise nouvelle : les couleurs sont
       l'inverse de celles des indicateurs d'usage. La flèche porte le sens. */
    .nm-ecart { display: inline-flex; align-items: center; gap: 0.2rem; font-size: 0.72rem; font-weight: 700; color: var(--nm-text-light-3, #6a7470); white-space: nowrap; }
    .nm-ecart i { font-size: 0.62rem; }
    .nm-hausse, .nm-hausse-txt { color: var(--nm-verdict-taken-light-fg, #a33b3b); }
    .nm-baisse, .nm-baisse-txt { color: var(--nm-verdict-free-light-fg, #0d7a4e); }

    .nm-alerte {
      margin-top: 0.6rem; font-size: 0.74rem; padding: 0.5rem 0.75rem; border-radius: 8px;
      color: var(--nm-verdict-watch-light-fg, #9a6a12); background: var(--nm-verdict-watch-light-bg, #fdf3e3);
    }

    .nm-table { width: 100%; border-collapse: collapse; font-size: 0.78rem; font-variant-numeric: tabular-nums; }
    .nm-table th {
      font-size: 0.66rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;
      color: var(--nm-text-light-2, #5c6663); text-align: right; padding: 0.55rem 0.6rem;
      border-bottom: 1px solid var(--nm-border-light, #e3e7e5); white-space: nowrap;
    }
    .nm-table td { text-align: right; padding: 0.45rem 0.6rem; border-bottom: 1px solid var(--nm-divider-light-1, #eef1f0); white-space: nowrap; }
    .nm-table tfoot td { border-bottom: none; font-weight: 700; }
    .nm-sim { background: var(--nm-divider-light-1, #f5f7f6); }
    .nm-select {
      font: inherit; font-size: 0.74rem; padding: 0.15rem 0.3rem;
      border: 1px solid var(--nm-border-light, #e3e7e5); border-radius: 6px; background: white;
    }
  `],
})
export class AdminModelCostsComponent {
  @Input({ required: true }) set donnees(v: AdminModelCosts | null) { this.couts.set(v); }
  /** Crédits consommés sur la période, lus dans les statistiques — `null` s'ils manquent. */
  @Input() creditsConsommes: number | null = null;
  @Input() erreur = false;

  readonly couts = signal<AdminModelCosts | null>(null);
  /** Modèle choisi par ligne, dans le simulateur. Absent : celui de l'appel. */
  private readonly choix = signal<Record<string, string>>({});

  readonly usd = usd;
  readonly usdUnitaire = usdUnitaire;
  readonly tokens = tokens;
  readonly libelle = libelleOperation;

  tarifCourant(model: string): string {
    return tarifDe(model, this.couts()?.prices ?? [])?.model ?? '';
  }

  lignes = computed<LigneSimulee[]>(() => {
    const c = this.couts();
    if (!c) return [];
    const choix = this.choix();
    return c.period.byOperation.map((l) => {
      const cle = `${l.operation}|${l.model}`;
      const courant = tarifDe(l.model, c.prices);
      const cible = choix[cle] ?? courant?.model ?? '';
      return {
        cle,
        ligne: l,
        base: coutAuTarif(l, courant, c.webSearchPerCall),
        cible,
        simule: coutAuTarif(l, c.prices.find((t) => t.model === cible) ?? null, c.webSearchPerCall),
      };
    });
  });

  /**
   * Les lignes comparables : chiffrées avant ET après. Une ligne sans tarif
   * d'un côté ou de l'autre en est retirée — et le nombre en est affiché —
   * plutôt que de vider tout le total, ou de compter pour zéro.
   */
  private comparables = computed(() => this.lignes().filter((l) => l.base !== null && l.simule !== null));

  lignesHorsSimulation = computed(() => this.lignes().length - this.comparables().length);

  totalBase = computed<number | null>(() => {
    const l = this.comparables();
    return l.length ? l.reduce((a, x) => a + x.base!, 0) : null;
  });
  totalSimule = computed<number | null>(() => {
    const l = this.comparables();
    return l.length ? l.reduce((a, x) => a + x.simule!, 0) : null;
  });

  pctEcart(): string {
    const b = this.totalBase();
    const s = this.totalSimule();
    if (b === null || s === null || b === 0) return '';
    const pct = Math.round(((s - b) / b) * 100);
    return `${pct > 0 ? '+' : ''}${pct} %`;
  }

  choisir(cle: string, model: string) {
    this.choix.update((c) => ({ ...c, [cle]: model }));
  }

  parCle = (_: number, s: LigneSimulee) => s.cle;

  parElement(l: LigneConsommation): number | null {
    return l.costUsd === null || l.items === 0 ? null : l.costUsd / l.items;
  }

  part(cout: number | null): string {
    const total = this.couts()?.period.costUsd ?? 0;
    if (cout === null || total <= 0) return '—';
    return `${Math.round((cout / total) * 100)} %`;
  }

  /**
   * Écart à la période précédente, en pourcentage — sauf quand elle ne coûtait
   * rien : un « +∞ % » n'apprend rien, le montant de la carte suffit.
   */
  ecart = computed<{ texte: string; sens: number } | null>(() => {
    const c = this.couts();
    if (!c || c.previous.costUsd <= 0) return null;
    const pct = Math.round(((c.period.costUsd - c.previous.costUsd) / c.previous.costUsd) * 100);
    return { texte: `${pct > 0 ? '+' : ''}${pct} %`, sens: Math.sign(pct) };
  });

  parCredit = computed(() => {
    const c = this.couts();
    if (!c || !this.creditsConsommes) return null;
    return c.period.costUsd / this.creditsConsommes;
  });

  /** Coût moyen d'un compte servi — les visiteurs sans compte n'y sont pas. */
  parCompte = computed(() => {
    const c = this.couts();
    if (!c || c.period.accounts === 0) return null;
    return (c.period.costUsd - c.period.unattributedCostUsd) / c.period.accounts;
  });

  partSansCompte = computed(() => {
    const c = this.couts();
    if (!c || c.period.costUsd <= 0) return null;
    return Math.round((c.period.unattributedCostUsd / c.period.costUsd) * 100);
  });

  modelesSansTarif = computed(() =>
    [...new Set((this.couts()?.period.byOperation ?? []).filter((l) => l.unpricedCalls > 0).map((l) => l.model))].join(', '),
  );

  /** Au millième de dollar : au centime, une semaine calme s'afficherait à zéro. */
  pointsSemaines = computed<ChartPoint[]>(() =>
    (this.couts()?.weeks ?? []).map((w) => ({
      week: w.week,
      value: w.costUsd === null ? null : Math.round(w.costUsd * 100) / 100,
    })),
  );

  dateCourte(jour: string): string {
    return new Date(`${jour}T00:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  }
}
