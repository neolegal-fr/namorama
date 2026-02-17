import { Routes } from '@angular/router';
import { WizardComponent } from './components/wizard/wizard';

export const routes: Routes = [
  { path: '', component: WizardComponent },
  { path: 'projects/:id', component: WizardComponent },
  { path: '**', redirectTo: '' }
];
