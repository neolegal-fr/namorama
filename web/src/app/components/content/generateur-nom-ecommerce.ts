import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TroisRisquesComponent } from './trois-risques';
import { ArticleCtaComponent } from './article-cta';
import { applyContentSeo } from './content-seo';
import { ArticleEnteteComponent } from './article-entete';

/**
 * Landing sectorielle : générateur de nom pour boutique en ligne / e-commerce.
 * Cible « nom de boutique en ligne », « nom de marque e-commerce », « nom de shop ».
 * Cluster le plus volumineux des recherches réelles en prod.
 */
@Component({
  selector: 'app-generateur-nom-ecommerce',
  standalone: true,
  imports: [ArticleEnteteComponent, TroisRisquesComponent, RouterModule, ArticleCtaComponent],
  template: `
    <article class="article">
      <app-article-entete>
        <h1>Générateur de nom pour boutique en ligne (e-commerce)</h1>
      </app-article-entete>
      <p class="lead">
        Vous lancez une <strong>boutique en ligne</strong> ou une marque e-commerce&nbsp;? Trouvez un nom
        mémorable et <strong>vérifiez la disponibilité du domaine en direct</strong> (<code>.com</code>,
        <code>.fr</code>). Décrivez vos produits, l'IA génère des dizaines de noms adaptés à la vente en ligne
        et teste chaque domaine par Whois réel.
      </p>

      <h2 id="enjeu">Un nom d'e-commerce doit tenir sur trois plans</h2>
      <ul>
        <li><strong>Le nom de domaine</strong> : c'est l'adresse de votre boutique. Sans <code>.com</code> ou
          <code>.fr</code> disponible, le nom ne sert à rien.</li>
        <li><strong>La marque</strong> : suffisamment large pour couvrir votre catalogue <em>et son évolution</em>
          (beaucoup de boutiques démarrent sur un produit puis s'étendent).</li>
        <li><strong>Le référencement</strong> : un nom distinctif se démarque mieux qu'un nom générique noyé dans
          les résultats.</li>
      </ul>

      <h2 id="descriptif-ou-invente">Descriptif ou inventé&nbsp;?</h2>
      <p>
        Un nom <strong>descriptif</strong> (ex. «&nbsp;maboutiquedefleurs&nbsp;») aide au premier coup d'œil mais
        vous enferme dans une catégorie et se démarque mal. Un nom <strong>inventé et brandable</strong> (ex.
        Petiva, Glowify, Purzio — des recherches réelles de nos utilisateurs) devient une vraie marque, s'étend à
        de nouveaux produits et se protège plus facilement. Si vous ciblez un marché local, un nom incluant une
        référence géographique ou une sonorité française peut aussi convertir.
      </p>
      <p>
        <a routerLink="/app">Namorama</a> couvre les deux styles&nbsp;: il génère des noms inventés
        <em>et</em> descriptifs, puis <strong>vérifie en temps réel</strong> quelles extensions sont libres
        (<code>.com</code>, <code>.fr</code>, <code>.net</code>…) pour que vous ne perdiez pas de temps sur des
        noms déjà pris.
      </p>

      <app-trois-risques intro="Une boutique en ligne vit de sa visibilité : ces trois contrôles décident de qui la trouve, et sous quel nom."></app-trois-risques>

      <app-article-cta
        heading="Trouvez le nom de votre boutique en ligne"
        subheading="Décrivez vos produits, l'IA propose des noms de marque e-commerce et vérifie le domaine (.com, .fr) en direct."
      ></app-article-cta>

      <h2 id="marketplace">Votre nom vit ailleurs que sur votre site</h2>
      <p>
        C'est la spécificité de l'e-commerce&nbsp;: votre nom sera lu sur des supports que vous ne maîtrisez
        pas. Sur une place de marché à côté de dizaines de vendeurs, dans un e-mail de confirmation, sur un
        bordereau de livraison, sur un ticket de carte bancaire tronqué à vingt caractères, dans une story
        lue en trois secondes.
      </p>
      <p>
        Trois conséquences pratiques&nbsp;: il doit rester <strong>lisible tronqué</strong>, se
        <strong>dicter sans faute</strong> à un service client, et ne pas se confondre avec un vendeur voisin.
        Un nom qui ne fonctionne que sur votre page d'accueil, dans votre typographie, n'est pas un nom
        d'e-commerce.
      </p>

      <h2 id="perenne">Ne vous enfermez pas dans votre premier catalogue</h2>
      <p>
        L'erreur la plus fréquente en boutique en ligne est de nommer d'après le produit de lancement. « Ma
        Boutique Bougies » fonctionne parfaitement — jusqu'au jour où les diffuseurs, les savons puis la
        décoration représentent la moitié du chiffre d'affaires. Le nom devient alors un plafond.
      </p>
      <p>
        Le raisonnement vaut pour la géographie&nbsp;: un nom de ville rassure au démarrage et devient un
        handicap dès que vous expédiez dans toute la France. Réservez les mentions géographiques aux activités
        réellement locales — un salon, un atelier, un point de retrait.
      </p>

      <h2 id="conseils">3 réflexes avant de valider</h2>
      <ul>
        <li><strong>Sécurisez le <code>.com</code> et le <code>.fr</code></strong> ensemble quand c'est possible :
          cela protège votre marque et évite qu'un concurrent prenne l'autre extension.</li>
        <li><strong>Vérifiez la marque</strong> (INPI) et la disponibilité des pseudos réseaux sociaux.</li>
        <li><strong>Testez la prononciation à voix haute</strong> : un nom qui se dicte sans épeler se partage
          mieux.</li>
      </ul>

      <h2 id="faq">Questions fréquentes</h2>
      <h3>Faut-il mettre un mot-clé produit dans le nom pour le référencement&nbsp;?</h3>
      <p>
        Non. Les domaines à mots-clés exacts n'ont plus d'avantage depuis des années, et un nom générique vous
        rend indistinguable. Une boutique se référence par ses fiches produit, ses catégories et son contenu —
        pas par son nom de domaine.
      </p>
      <h3><code>.fr</code> ou <code>.com</code> pour une boutique française&nbsp;?</h3>
      <p>
        Le <code>.fr</code> rassure les acheteurs français, signale clairement l'origine et les délais de
        livraison, et reste beaucoup plus disponible. Le <code>.com</code> s'impose si vous visez l'export.
        Vérifiez surtout que l'autre extension n'appartient pas à un concurrent&nbsp;: vos clients taperont
        votre nom de mémoire, avec l'extension qui leur vient spontanément.
      </p>
      <h3>Puis-je utiliser un nom déjà pris sur les réseaux sociaux si le domaine est libre&nbsp;?</h3>
      <p>
        Techniquement oui, mais c'est un mauvais calcul. En e-commerce, le réseau social est souvent le premier
        point de contact&nbsp;: un pseudo différent du nom de domaine coûte en mémorisation à chaque
        publication. Vérifiez les deux avant de trancher, et réservez-les le même jour.
      </p>
      <h3>Combien de temps pour trouver un nom de boutique&nbsp;?</h3>
      <p>
        À la main, plusieurs jours, dont l'essentiel passé à découvrir que les noms trouvés sont déjà pris. En
        générant et vérifiant simultanément, une séance de vingt minutes suffit généralement à obtenir une
        dizaine de candidats réellement disponibles.
      </p>

      <h2 id="suite">Guides liés</h2>
      <ul>
        <li><a routerLink="/generateur-nom-marque-vetement">Générateur de nom pour marque de vêtements</a></li>
        <li><a routerLink="/generateur-nom-marque-cosmetique">Générateur de nom pour marque cosmétique / beauté</a></li>
        <li><a routerLink="/guides/trouver-nom-de-produit">Trouver un nom de produit</a></li>
        <li><a routerLink="/guides/trouver-nom-de-marque">Trouver un nom de marque disponible</a></li>
      </ul>
    </article>
  `,
})
export class GenerateurNomEcommerceComponent {
  constructor() {
    applyContentSeo({
      title: 'Générateur de nom pour boutique en ligne',
      description:
        "Trouvez un nom pour votre boutique en ligne, avec le domaine (.com, .fr) vérifié en temps réel. Noms inventés ou descriptifs générés par l'IA.",
      path: '/generateur-nom-ecommerce',
    });
  }
}
