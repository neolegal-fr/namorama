import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminModelCosts, AdminService, PeriodeAdmin } from '../../services/admin.service';
import { AdminModelCostsComponent } from './admin-model-costs.component';
import { AdminPeriodeComponent } from './admin-periode.component';
import { bornesExplicites, bornesPeriode } from './periode-admin';

/** Semaines de la courbe par opération : six mois, comme avant la refonte. */
const SEMAINES = 26;

/**
 * Administration → Coûts IA : le relevé par opération et le simulateur.
 *
 * Sorti du tableau de bord le 31/10/2026 : c'est un outil de réglage des
 * modèles, pas un indicateur de pilotage. Le tableau de bord n'en garde que le
 * total et ses ratios ; la période se partage par l'URL, de sorte que le lien
 * « Détail des coûts » arrive sur la même fenêtre.
 */
@Component({
  selector: 'app-admin-costs',
  standalone: true,
  imports: [CommonModule, AdminModelCostsComponent, AdminPeriodeComponent],
  template: `
    <div style="display: flex; flex-direction: column; gap: 1.25rem; padding-top: 1rem">
      <app-admin-periode (periode)="charger($event)"></app-admin-periode>
      <div [style.opacity]="chargement() ? 0.55 : 1" style="transition: opacity 0.15s">
        <app-admin-model-costs [donnees]="couts()" [erreur]="erreur()" [creditsConsommes]="credits()">
        </app-admin-model-costs>
      </div>
    </div>
  `,
})
export class AdminCostsComponent {
  private admin = inject(AdminService);

  couts = signal<AdminModelCosts | null>(null);
  credits = signal<number | null>(null);
  erreur = signal(false);
  chargement = signal(false);

  charger(p: PeriodeAdmin): void {
    const { from, to } = bornesExplicites(p);
    this.chargement.set(true);
    this.admin.getModelCosts(from, to, SEMAINES).subscribe({
      next: (c) => { this.couts.set(c); this.erreur.set(false); this.chargement.set(false); },
      error: () => { this.erreur.set(true); this.chargement.set(false); },
    });
    // Le coût par crédit consommé a besoin des crédits de la MÊME période.
    const b = bornesPeriode(p);
    this.admin.getStats(b.from, b.to, b.month).subscribe({
      next: (s) => this.credits.set(s.period.creditsConsumed),
      error: () => this.credits.set(null),
    });
  }
}
