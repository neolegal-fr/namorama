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
import { MessageService } from 'primeng/api';
import { AdminService, AdminUser, AdminStats } from '../../services/admin.service';

interface PeriodOption { label: string; days: number | null; }

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [
    CommonModule, FormsModule, TranslateModule,
    TableModule, ButtonModule, InputTextModule,
    InputNumberModule, ToastModule, TooltipModule,
    SelectButtonModule, DatePickerModule,
  ],
  providers: [MessageService],
  template: `
    <p-toast></p-toast>

    <div style="display: flex; flex-direction: column; gap: 1.5rem">

      <!-- Titre + sélecteur de période -->
      <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 0.75rem; justify-content: space-between">
        <h1 class="font-bold text-900" style="margin: 0; font-size: 1.5rem">
          {{ 'ADMIN.TITLE' | translate }}
        </h1>
        <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap">
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
      </div>

      <!-- KPI cards -->
      <ng-container *ngIf="stats() as s">
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr)); gap: 0.75rem">
          <div *ngFor="let kpi of kpiCards(s)" class="border-1 border-round-lg border-surface" style="padding: 0.875rem 1rem; background: white">
            <div style="font-size: 0.72rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--p-surface-500); margin-bottom: 0.25rem">{{ kpi.label }}</div>
            <div style="font-size: 1.5rem; font-weight: 800; color: var(--p-surface-900)">{{ kpi.value }}</div>
            <div *ngIf="kpi.sub" style="font-size: 0.72rem; color: var(--p-surface-400); margin-top: 0.15rem">{{ kpi.sub }}</div>
          </div>
        </div>
      </ng-container>

      <!-- Barre de recherche -->
      <div style="display: flex; gap: 0.5rem; align-items: center">
        <input pInputText [(ngModel)]="searchText" [placeholder]="'ADMIN.SEARCH_PLACEHOLDER' | translate"
               (ngModelChange)="onSearch()" style="flex: 1; max-width: 24rem">
      </div>

      <!-- Tableau utilisateurs -->
      <div class="border-1 border-solid border-round-lg shadow-1 overflow-x-auto" style="background: white">
        <p-table [value]="users()" [loading]="loadingUsers()" [tableStyle]="{'width': '100%'}"
                 styleClass="p-datatable-sm">
          <ng-template pTemplate="header">
            <tr>
              <th style="background: var(--p-surface-50)">{{ 'ADMIN.COL_USER' | translate }}</th>
              <th class="text-center" style="background: var(--p-surface-50); white-space: nowrap">{{ 'ADMIN.COL_CREDITS' | translate }}</th>
              <th class="text-center" style="background: var(--p-surface-50); white-space: nowrap">{{ 'ADMIN.COL_PROJECTS' | translate }}</th>
              <th class="text-center" style="background: var(--p-surface-50); white-space: nowrap">{{ 'ADMIN.COL_CREATED' | translate }}</th>
              <th class="text-center" style="background: var(--p-surface-50); white-space: nowrap">{{ 'ADMIN.COL_LAST_LOGIN' | translate }}</th>
              <th style="background: var(--p-surface-50); width: 1px"></th>
            </tr>
          </ng-template>
          <ng-template pTemplate="body" let-user>
            <tr>
              <td>
                <div *ngIf="user.firstName || user.lastName" class="font-semibold text-sm text-900">
                  {{ user.firstName }} {{ user.lastName }}
                </div>
                <div class="text-xs text-500" style="font-family: monospace">
                  {{ user.email || user.keycloakId }}
                </div>
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
                </ng-template>
              </td>
            </tr>
          </ng-template>
          <ng-template pTemplate="emptymessage">
            <tr><td colspan="6" class="text-center text-500 py-4">{{ 'ADMIN.NO_USERS' | translate }}</td></tr>
          </ng-template>
        </p-table>

        <!-- Pagination -->
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
  `,
})
export class AdminComponent implements OnInit {
  users = signal<AdminUser[]>([]);
  stats = signal<AdminStats | null>(null);
  loadingUsers = signal(false);
  total = signal(0);
  page = signal(1);
  pageSize = 20;
  searchText = '';
  private searchTimer: any;

  editingUserId = signal<number | null>(null);
  savingUserId = signal<number | null>(null);
  adjustNewValue = 0;
  adjustReason = '';

  periodOptions: PeriodOption[] = [
    { label: '24h', days: 1 },
    { label: '7j', days: 7 },
    { label: '30j', days: 30 },
    { label: 'Personnalisé', days: null },
  ];
  selectedPeriod: PeriodOption = this.periodOptions[1]; // 7j par défaut
  customFrom: Date | null = null;
  customTo: Date | null = null;

  constructor(private adminService: AdminService, private messageService: MessageService) {}

  ngOnInit() {
    this.loadUsers();
    this.loadStats();
  }

  private getPeriodDates(): { from?: Date; to?: Date } {
    if (this.selectedPeriod.days !== null) {
      const to = new Date();
      const from = new Date(to.getTime() - this.selectedPeriod.days * 24 * 60 * 60 * 1000);
      return { from, to };
    }
    return {
      from: this.customFrom ?? undefined,
      to: this.customTo ?? undefined,
    };
  }

  loadStats() {
    const { from, to } = this.getPeriodDates();
    this.adminService.getStats(from, to).subscribe(s => this.stats.set(s));
  }

  onPeriodChange() {
    if (this.selectedPeriod.days !== null) this.loadStats();
  }

  totalPages() {
    return Math.max(1, Math.ceil(this.total() / this.pageSize));
  }

  kpiCards(s: AdminStats) {
    const periodLabel = this.selectedPeriod.days !== null
      ? this.selectedPeriod.label
      : 'période';
    return [
      { label: 'Utilisateurs', value: s.totalUsers },
      { label: `Actifs (${periodLabel})`, value: s.periodActiveUsers, sub: `${s.periodNewUsers} nouveaux` },
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
    this.adjustNewValue = user.extraCredits; // pré-remplir avec la valeur actuelle
    this.adjustReason = '';
  }

  cancelEdit() {
    this.editingUserId.set(null);
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
}
