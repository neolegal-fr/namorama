import { Component, Injector, inject, runInInjectionContext } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { map, tap } from 'rxjs';
import { ArticleCorpsComponent } from './article-corps';
import { applyContentSeo } from './content-seo';
import type { ArticleMarkdown } from './articles';
import { cheminDe, type Lecture } from './articles-api';

type Vue = { etat: 'ok'; article: ArticleMarkdown } | { etat: 'absent' | 'indisponible' };

/**
 * Page d'un article du blog, lu dans l'API par `resoudreArticle` (chantier
 * `articles-en-base`) : rendue par le serveur à la demande, reprise telle quelle par le
 * navigateur (`TransferState`). Le corps est rendu par `ArticleCorpsComponent`, le même
 * que l'aperçu de l'éditeur.
 *
 * Article absent (404) ou source en panne (503) : la page le dit, sans index, et sans
 * confondre les deux — une panne n'est pas une absence.
 */
@Component({
  selector: 'app-article-markdown',
  standalone: true,
  imports: [ArticleCorpsComponent, RouterModule],
  template: `
    @if (vue(); as v) {
      @if (v.etat === 'ok') {
        <app-article-corps [article]="v.article"></app-article-corps>
      } @else {
        <section class="article">
          <nav class="meta" aria-label="Fil d'Ariane"><a routerLink="/">Accueil</a> &rsaquo; <a routerLink="/blog">Blog</a></nav>
          @if (v.etat === 'absent') {
            <h1>Article introuvable</h1>
            <p class="lead">Aucun article n'est publié à cette adresse. Il a peut-être été renommé ou retiré.</p>
          } @else {
            <h1>Article momentanément indisponible</h1>
            <p class="lead">Le blog ne répond pas pour le moment. Réessayez dans quelques minutes.</p>
          }
          <p><a routerLink="/blog">Voir tous les articles du blog</a></p>
        </section>
      }
    }
  `,
})
export class ArticleMarkdownComponent {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly injector = inject(Injector);

  /**
   * Suit `route.data`, pas un instantané : passer de `/blog/a` à `/blog/b` réutilise
   * ce composant, et le constructeur ne repasse pas.
   */
  readonly vue = toSignal(
    this.route.data.pipe(
      map((d) => vueDe(d['article'] as Lecture<ArticleMarkdown> | undefined)),
      tap((v) => this.referencer(v)),
    ),
  );

  private referencer(v: Vue): void {
    runInInjectionContext(this.injector, () => {
      if (v.etat === 'ok') {
        const a = v.article;
        applyContentSeo({ title: a.title, description: a.description, path: a.path, article: a });
      } else {
        applyContentSeo({
          title: v.etat === 'absent' ? 'Article introuvable' : 'Article momentanément indisponible',
          description: 'Le blog Namorama.',
          path: cheminDe(this.router.url),
          noindex: true,
        });
      }
    });
  }
}

function vueDe(lu: Lecture<ArticleMarkdown> | undefined): Vue {
  if (lu?.etat === 'ok') return { etat: 'ok', article: lu.valeur };
  return { etat: lu?.etat === 'absent' ? 'absent' : 'indisponible' };
}
