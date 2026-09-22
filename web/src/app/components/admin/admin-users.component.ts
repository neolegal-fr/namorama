import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { MessageService, ConfirmationService } from 'primeng/api';
import { AdminService, AdminUser, UserModelCosts } from '../../services/admin.service';
import { AdminWeeklyChartComponent, ChartPoint } from './admin-weekly-chart.component';
import { libelleOperation, parOperation, tokens, usd } from './couts-modele';
import { UserService } from '../../services/user';
import { KeycloakService } from 'keycloak-angular';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [
    CommonModule, FormsModule, TranslatePipe,
    TableModule, ButtonModule, InputTextModule,
    InputNumberModule, ToastModule, TooltipModule,
    ConfirmDialog, DialogModule, AdminWeeklyChartComponent,
  ],
  providers: [MessageService, ConfirmationService],
  template: `
    <p-toast></p-toast>
    <p-confirmdialog></p-confirmdialog>

    <div style="display: flex; flex-direction: column; gap: 1rem; padding-top: 1rem">

      <input pInputText [(ngModel)]="searchText" [placeholder]="'ADMIN.SEARCH_PLACEHOLDER' | translate"
             (ngModelChange)="onSearch()" style="max-width: 24rem">

      <div class="border-1 border-solid border-round-lg shadow-1 overflow-x-auto" style="background: white">
        <!-- « lazy » : le tri part au SERVEUR. La table étant paginée, trier les
             vingt lignes chargées répondrait à « qui est le plus récemment
             actif de cette page », pas de la base. -->
        <p-table [value]="users()" [loading]="loadingUsers()" [tableStyle]="{'width': '100%'}"
                 styleClass="p-datatable-sm"
                 [lazy]="true" [sortField]="sortField()" [sortOrder]="sortOrder()"
                 (onLazyLoad)="onSort($any($event))">
          <ng-template pTemplate="header">
            <tr>
              <th pSortableColumn="name" style="background: var(--p-surface-50)">
                {{ 'ADMIN.COL_NAME' | translate }} <p-sortIcon field="name"></p-sortIcon>
              </th>
              <th pSortableColumn="email" style="background: var(--p-surface-50)">
                {{ 'ADMIN.COL_EMAIL' | translate }} <p-sortIcon field="email"></p-sortIcon>
              </th>
              <th pSortableColumn="totalCredits" class="text-center" style="background: var(--p-surface-50); white-space: nowrap">
                {{ 'ADMIN.COL_CREDITS' | translate }} <p-sortIcon field="totalCredits"></p-sortIcon>
              </th>
              <th pSortableColumn="projectCount" class="text-center" style="background: var(--p-surface-50); white-space: nowrap">
                {{ 'ADMIN.COL_PROJECTS' | translate }} <p-sortIcon field="projectCount"></p-sortIcon>
              </th>
              <th pSortableColumn="brandReportCount" class="text-center" style="background: var(--p-surface-50); white-space: nowrap">
                {{ 'ADMIN.COL_REPORTS' | translate }} <p-sortIcon field="brandReportCount"></p-sortIcon>
              </th>
              <!-- Coût du modèle depuis l'ouverture du compte, au tarif de chaque
                   appel. Le clic ouvre le détail par opération et par semaine. -->
              <th pSortableColumn="aiCostUsd" class="text-center" style="background: var(--p-surface-50); white-space: nowrap">
                {{ 'ADMIN.COL_AI_COST' | translate }} <p-sortIcon field="aiCostUsd"></p-sortIcon>
              </th>
              <th pSortableColumn="createdAt" class="text-center" style="background: var(--p-surface-50); white-space: nowrap">
                {{ 'ADMIN.COL_CREATED' | translate }} <p-sortIcon field="createdAt"></p-sortIcon>
              </th>
              <!-- « Dernière activité », et non « dernière connexion » : le champ
                   est réécrit à CHAQUE appel authentifié de l'API, pas seulement
                   à l'ouverture de session. Il dit donc quand le compte s'est
                   servi du produit pour la dernière fois — ce qu'on cherche
                   vraiment en triant cette colonne. -->
              <th pSortableColumn="lastLogin" class="text-center" style="background: var(--p-surface-50); white-space: nowrap">
                {{ 'ADMIN.COL_LAST_LOGIN' | translate }} <p-sortIcon field="lastLogin"></p-sortIcon>
              </th>
              <th style="background: var(--p-surface-50); width: 1px"></th>
            </tr>
          </ng-template>
          <ng-template pTemplate="body" let-user>
            <tr>
              <td class="text-sm font-semibold text-900">
                {{ (user.firstName || user.lastName) ? (user.firstName + ' ' + user.lastName) : '—' }}
                <!-- Le badge porte le mot, pas seulement une teinte : « ce
                     compte ne compte pas » ne se devine pas d'une couleur. -->
                <span *ngIf="user.isInternal" class="nm-badge-interne"
                      pTooltip="Écarté de toutes les statistiques" tooltipPosition="top">interne</span>
              </td>
              <td class="text-xs text-500" style="font-family: monospace">
                {{ user.email || user.keycloakId }}
              </td>
              <td class="text-center">
                <span class="font-bold" [style.color]="user.totalCredits > 0 ? '#16a34a' : '#ef4444'">{{ user.totalCredits }}</span>
                <span class="text-400 text-xs" style="margin-left: 0.25rem">({{ user.credits }}+{{ user.extraCredits }})</span>
              </td>
              <td class="text-center text-sm">{{ user.projectCount }}</td>
              <td class="text-center text-sm" [class.text-400]="!user.brandReportCount">{{ user.brandReportCount }}</td>
              <td class="text-center text-sm" style="white-space: nowrap">
                <button *ngIf="user.aiCostUsd !== null || user.aiUnpricedCalls; else sansAppel" type="button" class="nm-cout"
                        [pTooltip]="infoCout(user)" tooltipPosition="top" (click)="ouvrirCouts(user)">
                  {{ usd(user.aiCostUsd) }}
                  <span *ngIf="coutParCredit(user) !== null" class="nm-cout-credit">{{ usd(coutParCredit(user)) }}/cr.</span>
                </button>
                <ng-template #sansAppel><span class="text-400">—</span></ng-template>
              </td>
              <td class="text-center text-xs text-500">{{ user.createdAt | date:'dd/MM/yy' }}</td>
              <td class="text-center text-xs text-500">{{ user.lastLogin ? (user.lastLogin | date:'dd/MM/yy') : '—' }}</td>
              <td style="white-space: nowrap; padding: 0.25rem 0.5rem">
                <ng-container *ngIf="editingUserId() === user.id; else showEditBtn">
                  <div style="display: flex; gap: 0.375rem; align-items: center; flex-wrap: wrap">
                    <div style="display: flex; flex-direction: column; gap: 0.15rem">
                      <span style="font-size: 0.68rem; color: var(--p-surface-400); text-transform: uppercase; letter-spacing: 0.04em">{{ 'ADMIN.EXTRA_CREDITS' | translate }}</span>
                      <p-inputNumber [(ngModel)]="adjustNewValue" [showButtons]="false" [min]="0"
                                     [style]="{'width': '6rem'}" inputStyleClass="text-center p-1 text-sm">
                      </p-inputNumber>
                    </div>
                    <p-button icon="pi pi-check" size="small" severity="success"
                              [loading]="savingUserId() === user.id"
                              (onClick)="saveAdjustment(user)">
                    </p-button>
                    <p-button icon="pi pi-times" size="small" severity="secondary"
                              (onClick)="cancelEdit()">
                    </p-button>
                  </div>
                </ng-container>
                <ng-template #showEditBtn>
                  <p-button icon="pi pi-wallet" size="small" [text]="true" severity="secondary"
                            [pTooltip]="'ADMIN.ADJUST_CREDITS' | translate" tooltipPosition="top"
                            (onClick)="startEdit(user)">
                  </p-button>
                  <p-button [icon]="user.isInternal ? 'pi pi-flag-fill' : 'pi pi-flag'"
                            size="small" [text]="true"
                            [severity]="user.isInternal ? 'warn' : 'secondary'"
                            [loading]="marquageUserId() === user.id"
                            [pTooltip]="user.isInternal
                              ? 'Compte interne — le remettre dans les statistiques'
                              : 'Marquer comme compte interne (exclu des statistiques)'"
                            tooltipPosition="top"
                            (onClick)="basculerInterne(user)">
                  </p-button>
                  <p-button icon="pi pi-trash" size="small" [text]="true" severity="danger"
                            [loading]="deletingUserId() === user.id"
                            [disabled]="user.keycloakId === currentKeycloakId()"
                            pTooltip="Supprimer l'utilisateur" tooltipPosition="top"
                            (onClick)="confirmDeleteUser(user)">
                  </p-button>
                </ng-template>
              </td>
            </tr>
          </ng-template>
          <ng-template pTemplate="emptymessage">
            <tr><td colspan="9" class="text-center text-500 py-4">{{ 'ADMIN.NO_USERS' | translate }}</td></tr>
          </ng-template>
        </p-table>

        <div *ngIf="total() > pageSize" style="display: flex; justify-content: space-between; align-items: center; padding: 0.625rem 1rem; border-top: 1px solid var(--p-surface-200)">
          <span class="text-500 text-sm">{{ total() }} {{ 'ADMIN.USERS_TOTAL' | translate }}</span>
          <div style="display: flex; gap: 0.375rem">
            <p-button icon="pi pi-chevron-left" size="small" severity="secondary" [text]="true"
                      [disabled]="page() === 1" (onClick)="changePage(page() - 1)">
            </p-button>
            <span class="text-sm" style="padding: 0.25rem 0.5rem">{{ page() }} / {{ totalPages() }}</span>
            <p-button icon="pi pi-chevron-right" size="small" severity="secondary" [text]="true"
                      [disabled]="page() === totalPages()" (onClick)="changePage(page() + 1)">
            </p-button>
          </div>
        </div>
      </div>
    </div>

    <!-- Détail des coûts du modèle d'un compte. Chargé à l'ouverture seulement :
         la liste ne porte que le total. -->
    <p-dialog [visible]="!!coutsDe()" (visibleChange)="!$event && fermerCouts()" [modal]="true"
              [header]="'Coût du modèle — ' + (coutsDe()?.email || coutsDe()?.keycloakId || '')"
              [style]="{ width: '46rem', maxWidth: '95vw' }" [dismissableMask]="true">
      <div *ngIf="chargementCouts()" style="padding: 1rem; text-align: center"><i class="pi pi-spin pi-spinner"></i></div>
      <div *ngIf="erreurCouts()" class="text-sm" style="color: var(--nm-verdict-taken-light-fg, #a33b3b)">
        Le détail n'a pas pu être chargé.
      </div>
      <ng-container *ngIf="detailCouts() as d">
        <div style="display: flex; flex-wrap: wrap; gap: 1.5rem; margin-bottom: 0.75rem">
          <div>
            <div class="nm-d-label">Total</div>
            <div class="nm-d-valeur">{{ usd(d.costUsd) }}</div>
          </div>
          <div>
            <div class="nm-d-label">Appels</div>
            <div class="nm-d-valeur">{{ d.calls.toLocaleString('fr-FR') }}</div>
          </div>
          <div *ngIf="coutsDe() as u">
            <div class="nm-d-label">Crédits consommés</div>
            <div class="nm-d-valeur">{{ u.creditsConsumed.toLocaleString('fr-FR') }}</div>
          </div>
          <div *ngIf="coutsDe() && coutParCredit(coutsDe()!) !== null">
            <div class="nm-d-label">Par crédit</div>
            <div class="nm-d-valeur">{{ usd(coutParCredit(coutsDe()!)) }}</div>
          </div>
        </div>

        <div *ngIf="d.unpricedCalls" class="text-xs" style="margin-bottom: 0.5rem; color: var(--nm-verdict-watch-light-fg, #9a6a12)">
          {{ d.unpricedCalls }} appel(s) sur un modèle sans tarif, absent(s) du total.
        </div>

        <table class="nm-d-table">
          <thead><tr><th style="text-align: left">Opération</th><th>Appels</th><th>Coût</th><th>Part</th></tr></thead>
          <tbody>
            <tr *ngFor="let o of operations()">
              <td style="text-align: left">{{ libelle(o.operation) }}
                <span *ngIf="o.items > o.calls" class="text-400 text-xs">— {{ o.items }} noms</span></td>
              <td>{{ o.calls }}</td>
              <td>{{ usd(o.costUsd) }}</td>
              <td>{{ d.costUsd > 0 && o.costUsd !== null ? (o.costUsd / d.costUsd * 100 | number:'1.0-0') + ' %' : '—' }}</td>
            </tr>
          </tbody>
        </table>
        <div class="text-xs text-500" style="margin: 0.4rem 0 0.9rem">
          Tokens : {{ tokens(totalTokens(d).entree) }} en entrée, {{ tokens(totalTokens(d).sortie) }} en sortie.
          Inclut les appels anonymes de l'étape 1 rattachés à ce compte par sa visite, et ce que ses crédits
          ont payé sur les projets qu'il partage.
        </div>

        <app-admin-weekly-chart
          title="Coût par semaine"
          unite="$"
          [points]="pointsCouts()"
          [note]="d.since ? 'Relevé depuis le ' + (d.since | date:'dd/MM/yyyy') + ' : les semaines antérieures sont hachurées.' : ''">
        </app-admin-weekly-chart>
      </ng-container>
    </p-dialog>
  `,
  styles: [`
    .nm-cout {
      background: none; border: none; cursor: pointer; padding: 0.1rem 0.25rem; border-radius: 4px;
      font: inherit; font-weight: 600; color: var(--nm-text-light, #0b0e10);
      display: inline-flex; flex-direction: column; align-items: center; line-height: 1.2;
    }
    .nm-cout:hover { background: var(--p-surface-100); }
    .nm-cout-credit { font-size: 0.64rem; font-weight: 400; color: var(--nm-text-light-3, #6a7470); }
    .nm-d-label { font-size: 0.66rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--nm-text-light-2, #5c6663); }
    .nm-d-valeur { font-size: 1.2rem; font-weight: 800; color: var(--nm-accent-text-light, #0d7a4e); }
    .nm-d-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; font-variant-numeric: tabular-nums; }
    .nm-d-table th { font-size: 0.66rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--nm-text-light-2, #5c6663); text-align: right; padding: 0.35rem 0.5rem; border-bottom: 1px solid var(--p-surface-200); }
    .nm-d-table td { text-align: right; padding: 0.35rem 0.5rem; border-bottom: 1px solid var(--p-surface-100); }
    .nm-badge-interne {
      display: inline-block; margin-left: 0.4rem;
      padding: 0.05rem 0.35rem; border-radius: 4px;
      font-size: 0.62rem; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.04em; vertical-align: middle;
      color: var(--nm-verdict-watch-light-fg, #9a6a12);
      background: var(--nm-verdict-watch-light-bg, #fdf3e3);
    }
  `],
})
export class AdminUsersComponent implements OnInit {
  users = signal<AdminUser[]>([]);
  loadingUsers = signal(false);
  total = signal(0);
  page = signal(1);
  pageSize = 20;
  searchText = '';
  private searchTimer: any;

  /**
   * Tri courant. Par défaut la date d'inscription, décroissante — l'ordre
   * historique de cette liste, conservé pour ne pas déplacer les repères de
   * qui l'utilise déjà.
   */
  readonly sortField = signal('createdAt');
  readonly sortOrder = signal(-1);

  editingUserId = signal<number | null>(null);
  savingUserId = signal<number | null>(null);
  deletingUserId = signal<number | null>(null);
  marquageUserId = signal<number | null>(null);
  currentKeycloakId = signal<string | null>(null);
  /** Compte dont le détail des coûts est ouvert. */
  coutsDe = signal<AdminUser | null>(null);
  detailCouts = signal<UserModelCosts | null>(null);
  chargementCouts = signal(false);
  erreurCouts = signal(false);

  readonly usd = usd;
  readonly tokens = tokens;
  readonly libelle = libelleOperation;

  adjustNewValue = 0;
  adjustReason = '';

  constructor(
    private adminService: AdminService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService,
    private keycloak: KeycloakService,
    private userService: UserService,
  ) {}

  ngOnInit() {
    this.keycloak.loadUserProfile().then(p => this.currentKeycloakId.set((p as any).id ?? null));
    this.loadUsers();
  }

  loadUsers() {
    this.loadingUsers.set(true);
    this.adminService
      .getUsers(
        this.page(),
        this.pageSize,
        this.searchText,
        this.sortField(),
        this.sortOrder() === 1 ? 'ASC' : 'DESC',
      )
      .subscribe({
      next: ({ data, total }) => {
        this.users.set(data);
        this.total.set(total);
        this.loadingUsers.set(false);
      },
      error: () => this.loadingUsers.set(false),
    });
  }

  /**
   * Clic sur un en-tête.
   *
   * `onLazyLoad` se déclenche AUSSI à l'initialisation de la table, avec le
   * tri qu'on vient de lui donner : sans la comparaison ci-dessous, chaque
   * ouverture de l'écran lancerait deux fois la même requête. Le retour à la
   * première page est volontaire — trier puis rester page 3 montre le milieu
   * d'un classement qu'on vient tout juste de demander.
   */
  onSort(e: { sortField?: string | string[] | null; sortOrder?: number | null }): void {
    const champ = (Array.isArray(e.sortField) ? e.sortField[0] : e.sortField) || 'createdAt';
    const sens = e.sortOrder ?? -1;
    if (champ === this.sortField() && sens === this.sortOrder()) return;
    this.sortField.set(champ);
    this.sortOrder.set(sens);
    this.page.set(1);
    this.loadUsers();
  }

  // ─── Coût du modèle ───────────────────────────────────────────────────────

  /**
   * Coût par crédit consommé : ce qu'un crédit de ce compte a coûté en IA.
   * Sans crédit consommé, pas de ratio — un compte qui n'a fait que l'étape 1
   * coûte quelque chose sans rien avoir consommé.
   */
  coutParCredit(u: AdminUser): number | null {
    return u.aiCostUsd === null || u.creditsConsumed <= 0 ? null : u.aiCostUsd / u.creditsConsumed;
  }

  infoCout(u: AdminUser): string {
    const base = `${u.creditsConsumed} crédit${u.creditsConsumed > 1 ? 's' : ''} consommé${u.creditsConsumed > 1 ? 's' : ''}`;
    const sansTarif = u.aiUnpricedCalls ? ` — ${u.aiUnpricedCalls} appel(s) sans tarif non comptés` : '';
    return `${base}${sansTarif}. Cliquer pour le détail.`;
  }

  ouvrirCouts(u: AdminUser) {
    this.coutsDe.set(u);
    this.detailCouts.set(null);
    this.erreurCouts.set(false);
    this.chargementCouts.set(true);
    this.adminService.getUserModelCosts(u.id).subscribe({
      next: (d) => { this.detailCouts.set(d); this.chargementCouts.set(false); },
      error: () => { this.erreurCouts.set(true); this.chargementCouts.set(false); },
    });
  }

  fermerCouts() {
    this.coutsDe.set(null);
    this.detailCouts.set(null);
  }

  operations() {
    return parOperation(this.detailCouts()?.byOperation ?? []);
  }

  totalTokens(d: UserModelCosts): { entree: number; sortie: number } {
    return d.byOperation.reduce(
      (t, l) => ({ entree: t.entree + l.inputTokens, sortie: t.sortie + l.outputTokens }),
      { entree: 0, sortie: 0 },
    );
  }

  pointsCouts(): ChartPoint[] {
    return (this.detailCouts()?.weeks ?? []).map((w) => ({
      week: w.week,
      value: w.costUsd === null ? null : Math.round(w.costUsd * 1000) / 1000,
    }));
  }

  totalPages() {
    return Math.max(1, Math.ceil(this.total() / this.pageSize));
  }

  onSearch() {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => { this.page.set(1); this.loadUsers(); }, 300);
  }

  changePage(p: number) {
    this.page.set(p);
    this.loadUsers();
  }

  startEdit(user: AdminUser) {
    this.editingUserId.set(user.id);
    this.adjustNewValue = user.extraCredits;
    this.adjustReason = '';
  }

  cancelEdit() {
    this.editingUserId.set(null);
  }

  confirmDeleteUser(user: AdminUser) {
    const label = user.email || user.keycloakId;
    this.confirmationService.confirm({
      message: `Supprimer définitivement l'utilisateur <strong>${label}</strong> ?<br>Ses projets seront également supprimés.`,
      header: 'Supprimer l\'utilisateur',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Supprimer',
      rejectLabel: 'Annuler',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.deleteUser(user),
    });
  }

  deleteUser(user: AdminUser) {
    this.deletingUserId.set(user.id);
    this.adminService.deleteUser(user.id).subscribe({
      next: () => {
        this.users.update(list => list.filter(u => u.id !== user.id));
        this.total.update(t => t - 1);
        this.deletingUserId.set(null);
        this.messageService.add({
          severity: 'success',
          summary: 'Utilisateur supprimé',
          detail: user.email || user.keycloakId,
        });
      },
      error: () => this.deletingUserId.set(null),
    });
  }

  /**
   * Bascule le drapeau « compte interne ».
   *
   * Pas de confirmation : le geste ne touche ni aux crédits, ni aux données du
   * compte, ni à son accès au produit — il ne change QUE ce que le tableau de
   * bord compte, et se défait d'un second clic. Le message rappelle en
   * revanche que les chiffres viennent de bouger, sans quoi l'écart constaté
   * à la prochaine ouverture passerait pour une variation d'usage.
   */
  basculerInterne(user: AdminUser) {
    const vise = !user.isInternal;
    this.marquageUserId.set(user.id);
    this.adminService.setInternal(user.id, vise).subscribe({
      next: (updated) => {
        this.users.update(list => list.map(u => u.id === updated.id ? updated : u));
        this.marquageUserId.set(null);
        this.messageService.add({
          severity: 'success',
          summary: vise ? 'Compte marqué comme interne' : 'Compte remis dans les statistiques',
          detail: `${updated.email || updated.keycloakId} — les indicateurs du tableau de bord changent en conséquence.`,
        });
      },
      error: () => this.marquageUserId.set(null),
    });
  }

  saveAdjustment(user: AdminUser) {
    const delta = this.adjustNewValue - user.extraCredits;
    this.savingUserId.set(user.id);
    this.adminService.adjustCredits(user.id, delta, this.adjustReason).subscribe({
      next: (updated) => {
        this.users.update(list => list.map(u => u.id === updated.id ? updated : u));
        this.savingUserId.set(null);
        this.editingUserId.set(null);
        // Si on vient d'ajuster ses propres crédits, rafraîchir le compteur global.
        if (updated.keycloakId === this.currentKeycloakId()) {
          this.userService.getCredits().subscribe();
        }
        this.messageService.add({
          severity: 'success',
          summary: 'Crédits mis à jour',
          detail: `${updated.email || updated.keycloakId} : ${updated.totalCredits} crédits (${delta >= 0 ? '+' : ''}${delta})`,
        });
      },
      error: () => this.savingUserId.set(null),
    });
  }
}
