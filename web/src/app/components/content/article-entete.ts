import { Component, computed, inject } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { AUTEUR, articleDe, dateLongue } from './articles';

/**
 * En-tête d'un article du blog : fil d'Ariane, titre (projeté), signature,
 * dates et temps de lecture.
 *
 * Il enveloppe le H1 de l'article :
 *
 *   <app-article-entete><h1>…</h1></app-article-entete>
 *
 * Les métadonnées viennent du registre (`articles.ts`), retrouvées par l'URL du
 * routeur : aucun article ne recopie sa date. L'URL est connue au prérendu,
 * l'en-tête est donc dans le HTML statique que lit Google.
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
  readonly article = computed(() => articleDe(this.router.url));
  readonly date = dateLongue;
}
