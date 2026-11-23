import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TroisRisquesComponent } from './trois-risques';
import { ArticleCtaComponent } from './article-cta';
import { applyContentSeo } from './content-seo';
import { ArticleEnteteComponent } from './article-entete';

/**
 * Guide : trouver un nom de produit. Page prérendue (SSG) ciblant
 * « trouver un nom de produit », « nommer un produit », « naming produit ».
 */
@Component({
  selector: 'app-guide-nom-de-produit',
  standalone: true,
  imports: [ArticleEnteteComponent, TroisRisquesComponent, RouterModule, ArticleCtaComponent],
  template: `
    <article class="article">
      <app-article-entete>
        <h1>Comment trouver un nom de produit qui marque les esprits ?</h1>
      </app-article-entete>
      <p class="lead">
        Un bon nom de produit se retient, se cherche sur Google et se prononce sans hésiter. Contrairement
        au nom d'entreprise, il peut être plus descriptif, plus joueur, plus ciblé sur un bénéfice. Mais il
        a le même impératif&nbsp;: <strong>un nom de domaine ou un sous-domaine disponible</strong> pour
        sa page produit.
      </p>

      <h2 id="types">Les grands types de noms de produit</h2>
      <ul>
        <li><strong>Descriptif</strong> : dit ce que fait le produit (« Mailchimp », « PayPal »). Facile à comprendre, plus dur à protéger.</li>
        <li><strong>Évocateur</strong> : suggère une sensation ou un bénéfice (« Slack », « Notion »). Mémorable et flexible.</li>
        <li><strong>Inventé</strong> : un mot nouveau (« Spotify », « Algolia »). Disponible partout, mais demande de l'éducation client.</li>
        <li><strong>Composé</strong> : deux mots fusionnés (« Facebook », « Snapchat »). Bon compromis sens / disponibilité.</li>
      </ul>

      <h2 id="methode">La méthode pour nommer un produit</h2>
      <p>
        <strong>1. Définissez la promesse.</strong> Quel problème résout le produit, pour qui, et avec quelle
        émotion&nbsp;? Un nom de produit raconte un bénéfice, pas une fiche technique.
      </p>
      <p>
        <strong>2. Explorez plusieurs registres.</strong> Générez des dizaines de pistes descriptives,
        évocatrices et inventées avant de juger. <a routerLink="/app">Le générateur de Namorama</a> produit
        ces variations à partir d'une simple description, et teste la disponibilité du domaine pour chacune.
      </p>
      <p>
        <strong>3. Testez la prononciation.</strong> Dites le nom à voix haute, faites-le répéter. S'il faut
        l'épeler, il freinera le bouche-à-oreille.
      </p>
      <p>
        <strong>4. Sécurisez le domaine.</strong> Même pour un produit lancé sous une marque existante, une
        URL dédiée (<code>produit.com</code> ou <code>marque.com/produit</code>) renforce le référencement et
        les campagnes. Vérifiez la disponibilité avant l'annonce, pas après.
      </p>

      <app-trois-risques intro="Un produit change de nom moins facilement qu'un site : voici les trois contrôles à passer avant de l'imprimer sur un emballage."></app-trois-risques>

      <app-article-cta
        heading="Trouvez le nom de votre produit"
        subheading="Décrivez votre produit, l'IA génère des noms et vérifie la disponibilité du domaine en direct."
      ></app-article-cta>

      <h2 id="atelier">Un atelier de nommage qui tient en une heure</h2>
      <p>
        Nommer en réunion tourne vite au concours d'opinions. Un déroulé simple évite l'enlisement&nbsp;:
      </p>
      <ol>
        <li>
          <strong>Cadrer (10 min)</strong> — écrire en une phrase ce que fait le produit, pour qui, et le ton
          visé. Tant que cette phrase n'est pas partagée, aucun nom ne sera jugé sur les mêmes critères.
        </li>
        <li>
          <strong>Diverger seuls (15 min)</strong> — chacun produit des noms de son côté, sans discussion. En
          groupe, le premier nom énoncé oriente tous les suivants&nbsp;: c'est le principal biais à neutraliser.
        </li>
        <li>
          <strong>Mettre en commun sans juger (10 min)</strong> — tout afficher, y compris les propositions
          faibles&nbsp;: elles déclenchent souvent les bonnes.
        </li>
        <li>
          <strong>Filtrer sur la disponibilité (15 min)</strong> — c'est là que la liste fond, et c'est normal.
          Mieux vaut le découvrir maintenant qu'après avoir choisi.
        </li>
        <li>
          <strong>Décider (10 min)</strong> — désigner une seule personne qui tranche. Un nom choisi par
          consensus est presque toujours le plus tiède de la liste.
        </li>
      </ol>

      <h2 id="tester">Tester un nom avant de s'engager</h2>
      <p>
        Trois épreuves suffisent, et elles ne coûtent rien&nbsp;:
      </p>
      <ul>
        <li>
          <strong>Le test du téléphone.</strong> Dictez-le à quelqu'un qui ne l'a jamais vu. S'il faut épeler,
          le nom vous coûtera cher pendant des années.
        </li>
        <li>
          <strong>Le test du lendemain.</strong> Citez cinq noms à un proche, puis redemandez-lui le lendemain
          lesquels il retient. La mémorisation se mesure, elle ne se devine pas.
        </li>
        <li>
          <strong>Le test de la phrase.</strong> Placez le nom dans une vraie phrase de vente — « nous
          utilisons X pour… ». Certains noms très séduisants isolément deviennent bancals à l'usage.
        </li>
      </ul>
      <p>
        Méfiez-vous en revanche du sondage auprès de vos proches&nbsp;: on y mesure surtout la familiarité, et
        les noms les plus distinctifs y sont systématiquement mal notés au premier contact. Les marques fortes
        ont presque toutes été jugées étranges à leur lancement.
      </p>

      <h2 id="domaine">Faut-il un domaine dédié pour un produit ?</h2>
      <p>
        Pas toujours, mais c'est souvent un atout&nbsp;: un domaine exact améliore la mémorisation, facilite
        les publicités et protège le nom. À défaut du <code>.com</code>, un <code>.io</code>, <code>.app</code>
        ou le <code>.fr</code> local font très bien l'affaire. L'essentiel est de vérifier qu'au moins une
        extension crédible est libre avant de figer le nom.
      </p>

      <h2 id="faq">Questions fréquentes</h2>
      <h3>Combien de noms faut-il produire avant de choisir&nbsp;?</h3>
      <p>
        Beaucoup plus qu'on ne l'imagine, parce que la disponibilité élimine l'essentiel de la liste. Visez une
        quinzaine de candidats <em>réellement disponibles</em> pour arbitrer confortablement — ce qui suppose
        d'en avoir généré plusieurs dizaines.
      </p>
      <h3>Qui doit trancher&nbsp;?</h3>
      <p>
        Une seule personne, désignée à l'avance. Le vote produit des noms consensuels, c'est-à-dire sans
        aspérité — exactement ce qu'un nom ne doit pas être.
      </p>
      <h3>Faut-il tester le nom auprès de clients&nbsp;?</h3>
      <p>
        Testez la <em>prononciation</em> et la <em>mémorisation</em>, jamais la préférence. Demander « lequel
        préférez-vous&nbsp;? » mesure la familiarité, ce qui favorise mécaniquement les noms les plus banals.
      </p>
      <h3>Peut-on renommer un produit après son lancement&nbsp;?</h3>
      <p>
        C'est plus facile que pour une entreprise, mais loin d'être indolore&nbsp;: documentation, support,
        intégrations, redirections, et surtout la notoriété accumulée. Tant que le produit est jeune et son
        audience réduite, c'est jouable&nbsp;; passé ce stade, cela devient un projet à part entière.
      </p>

      <h2 id="suite">Guides liés</h2>
      <ul>
        <li><a routerLink="/guides/trouver-nom-de-marque">Trouver un nom de marque disponible</a></li>
        <li><a routerLink="/guides/trouver-nom-entreprise">Trouver un nom d'entreprise</a></li>
        <li><a routerLink="/guides/trouver-nom-de-startup">Trouver un nom de startup</a></li>
      </ul>
    </article>
  `,
})
export class GuideNomDeProduitComponent {
  constructor() {
    applyContentSeo({
      title: 'Comment trouver un nom de produit',
      description:
        "Descriptif, évocateur ou inventé : la méthode pour nommer un produit mémorable et vérifier la disponibilité de son domaine en direct.",
      path: '/guides/trouver-nom-de-produit',
    });
  }
}
