import { Component, Input, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminRetention, TauxDeRetour, Tranche } from '../../services/admin.service';

/**
 * Sous ce nombre d'inscrits éligibles, pas de pourcentage : à 2 sur 3, un
 * compte de plus déplace le taux de 17 points. Même socle qu'ailleurs au
 * tableau de bord.
 */
const SOCLE = 5;

/**
 * Qui revient, et combien de temps on reste.
 *
 * « Revenir » = une activité un autre jour que l'inscription. Un taux à J+N ne
 * compte que les inscrits dont le J+N est passé : un compte d'hier n'a pas
 * « échoué à revenir », il n'en a pas encore eu le temps.
 */
@Component({
  selector: 'app-admin-retention',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div>
      <div style="display: flex; align-items: baseline; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.5rem">
        <span class="nm-titre">Fidélité</span>
        <span class="nm-sous-titre">
          tous les inscrits, indépendamment de la période choisie
          <ng-container *ngIf="donnees()?.journalDepuis as d"> — retours mesurés depuis le {{ dateCourte(d) }}</ng-container>
        </span>
      </div>

      <div *ngIf="erreur" class="nm-carte nm-muet">Les indicateurs de fidélité n'ont pas pu être chargés.</div>

      <ng-container *ngIf="!erreur && donnees() as r">
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(10.5rem, 1fr)); gap: 0.75rem">
          <div class="nm-carte nm-accent" *ngFor="let k of [{ label: 'Reviennent sous 7 jours', t: r.sous7Jours, n: 7 }, { label: 'Reviennent sous 30 jours', t: r.sous30Jours, n: 30 }]">
            <div class="nm-label">{{ k.label }}</div>
            <div class="nm-valeur" [class.nm-vide]="taux(k.t) === null">{{ taux(k.t) === null ? '—' : taux(k.t) + ' %' }}</div>
            <div class="nm-detail">{{ detailTaux(k.t, k.n, r.journalDepuis) }}</div>
          </div>

          <div class="nm-carte nm-accent">
            <div class="nm-label">Durée de vie médiane</div>
            <div class="nm-valeur" [class.nm-vide]="r.dureeDeVie.medianeMinutes === null">{{ duree(r.dureeDeVie.medianeMinutes) }}</div>
            <div class="nm-detail">de la création à la dernière activité, sur {{ r.dureeDeVie.comptes }} comptes</div>
          </div>

          <div class="nm-carte nm-accent">
            <div class="nm-label">Actifs un seul jour</div>
            <div class="nm-valeur" [class.nm-vide]="unSeulJour() === null">{{ unSeulJour() === null ? '—' : unSeulJour() + ' %' }}</div>
            <div class="nm-detail">{{ r.joursActifs[0].comptes }} sur {{ totalTranches(r.joursActifs) }} inscrits depuis le début du journal</div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(20rem, 1fr)); gap: 0.75rem; margin-top: 0.75rem">
          <div class="nm-carte" *ngFor="let bloc of [
              { titre: 'Jours d\\'activité par compte', tranches: r.joursActifs, note: 'Inscrits depuis le début du journal d\\'activité.' },
              { titre: 'Durée de vie', tranches: r.dureeDeVie.tranches, note: 'Tout l\\'historique : seule la dernière activité est connue, pas les intermédiaires.' }]">
            <div class="nm-label" style="margin-bottom: 0.6rem">{{ bloc.titre }}</div>
            <div *ngFor="let t of bloc.tranches" style="margin-bottom: 0.55rem">
              <div style="display: flex; justify-content: space-between; gap: 0.5rem; font-size: 0.78rem">
                <span>{{ t.libelle }}</span>
                <span class="nm-chiffre">{{ t.comptes }} <span class="nm-muet">· {{ part(t.comptes, totalTranches(bloc.tranches)) }}</span></span>
              </div>
              <div class="nm-piste"><div class="nm-barre" [style.width.%]="partBrute(t.comptes, totalTranches(bloc.tranches))"></div></div>
            </div>
            <div class="nm-detail">{{ bloc.note }}</div>
          </div>
        </div>

        <!-- Cohortes au mois, pas à la semaine : à quelques inscriptions par
             semaine, chaque case vaudrait 0, 20 ou 50 %. -->
        <div class="nm-carte" style="margin-top: 0.75rem; padding: 0; overflow-x: auto" *ngIf="r.cohortes.length">
          <table class="nm-table">
            <thead>
              <tr>
                <th style="text-align: left">Inscrits en</th>
                <th>Inscrits</th>
                <th>Revenus sous 7 j</th>
                <th>Revenus sous 30 j</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let c of r.cohortes">
                <td style="text-align: left">{{ moisLisible(c.mois) }}</td>
                <td>{{ c.inscrits }}</td>
                <td>{{ cellule(c.sous7Jours) }}</td>
                <td>{{ cellule(c.sous30Jours) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="nm-detail" style="margin-top: 0.5rem; max-width: 60rem">
          « Revenir » = une activité un autre jour que l'inscription — ouvrir l'application avec une session
          ouverte suffit. Un taux à J+N ne compte que les inscrits dont le J+N est passé ; sous {{ socle }} inscrits
          éligibles, il s'affiche en valeur brute. Comptes administrateurs et internes exclus.
        </div>
      </ng-container>
    </div>
  `,
  styles: [`
    .nm-titre { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: var(--nm-text-light-3, #6a7470); }
    .nm-sous-titre { font-size: 0.7rem; color: var(--nm-text-light-3, #6a7470); }
    .nm-carte { background: var(--nm-surface-light, #fff); border: 1px solid var(--nm-border-light, #e3e7e5); border-radius: 10px; padding: 0.875rem 1rem; }
    .nm-accent { border-color: var(--nm-accent-border-light, #c9e9d8); }
    .nm-muet { color: var(--nm-text-light-3, #6a7470); font-size: 0.72rem; }
    .nm-label { font-size: 0.72rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--nm-text-light-2, #5c6663); margin-bottom: 0.25rem; }
    .nm-valeur { font-size: 1.5rem; font-weight: 800; color: var(--nm-accent-text-light, #0d7a4e); line-height: 1.1; }
    .nm-vide { color: var(--nm-text-light-3, #6a7470); font-weight: 600; }
    .nm-detail { font-size: 0.68rem; color: var(--nm-text-light-3, #6a7470); margin-top: 0.3rem; line-height: 1.35; }
    .nm-chiffre { font-weight: 700; font-variant-numeric: tabular-nums; }
    .nm-piste { height: 0.45rem; border-radius: 999px; margin-top: 0.25rem; background: var(--nm-divider-light-1, #eef1f0); overflow: hidden; }
    .nm-barre { height: 100%; border-radius: 999px; background: var(--nm-accent-text-light, #0d7a4e); }
    .nm-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; font-variant-numeric: tabular-nums; }
    .nm-table th { font-size: 0.66rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--nm-text-light-2, #5c6663); text-align: right; padding: 0.55rem 0.6rem; border-bottom: 1px solid var(--nm-border-light, #e3e7e5); }
    .nm-table td { text-align: right; padding: 0.45rem 0.6rem; border-bottom: 1px solid var(--nm-divider-light-1, #eef1f0); }
  `],
})
export class AdminRetentionComponent {
  @Input({ required: true }) set retention(v: AdminRetention | null) { this.donnees.set(v); }
  @Input() erreur = false;

  readonly donnees = signal<AdminRetention | null>(null);
  readonly socle = SOCLE;

  taux(t: TauxDeRetour): number | null {
    return t.eligibles < SOCLE ? null : Math.round((t.revenus / t.eligibles) * 100);
  }

  /**
   * Ce que le taux compte, ou pourquoi il manque. Avant le premier J+N, il n'y
   * a pas « 0 % de retour » : il n'y a personne à qui poser la question.
   */
  detailTaux(t: TauxDeRetour, n: number, depuis: string | null): string {
    if (t.eligibles === 0) {
      if (!depuis) return 'journal d\'activité pas encore démarré';
      const premier = new Date(`${depuis}T00:00:00`);
      premier.setDate(premier.getDate() + n + 1);
      return `pas encore mesurable — premiers inscrits à J+${n} le ${premier.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`;
    }
    const brut = `${t.revenus} sur ${t.eligibles} inscrits de plus de ${n} jours`;
    return t.eligibles < SOCLE ? `${brut} — trop peu pour un taux` : brut;
  }

  cellule(t: TauxDeRetour): string {
    if (t.eligibles === 0) return '—';
    const pct = t.eligibles < SOCLE ? '' : ` (${Math.round((t.revenus / t.eligibles) * 100)} %)`;
    return `${t.revenus} / ${t.eligibles}${pct}`;
  }

  unSeulJour = computed(() => {
    const r = this.donnees();
    if (!r) return null;
    const total = this.totalTranches(r.joursActifs);
    return total < SOCLE ? null : Math.round((r.joursActifs[0].comptes / total) * 100);
  });

  totalTranches(t: Tranche[]): number {
    return t.reduce((s, x) => s + x.comptes, 0);
  }

  partBrute(n: number, total: number): number {
    return total > 0 ? (n / total) * 100 : 0;
  }

  part(n: number, total: number): string {
    return total > 0 ? `${Math.round((n / total) * 100)} %` : '—';
  }

  /** Minutes, heures ou jours, selon l'ordre de grandeur. */
  duree(minutes: number | null): string {
    if (minutes === null) return '—';
    if (minutes < 60) return `${minutes} min`;
    if (minutes < 24 * 60) return `${Math.round(minutes / 60)} h`;
    const j = Math.round((minutes / (24 * 60)) * 10) / 10;
    return `${j.toLocaleString('fr-FR')} jour${j >= 2 ? 's' : ''}`;
  }

  moisLisible(mois: string): string {
    return new Date(`${mois}-01T00:00:00`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  }

  dateCourte(jour: string): string {
    return new Date(`${jour}T00:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  }
}
