import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { SelectButtonModule } from 'primeng/selectbutton';
import { DatePickerModule } from 'primeng/datepicker';
import { AdminService, AdminStats } from '../../services/admin.service';

interface PeriodOption { label: string; days: number | null; }

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, ButtonModule, SelectButtonModule, DatePickerModule],
  template: `
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

      <!-- Skeleton chargement initial -->
      <ng-container *ngIf="loadingStats() && !stats()">
        <div>
          <div style="height: 0.65rem; width: 12rem; background: var(--p-surface-200); border-radius: 4px; margin-bottom: 0.75rem; animation: pulse 1.5s ease-in-out infinite"></div>
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr)); gap: 0.75rem">
            <div *ngFor="let i of [1,2,3,4]" class="border-1 border-round-lg border-surface" style="padding: 0.875rem 1rem; background: white">
              <div style="height: 0.55rem; width: 5rem; background: var(--p-surface-200); border-radius: 4px; margin-bottom: 0.6rem; animation: pulse 1.5s ease-in-out infinite"></div>
              <div style="height: 1.5rem; width: 3rem; background: var(--p-surface-200); border-radius: 4px; animation: pulse 1.5s ease-in-out infinite"></div>
            </div>
          </div>
        </div>
        <div>
          <div style="height: 0.65rem; width: 8rem; background: var(--p-surface-200); border-radius: 4px; margin-bottom: 0.75rem; animation: pulse 1.5s ease-in-out infinite"></div>
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr)); gap: 0.75rem">
            <div *ngFor="let i of [1,2,3,4,5]" class="border-1 border-round-lg border-surface" style="padding: 0.875rem 1rem; background: white">
              <div style="height: 0.55rem; width: 5rem; background: var(--p-surface-200); border-radius: 4px; margin-bottom: 0.6rem; animation: pulse 1.5s ease-in-out infinite"></div>
              <div style="height: 1.5rem; width: 3rem; background: var(--p-surface-200); border-radius: 4px; animation: pulse 1.5s ease-in-out infinite"></div>
            </div>
          </div>
        </div>
      </ng-container>

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
  `,
})
export class AdminDashboardComponent implements OnInit {
  stats = signal<AdminStats | null>(null);
  loadingStats = signal(false);

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
}
