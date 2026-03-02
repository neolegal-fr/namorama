import { Routes } from '@angular/router';
import { WizardComponent } from './components/wizard/wizard';
import { PaymentResultComponent } from './components/payment-result/payment-result';
import { AdminComponent } from './components/admin/admin.component';
import { adminGuard } from './guards/admin.guard';

export const routes: Routes = [
  { path: '', component: WizardComponent },
  { path: 'projects/:id', component: WizardComponent },
  { path: 'payment/success', component: PaymentResultComponent },
  { path: 'payment/cancel', component: PaymentResultComponent },
  { path: 'admin', component: AdminComponent, canActivate: [adminGuard] },
  { path: '**', redirectTo: '' }
];
