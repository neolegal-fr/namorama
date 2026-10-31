import { Component, Input, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminRetention, CaseCohorte, MoisActif, TauxDeRetour } from '../../services/admin.service';

/**
 * Sous ce nombre d'inscrits éligibles, pas de pourcentage : à 2 sur 3, un
 * compte de plus déplace le taux de 17 points. Même socle qu'ailleurs au
 * tableau de bord.
 */
const SOCLE = 5;

/** Mois suivis après l'inscription, colonnes du triangle. */
const HORIZON = [1, 2, 3, 4, 5];

/**
 * Qui revient : décomposition mensuelle des actifs, triangle de cohortes, et
 * retours sous 7 et 30 jours.
 *
 * Remplace, le 31/10/2026, quatre vues de la même question (durée de vie
 * médiane, actifs un seul jour, deux répartitions) : relevé ce jour-là, 52
 * actifs sur 30 jours dont 51 inscrits dans la fenêtre — c'est la part de
 * retenus qu'il fallait voir d'un coup d'œil, pas la forme d'une distribution.
 */
@Component({
  selector: 'app-admin-retention',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section>
      <div style="display: flex; align-items: baseline; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.5rem">
        <span class="nm-titre">Rétention</span>
        <span class="nm-sous-titre">
          au mois civil, indépendamment de la période choisie
          <ng-container *ngIf="donnees()?.journalDepuis as d"> — mesurée depuis le {{ dateCourte(d) }}</ng-container>
        </span>
      </div>

      <div *ngIf="erreur" class="nm-carte nm-muet">Les indicateurs de rétention n'ont pas pu être chargés.</div>

      <ng-container *ngIf="!erreur && donnees() as r">
        <div class="nm-grille">
          <div class="nm-carte nm-accent" *ngFor="let k of [{ label: 'Reviennent sous 7 jours', t: r.sous7Jours, n: 7 }, { label: 'Reviennent sous 30 jours', t: r.sous30Jours, n: 30 }]">
            <div class="nm-label">{{ k.label }}</div>
            <div class="nm-valeur" [class.nm-vide]="taux(k.t) === null">{{ taux(k.t) === null ? '—' : taux(k.t) + ' %' }}</div>
            <div class="nm-detail">{{ detailTaux(k.t, k.n, r.journalDepuis) }}</div>
          </div>

          <div class="nm-carte nm-accent" *ngIf="dernierMoisClos() as m">
            <div class="nm-label">Retenus en {{ moisCourt(m.mois) }}</div>
            <div class="nm-valeur" [class.nm-vide]="m.retenus === null">{{ m.retenus ?? '—' }}</div>
            <div class="nm-detail" *ngIf="m.retenus !== null">
              sur {{ m.actifs }} actifs — {{ m.nouveaux }} nouveaux, {{ m.reactives }} réactivés, {{ m.perdus }} perdus
            </div>
            <div class="nm-detail" *ngIf="m.retenus === null">premier mois du journal : rien à comparer</div>
          </div>
        </div>

        <!-- ─── Actifs par mois, décomposés ─────────────────────────────── -->
        <div class="nm-carte" style="margin-top: 0.75rem" *ngIf="r.mensuel.length">
          <div style="display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem">
            <div>
              <div class="nm-label">Actifs par mois</div>
              <div class="nm-detail" style="margin-top: 0">qui sont les actifs de chaque mois : nouveaux, revenus après une absence, ou restés</div>
            </div>
            <!-- La couleur ne suffit pas : chaque série est nommée, et le
                 tableau dessous donne les valeurs. -->
            <div class="nm-legende">
              <span><i class="nm-pastille nm-s-nouveaux"></i>nouveaux</span>
              <span><i class="nm-pastille nm-s-reactives"></i>réactivés</span>
              <span><i class="nm-pastille nm-s-retenus"></i>retenus</span>
            </div>
          </div>

          <div class="nm-pile-plot">
            <div class="nm-pile-col" *ngFor="let m of r.mensuel" [class.nm-encours]="m.enCours"
                 [title]="titrePile(m)">
              <div class="nm-pile" [style.height.%]="hauteur(m.actifs)">
                <div class="nm-s-retenus" [style.flex-grow]="m.retenus ?? 0"></div>
                <div class="nm-s-reactives" [style.flex-grow]="m.reactives ?? 0"></div>
                <div class="nm-s-nouveaux" [style.flex-grow]="m.nouveaux"></div>
              </div>
            </div>
          </div>
          <div class="nm-axe">
            <div *ngFor="let m of r.mensuel">{{ moisCourt(m.mois) }}</div>
          </div>

          <details class="nm-details">
            <summary>Voir les valeurs</summary>
            <div style="overflow-x: auto">
              <table class="nm-table">
                <thead>
                  <tr><th style="text-align: left">Mois</th><th>Actifs</th><th>Nouveaux</th><th>Retenus</th><th>Réactivés</th><th>Perdus</th></tr>
                </thead>
                <tbody>
                  <tr *ngFor="let m of mensuelRecent()">
                    <td style="text-align: left">
                      {{ moisLisible(m.mois) }}
                      <span class="nm-muet" *ngIf="m.enCours"> · en cours</span>
                      <span class="nm-muet" *ngIf="m.debutDuJournal"> · journal commencé en cours de mois</span>
                    </td>
                    <td>{{ m.actifs }}</td>
                    <td>{{ m.nouveaux }}</td>
                    <td>{{ m.retenus ?? '—' }}</td>
                    <td>{{ m.reactives ?? '—' }}</td>
                    <td>{{ m.perdus ?? '—' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </details>
        </div>

        <!-- ─── Triangle de cohortes ────────────────────────────────────── -->
        <div class="nm-carte" style="margin-top: 0.75rem; padding: 0" *ngIf="r.cohortes.length">
          <div style="padding: 0.875rem 1rem 0.25rem">
            <div class="nm-label">Cohortes mensuelles</div>
            <div class="nm-detail" style="margin-top: 0">part des inscrits d'un mois encore actifs les mois suivants</div>
          </div>
          <!-- Le triangle défile dans sa carte, jamais la page. -->
          <div style="overflow-x: auto">
            <table class="nm-table">
              <thead>
                <tr>
                  <th style="text-align: left">Inscrits en</th>
                  <th>Inscrits</th>
                  <th *ngFor="let k of horizon">M+{{ k }}</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let c of r.cohortes">
                  <td style="text-align: left; white-space: nowrap">{{ moisLisible(c.mois) }}</td>
                  <td>{{ c.inscrits }}</td>
                  <td *ngFor="let k of horizon" [class.nm-encours]="caseDe(c.suivants, k)?.enCours"
                      [title]="caseDe(c.suivants, k)?.enCours ? 'mois en cours : provisoire' : ''">
                    <ng-container *ngIf="caseDe(c.suivants, k) as cs">{{ cellule(cs, c.inscrits) }}</ng-container>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="nm-detail" style="margin-top: 0.5rem; max-width: 60rem">
          « Actif » = au moins un appel authentifié dans le mois ; « revenir » = une activité un autre jour que
          l'inscription. Un taux à J+N ne compte que les inscrits dont le J+N est passé ; sous {{ socle }} inscrits,
          il s'affiche en valeur brute. Le mois en cours est estompé. Comptes administrateurs et internes exclus.
        </div>
      </ng-container>
    </section>
  `,
  styles: [`
    .nm-titre { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: var(--nm-text-light-3, #6a7470); }
    .nm-sous-titre { font-size: 0.7rem; color: var(--nm-text-light-3, #6a7470); }
    .nm-grille { display: grid; grid-template-columns: repeat(auto-fill, minmax(10.5rem, 1fr)); gap: 0.75rem; }
    .nm-carte { background: var(--nm-surface-light, #fff); border: 1px solid var(--nm-border-light, #e3e7e5); border-radius: 10px; padding: 0.875rem 1rem; min-width: 0; }
    .nm-accent { border-color: var(--nm-accent-border-light, #c9e9d8); }
    .nm-muet { color: var(--nm-text-light-3, #6a7470); font-size: 0.72rem; }
    .nm-label { font-size: 0.72rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--nm-text-light-2, #5c6663); margin-bottom: 0.25rem; }
    .nm-valeur { font-size: 1.5rem; font-weight: 800; color: var(--nm-accent-text-light, #0d7a4e); line-height: 1.1; }
    .nm-vide { color: var(--nm-text-light-3, #6a7470); font-weight: 600; }
    .nm-detail { font-size: 0.68rem; color: var(--nm-text-light-3, #6a7470); margin-top: 0.3rem; line-height: 1.35; }

    /* Trois séries d'une même teinte, de la plus claire (nouveaux) à la plus
       soutenue (retenus) : l'ordre suit l'ancienneté de la relation. */
    .nm-s-nouveaux { background: color-mix(in srgb, var(--nm-accent-on-light, #0d9a63) 30%, transparent); }
    .nm-s-reactives { background: color-mix(in srgb, var(--nm-accent-on-light, #0d9a63) 62%, transparent); }
    .nm-s-retenus { background: var(--nm-accent-text-light, #0d7a4e); }
    .nm-legende { display: flex; flex-wrap: wrap; gap: 0.75rem; font-size: 0.68rem; color: var(--nm-text-light-2, #5c6663); }
    .nm-legende span { display: inline-flex; align-items: center; gap: 0.3rem; }
    .nm-pastille { display: inline-block; width: 0.65rem; height: 0.65rem; border-radius: 2px; }

    .nm-pile-plot {
      height: 120px; margin-top: 0.75rem; display: flex; align-items: flex-end; gap: 4px;
      border-bottom: 1px solid var(--nm-border-light, #e3e7e5);
    }
    .nm-pile-col { flex: 1 1 0; min-width: 0; height: 100%; display: flex; align-items: flex-end; justify-content: center; }
    .nm-pile {
      width: 100%; max-width: 28px; min-height: 2px;
      display: flex; flex-direction: column-reverse;
      border-radius: 4px 4px 0 0; overflow: hidden;
    }
    .nm-pile > div { flex-basis: 0; }
    /* Un séparateur couleur surface entre deux segments : sans lui, deux verts
       voisins se fondent. */
    .nm-pile > div + div { border-bottom: 1px solid var(--nm-surface-light, #fff); }
    .nm-encours { opacity: 0.45; }
    .nm-axe { display: flex; gap: 4px; margin-top: 0.25rem; }
    .nm-axe div {
      flex: 1 1 0; min-width: 0; text-align: center; white-space: nowrap; overflow: hidden;
      font-size: 0.62rem; color: var(--nm-text-light-3, #6a7470);
    }

    .nm-details { margin-top: 0.5rem; }
    .nm-details summary { cursor: pointer; color: var(--nm-text-light-3, #6a7470); font-size: 0.68rem; user-select: none; }

    .nm-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; font-variant-numeric: tabular-nums; }
    .nm-table th { font-size: 0.66rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--nm-text-light-2, #5c6663); text-align: right; padding: 0.55rem 0.6rem; border-bottom: 1px solid var(--nm-border-light, #e3e7e5); white-space: nowrap; }
    .nm-table td { text-align: right; padding: 0.45rem 0.6rem; border-bottom: 1px solid var(--nm-divider-light-1, #eef1f0); white-space: nowrap; }
  `],
})
export class AdminRetentionComponent {
  @Input({ required: true }) set retention(v: AdminRetention | null) { this.donnees.set(v); }
  @Input() erreur = false;

  readonly donnees = signal<AdminRetention | null>(null);
  readonly socle = SOCLE;
  readonly horizon = HORIZON;

  private maxActifs = computed(() =>
    (this.donnees()?.mensuel ?? []).reduce((m, x) => Math.max(m, x.actifs), 0),
  );

  /** Le dernier mois TERMINÉ : le mois en cours n'a pas fini de retenir. */
  dernierMoisClos = computed<MoisActif | null>(() => {
    const m = (this.donnees()?.mensuel ?? []).filter(x => !x.enCours);
    return m.length ? m[m.length - 1] : null;
  });

  /** Le tableau reprend les mois du plus récent au plus ancien. */
  mensuelRecent = computed(() => [...(this.donnees()?.mensuel ?? [])].reverse());

  hauteur(actifs: number): number {
    const max = this.maxActifs();
    return max > 0 ? (actifs / max) * 100 : 0;
  }

  titrePile(m: MoisActif): string {
    const base = `${this.moisLisible(m.mois)} : ${m.actifs} actifs — ${m.nouveaux} nouveaux`;
    const suite = m.retenus === null ? '' : `, ${m.retenus} retenus, ${m.reactives} réactivés, ${m.perdus} perdus`;
    return base + suite + (m.enCours ? ' (mois en cours)' : '');
  }

  caseDe(suivants: CaseCohorte[], k: number): CaseCohorte | undefined {
    return suivants.find(s => s.decalage === k);
  }

  /** « 3 (8 %) », ou la seule valeur brute sous le socle. */
  cellule(c: CaseCohorte, inscrits: number): string {
    return inscrits < SOCLE ? `${c.actifs}` : `${c.actifs} (${Math.round((c.actifs / inscrits) * 100)} %)`;
  }

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

  moisLisible(mois: string): string {
    return new Date(`${mois}-01T00:00:00`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  }

  moisCourt(mois: string): string {
    return new Date(`${mois}-01T00:00:00`).toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');
  }

  dateCourte(jour: string): string {
    return new Date(`${jour}T00:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  }
}
