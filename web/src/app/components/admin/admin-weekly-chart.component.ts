import { Component, Input, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

/** Un point de la série, tel que le composant le consomme. */
export interface ChartPoint {
  /** Lundi de la semaine, `AAAA-MM-JJ`. */
  week: string;
  /** `null` = NON MESURÉ. Le graphique montre un trou, jamais une barre à zéro. */
  value: number | null;
}

interface Barre {
  point: ChartPoint;
  /** Hauteur en % du plot. `null` quand la semaine n'est pas mesurée. */
  hauteur: number | null;
  libelle: string;
  /** Semaine encore en cours : incomplète par construction. */
  enCours: boolean;
  /** Étiquette d'axe, ou chaîne vide quand la graduation est sautée. */
  tick: string;
}

/** Un tronçon continu de la courbe. Une coupure = une semaine non mesurée. */
interface Troncon {
  ligne: string;
  aire: string;
}

/**
 * Historique hebdomadaire d'un indicateur.
 *
 * Deux formes, et le choix n'est pas cosmétique :
 *
 * - **`barres`** pour un FLUX — ce qui s'est produit pendant la semaine.
 *   Chaque valeur porte sur une semaine entière ; une courbe interpolerait
 *   entre deux lundis un continu qui n'existe pas.
 * - **`ligne`** pour un CUMUL — un état qui se prolonge d'un point au suivant.
 *   Vingt-six barres presque égales obligeraient à comparer des sommets ; la
 *   trajectoire, elle, se lit d'un coup d'œil.
 *
 * Trois choses que ce composant refuse de faire, parce qu'elles font mentir un
 * graphique à faible volume :
 *
 * - **Un zéro pour une absence de mesure.** Une semaine à `null` est marquée
 *   d'un creux hachuré gris : « on ne sait pas » ne se confond pas avec
 *   « personne ». En mode ligne, la courbe s'interrompt.
 * - **Traiter la semaine en cours comme les autres.** Elle est incomplète
 *   jusqu'au dimanche soir ; affichée pleine, elle simulerait une chute
 *   hebdomadaire. Elle est donc estompée et annoncée comme telle.
 * - **Réserver la valeur à l'infobulle.** Chaque graphique porte son tableau
 *   équivalent, dépliable : une valeur qui n'existe qu'au survol est
 *   inaccessible au clavier comme à l'impression.
 *
 * Un seul indicateur par graphique, donc une seule couleur et pas de légende —
 * le titre nomme la série. Deux échelles sur un même plot inventeraient une
 * corrélation que les données ne portent pas.
 */
@Component({
  selector: 'app-admin-weekly-chart',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="nm-chart">
      <div class="nm-chart-head">
        <div>
          <div class="nm-chart-title">{{ title }}</div>
          <div class="nm-chart-sub">{{ sousTitre() }}</div>
        </div>
        <div class="nm-chart-max" *ngIf="maximum() > 0">max {{ maximum() }}</div>
      </div>

      <div class="nm-plot" (mouseleave)="survol.set(null)">
        <!-- Repères : deux hairlines pleines, une au sommet de l'échelle, une
             sur la ligne de base. Rien de plus — au-delà, la grille pèse plus
             que les données. -->
        <div class="nm-grid nm-grid-haut"></div>
        <div class="nm-grid nm-grid-bas"></div>

        <!-- ─── Forme « ligne » ─────────────────────────────────────────── -->
        <svg *ngIf="forme === 'ligne'" class="nm-svg"
             viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <ng-container *ngFor="let t of troncons()">
            <polygon class="nm-aire" [attr.points]="t.aire"></polygon>
            <polyline class="nm-ligne" [attr.points]="t.ligne"
                      vector-effect="non-scaling-stroke"></polyline>
          </ng-container>
        </svg>
        <!-- Le point final est en HTML, pas dans le SVG : un cercle posé dans
             un viewBox étiré deviendrait une ellipse. -->
        <div class="nm-fin" *ngIf="forme === 'ligne' && pointFinal() as f"
             [style.left.%]="f.x" [style.bottom.%]="f.y"></div>

        <!-- ─── Forme « barres », et zone de survol des deux formes ──────── -->
        <div class="nm-bars">
          <div class="nm-band" *ngFor="let b of barres(); let i = index"
               (mouseenter)="survol.set(i)"
               [class.nm-band-actif]="survol() === i">
            <ng-container *ngIf="forme === 'barres'">
              <div class="nm-bar" *ngIf="b.hauteur !== null"
                   [class.nm-bar-encours]="b.enCours"
                   [style.height.%]="b.hauteur"></div>
            </ng-container>
            <!-- Un talon gris au pied de l'axe, pas un aplat sur toute la
                 hauteur : sur une longue plage non mesurée, la texture pleine
                 couvre la carte et pèse plus que la donnée qu'elle remplace. -->
            <div class="nm-nomesure" *ngIf="b.hauteur === null"></div>
          </div>
        </div>

        <!-- L'infobulle vit DANS le plot : posée au-dessus, elle recouvrirait
             le titre de la carte à chaque survol. -->
        <div class="nm-tip" *ngIf="survol() !== null && barres()[survol()!] as b"
             [style.left.%]="positionTip()">
          <div class="nm-tip-week">{{ b.libelle }}</div>
          <div class="nm-tip-val" *ngIf="b.point.value !== null">
            {{ valeur(b.point.value) }} <span>{{ unite }}</span>
          </div>
          <div class="nm-tip-null" *ngIf="b.point.value === null">non mesuré</div>
          <div class="nm-tip-encours" *ngIf="b.enCours">semaine en cours</div>
        </div>
      </div>

      <div class="nm-xaxis">
        <div class="nm-tick" *ngFor="let b of barres()">{{ b.tick }}</div>
      </div>

      <div class="nm-chart-note" *ngIf="note">{{ note }}</div>

      <details class="nm-chart-table">
        <summary>Voir les valeurs</summary>
        <table>
          <thead>
            <tr><th>Semaine du</th><th>{{ title }}</th></tr>
          </thead>
          <tbody>
            <tr *ngFor="let b of barresRecentes()">
              <td>{{ b.libelle }}</td>
              <td>
                <span *ngIf="b.point.value !== null">{{ valeur(b.point.value) }}</span>
                <span class="nm-td-null" *ngIf="b.point.value === null">non mesuré</span>
                <span class="nm-td-note" *ngIf="b.enCours"> · en cours</span>
              </td>
            </tr>
          </tbody>
        </table>
      </details>
    </div>
  `,
  styles: [`
    .nm-chart {
      background: var(--nm-surface-light, #fff);
      border: 1px solid var(--nm-border-light, #e3e7e5);
      border-radius: 10px;
      padding: 0.875rem 1rem 0.75rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .nm-chart-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 0.75rem; }

    .nm-chart-title {
      font-size: 0.72rem; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.05em; color: var(--nm-text-light-2, #5c6663);
    }
    .nm-chart-sub { font-size: 0.78rem; color: var(--nm-text-light-3, #6a7470); margin-top: 0.15rem; }
    .nm-chart-max {
      font-size: 0.68rem; color: var(--nm-text-light-3, #6a7470);
      font-variant-numeric: tabular-nums; white-space: nowrap; padding-top: 0.1rem;
    }

    /* Le conteneur inclut la bande d'axe : une hauteur fixe qui n'en tient pas
       compte pousse les étiquettes hors cadre et crée une barre de défilement
       de quelques pixels dans la carte. */
    .nm-plot { position: relative; height: 132px; }

    .nm-grid { position: absolute; left: 0; right: 0; height: 1px; background: var(--nm-divider-light-1, #eef1f0); }
    .nm-grid-haut { top: 0; }
    .nm-grid-bas { bottom: 0; background: var(--nm-border-light, #e3e7e5); }

    .nm-svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
    .nm-ligne { fill: none; stroke: var(--nm-accent-on-light, #0d9a63); stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
    /* Lavis, jamais un aplat saturé : l'aire situe la courbe, elle ne la double pas. */
    .nm-aire { fill: var(--nm-accent-on-light, #0d9a63); opacity: 0.1; stroke: none; }

    .nm-fin {
      position: absolute; width: 9px; height: 9px; border-radius: 50%;
      background: var(--nm-accent-on-light, #0d9a63);
      /* Anneau à la couleur de la surface : le point reste lisible là où il
         croise la ligne ou la bordure du plot. */
      box-shadow: 0 0 0 2px var(--nm-surface-light, #fff);
      transform: translate(-50%, 50%);
      pointer-events: none;
    }

    .nm-bars { position: absolute; inset: 0; display: flex; align-items: flex-end; gap: 2px; }

    /* La bande entière est la cible de survol : viser une barre de 3 px de
       haut serait impossible. Elle fait toute la hauteur du plot. */
    .nm-band {
      flex: 1 1 0; min-width: 0; height: 100%;
      display: flex; align-items: flex-end; justify-content: center;
      cursor: default;
    }
    .nm-band-actif { background: color-mix(in srgb, var(--nm-divider-light-2, #f2f4f3) 70%, transparent); }

    .nm-bar {
      width: 100%; max-width: 24px;
      min-height: 2px;
      background: var(--nm-accent-on-light, #0d9a63);
      /* Extrémité de donnée arrondie, base carrée : le sommet porte la valeur,
         le pied est posé sur la ligne de base. */
      border-radius: 4px 4px 0 0;
    }
    /* La semaine courante n'est pas finie. Estompée, elle ne se lit plus comme
       une chute — et l'infobulle le dit en toutes lettres. */
    .nm-bar-encours { opacity: 0.45; }

    /* Non mesuré : un talon hachuré gris, visiblement d'une autre nature qu'une
       barre verte à zéro (qui, elle, se réduit à un trait de 2 px). */
    .nm-nomesure {
      width: 100%; max-width: 24px; height: 12px;
      background: repeating-linear-gradient(
        45deg,
        var(--nm-border-light, #e3e7e5) 0 2px,
        transparent 2px 5px
      );
    }

    .nm-tip {
      position: absolute; top: 2px;
      transform: translateX(-50%);
      background: var(--nm-text-light, #0b0e10); color: #fff;
      border-radius: 6px; padding: 0.3rem 0.5rem;
      font-size: 0.72rem; line-height: 1.3; white-space: nowrap;
      pointer-events: none; z-index: 5;
    }
    .nm-tip-week { opacity: 0.7; }
    .nm-tip-val { font-weight: 700; font-variant-numeric: tabular-nums; }
    .nm-tip-val span { font-weight: 400; opacity: 0.7; }
    .nm-tip-null, .nm-tip-encours { opacity: 0.7; font-style: italic; }

    .nm-xaxis { display: flex; gap: 2px; }
    .nm-tick {
      flex: 1 1 0; min-width: 0;
      font-size: 0.62rem; color: var(--nm-text-light-3, #6a7470);
      text-align: center; white-space: nowrap; overflow: visible;
      font-variant-numeric: tabular-nums;
    }

    .nm-chart-note { font-size: 0.68rem; color: var(--nm-text-light-3, #6a7470); line-height: 1.4; }

    .nm-chart-table { font-size: 0.72rem; }
    .nm-chart-table summary {
      cursor: pointer; color: var(--nm-text-light-3, #6a7470);
      font-size: 0.68rem; user-select: none;
    }
    .nm-chart-table table { width: 100%; margin-top: 0.4rem; border-collapse: collapse; }
    .nm-chart-table th, .nm-chart-table td {
      text-align: left; padding: 0.15rem 0.25rem;
      border-bottom: 1px solid var(--nm-divider-light-1, #eef1f0);
      font-variant-numeric: tabular-nums;
    }
    .nm-chart-table th { color: var(--nm-text-light-3, #6a7470); font-weight: 600; }
    .nm-td-null, .nm-td-note { color: var(--nm-text-light-3, #6a7470); font-style: italic; }
  `],
})
export class AdminWeeklyChartComponent {
  @Input({ required: true }) title = '';
  @Input({ required: true }) set points(v: ChartPoint[]) { this._points.set(v ?? []); }

  /** `barres` pour un flux hebdomadaire, `ligne` pour un cumul. */
  @Input() forme: 'barres' | 'ligne' = 'barres';

  /**
   * Ce que résume le sous-titre. Une moyenne hebdomadaire n'a aucun sens sur un
   * cumul — « 21,8 comptes par semaine » quand la courbe monte de 23 à 46.
   */
  @Input() agregat: 'moyenne' | 'dernier' = 'moyenne';

  /** Unité affichée dans l'infobulle et le sous-titre (« comptes », « crédits »…). */
  @Input() unite = '';
  /**
   * Décimales fixes des valeurs affichées — `2` pour des dollars, lus au
   * centime. Non renseigné : la valeur telle quelle, moyenne au dixième.
   */
  @Input() decimales: number | null = null;
  @Input() note = '';

  private _points = signal<ChartPoint[]>([]);
  survol = signal<number | null>(null);

  maximum = computed(() =>
    this._points().reduce((m, p) => Math.max(m, p.value ?? 0), 0),
  );

  /** Semaines RÉVOLUES et mesurées : la semaine en cours fausserait tout résumé. */
  private revolues = computed(() =>
    this._points().slice(0, -1).filter((p) => p.value !== null),
  );

  sousTitre = computed(() => {
    const revolues = this.revolues();
    if (!revolues.length) return '';

    if (this.agregat === 'dernier') {
      const fin = revolues[revolues.length - 1];
      return `${this.valeur(fin.value)} ${this.unite} au ${AdminWeeklyChartComponent.libelleSemaine(fin.week)}`;
    }
    const total = revolues.reduce((s, p) => s + (p.value ?? 0), 0);
    const moyenne = total / revolues.length;
    // La base de la moyenne quand elle n'est PAS la fenêtre entière : sans
    // cela, « 7,5 par semaine » calculé sur deux semaines mesurées se lirait
    // comme une moyenne sur six mois.
    const attendues = this._points().length - 1;
    const base = revolues.length < attendues
      ? ` (${revolues.length} semaine${revolues.length > 1 ? 's' : ''} mesurée${revolues.length > 1 ? 's' : ''})`
      : '';
    const texte = this.decimales === null
      ? (Math.round(moyenne * 10) / 10).toLocaleString('fr-FR')
      : this.valeur(moyenne);
    return `${texte} / semaine en moyenne${base}`;
  });

  valeur(v: number | null): string {
    if (v === null) return '';
    return this.decimales === null
      ? v.toLocaleString('fr-FR')
      : v.toLocaleString('fr-FR', { minimumFractionDigits: this.decimales, maximumFractionDigits: this.decimales });
  }

  barres = computed<Barre[]>(() => {
    const pts = this._points();
    const max = this.maximum();
    const dernier = pts.length - 1;
    // Une graduation sur quatre environ : à vingt-six semaines, toutes les
    // afficher les fait se chevaucher. La dernière est toujours graduée —
    // c'est celle qu'on regarde.
    const pas = Math.max(1, Math.ceil(pts.length / 7));

    return pts.map((point, i) => ({
      point,
      hauteur: point.value === null ? null : max > 0 ? (point.value / max) * 100 : 0,
      libelle: AdminWeeklyChartComponent.libelleSemaine(point.week),
      enCours: i === dernier,
      tick: (dernier - i) % pas === 0 ? AdminWeeklyChartComponent.tick(point.week) : '',
    }));
  });

  /** Le tableau reprend les douze dernières semaines : au-delà, on déroule. */
  barresRecentes = computed(() => this.barres().slice(-12).reverse());

  // ─── Géométrie de la forme « ligne » ────────────────────────────────────
  //
  // Coordonnées en pourcentages dans un viewBox 100×100 étiré
  // (`preserveAspectRatio="none"`) : le plot est bien plus large que haut, et
  // un viewBox à l'échelle laisserait la courbe dans un carré. Le trait garde
  // son épaisseur grâce à `vector-effect`, et le point final est en HTML.

  private xy = computed(() => {
    const pts = this._points();
    const max = this.maximum() || 1;
    const n = pts.length;
    return pts.map((p, i) => ({
      x: ((i + 0.5) / n) * 100,
      y: p.value === null ? null : 100 - (p.value / max) * 100,
    }));
  });

  troncons = computed<Troncon[]>(() => {
    const segments: { x: number; y: number }[][] = [];
    let courant: { x: number; y: number }[] = [];

    for (const p of this.xy()) {
      if (p.y === null) {
        // Une semaine non mesurée coupe la courbe. La relier par-dessus
        // reviendrait à interpoler une valeur qu'on n'a pas.
        if (courant.length) segments.push(courant);
        courant = [];
      } else {
        courant.push({ x: p.x, y: p.y });
      }
    }
    if (courant.length) segments.push(courant);

    return segments
      .filter((seg) => seg.length >= 2)
      .map((seg) => ({
        ligne: seg.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' '),
        aire: [
          `${seg[0].x.toFixed(2)},100`,
          ...seg.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`),
          `${seg[seg.length - 1].x.toFixed(2)},100`,
        ].join(' '),
      }));
  });

  /** Dernier point mesuré, en % depuis la gauche et depuis le BAS du plot. */
  pointFinal = computed(() => {
    const pts = this.xy();
    for (let i = pts.length - 1; i >= 0; i--) {
      if (pts[i].y !== null) return { x: pts[i].x, y: 100 - (pts[i].y as number) };
    }
    return null;
  });

  /** Centre de la bande survolée, en % de la largeur du plot. */
  positionTip = computed(() => {
    const i = this.survol();
    const n = this.barres().length;
    if (i === null || !n) return 50;
    // Bornée : sans cela, l'infobulle des semaines extrêmes déborde la carte.
    return Math.min(85, Math.max(15, ((i + 0.5) / n) * 100));
  });

  private static parse(week: string): Date {
    // `T00:00:00` sans « Z » : la date est un jour civil du serveur, pas un
    // instant UTC. Sans cela, un navigateur à l'ouest recule d'un jour et la
    // « semaine du 17 » s'affiche « semaine du 16 ».
    return new Date(`${week}T00:00:00`);
  }

  private static libelleSemaine(week: string): string {
    return AdminWeeklyChartComponent.parse(week)
      .toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
  }

  private static tick(week: string): string {
    return AdminWeeklyChartComponent.parse(week)
      .toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
      .replace('.', '');
  }
}
