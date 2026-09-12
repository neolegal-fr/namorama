import { Directive, ElementRef, OnDestroy, afterNextRender, inject, input, output } from '@angular/core';

/**
 * Signale, une seule fois, que l'élément est entré dans le champ de vision.
 *
 * Existe pour ne pas payer d'avance ce que personne ne regardera. L'analyse
 * d'un nom est un appel au modèle : sur les sept jours suivant le déploiement
 * du 05/09/2026, `POST /domain/analyze` pesait **69 % des appels au modèle et
 * 61,5 % du temps passé dedans** — de loin le premier poste — parce que chaque
 * recherche en lançait un par nom produit, qu'on descende ou non jusqu'à la
 * carte. Un compte a enchaîné neuf recherches en trois minutes et demie : 90
 * analyses calculées pour une liste parcourue en vingt secondes.
 *
 * `rootMargin` déclenche un peu AVANT que la carte n'affleure, pour que les
 * étoiles soient là quand l'œil y arrive. La marge reste bornée par ce que
 * l'utilisateur fait défiler : une carte jamais approchée ne coûte rien.
 *
 * Une seule émission par élément : la directive se débranche aussitôt. Comme
 * `@for` réutilise l'élément d'une même clé, refaire défiler la page ne
 * redemande rien.
 */
@Directive({
  selector: '[nmVisibleOnce]',
  standalone: true,
})
export class VisibleOnceDirective implements OnDestroy {
  private readonly hote = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Charge utile remontée à l'apparition — ici le nom porté par la carte. */
  readonly nmVisibleOnce = input.required<string>();

  readonly visibleOnce = output<string>();

  private observateur?: IntersectionObserver;

  constructor() {
    afterNextRender(() => {
      // Absent au prérendu, et absent des très vieux navigateurs. Dans les deux
      // cas on signale tout de suite : mieux vaut le comportement d'avant —
      // tout analyser — qu'une carte qui resterait vide sans recours.
      if (typeof IntersectionObserver === 'undefined') {
        this.visibleOnce.emit(this.nmVisibleOnce());
        return;
      }

      this.observateur = new IntersectionObserver(
        (entrees) => {
          if (!entrees.some((e) => e.isIntersecting)) return;
          this.debrancher();
          this.visibleOnce.emit(this.nmVisibleOnce());
        },
        { rootMargin: '200px' },
      );
      this.observateur.observe(this.hote.nativeElement);
    });
  }

  ngOnDestroy(): void {
    this.debrancher();
  }

  private debrancher(): void {
    this.observateur?.disconnect();
    this.observateur = undefined;
  }
}
