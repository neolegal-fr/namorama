import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TroisRisquesComponent } from './trois-risques';
import { ArticleCtaComponent } from './article-cta';
import { applyContentSeo } from './content-seo';
import { ArticleEnteteComponent } from './article-entete';

/**
 * Landing sectorielle : marque de vêtements / mode.
 *
 * Secteur le plus demandé de tous ceux relevés dans les recherches
 * (« générateur de nom de marque de vetement », « trouver un nom pour une
 * marque de vetement », « nom de marque de vetement disponible »), et le seul
 * de ce niveau à n'avoir aucune page — la cosmétique en avait une, la mode
 * non. La classe 25 y est le fait juridique dominant : c'est l'une des classes
 * les plus encombrées de l'INPI, ce qui change la façon de chercher.
 */
@Component({
  selector: 'app-generateur-nom-marque-vetement',
  standalone: true,
  imports: [ArticleEnteteComponent, TroisRisquesComponent, RouterModule, ArticleCtaComponent],
  template: `
    <article class="article">
      <app-article-entete>
        <h1>Générateur de nom pour marque de vêtements</h1>
      </app-article-entete>
      <p class="lead">
        Streetwear, prêt-à-porter, mode féminine, vêtements de sport ou pièces artisanales&nbsp;: décrivez votre
        univers et l'IA propose des <strong>noms de marque</strong> à la fois tenables sur une étiquette et
        <strong>libres en nom de domaine</strong>, vérifiés en direct auprès du registre
        (<code>.com</code>, <code>.fr</code>, <code>.store</code>).
      </p>

      <app-article-cta
        heading="Trouvez le nom de votre marque de vêtements"
        subheading="Décrivez votre univers et votre cible. L'IA génère, le registre confirme que le domaine est libre."></app-article-cta>

      <h2 id="classe-25">La classe 25 est saturée — et cela change votre méthode</h2>
      <p>
        Les vêtements, chaussures et chapellerie relèvent de la <strong>classe 25</strong> de la
        classification de Nice. C'est l'une des plus déposées au monde, et de très loin&nbsp;: des dizaines de
        milliers de marques actives rien qu'en France. Conséquence pratique&nbsp;: sur un nom court et
        évocateur en français ou en anglais, la probabilité qu'une antériorité existe en classe 25 est
        élevée, même quand le domaine est libre.
      </p>
      <p>
        Ce déséquilibre est propre à la mode. Dans le logiciel, le domaine part le premier et la marque suit&nbsp;;
        ici, c'est l'inverse — vous trouverez des <code>.com</code> libres dont le nom est déposé depuis
        quinze ans par une maison italienne. D'où une règle&nbsp;: dans ce secteur, la
        <a routerLink="/recherche-anteriorite-marque-inpi">recherche d'antériorité</a> passe
        <strong>avant</strong> l'achat du domaine, pas après.
      </p>

      <h2 id="codes">Ce qui fait un nom de marque de mode qui tient</h2>
      <ul>
        <li>
          <strong>Il se lit sur une étiquette de 3 centimètres.</strong> Un nom de dix lettres avec un trait
          d'union ne survit ni au tissage, ni à la broderie, ni à une étiquette de col. Testez-le en petit
          avant de l'aimer en grand.
        </li>
        <li>
          <strong>Il se prononce dans la langue de vos clients.</strong> Un nom français à consonnes muettes
          devient illisible pour un acheteur allemand ou américain&nbsp;; un nom anglais mal orthographié se
          cherche mal sur Instagram. Choisissez votre marché, puis votre langue.
        </li>
        <li>
          <strong>Il n'enferme pas la marque dans un produit.</strong> «&nbsp;Tee&nbsp;», «&nbsp;Denim&nbsp;»,
          «&nbsp;Hoodie&nbsp;» dans le nom vous condamnent à repartir de zéro à la première extension de gamme
          — et une marque de mode s'élargit presque toujours.
        </li>
        <li>
          <strong>Il porte un imaginaire, pas une description.</strong> Les marques qui durent empruntent à un
          patronyme, un lieu, un mot rare ou un néologisme euphonique&nbsp;: elles se remplissent de sens au
          fil du temps au lieu d'en imposer un.
        </li>
        <li>
          <strong>Le pseudo Instagram est cohérent.</strong> En mode, le compte social est la vitrine
          principale. Un nom dont le handle exact est pris, et qu'il faut affubler d'un
          <em>_officiel</em> ou d'un <em>.paris</em>, part avec un handicap réel.
        </li>
      </ul>

      <h2 id="extensions">Quelle extension pour une marque de vêtements&nbsp;?</h2>
      <p>
        Le <code>.com</code> reste la référence dès que vous vendez au-delà des frontières, et c'est aussi le
        plus disputé. Le <code>.fr</code> est un excellent choix si votre marché est français&nbsp;: il rassure
        à l'achat, et il est <strong>nettement plus disponible</strong> — beaucoup de noms perdus en
        <code>.com</code> sont encore libres en <code>.fr</code>. Le <code>.store</code> et le <code>.shop</code>
        dépannent, mais ils signalent «&nbsp;boutique en ligne&nbsp;» plus qu'ils ne signalent une maison.
      </p>
      <p>
        Le vrai risque reste le mélange&nbsp;: prendre le <code>.fr</code> quand le <code>.com</code>
        correspondant appartient à un tiers, c'est envoyer une partie de vos clients chez quelqu'un d'autre.
        Namorama affiche les extensions côte à côte pour que le choix se fasse en connaissance de cause.
      </p>

      <app-trois-risques intro="En mode, la marque déposée est le risque dominant — bien plus que le domaine, contrairement à ce qu'on croit."></app-trois-risques>

      <h2 id="faq">Questions fréquentes</h2>
      <h3>Comment trouver un nom de marque de vêtements qui n'est pas déjà pris&nbsp;?</h3>
      <p>
        Générez large, puis filtrez tôt sur la classe 25. Concrètement&nbsp;: écartez d'emblée les mots
        anglais courants de la mode (les plus déposés), privilégiez les noms inventés ou les mots rares, et
        vérifiez l'antériorité INPI sur vos deux ou trois finalistes avant d'acheter quoi que ce soit.
      </p>
      <h3>Faut-il déposer sa marque de vêtements&nbsp;?</h3>
      <p>
        Dès que la marque est apposée sur les produits, oui. C'est même le secteur où le dépôt se rentabilise
        le plus vite&nbsp;: la contrefaçon y est banale, et sans marque déposée vous n'avez aucun moyen
        d'action contre une boutique qui reprend votre nom. Le dépôt français couvre une à trois classes pour
        quelques centaines d'euros&nbsp;; la classe 25 est celle qui compte, éventuellement complétée par la
        18 (maroquinerie) et la 35 (vente au détail).
      </p>
      <h3>Un nom en anglais ou en français pour une marque française&nbsp;?</h3>
      <p>
        L'anglais élargit le marché mais vous met en concurrence directe avec les dizaines de milliers de
        marques anglophones déjà déposées — la disponibilité y est bien pire. Un nom français, ou un
        néologisme sans langue identifiable, se trouve plus facilement libre et se distingue davantage.
      </p>
      <h3>Puis-je utiliser mon nom de famille&nbsp;?</h3>
      <p>
        C'est une tradition solide de la mode, et c'est possible — mais votre patronyme n'est pas
        automatiquement disponible comme marque&nbsp;: s'il est déjà déposé par un homonyme dans la classe 25,
        vous ne pourrez pas l'exploiter commercialement. Vérifiez-le exactement comme un nom inventé.
      </p>

      <h2 id="suite">À lire aussi</h2>
      <ul>
        <li><a routerLink="/generateur-nom-marque-cosmetique">Nom de marque cosmétique, beauté et bijoux</a></li>
        <li><a routerLink="/generateur-nom-ecommerce">Nom pour boutique en ligne (e-commerce)</a></li>
        <li><a routerLink="/recherche-anteriorite-marque-inpi">Recherche d'antériorité de marque (INPI)</a></li>
        <li><a routerLink="/guides/trouver-nom-de-marque">Guide&nbsp;: trouver un nom de marque disponible</a></li>
      </ul>
    </article>
  `,
})
export class GenerateurNomMarqueVetementComponent {
  constructor() {
    applyContentSeo({
      title: 'Générateur de nom pour marque de vêtements',
      description:
        "Trouvez un nom pour votre marque de vêtements ou de streetwear, avec le domaine (.com, .fr) vérifié libre en direct — et le réflexe classe 25 avant de déposer.",
      path: '/generateur-nom-marque-vetement',
    });
  }
}
