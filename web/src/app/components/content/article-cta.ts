import { Component, Input } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';

/**
 * Bloc d'appel à l'action réutilisé en fin (et en milieu) d'article de contenu.
 * Renvoie systématiquement vers le wizard de recherche (/app), objectif de
 * conversion de chaque page SEO.
 */
@Component({
  selector: 'app-article-cta',
  standalone: true,
  imports: [RouterModule, ButtonModule],
  template: `
    <aside class="cta">
      <h2 class="cta__titre">{{ heading }}</h2>
      <p class="cta__texte">{{ subheading }}</p>
      <a routerLink="/app" class="cta__lien">
        <p-button [label]="label" icon="pi pi-compass" size="large" [rounded]="true"></p-button>
      </a>
      <div class="cta__mention">100 crédits offerts &middot; sans abonnement &middot; testez sans inscription</div>
    </aside>
  `,
  // Rôles applicatifs : l'encart suit le thème comme l'article qui le porte
  // (docs/systeme-de-design.md §2). Sur la palette PrimeNG, il restait vert clair
  // en mode sombre.
  styles: [`
    .cta {
      margin: 3rem 0;
      padding: 2rem 1.5rem;
      text-align: center;
      background: var(--nm-app-accent-surface);
      border: 1px solid var(--nm-app-accent-border);
      border-radius: 0.9rem;
    }
    .cta__titre { font-size: 1.35rem; font-weight: 700; margin: 0 0 0.5rem; color: var(--nm-app-text); }
    .cta__texte { margin: 0 auto 1.25rem; max-width: 34rem; color: var(--nm-app-text-2); line-height: 1.55; }
    /* « inline-block » : le lien enveloppe le bouton, mais en ligne sa boîte se
       réduit à une ligne de texte de 20 px — la cible visible et la cible
       mesurée cessent de coïncider. */
    .cta__lien { display: inline-block; }
    .cta__mention { margin-top: 0.6rem; font-size: 0.85rem; color: var(--nm-app-text-2); }
  `],
})
export class ArticleCtaComponent {
  @Input() heading = 'Trouvez le nom de votre marque maintenant';
  @Input() subheading = "Décrivez votre projet, l'IA propose des noms et vérifie la disponibilité du domaine en temps réel.";
  @Input() label = 'Lancer une recherche gratuite';
}
