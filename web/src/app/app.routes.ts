import { Routes } from '@angular/router';
import { WizardComponent } from './components/wizard/wizard';
import { PaymentResultComponent } from './components/payment-result/payment-result';
import { AdminComponent } from './components/admin/admin.component';
import { AdminDashboardComponent } from './components/admin/admin-dashboard.component';
import { AdminUsersComponent } from './components/admin/admin-users.component';
import { AdminFeedbackComponent } from './components/admin/admin-feedback.component';
import { LegalComponent } from './components/legal/legal.component';
import { PrivacyComponent } from './components/privacy/privacy.component';
import { adminGuard } from './guards/admin.guard';

export const routes: Routes = [
  { path: '', component: WizardComponent },
  { path: 'projects/:id', component: WizardComponent },
  { path: 'payment/success', component: PaymentResultComponent },
  { path: 'payment/cancel', component: PaymentResultComponent },
  {
    path: 'admin',
    component: AdminComponent,
    canActivate: [adminGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: AdminDashboardComponent },
      { path: 'users', component: AdminUsersComponent },
      { path: 'feedback', component: AdminFeedbackComponent },
    ],
  },
  { path: 'legal', component: LegalComponent },
  { path: 'privacy', component: PrivacyComponent },
  { path: '**', redirectTo: '' }
];
