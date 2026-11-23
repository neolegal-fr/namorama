import { Component, computed, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ArticleCtaComponent } from './article-cta';
import { applyContentSeo } from './content-seo';
import { ARTICLES, AUTEUR, CATEGORIES, type CategorieArticle, dateLongue } from './articles';

/**
 * Index du blog (/blog), qui remplace l'ancien hub /guides (301 côté nginx).
 *
 * Tous les articles sont dans le HTML prérendu : le filtre par catégorie ne
 * fait que masquer des cartes côté navigateur, il ne retire rien de ce que lit
 * un robot.
 */
@Component({
  selector: 'app-blog-index',
  standalone: true,
  imports: [RouterModule, ArticleCtaComponent],
  template: `
    <section class="article blog">
      <nav class="meta" aria-label="Fil d'Ariane">
        <a routerLink="/">Accueil</a> &rsaquo; Blog
      </nav>

      <h1>Le blog Namorama</h1>
      <p class="lead">
        Trouver un nom de marque, d'entreprise ou de produit <strong>qui soit vraiment libre</strong>&nbsp;:
        méthodes, cas par secteur, règles de l'INPI et chiffres mesurés sur les registres. Écrit par
        {{ auteur.nom }}, {{ auteur.role }}.
      </p>

      <div class="blog-filtres" role="group" aria-label="Filtrer par catégorie">
        <button type="button" class="blog-filtre" [class.actif]="categorie() === null"
                [attr.aria-pressed]="categorie() === null" (click)="categorie.set(null)">
          Tous <span class="nb">{{ total }}</span>
        </button>
        @for (c of categories; track c) {
          <button type="button" class="blog-filtre" [class.actif]="categorie() === c"
                  [attr.aria-pressed]="categorie() === c" (click)="categorie.set(c)">
            {{ c }} <span class="nb">{{ compte(c) }}</span>
          </button>
        }
      </div>

      <div class="blog-liste">
        @for (a of visibles(); track a.path; let premier = $first) {
          <a [routerLink]="a.path" class="blog-carte" [class.une]="premier && categorie() === null">
            <span class="blog-cat">{{ a.categorie }}</span>
            <h2>{{ a.titre }}</h2>
            <p>{{ a.extrait }}</p>
            <span class="blog-date">
              <time [attr.datetime]="a.publie">{{ date(a.publie) }}</time> &middot; {{ a.lecture }} min de lecture
            </span>
          </a>
        }
      </div>

      <app-article-cta></app-article-cta>
    </section>
  `,
  styles: [`
    .blog-filtres {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin: 2rem 0 1.5rem;
    }
    .blog-filtre {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      min-height: 40px;
      padding: 0.35rem 0.95rem;
      border: 1px solid var(--nm-app-border);
      border-radius: 999px;
      background: transparent;
      color: var(--nm-app-text);
      font: inherit;
      font-size: 0.92rem;
      cursor: pointer;
      transition: border-color 0.15s, background 0.15s;
    }
    .blog-filtre:hover { border-color: var(--nm-app-accent-border); }
    .blog-filtre.actif {
      background: var(--nm-app-accent-surface);
      border-color: var(--nm-app-accent);
      color: var(--nm-app-text);
      font-weight: 600;
    }
    .blog-filtre .nb { font-size: 0.8rem; color: var(--nm-app-text-3); }
    .blog-liste {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr));
      gap: 1rem;
      margin: 0 0 2rem;
    }
    .blog-carte {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      padding: 1.25rem 1.4rem;
      border: 1px solid var(--nm-app-border);
      border-radius: 0.8rem;
      text-decoration: none;
      color: inherit;
      transition: border-color 0.15s, transform 0.15s;
    }
    .blog-carte:hover {
      border-color: var(--nm-app-accent-border);
      transform: translateY(-2px);
    }
    .blog-carte.une { grid-column: 1 / -1; padding: 1.75rem 1.9rem; }
    .blog-carte.une h2 { font-size: 1.5rem; }
    .blog-cat {
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--nm-app-accent);
    }
    .blog-carte h2 {
      font-size: 1.15rem;
      font-weight: 700;
      line-height: 1.3;
      margin: 0;
      color: var(--nm-app-text);
    }
    .blog-carte p { margin: 0; color: var(--nm-app-text-2); line-height: 1.5; flex: 1; }
    .blog-date { font-size: 0.85rem; color: var(--nm-app-text-3); }
  `],
})
export class BlogIndexComponent {
  readonly auteur = AUTEUR;
  readonly categories = CATEGORIES;
  readonly total = ARTICLES.length;
  readonly date = dateLongue;
  readonly categorie = signal<CategorieArticle | null>(null);
  readonly visibles = computed(() => {
    const c = this.categorie();
    return c ? ARTICLES.filter((a) => a.categorie === c) : ARTICLES;
  });

  compte(c: CategorieArticle): number {
    return ARTICLES.filter((a) => a.categorie === c).length;
  }

  constructor() {
    applyContentSeo({
      title: 'Blog : trouver un nom de marque et son domaine disponible',
      description:
        "Le blog Namorama : méthodes pour trouver un nom de marque, d'entreprise ou de produit disponible, cas par secteur, règles de l'INPI et chiffres mesurés sur les registres.",
      path: '/blog',
      ogType: 'website',
    });
  }
}
