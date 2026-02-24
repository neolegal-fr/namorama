import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { UserService } from '../../services/user';
import { PaymentService } from '../../services/payment';

@Component({
  selector: 'app-payment-result',
  standalone: true,
  imports: [CommonModule, TranslateModule, ButtonModule],
  template: `
    <div style="display: flex; flex-direction: column; align-items: center; text-align: center; gap: 1.5rem; padding: 4rem 1rem">
      <ng-container *ngIf="isSuccess()">
        <i class="pi pi-check-circle" style="font-size: 4rem; color: #16a34a"></i>
        <h1 class="font-bold text-900" style="font-size: 1.75rem; margin: 0">
          {{ 'PAYMENT.SUCCESS_TITLE' | translate }}
        </h1>
        <p class="text-500" style="margin: 0; font-size: 1rem; max-width: 28rem">
          {{ 'PAYMENT.SUCCESS_MESSAGE' | translate }}
        </p>
        <p *ngIf="creditsAdded() > 0" class="font-semibold" style="margin: 0; font-size: 1.1rem; color: #16a34a">
          {{ 'PAYMENT.CREDITS_ADDED' | translate: { count: creditsAdded(), total: totalCredits() } }}
        </p>
      </ng-container>

      <ng-container *ngIf="!isSuccess()">
        <i class="pi pi-times-circle" style="font-size: 4rem; color: #ef4444"></i>
        <h1 class="font-bold text-900" style="font-size: 1.75rem; margin: 0">
          {{ 'PAYMENT.CANCEL_TITLE' | translate }}
        </h1>
        <p class="text-500" style="margin: 0; font-size: 1rem; max-width: 28rem">
          {{ 'PAYMENT.CANCEL_MESSAGE' | translate }}
        </p>
      </ng-container>

      <p-button
        [label]="'PAYMENT.BACK_HOME' | translate"
        icon="pi pi-arrow-left"
        (onClick)="goHome()">
      </p-button>
    </div>
  `
})
export class PaymentResultComponent implements OnInit {
  isSuccess = signal(false);
  creditsAdded = signal(0);
  totalCredits = signal(0);

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private userService: UserService,
    private paymentService: PaymentService,
  ) {}

  ngOnInit() {
    const isSuccessRoute = this.router.url.startsWith('/payment/success');
    this.isSuccess.set(isSuccessRoute);

    if (isSuccessRoute) {
      const sessionId = this.route.snapshot.queryParamMap.get('session_id');
      if (sessionId) {
        this.paymentService.fulfillSession(sessionId).subscribe({
          next: (result) => {
            this.creditsAdded.set(result.creditsAdded);
            this.totalCredits.set(result.totalCredits);
            this.userService.getCredits().subscribe();
          },
          error: () => {
            // Fallback : rafraîchir quand même les crédits
            this.userService.getCredits().subscribe();
          },
        });
      } else {
        this.userService.getCredits().subscribe();
      }
    }
  }

  goHome() {
    this.router.navigate(['/']);
  }
}
