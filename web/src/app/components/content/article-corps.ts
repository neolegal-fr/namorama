import { Component, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ArticleEnteteComponent } from './article-entete';
import { ArticleCtaComponent } from './article-cta';
import { TroisRisquesComponent } from './trois-risques';
import type { ArticleMarkdown, SegmentArticle } from './articles';

type SegmentAffiche = Exclude<SegmentArticle, { type: 'html' }> | { type: 'html'; html: SafeHtml };

/**
 * Le corps d'un article du blog : en-tête, titre, segments et blocs. Le même rendu sert
 * la page publique (`ArticleMarkdownComponent`) et l'aperçu de l'éditeur
 * d'administration — ce qu'on voit en écrivant est ce que le lecteur verra.
 *
 * Le HTML est compilé par l'API à l'enregistrement, qui refuse tout HTML d'auteur ;
 * seuls un administrateur ou un jeton de rédaction écrivent. Il est donc marqué sûr :
 * l'assainisseur d'Angular retirerait sinon les `id` des titres, cibles des ancres.
 *
 * Les liens internes sont des `<a href="/…">` ordinaires, lisibles tels quels dans le
 * HTML servi ; un clic simple passe par le routeur pour ne pas recharger l'application.
 * Dans l'aperçu (`liensActifs` faux), un clic ne quitte pas l'éditeur.
 */
@Component({
  selector: 'app-article-corps',
  standalone: true,
  imports: [ArticleEnteteComponent, ArticleCtaComponent, TroisRisquesComponent],
  host: { '(click)': 'suivreLien($event)' },
  template: `
    <article class="article">
      <app-article-entete [article]="article()">
        <h1 [innerHTML]="h1()"></h1>
      </app-article-entete>
      @for (s of segments(); track $index) {
        @if (s.type === 'html') {
          <div class="article-corps" [innerHTML]="s.html"></div>
        } @else if (s.type === 'cta') {
          <app-article-cta
            [heading]="s.heading ?? cta.heading"
            [subheading]="s.subheading ?? cta.subheading"
            [label]="s.label ?? cta.label"
          ></app-article-cta>
        } @else {
          <app-trois-risques [heading]="s.heading ?? risques.heading" [intro]="s.intro ?? risques.intro"></app-trois-risques>
        }
      }
    </article>
  `,
  styles: ['.article-corps { display: contents; }'],
})
export class ArticleCorpsComponent {
  private readonly router = inject(Router);
  private readonly sanitizer = inject(DomSanitizer);

  readonly article = input.required<ArticleMarkdown>();
  /** Faux dans l'aperçu de l'éditeur : un clic sur un lien n'en sort pas. */
  readonly liensActifs = input(true);
  /** Valeurs par défaut des blocs, quand l'article ne les précise pas. */
  readonly cta = new ArticleCtaComponent();
  readonly risques = new TroisRisquesComponent();

  readonly h1 = computed(() => this.sanitizer.bypassSecurityTrustHtml(this.article().h1));
  readonly segments = computed<SegmentAffiche[]>(() =>
    this.article().segments.map((s) =>
      s.type === 'html' ? { type: 'html', html: this.sanitizer.bypassSecurityTrustHtml(s.html) } : s,
    ),
  );

  /** Clic simple sur un lien interne : navigation par le routeur (ou rien, en aperçu). */
  suivreLien(event: MouseEvent): void {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const lien = (event.target as Element | null)?.closest?.('a');
    const href = lien?.getAttribute('href');
    if (!lien || !href || !href.startsWith('/') || lien.hasAttribute('target')) return;
    event.preventDefault();
    if (this.liensActifs()) this.router.navigateByUrl(href);
  }
}
