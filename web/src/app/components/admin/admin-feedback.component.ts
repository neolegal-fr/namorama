import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { Menu } from 'primeng/menu';
import { MessageService, MenuItem } from 'primeng/api';
import { AdminService, FeedbackItem } from '../../services/admin.service';

@Component({
  selector: 'app-admin-feedback',
  standalone: true,
  imports: [CommonModule, TranslateModule, TableModule, ButtonModule, ToastModule, Menu],
  providers: [MessageService],
  template: `
    <p-toast></p-toast>

    <div style="display: flex; flex-direction: column; gap: 1rem; padding-top: 1rem">

      <div style="display: flex; justify-content: flex-end">
        <p-button icon="pi pi-refresh" size="small" [text]="true" severity="secondary" label="Actualiser" (onClick)="loadFeedback()"></p-button>
      </div>

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
  `,
})
export class AdminFeedbackComponent implements OnInit {
  feedbackList = signal<FeedbackItem[]>([]);
  loadingFeedback = signal(false);
  awardingFeedbackId = signal<string | null>(null);
  rejectingFeedbackId = signal<string | null>(null);
  deletingFeedbackId = signal<string | null>(null);

  activeMenuItems: MenuItem[] = [];

  constructor(
    private adminService: AdminService,
    private messageService: MessageService,
  ) {}

  ngOnInit() {
    this.loadFeedback();
  }

  loadFeedback() {
    this.loadingFeedback.set(true);
    this.adminService.getFeedback().subscribe({
      next: (list) => {
        this.feedbackList.set(list);
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
        this.deletingFeedbackId.set(null);
      },
      error: () => this.deletingFeedbackId.set(null),
    });
  }

  private updateFeedback(updated: FeedbackItem) {
    this.feedbackList.update(list => list.map(f => f.id === updated.id ? updated : f));
  }
}
