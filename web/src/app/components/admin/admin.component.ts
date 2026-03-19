import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { SelectButtonModule } from 'primeng/selectbutton';
import { DatePickerModule } from 'primeng/datepicker';
import { Tabs, TabList, Tab, TabPanels, TabPanel } from 'primeng/tabs';
import { Menu } from 'primeng/menu';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { MessageService, MenuItem, ConfirmationService } from 'primeng/api';
import { AdminService, AdminUser, AdminStats, FeedbackItem } from '../../services/admin.service';
import { KeycloakService } from 'keycloak-angular';

interface PeriodOption { label: string; days: number | null; }

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [
    CommonModule, FormsModule, TranslateModule,
    TableModule, ButtonModule, InputTextModule,
    InputNumberModule, ToastModule, TooltipModule,
    SelectButtonModule, DatePickerModule,
    Tabs, TabList, Tab, TabPanels, TabPanel,
    Menu, ConfirmDialog,
  ],
  providers: [MessageService, ConfirmationService],
  template: `
    <p-toast></p-toast>
    <p-confirmdialog></p-confirmdialog>

    <p-tabs value="dashboard">
      <p-tablist>
        <p-tab value="dashboard">
          <i class="pi pi-chart-bar" style="margin-right: 0.375rem"></i>Dashboard
        </p-tab>
        <p-tab value="users">
          <i class="pi pi-users" style="margin-right: 0.375rem"></i>Utilisateurs
        </p-tab>
        <p-tab value="feedback" (click)="loadFeedback()">
          <i class="pi pi-comment" style="margin-right: 0.375rem"></i>Feedbacks
          <span *ngIf="pendingFeedbackCount() > 0"
                style="margin-left: 0.375rem; background: var(--p-primary-color); color: white; border-radius: 999px; font-size: 0.7rem; font-weight: 700; padding: 0.1rem 0.45rem">
            {{ pendingFeedbackCount() }}
          </span>
        </p-tab>
      </p-tablist>

      <p-tabpanels>

        <!-- ─── Dashboard ──────────────────────────────────────── -->
        <p-tabpanel value="dashboard">
          <div style="display: flex; flex-direction: column; gap: 1.5rem; padding-top: 1rem">

            <!-- Sélecteur de période -->
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

            <ng-container *ngIf="stats() as s">
              <!-- Indicateurs de période -->
              <div>
                <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem">
                  <span style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: var(--p-surface-400)">Sur la période sélectionnée</span>
                  <i *ngIf="loadingStats()" class="pi pi-spin pi-spinner" style="font-size: 0.8rem; color: var(--p-surface-400)"></i>
                </div>
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr)); gap: 0.75rem">
                  <div *ngFor="let kpi of kpiPeriod(s)" class="border-1 border-round-lg" style="padding: 0.875rem 1rem; background: white; border-color: var(--p-primary-200, #bfdbfe)">
                    <div style="font-size: 0.72rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--p-surface-500); margin-bottom: 0.25rem">{{ kpi.label }}</div>
                    <div style="font-size: 1.5rem; font-weight: 800; color: var(--p-primary-color)">{{ kpi.value }}</div>
                  </div>
                </div>
              </div>

              <!-- Indicateurs globaux -->
              <div>
                <div style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: var(--p-surface-400); margin-bottom: 0.5rem">Total cumulé</div>
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr)); gap: 0.75rem">
                  <div *ngFor="let kpi of kpiAbsolute(s)" class="border-1 border-round-lg border-surface" style="padding: 0.875rem 1rem; background: white">
                    <div style="font-size: 0.72rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--p-surface-500); margin-bottom: 0.25rem">{{ kpi.label }}</div>
                    <div style="font-size: 1.5rem; font-weight: 800; color: var(--p-surface-900)">{{ kpi.value }}</div>
                  </div>
                </div>
              </div>
            </ng-container>

          </div>
        </p-tabpanel>

        <!-- ─── Utilisateurs ───────────────────────────────────── -->
        <p-tabpanel value="users">
          <div style="display: flex; flex-direction: column; gap: 1rem; padding-top: 1rem">

            <input pInputText [(ngModel)]="searchText" [placeholder]="'ADMIN.SEARCH_PLACEHOLDER' | translate"
                   (ngModelChange)="onSearch()" style="max-width: 24rem">

            <div class="border-1 border-solid border-round-lg shadow-1 overflow-x-auto" style="background: white">
              <p-table [value]="users()" [loading]="loadingUsers()" [tableStyle]="{'width': '100%'}"
                       styleClass="p-datatable-sm">
                <ng-template pTemplate="header">
                  <tr>
                    <th style="background: var(--p-surface-50)">{{ 'ADMIN.COL_NAME' | translate }}</th>
                    <th style="background: var(--p-surface-50)">{{ 'ADMIN.COL_EMAIL' | translate }}</th>
                    <th class="text-center" style="background: var(--p-surface-50); white-space: nowrap">{{ 'ADMIN.COL_CREDITS' | translate }}</th>
                    <th class="text-center" style="background: var(--p-surface-50); white-space: nowrap">{{ 'ADMIN.COL_PROJECTS' | translate }}</th>
                    <th class="text-center" style="background: var(--p-surface-50); white-space: nowrap">{{ 'ADMIN.COL_CREATED' | translate }}</th>
                    <th class="text-center" style="background: var(--p-surface-50); white-space: nowrap">{{ 'ADMIN.COL_LAST_LOGIN' | translate }}</th>
                    <th style="background: var(--p-surface-50); width: 1px"></th>
                  </tr>
                </ng-template>
                <ng-template pTemplate="body" let-user>
                  <tr>
                    <td class="text-sm font-semibold text-900">
                      {{ (user.firstName || user.lastName) ? (user.firstName + ' ' + user.lastName) : '—' }}
                    </td>
                    <td class="text-xs text-500" style="font-family: monospace">
                      {{ user.email || user.keycloakId }}
                    </td>
                    <td class="text-center">
                      <span class="font-bold" [style.color]="user.totalCredits > 0 ? '#16a34a' : '#ef4444'">{{ user.totalCredits }}</span>
                      <span class="text-400 text-xs" style="margin-left: 0.25rem">({{ user.credits }}+{{ user.extraCredits }})</span>
                    </td>
                    <td class="text-center text-sm">{{ user.projectCount }}</td>
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
                  <tr><td colspan="7" class="text-center text-500 py-4">{{ 'ADMIN.NO_USERS' | translate }}</td></tr>
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
        </p-tabpanel>

        <!-- ─── Feedbacks ──────────────────────────────────────── -->
        <p-tabpanel value="feedback">
          <div style="display: flex; flex-direction: column; gap: 1rem; padding-top: 1rem">

            <div style="display: flex; justify-content: flex-end">
              <p-button icon="pi pi-refresh" size="small" [text]="true" severity="secondary" label="Actualiser" (onClick)="loadFeedback()"></p-button>
            </div>

            <!-- Menu partagé pour les actions secondaires -->
            <p-menu #actionMenu [model]="activeMenuItems" [popup]="true" appendTo="body"></p-menu>

            <div class="border-1 border-solid border-round-lg shadow-1 overflow-x-auto" style="background: white">
              <p-table [value]="feedbackList()" [loading]="loadingFeedback()" [tableStyle]="{'width': '100%'}" styleClass="p-datatable-sm">
                <ng-template pTemplate="header">
                  <tr>
                    <th style="background: var(--p-surface-50); width: 9rem">Date</th>
                    <th style="background: var(--p-surface-50); width: 14rem">Email</th>
                    <th style="background: var(--p-surface-50)">Message</th>
                    <th style="background: var(--p-surface-50); width: 12rem; text-align: center">Action</th>
                  </tr>
                </ng-template>
                <ng-template pTemplate="body" let-fb>
                  <tr [style.opacity]="fb.rejected ? '0.45' : '1'">
                    <td class="text-xs text-500">{{ fb.createdAt | date:'dd/MM/yy HH:mm' }}</td>
                    <td class="text-xs" style="font-family: monospace; word-break: break-all">
                      {{ fb.email || '—' }}
                      <span *ngIf="!fb.keycloakId" style="display: block; font-size: 0.68rem; color: var(--p-surface-400); font-family: sans-serif">non connecté</span>
                    </td>
                    <td class="text-sm" style="white-space: pre-wrap; max-width: 30rem">{{ fb.message }}</td>
                    <td style="text-align: center; white-space: nowrap">
                      <div style="display: flex; gap: 0.375rem; justify-content: center; align-items: center">

                        <!-- Non traité avec compte → Approuver + menu ⋮ -->
                        <ng-container *ngIf="fb.keycloakId && !fb.creditAwarded && !fb.rejected">
                          <p-button label="Approuver" icon="pi pi-check" size="small" severity="success"
                            [loading]="awardingFeedbackId() === fb.id"
                            [disabled]="deletingFeedbackId() === fb.id"
                            (onClick)="awardCredits(fb)">
                          </p-button>
                          <p-button icon="pi pi-ellipsis-v" size="small" severity="secondary" [text]="true"
                            [disabled]="awardingFeedbackId() === fb.id || deletingFeedbackId() === fb.id"
                            (onClick)="openActionMenu($event, fb, actionMenu)">
                          </p-button>
                        </ng-container>

                        <!-- Non traité anonyme → menu ⋮ seulement -->
                        <ng-container *ngIf="!fb.keycloakId && !fb.creditAwarded && !fb.rejected">
                          <p-button icon="pi pi-ellipsis-v" size="small" severity="secondary" [text]="true"
                            [disabled]="rejectingFeedbackId() === fb.id || deletingFeedbackId() === fb.id"
                            (onClick)="openActionMenu($event, fb, actionMenu)">
                          </p-button>
                        </ng-container>

                        <!-- Approuvé -->
                        <span *ngIf="fb.creditAwarded" style="font-size: 0.78rem; font-weight: 600; color: #16a34a; margin-right: 0.25rem">
                          <i class="pi pi-check-circle"></i> Approuvé
                        </span>
                        <!-- Rejeté -->
                        <span *ngIf="fb.rejected && !fb.creditAwarded" style="font-size: 0.78rem; color: var(--p-surface-400); margin-right: 0.25rem">
                          <i class="pi pi-times-circle"></i> Rejeté
                        </span>
                        <!-- Supprimer (toujours dispo après traitement) -->
                        <p-button *ngIf="fb.creditAwarded || fb.rejected"
                          icon="pi pi-trash" size="small" severity="danger" [text]="true"
                          [loading]="deletingFeedbackId() === fb.id"
                          (onClick)="deleteFeedback(fb)">
                        </p-button>

                      </div>
                    </td>
                  </tr>
                </ng-template>
                <ng-template pTemplate="emptymessage">
                  <tr><td colspan="4" class="text-center text-500 py-4">Aucun feedback pour le moment.</td></tr>
                </ng-template>
              </p-table>
            </div>
          </div>
        </p-tabpanel>

      </p-tabpanels>
    </p-tabs>
  `,
})
export class AdminComponent implements OnInit {
  users = signal<AdminUser[]>([]);
  stats = signal<AdminStats | null>(null);
  loadingUsers = signal(false);
  loadingStats = signal(false);
  total = signal(0);
  page = signal(1);
  pageSize = 20;
  searchText = '';
  private searchTimer: any;

  editingUserId = signal<number | null>(null);
  savingUserId = signal<number | null>(null);
  deletingUserId = signal<number | null>(null);
  currentKeycloakId = signal<string | null>(null);
  adjustNewValue = 0;
  adjustReason = '';

  feedbackList = signal<FeedbackItem[]>([]);
  loadingFeedback = signal(false);
  awardingFeedbackId = signal<string | null>(null);
  rejectingFeedbackId = signal<string | null>(null);
  deletingFeedbackId = signal<string | null>(null);
  feedbackLoaded = false;

  pendingFeedbackCount = signal(0);

  periodOptions: PeriodOption[] = [
    { label: '24h', days: 1 },
    { label: '7j', days: 7 },
    { label: '30j', days: 30 },
    { label: 'Personnalisé', days: null },
  ];
  selectedPeriod: PeriodOption = this.periodOptions[1];
  customFrom: Date | null = null;
  customTo: Date | null = null;

  constructor(
    private adminService: AdminService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService,
    private keycloak: KeycloakService,
  ) {}

  ngOnInit() {
    this.keycloak.loadUserProfile().then(p => this.currentKeycloakId.set((p as any).id ?? null));
    this.loadUsers();
    this.loadStats();
    this.loadFeedback();
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
  }

  onPeriodChange() {
    if (this.selectedPeriod.days !== null) this.loadStats();
  }

  totalPages() {
    return Math.max(1, Math.ceil(this.total() / this.pageSize));
  }

  kpiPeriod(s: AdminStats): { label: string; value: number }[] {
    return [
      { label: 'Utilisateurs actifs', value: s.periodActiveUsers },
      { label: 'Nouveaux inscrits', value: s.periodNewUsers },
      { label: 'Nouveaux projets', value: s.periodNewProjects },
      { label: 'Suggestions générées', value: s.periodSuggestions },
    ];
  }

  kpiAbsolute(s: AdminStats): { label: string; value: number }[] {
    return [
      { label: 'Utilisateurs', value: s.totalUsers },
      { label: 'Projets', value: s.totalProjects },
      { label: 'Suggestions', value: s.totalSuggestions },
      { label: 'Moy. sugg./projet', value: s.avgSuggestionsPerProject },
      { label: 'Moy. favoris/projet', value: s.avgFavoritesPerProject },
      { label: 'Crédits gratuits', value: s.totalFreeCredits },
      { label: 'Crédits pack', value: s.totalPackCredits },
    ];
  }

  loadUsers() {
    this.loadingUsers.set(true);
    this.adminService.getUsers(this.page(), this.pageSize, this.searchText).subscribe({
      next: ({ data, total }) => {
        this.users.set(data);
        this.total.set(total);
        this.loadingUsers.set(false);
      },
      error: () => this.loadingUsers.set(false),
    });
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

  saveAdjustment(user: AdminUser) {
    const delta = this.adjustNewValue - user.extraCredits;
    this.savingUserId.set(user.id);
    this.adminService.adjustCredits(user.id, delta, this.adjustReason).subscribe({
      next: (updated) => {
        this.users.update(list => list.map(u => u.id === updated.id ? updated : u));
        this.savingUserId.set(null);
        this.editingUserId.set(null);
        this.messageService.add({
          severity: 'success',
          summary: 'Crédits mis à jour',
          detail: `${updated.email || updated.keycloakId} : ${updated.totalCredits} crédits (${delta >= 0 ? '+' : ''}${delta})`,
        });
      },
      error: () => this.savingUserId.set(null),
    });
  }

  loadFeedback() {
    this.loadingFeedback.set(true);
    this.adminService.getFeedback().subscribe({
      next: (list) => {
        this.feedbackList.set(list);
        this.pendingFeedbackCount.set(list.filter(f => !f.creditAwarded && !f.rejected).length);
        this.loadingFeedback.set(false);
      },
      error: () => this.loadingFeedback.set(false),
    });
  }

  awardCredits(fb: FeedbackItem) {
    this.awardingFeedbackId.set(fb.id);
    this.adminService.awardFeedbackCredits(fb.id).subscribe({
      next: (updated) => {
        this.updateFeedback(updated);
        this.awardingFeedbackId.set(null);
        this.messageService.add({
          severity: 'success',
          summary: 'Crédits attribués',
          detail: `500 crédits ajoutés pour ${updated.email || updated.keycloakId}`,
        });
      },
      error: () => this.awardingFeedbackId.set(null),
    });
  }

  rejectFeedback(fb: FeedbackItem) {
    this.rejectingFeedbackId.set(fb.id);
    this.adminService.rejectFeedback(fb.id).subscribe({
      next: (updated) => {
        this.updateFeedback(updated);
        this.rejectingFeedbackId.set(null);
        this.messageService.add({ severity: 'info', summary: 'Feedback rejeté', detail: '' });
      },
      error: () => this.rejectingFeedbackId.set(null),
    });
  }

  activeMenuItems: MenuItem[] = [];

  openActionMenu(event: Event, fb: FeedbackItem, menu: any) {
    this.activeMenuItems = [
      { label: 'Rejeter', icon: 'pi pi-times', command: () => this.rejectFeedback(fb) },
      { label: 'Supprimer', icon: 'pi pi-trash', command: () => this.deleteFeedback(fb) },
    ];
    menu.toggle(event);
  }

  deleteFeedback(fb: FeedbackItem) {
    this.deletingFeedbackId.set(fb.id);
    this.adminService.deleteFeedback(fb.id).subscribe({
      next: () => {
        this.feedbackList.update(list => list.filter(f => f.id !== fb.id));
        this.pendingFeedbackCount.set(this.feedbackList().filter(f => !f.creditAwarded && !f.rejected).length);
        this.deletingFeedbackId.set(null);
      },
      error: () => this.deletingFeedbackId.set(null),
    });
  }

  private updateFeedback(updated: FeedbackItem) {
    this.feedbackList.update(list => list.map(f => f.id === updated.id ? updated : f));
    this.pendingFeedbackCount.set(this.feedbackList().filter(f => !f.creditAwarded && !f.rejected).length);
  }
}
