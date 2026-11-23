import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ArticleEnteteComponent } from './article-entete';
import { ArticleCtaComponent } from './article-cta';
import { TroisRisquesComponent } from './trois-risques';
import { applyContentSeo } from './content-seo';
import { articleMarkdownDe, type SegmentArticle } from './articles';

type SegmentAffiche = Exclude<SegmentArticle, { type: 'html' }> | { type: 'html'; html: SafeHtml };

/**
 * Affiche un article écrit en Markdown (`src/content/articles/`).
 *
 * Le HTML vient de `scripts/articles.mjs`, au build, à partir de fichiers du
 * dépôt relus en PR ; la compilation y refuse tout HTML brut. Il est donc marqué
 * sûr : l'assainisseur d'Angular retirerait sinon les `id` des titres, cibles
 * des ancres.
 *
 * Les liens internes sont des `<a href="/…">` ordinaires, lisibles tels quels
 * dans le HTML prérendu ; un clic simple passe par le routeur pour ne pas
 * recharger l'application.
 */
@Component({
  selector: 'app-article-markdown',
  standalone: true,
  imports: [ArticleEnteteComponent, ArticleCtaComponent, TroisRisquesComponent],
  host: { '(click)': 'suivreLien($event)' },
  template: `
    <article class="article">
      <app-article-entete>
        <h1 [innerHTML]="h1"></h1>
      </app-article-entete>
      @for (s of segments; track $index) {
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
export class ArticleMarkdownComponent {
  private readonly router = inject(Router);
  readonly h1: SafeHtml;
  readonly segments: SegmentAffiche[];
  /** Valeurs par défaut des blocs, quand l'article ne les précise pas. */
  readonly cta = new ArticleCtaComponent();
  readonly risques = new TroisRisquesComponent();

  constructor() {
    const chemin: string = inject(ActivatedRoute).snapshot.data['article'];
    const article = articleMarkdownDe(chemin);
    if (!article) throw new Error(`Article Markdown introuvable : ${chemin}`);
    const sanitizer = inject(DomSanitizer);
    this.h1 = sanitizer.bypassSecurityTrustHtml(article.h1);
    this.segments = article.segments.map((s) =>
      s.type === 'html' ? { type: 'html', html: sanitizer.bypassSecurityTrustHtml(s.html) } : s,
    );
    applyContentSeo({ title: article.title, description: article.description, path: article.path });
  }

  /** Clic simple sur un lien interne : navigation par le routeur. */
  suivreLien(event: MouseEvent): void {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const lien = (event.target as Element | null)?.closest?.('a');
    const href = lien?.getAttribute('href');
    if (!lien || !href || !href.startsWith('/') || lien.hasAttribute('target')) return;
    event.preventDefault();
    this.router.navigateByUrl(href);
  }
}
