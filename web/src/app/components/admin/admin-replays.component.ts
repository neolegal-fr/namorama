import { Component, ElementRef, OnDestroy, OnInit, ViewChild, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { SelectButtonModule } from 'primeng/selectbutton';
import { FormsModule } from '@angular/forms';
import { AdminReplayService, FiltreRejeu, LigneRejeu } from '../../services/admin-replay.service';

/** Type rrweb : 5 = événement personnalisé (repéré sur la frise), 6 = plugin (console). */
const EVENEMENT_PERSONNALISE = 5;
const EVENEMENT_PLUGIN = 6;
const PLUGIN_CONSOLE = 'rrweb/console@1';
const REPERE_ERREUR = 'erreur';

/** Une erreur console, à son instant dans la visite. */
interface ErreurRejouee {
  decalageMs: number;
  message: string;
}

/** Ce que l'on utilise du lecteur (Svelte), chargé à l'ouverture. */
interface Lecteur {
  goto(decalageMs: number, lecture?: boolean): void;
  $destroy(): void;
}

/**
 * Administration → Sessions : les visites enregistrées, et leur rejeu.
 *
 * Les segments d'une visite (avant et après Keycloak, après un rechargement)
 * sont rejoués à la suite : chaque segment commence par un instantané complet
 * que le lecteur reconstruit, et `skipInactive` saute l'intervalle. Les erreurs
 * console deviennent des repères sur la frise.
 *
 * `rrweb-player` et sa feuille de style ne sont chargés qu'à l'ouverture d'un
 * rejeu : rien pour qui n'ouvre jamais cette page.
 */
@Component({
  selector: 'app-admin-replays',
  standalone: true,
  imports: [CommonModule, FormsModule, TableModule, ButtonModule, DialogModule, SelectButtonModule],
  template: `
    <div style="display: flex; flex-direction: column; gap: 1rem; padding-top: 1rem">

      <div style="display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; justify-content: space-between">
        <p-selectbutton [options]="filtres" [(ngModel)]="filtre" optionLabel="label" optionValue="value"
                        [allowEmpty]="false" (onChange)="recharger()" size="small"></p-selectbutton>
        <div style="display: flex; gap: 0.5rem; align-items: center">
          <span *ngIf="compte()" class="text-sm" style="display: flex; gap: 0.25rem; align-items: center">
            Compte <code style="font-size: 0.75rem">{{ compte() }}</code>
            <p-button icon="pi pi-times" size="small" [text]="true" severity="secondary"
                      ariaLabel="Toutes les visites" (onClick)="oublierLeCompte()"></p-button>
          </span>
          <p-button icon="pi pi-refresh" size="small" [text]="true" severity="secondary" label="Actualiser" (onClick)="recharger()"></p-button>
        </div>
      </div>

      <p class="text-sm" style="margin: 0; color: var(--nm-app-text-2)">
        Seules les visites qui ont accepté « Enregistrement de session » figurent ici
        (<code>python3 - consentement</code> en donne la part). Saisies, descriptions,
        mots-clés et adresses sont masqués dès le navigateur. Conservation : 30 jours.
      </p>

      <div class="border-1 border-solid border-round-lg shadow-1 overflow-x-auto" style="background: var(--nm-app-surface)">
        <p-table [value]="lignes()" [lazy]="true" (onLazyLoad)="charger($event)" [paginator]="true"
                 [rows]="parPage" [totalRecords]="total()" [loading]="chargement()"
                 [tableStyle]="{ width: '100%' }" styleClass="p-datatable-sm" dataKey="sessionId">
          <ng-template pTemplate="header">
            <tr>
              <th style="width: 9rem">Début</th>
              <th style="width: 5rem">Durée</th>
              <th>Entrée</th>
              <th>Parcours</th>
              <th style="width: 6rem; text-align: right">Taille</th>
              <th style="width: 7rem; text-align: center">Rejeu</th>
            </tr>
          </ng-template>
          <ng-template pTemplate="body" let-l>
            <tr>
              <td class="text-xs">{{ l.debut | date:'dd/MM/yy HH:mm' }}</td>
              <td class="text-xs">{{ duree(l.dureeMs) }}</td>
              <td class="text-xs" style="font-family: monospace; word-break: break-all">{{ l.entree || '—' }}</td>
              <td>
                <div style="display: flex; flex-wrap: wrap; gap: 0.25rem">
                  <span *ngIf="l.erreur" class="nm-rejeu-badge nm-rejeu-badge--erreur">erreur</span>
                  <span *ngIf="l.connecteAuDepart" class="nm-rejeu-badge">connecté</span>
                  <span *ngIf="l.recherche" class="nm-rejeu-badge">recherche</span>
                  <span *ngIf="l.compteCree" class="nm-rejeu-badge nm-rejeu-badge--ok">compte créé</span>
                  <span *ngIf="l.tarifsVus" class="nm-rejeu-badge">tarifs vus</span>
                  <span *ngIf="l.rapport" class="nm-rejeu-badge">rapport</span>
                  <span *ngIf="l.segments > 1" class="nm-rejeu-badge">{{ l.segments }} segments</span>
                </div>
              </td>
              <td class="text-xs" style="text-align: right">{{ (l.octets / 1024) | number:'1.0-0' }} ko</td>
              <td style="text-align: center">
                <p-button icon="pi pi-play" size="small" label="Lire" [text]="true" (onClick)="ouvrir(l)"></p-button>
              </td>
            </tr>
          </ng-template>
          <ng-template pTemplate="emptymessage">
            <tr><td colspan="6" class="text-center text-500 py-4">Aucune visite enregistrée pour ce filtre.</td></tr>
          </ng-template>
        </p-table>
      </div>
    </div>

    <p-dialog [visible]="ouvert()" (visibleChange)="!$event && fermer()" [modal]="true" [draggable]="false"
              [style]="{ width: '96vw', maxWidth: '1400px' }" [header]="titre()" (onHide)="fermer()">
      <div style="display: flex; flex-direction: column; gap: 0.75rem">
        <p *ngIf="message()" class="text-sm" style="margin: 0">{{ message() }}</p>
        <div #scene style="width: 100%; display: flex; justify-content: center"></div>
        <div *ngIf="erreurs().length" style="display: flex; flex-direction: column; gap: 0.25rem">
          <strong class="text-sm">Erreurs console</strong>
          <div *ngFor="let e of erreurs()" style="display: flex; gap: 0.5rem; align-items: baseline">
            <p-button size="small" [text]="true" [label]="duree(e.decalageMs)" (onClick)="allerA(e.decalageMs)"></p-button>
            <code class="text-xs" style="word-break: break-all">{{ e.message }}</code>
          </div>
        </div>
      </div>
    </p-dialog>
  `,
})
export class AdminReplaysComponent implements OnInit, OnDestroy {
  private readonly service = inject(AdminReplayService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  @ViewChild('scene') scene?: ElementRef<HTMLDivElement>;

  readonly parPage = 50;
  readonly filtres: { label: string; value: FiltreRejeu | null }[] = [
    { label: 'Toutes', value: null },
    { label: 'A cherché, sans compte', value: 'cherche_sans_compte' },
    { label: 'Erreur', value: 'erreur' },
    { label: 'Tarifs vus', value: 'tarifs_vus' },
    { label: 'Rapport', value: 'rapport' },
  ];
  filtre: FiltreRejeu | null = null;

  readonly lignes = signal<LigneRejeu[]>([]);
  readonly total = signal(0);
  readonly chargement = signal(false);
  readonly compte = signal<string | null>(null);

  readonly ouvert = signal(false);
  readonly titre = signal('');
  readonly message = signal('');
  readonly erreurs = signal<ErreurRejouee[]>([]);

  private page = 0;
  private lecteur?: Lecteur;

  ngOnInit(): void {
    this.compte.set(this.route.snapshot.queryParamMap.get('compte'));
  }

  ngOnDestroy(): void {
    this.detruireLeLecteur();
  }

  charger(e: TableLazyLoadEvent): void {
    this.page = Math.floor((e.first ?? 0) / this.parPage);
    this.recharger();
  }

  recharger(): void {
    this.chargement.set(true);
    this.service.lister({ filtre: this.filtre, compte: this.compte(), page: this.page }).subscribe({
      next: p => {
        this.lignes.set(p.lignes);
        this.total.set(p.total);
        this.chargement.set(false);
      },
      error: () => this.chargement.set(false),
    });
  }

  oublierLeCompte(): void {
    this.compte.set(null);
    void this.router.navigate([], { queryParams: { compte: null }, queryParamsHandling: 'merge' });
    this.page = 0;
    this.recharger();
  }

  ouvrir(l: LigneRejeu): void {
    this.titre.set(`Visite du ${new Date(l.debut).toLocaleString('fr-FR')} — ${this.duree(l.dureeMs)}`);
    this.message.set('Chargement…');
    this.erreurs.set([]);
    this.ouvert.set(true);
    this.service.lire(l.sessionId).subscribe({
      next: r => void this.monter(r.segments),
      error: err => this.message.set(
        err?.status === 404 ? 'Enregistrement purgé ou absent.' : 'Lecture impossible.',
      ),
    });
  }

  fermer(): void {
    this.detruireLeLecteur();
    this.ouvert.set(false);
  }

  allerA(decalageMs: number): void {
    this.lecteur?.goto(Math.max(0, decalageMs - 1500), true);
  }

  duree(ms: number): string {
    const s = Math.round(ms / 1000);
    return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')}`;
  }

  /** Recolle les segments, repère les erreurs, et monte le lecteur. */
  private async monter(segments: Record<string, unknown>[][]): Promise<void> {
    const { evenements, erreurs } = preparer(segments);
    if (evenements.length < 2) {
      this.message.set('Enregistrement trop court pour être rejoué.');
      return;
    }
    this.erreurs.set(erreurs);
    chargerLaFeuilleDuLecteur();
    const { default: Player } = await import('rrweb-player');
    // Le dialogue vient de s'ouvrir : laisser Angular poser la scène.
    await new Promise(r => setTimeout(r));
    const cible = this.scene?.nativeElement;
    if (!cible || !this.ouvert()) return;
    this.detruireLeLecteur();
    const largeur = Math.min(cible.clientWidth || 1200, 1340);
    this.lecteur = new Player({
      target: cible,
      props: {
        events: evenements as any,
        width: largeur,
        height: Math.round(largeur * 0.56),
        autoPlay: false,
        skipInactive: true,
        showController: true,
        tags: { [REPERE_ERREUR]: '#d32f2f' },
      },
    }) as unknown as Lecteur;
    this.message.set('');
  }

  private detruireLeLecteur(): void {
    try {
      this.lecteur?.$destroy();
    } catch {
      /* déjà détruit */
    }
    this.lecteur = undefined;
    if (this.scene) this.scene.nativeElement.innerHTML = '';
  }
}

/**
 * Met bout à bout les segments, triés par horodatage, et ajoute un repère de
 * frise à chaque erreur console. Exporté pour les tests.
 */
export function preparer(segments: Record<string, unknown>[][]): {
  evenements: Record<string, unknown>[];
  erreurs: ErreurRejouee[];
} {
  const tous = segments.flat().filter(e => typeof e?.['timestamp'] === 'number');
  tous.sort((a, b) => (a['timestamp'] as number) - (b['timestamp'] as number));
  const debut = (tous[0]?.['timestamp'] as number) ?? 0;

  const erreurs: ErreurRejouee[] = [];
  const reperes: Record<string, unknown>[] = [];
  for (const e of tous) {
    const data = e['data'] as any;
    if (e['type'] === EVENEMENT_PLUGIN && data?.plugin === PLUGIN_CONSOLE && data?.payload?.level === 'error') {
      const message = (Array.isArray(data.payload.payload) ? data.payload.payload.join(' ') : String(data.payload.payload ?? ''))
        .replace(/^"|"$/g, '')
        .slice(0, 500);
      const ts = e['timestamp'] as number;
      erreurs.push({ decalageMs: ts - debut, message });
      reperes.push({ type: EVENEMENT_PERSONNALISE, timestamp: ts, data: { tag: REPERE_ERREUR, payload: { message } } });
    }
  }
  const evenements = [...tous, ...reperes].sort((a, b) => (a['timestamp'] as number) - (b['timestamp'] as number));
  return { evenements, erreurs };
}

/** La CSS du lecteur est un bundle à part (`angular.json`, `inject: false`). */
function chargerLaFeuilleDuLecteur(): void {
  if (document.getElementById('nm-rrweb-player-css')) return;
  const lien = document.createElement('link');
  lien.id = 'nm-rrweb-player-css';
  lien.rel = 'stylesheet';
  lien.href = '/rrweb-player.css';
  document.head.appendChild(lien);
}
