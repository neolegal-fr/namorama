import { Component, DestroyRef, EventEmitter, OnInit, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SelectButtonModule } from 'primeng/selectbutton';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { ButtonModule } from 'primeng/button';
import { PeriodeAdmin } from '../../services/admin.service';
import { ecrirePeriode, jourISO, lirePeriode, moisProposes } from './periode-admin';

type Choix = '7j' | '30j' | 'mois' | 'plage';

/**
 * Sélecteur de période partagé par le tableau de bord et l'onglet Coûts IA.
 *
 * La période vit dans l'URL : ce composant l'y écrit au changement, et émet
 * `periode` à chaque fois que l'URL change — y compris à l'ouverture. Pas de
 * fenêtre de 24 h : à 2 comptes actifs par jour (relevé du 31/10/2026), elle
 * ne mesurait que du bruit.
 */
@Component({
  selector: 'app-admin-periode',
  standalone: true,
  imports: [CommonModule, FormsModule, SelectButtonModule, SelectModule, DatePickerModule, ButtonModule],
  template: `
    <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 0.5rem; justify-content: flex-end">
      <p-selectButton [options]="choixPossibles" [ngModel]="choix()" (ngModelChange)="choisir($event)"
                      optionLabel="label" optionValue="value" [allowEmpty]="false" styleClass="text-sm">
      </p-selectButton>

      <p-select *ngIf="choix() === 'mois'" [options]="mois" optionLabel="libelle" optionValue="valeur"
                [ngModel]="moisChoisi()" (ngModelChange)="choisirMois($event)"
                styleClass="text-sm" [style]="{ minWidth: '11rem' }" ariaLabel="Mois">
      </p-select>

      <ng-container *ngIf="choix() === 'plage'">
        <p-datepicker [(ngModel)]="du" [showIcon]="false" dateFormat="dd/mm/yy" placeholder="Du"
                      inputStyleClass="text-sm" [maxDate]="aujourdhui" style="width: 8rem"></p-datepicker>
        <span style="font-size: 0.8rem; color: var(--nm-text-light-3, #6a7470)">→</span>
        <p-datepicker [(ngModel)]="au" [showIcon]="false" dateFormat="dd/mm/yy" placeholder="Au"
                      inputStyleClass="text-sm" [maxDate]="aujourdhui" style="width: 8rem"></p-datepicker>
        <p-button label="Appliquer" size="small" icon="pi pi-search" [disabled]="!du || !au || du > au"
                  (onClick)="appliquerPlage()"></p-button>
      </ng-container>
    </div>
  `,
})
export class AdminPeriodeComponent implements OnInit {
  @Output() periode = new EventEmitter<PeriodeAdmin>();

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  readonly choixPossibles: { label: string; value: Choix }[] = [
    { label: '7 jours', value: '7j' },
    { label: '30 jours', value: '30j' },
    { label: 'Mois', value: 'mois' },
    { label: 'Personnalisé', value: 'plage' },
  ];
  readonly mois = moisProposes();
  readonly aujourdhui = new Date();

  choix = signal<Choix>('30j');
  moisChoisi = signal<string>(this.mois[0].valeur);
  du: Date | null = null;
  au: Date | null = null;

  ngOnInit(): void {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((q) => {
      const p = lirePeriode(q);
      this.refleter(p);
      this.periode.emit(p);
    });
  }

  choisir(c: Choix): void {
    this.choix.set(c);
    if (c === '7j') this.naviguer({ type: 'glissante', jours: 7 });
    else if (c === '30j') this.naviguer({ type: 'glissante', jours: 30 });
    else if (c === 'mois') this.naviguer({ type: 'mois', mois: this.moisChoisi() });
    // « Personnalisé » attend « Appliquer » : une plage à moitié saisie n'a pas de sens.
  }

  choisirMois(m: string): void {
    this.moisChoisi.set(m);
    this.naviguer({ type: 'mois', mois: m });
  }

  appliquerPlage(): void {
    if (!this.du || !this.au) return;
    this.naviguer({ type: 'plage', du: jourISO(this.du), au: jourISO(this.au) });
  }

  private naviguer(p: PeriodeAdmin): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: ecrirePeriode(p), queryParamsHandling: 'merge' });
  }

  private refleter(p: PeriodeAdmin): void {
    if (p.type === 'glissante') this.choix.set(p.jours === 7 ? '7j' : '30j');
    else if (p.type === 'mois') { this.choix.set('mois'); this.moisChoisi.set(p.mois); }
    else {
      this.choix.set('plage');
      this.du = new Date(`${p.du}T00:00:00`);
      this.au = new Date(`${p.au}T00:00:00`);
    }
  }
}
