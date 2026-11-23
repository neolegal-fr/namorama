import { Component, computed, inject, input } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { AUTEUR, type Article, articleEcritALaMainDe, dateLongue } from './articles';

/**
 * En-tête d'un article du blog : fil d'Ariane, titre (projeté), signature,
 * dates et temps de lecture.
 *
 * Il enveloppe le H1 de l'article :
 *
 *   <app-article-entete><h1>…</h1></app-article-entete>
 *
 * Les métadonnées viennent de l'article servi par l'API (`[article]`, passé par
 * `ArticleMarkdownComponent`) ; à défaut, du registre écrit à la main, retrouvé par
 * l'URL du routeur (page `/verifier-disponibilite-nom-de-marque`). Aucun article ne
 * recopie sa date, et l'en-tête est dans le HTML servi que lit Google.
 */
@Component({
  selector: 'app-article-entete',
  standalone: true,
  imports: [RouterModule],
  template: `
    <nav class="meta" aria-label="Fil d'Ariane">
      <a routerLink="/">Accueil</a> &rsaquo; <a routerLink="/blog">Blog</a>
      @if (article(); as a) { &rsaquo; {{ a.categorie }} }
    </nav>
    <ng-content></ng-content>
    @if (article(); as a) {
      <!-- Une seule chaîne par segment : Angular retire les espaces entre deux
           balises au prérendu, « · » se collait au texte voisin. -->
      <p class="article-signature">
        <span>Par <strong>{{ auteur.nom }}</strong>, {{ auteur.role }}</span>
        <span class="sep" aria-hidden="true">&middot;</span>
        <span><time [attr.datetime]="a.publie">Publié le {{ date(a.publie) }}</time>@if (a.misAJour !== a.publie) {, mis à jour le <time [attr.datetime]="a.misAJour">{{ date(a.misAJour) }}</time>}</span>
        <span class="sep" aria-hidden="true">&middot;</span>
        <span>{{ a.lecture }} min de lecture</span>
      </p>
    }
  `,
})
export class ArticleEnteteComponent {
  private readonly router = inject(Router);
  readonly auteur = AUTEUR;
  /** Article servi ; absent pour une page dont l'entrée est écrite à la main. */
  readonly source = input<Article | null>(null, { alias: 'article' });
  readonly article = computed(() => this.source() ?? articleEcritALaMainDe(this.router.url));
  readonly date = dateLongue;
}
