import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { AdminService, NouveauTarif, TarifModele } from '../../services/admin.service';

/** `AAAA-MM-JJ` du jour, dans le fuseau du navigateur. */
function aujourdhui(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Les tarifs du modèle : ce qui transforme les tokens relevés en dollars.
 *
 * On n'y modifie rien. Un changement de prix est un NOUVEAU tarif, daté, et le
 * passé garde celui qu'il a payé. La suppression sert à corriger une saisie
 * erronée — elle recalcule tout ce que la ligne couvrait, et le dit avant.
 */
@Component({
  selector: 'app-admin-model-prices',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, ToastModule, ConfirmDialog],
  providers: [MessageService, ConfirmationService],
  template: `
    <p-toast></p-toast>
    <p-confirmdialog></p-confirmdialog>

    <div style="display: flex; flex-direction: column; gap: 1.25rem; padding-top: 1rem; max-width: 64rem">
      <div>
        <div class="nm-titre">Tarifs du modèle</div>
        <div class="nm-detail" style="max-width: 48rem">
          Dollars par million de tokens (par appel pour <code>web_search</code>). Le coût de chaque appel se calcule
          au tarif en vigueur <strong>le jour où il est parti</strong> : un nouveau tarif ne réécrit pas le passé,
          sauf si sa date d'effet est antérieure. Le modèle est un préfixe — <code>gpt-5.6-luna</code> couvre aussi
          ses instantanés datés.
          Source : <a href="https://developers.openai.com/api/docs/pricing" target="_blank" rel="noopener">page tarifs d'OpenAI</a>.
        </div>
      </div>

      <!-- ─── Nouveau tarif ─────────────────────────────────────────── -->
      <div class="nm-carte">
        <div class="nm-label" style="margin-bottom: 0.6rem">Nouveau tarif</div>
        <form (ngSubmit)="enregistrer()" style="display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: flex-end">
          <label class="nm-champ" style="min-width: 12rem">
            <span>Modèle</span>
            <input name="model" [(ngModel)]="saisie.model" (ngModelChange)="preremplir($event)" list="nm-modeles"
                   required maxlength="64" autocomplete="off" placeholder="gpt-5.6-luna">
            <datalist id="nm-modeles">
              <option *ngFor="let m of modeles()" [value]="m"></option>
            </datalist>
          </label>
          <label class="nm-champ">
            <span>À partir du</span>
            <input name="effectiveFrom" type="date" [(ngModel)]="saisie.effectiveFrom" required>
          </label>
          <ng-container *ngIf="!estOutil(); else champOutil">
            <label class="nm-champ nm-nombre">
              <span>Entrée</span>
              <input name="inputPerM" type="number" min="0" step="any" [(ngModel)]="saisie.inputPerM" required>
            </label>
            <label class="nm-champ nm-nombre">
              <span>Entrée en cache</span>
              <input name="cachedInputPerM" type="number" min="0" step="any" [(ngModel)]="saisie.cachedInputPerM" placeholder="= entrée">
            </label>
            <label class="nm-champ nm-nombre">
              <span>Sortie</span>
              <input name="outputPerM" type="number" min="0" step="any" [(ngModel)]="saisie.outputPerM" required>
            </label>
          </ng-container>
          <ng-template #champOutil>
            <label class="nm-champ nm-nombre">
              <span>$ par appel</span>
              <input name="perCall" type="number" min="0" step="any" [(ngModel)]="saisie.perCall" required>
            </label>
          </ng-template>
          <label class="nm-champ" style="flex: 1; min-width: 14rem">
            <span>Note (source, contexte)</span>
            <input name="note" [(ngModel)]="saisie.note" maxlength="255" placeholder="Vérifié sur la page tarifs le …">
          </label>
          <p-button type="submit" label="Ajouter" icon="pi pi-plus" size="small" [loading]="enregistrement()"
                    [disabled]="!saisieValide()"></p-button>
        </form>
        <div *ngIf="avertissement() as a" class="nm-avert" [class.nm-avert-fort]="a.fort">
          <i class="pi" [class.pi-history]="a.fort" [class.pi-calendar]="!a.fort"></i> {{ a.texte }}
        </div>
      </div>

      <!-- ─── Historique ─────────────────────────────────────────────── -->
      <div class="nm-carte" style="padding: 0; overflow-x: auto">
        <div *ngIf="chargement()" style="padding: 1rem; text-align: center"><i class="pi pi-spin pi-spinner"></i></div>
        <table class="nm-table" *ngIf="!chargement()">
          <thead>
            <tr>
              <th style="text-align: left">Modèle</th>
              <th style="text-align: left">À partir du</th>
              <th>Entrée</th>
              <th>En cache</th>
              <th>Sortie</th>
              <th>Par appel</th>
              <th style="text-align: left">Note</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let t of tarifs()" [class.nm-remplace]="statut(t) === 'remplacé'">
              <td style="text-align: left; font-family: monospace; font-size: 0.75rem">{{ t.model }}</td>
              <td style="text-align: left; white-space: nowrap">
                {{ dateCourte(t.effectiveFrom) }}
                <span class="nm-badge" [class.nm-badge-actif]="t.current" [class.nm-badge-futur]="statut(t) === 'à venir'">{{ statut(t) }}</span>
              </td>
              <td>{{ montant(t.model === 'web_search' ? null : t.inputPerM) }}</td>
              <td>
                <ng-container *ngIf="t.model !== 'web_search'">
                  <span *ngIf="t.cachedInputPerM !== null">{{ montant(t.cachedInputPerM) }}</span>
                  <span *ngIf="t.cachedInputPerM === null" class="nm-muet" title="Non renseigné : l'entrée en cache est comptée au plein tarif">= entrée</span>
                </ng-container>
              </td>
              <td>{{ montant(t.model === 'web_search' ? null : t.outputPerM) }}</td>
              <td>{{ montant(t.perCall) }}</td>
              <td style="text-align: left; white-space: normal; min-width: 14rem" class="nm-muet">{{ t.note }}</td>
              <td>
                <p-button icon="pi pi-trash" size="small" [text]="true" severity="danger"
                          [loading]="suppression() === t.id" (onClick)="confirmerSuppression(t)"></p-button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: [`
    .nm-titre { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: var(--nm-text-light-3, #6a7470); margin-bottom: 0.3rem; }
    .nm-detail { font-size: 0.74rem; color: var(--nm-text-light-3, #6a7470); line-height: 1.45; }
    .nm-carte { background: var(--nm-surface-light, #fff); border: 1px solid var(--nm-border-light, #e3e7e5); border-radius: 10px; padding: 0.875rem 1rem; }
    .nm-label { font-size: 0.72rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--nm-text-light-2, #5c6663); }
    .nm-muet { color: var(--nm-text-light-3, #6a7470); font-size: 0.72rem; }

    .nm-champ { display: flex; flex-direction: column; gap: 0.2rem; font-size: 0.68rem; color: var(--nm-text-light-2, #5c6663); }
    .nm-champ input {
      font: inherit; font-size: 0.82rem; color: var(--nm-text-light, #0b0e10);
      padding: 0.35rem 0.5rem; border: 1px solid var(--nm-border-light, #d5dbd8); border-radius: 6px; background: white;
    }
    .nm-nombre input { width: 7rem; text-align: right; }

    .nm-avert { margin-top: 0.65rem; font-size: 0.74rem; color: var(--nm-text-light-2, #5c6663); }
    .nm-avert-fort { color: var(--nm-verdict-watch-light-fg, #9a6a12); background: var(--nm-verdict-watch-light-bg, #fdf3e3); padding: 0.45rem 0.7rem; border-radius: 8px; }

    .nm-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; font-variant-numeric: tabular-nums; }
    .nm-table th { font-size: 0.66rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--nm-text-light-2, #5c6663); text-align: right; padding: 0.55rem 0.6rem; border-bottom: 1px solid var(--nm-border-light, #e3e7e5); white-space: nowrap; }
    .nm-table td { text-align: right; padding: 0.45rem 0.6rem; border-bottom: 1px solid var(--nm-divider-light-1, #eef1f0); white-space: nowrap; }
    .nm-remplace td { color: var(--nm-text-light-3, #6a7470); }

    .nm-badge { display: inline-block; margin-left: 0.35rem; padding: 0.02rem 0.35rem; border-radius: 4px; font-size: 0.6rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--nm-text-light-3, #6a7470); background: var(--nm-divider-light-1, #eef1f0); }
    .nm-badge-actif { color: var(--nm-accent-text-light, #0d7a4e); background: var(--nm-accent-bg-light, #e5f5ec); }
    .nm-badge-futur { color: var(--nm-verdict-watch-light-fg, #9a6a12); background: var(--nm-verdict-watch-light-bg, #fdf3e3); }
  `],
})
export class AdminModelPricesComponent implements OnInit {
  readonly tarifs = signal<TarifModele[]>([]);
  readonly chargement = signal(true);
  readonly enregistrement = signal(false);
  readonly suppression = signal<number | null>(null);

  saisie: NouveauTarif = this.vierge();
  /** Rafraîchit les calculs qui dépendent de la saisie (ngModel n'est pas un signal). */
  private readonly revision = signal(0);

  constructor(
    private admin: AdminService,
    private messages: MessageService,
    private confirmation: ConfirmationService,
  ) {}

  ngOnInit() {
    this.charger();
  }

  private vierge(): NouveauTarif {
    return { model: '', effectiveFrom: aujourdhui(), inputPerM: 0, cachedInputPerM: null, outputPerM: 0, perCall: null, note: '' };
  }

  charger() {
    this.chargement.set(true);
    this.admin.getModelPrices().subscribe({
      next: (t) => { this.tarifs.set(t); this.chargement.set(false); },
      error: () => this.chargement.set(false),
    });
  }

  modeles = computed(() => [...new Set(this.tarifs().map((t) => t.model))]);

  estOutil(): boolean {
    return this.saisie.model.trim() === 'web_search';
  }

  /**
   * Choisir un modèle connu reprend son tarif courant : on saisit un
   * changement de prix, rarement un tarif de zéro.
   */
  preremplir(model: string) {
    const courant = this.tarifs().find((t) => t.model === model.trim() && t.current);
    if (courant) {
      this.saisie.inputPerM = courant.inputPerM;
      this.saisie.cachedInputPerM = courant.cachedInputPerM;
      this.saisie.outputPerM = courant.outputPerM;
      this.saisie.perCall = courant.perCall;
    }
    this.revision.update((n) => n + 1);
  }

  saisieValide(): boolean {
    const s = this.saisie;
    if (!/^[A-Za-z0-9._:-]+$/.test(s.model.trim()) || !/^\d{4}-\d{2}-\d{2}$/.test(s.effectiveFrom ?? '')) return false;
    const positif = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0;
    if (this.estOutil()) return positif(s.perCall);
    return positif(s.inputPerM) && positif(s.outputPerM)
      && (s.cachedInputPerM === null || (s.cachedInputPerM as unknown) === '' || positif(s.cachedInputPerM));
  }

  /**
   * Ce que va faire ce tarif, dit avant de l'enregistrer.
   *
   * Une date passée n'est pas une erreur — c'est ainsi qu'on corrige un prix
   * découvert après coup — mais elle recalcule des coûts déjà affichés, et
   * cela doit se voir.
   */
  avertissement(): { texte: string; fort: boolean } | null {
    this.revision();
    const d = this.saisie.effectiveFrom;
    if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
    const jour = aujourdhui();
    if (d < jour) {
      return {
        fort: true,
        texte: `Date passée : les appels à partir du ${this.dateCourte(d)} seront recalculés à ce tarif, `
          + 'dans le tableau de bord comme dans la liste des utilisateurs.',
      };
    }
    if (d > jour) return { fort: false, texte: `Prendra effet le ${this.dateCourte(d)} ; le tarif actuel s'applique jusque-là.` };
    return { fort: false, texte: 'S\'applique aux appels à partir d\'aujourd\'hui, minuit.' };
  }

  enregistrer() {
    if (!this.saisieValide()) return;
    const s = this.saisie;
    const cache = s.cachedInputPerM as unknown;
    const corps: NouveauTarif = {
      ...s,
      model: s.model.trim(),
      cachedInputPerM: cache === '' || cache === null ? null : Number(cache),
      perCall: this.estOutil() ? Number(s.perCall) : null,
    };
    this.enregistrement.set(true);
    this.admin.addModelPrice(corps).subscribe({
      next: (t) => {
        this.enregistrement.set(false);
        this.messages.add({ severity: 'success', summary: 'Tarif ajouté', detail: `${t.model} à partir du ${this.dateCourte(t.effectiveFrom)}` });
        this.saisie = this.vierge();
        this.revision.update((n) => n + 1);
        this.charger();
      },
      error: (e) => {
        this.enregistrement.set(false);
        this.messages.add({ severity: 'error', summary: 'Tarif refusé', detail: e?.error?.message ?? 'Erreur inconnue' });
      },
    });
  }

  confirmerSuppression(t: TarifModele) {
    this.confirmation.confirm({
      header: 'Supprimer ce tarif',
      icon: 'pi pi-exclamation-triangle',
      message: `Supprimer le tarif <strong>${t.model}</strong> du ${this.dateCourte(t.effectiveFrom)} ?<br>`
        + 'Les appels qu\'il couvrait seront recalculés au tarif précédent, ou deviendront « non chiffrés » s\'il n\'y en a pas.'
        + '<br>Pour un changement de prix, ajoutez plutôt un nouveau tarif daté.',
      acceptLabel: 'Supprimer',
      rejectLabel: 'Annuler',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.suppression.set(t.id);
        this.admin.deleteModelPrice(t.id).subscribe({
          next: () => { this.suppression.set(null); this.charger(); },
          error: () => this.suppression.set(null),
        });
      },
    });
  }

  statut(t: TarifModele): 'en vigueur' | 'à venir' | 'remplacé' {
    if (t.current) return 'en vigueur';
    return t.effectiveFrom > aujourdhui() ? 'à venir' : 'remplacé';
  }

  montant(v: number | null): string {
    return v === null ? '' : `${v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} $`;
  }

  dateCourte(jour: string): string {
    return new Date(`${jour}T00:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  }
}
