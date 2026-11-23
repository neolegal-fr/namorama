import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TroisRisquesComponent } from './trois-risques';
import { ArticleCtaComponent } from './article-cta';
import { applyContentSeo } from './content-seo';
import { ArticleEnteteComponent } from './article-entete';

/**
 * Landing transactionnelle : générateur de nom de produit.
 *
 * C'est l'intention qui amène déjà le trafic Google (« nom de produit »), sans
 * page dédiée jusqu'ici : la home visait « nom de marque » et le guide
 * /guides/trouver-nom-de-produit couvre l'intention informationnelle
 * (« comment faire »). Celle-ci vise l'intention outil (« générateur »), pour
 * éviter que les deux pages se cannibalisent.
 */
@Component({
  selector: 'app-generateur-nom-produit',
  standalone: true,
  imports: [ArticleEnteteComponent, TroisRisquesComponent, RouterModule, ArticleCtaComponent],
  template: `
    <article class="article">
      <app-article-entete>
        <h1>Générateur de nom de produit</h1>
      </app-article-entete>
      <p class="lead">
        Vous lancez un produit et il vous faut un nom&nbsp;: mémorable, prononçable, et surtout
        <strong>dont le domaine est encore libre</strong>. Décrivez votre produit en une phrase&nbsp;:
        l'IA analyse les noms déjà utilisés dans votre secteur, génère des propositions originales
        et <strong>vérifie chaque domaine en direct par une requête Whois réelle</strong>
        (<code>.com</code>, <code>.fr</code>, <code>.io</code>…).
      </p>

      <h2 id="difficulte">Pourquoi nommer un produit est plus dur qu'il n'y paraît</h2>
      <p>
        Le problème n'est presque jamais la créativité&nbsp;: c'est la disponibilité. Les noms
        «&nbsp;évidents&nbsp;» de votre marché sont pris depuis longtemps, et on s'en aperçoit
        seulement après s'y être attaché. D'où l'ordre de travail inversé que nous recommandons&nbsp;:
        <strong>vérifier avant de tomber amoureux d'un nom</strong>.
      </p>
      <p>
        Nos mesures donnent l'ampleur du phénomène. Sur des noms prononçables tirés au sort et testés
        au Whois&nbsp;: <strong>environ 83&nbsp;% des <code>.com</code> de 5&nbsp;caractères sont déjà
        déposés</strong>, contre à peu près 34&nbsp;% en 6&nbsp;caractères, et moins de 3&nbsp;% en
        7&nbsp;caractères. Viser très court, c'est donc accepter de chercher beaucoup plus longtemps —
        un arbitrage qu'il vaut mieux faire en connaissance de cause.
      </p>

      <h2 id="types">Trois familles de noms de produit</h2>
      <ul>
        <li>
          <strong>Descriptif</strong> — il dit ce que fait le produit (<em>Compta&nbsp;Facile</em>).
          Compris immédiatement, mais difficile à protéger juridiquement, banal, et presque toujours
          déjà pris en domaine.
        </li>
        <li>
          <strong>Évocateur</strong> — il suggère un bénéfice ou une image sans le décrire
          (<em>Slack</em>, <em>Stripe</em>). Le meilleur compromis dans la plupart des cas&nbsp;:
          distinctif, protégeable, et il laisse le produit évoluer.
        </li>
        <li>
          <strong>Inventé</strong> — un mot qui n'existait pas (<em>Qonto</em>, <em>Notion</em>).
          Disponibilité maximale et marque très solide, mais il faut un budget de communication pour
          lui donner du sens.
        </li>
      </ul>

      <h2 id="produit-vs-marque">Nommer un produit ou nommer une marque&nbsp;?</h2>
      <p>
        La question est rarement posée, et elle change tout. Nommer une entreprise engage pour dix ans
        et doit couvrir une activité qui va évoluer. <strong>Nommer un produit engage moins, mais doit
        porter plus</strong>&nbsp;: le nom doit vendre un bénéfice précis, à un public précis, souvent
        face à des concurrents directs sur une même étagère ou une même page de résultats.
      </p>
      <p>
        Trois architectures possibles, à choisir avant de chercher des mots&nbsp;:
      </p>
      <ul>
        <li>
          <strong>Marque unique</strong> — le produit porte le nom de l'entreprise, éventuellement suivi
          d'un descriptif (<em>Google Agenda</em>, <em>Apple Watch</em>). Simple, capitalise sur la
          notoriété existante, mais chaque produit engage la marque entière.
        </li>
        <li>
          <strong>Marque endossée</strong> — le produit a son nom propre, adossé à celui de la maison
          (<em>Nespresso by Nestlé</em>). Le meilleur des deux mondes, au prix d'une communication plus
          lourde.
        </li>
        <li>
          <strong>Produit autonome</strong> — le nom vit seul, sans lien visible avec l'entreprise. C'est
          la voie obligée quand vous visez des publics très différents, ou quand vous préparez une revente.
        </li>
      </ul>
      <p>
        Si vous lancez votre premier produit, la question est en général tranchée d'avance&nbsp;: le nom
        du produit <em>est</em> la marque. Dans ce cas, appliquez les exigences les plus strictes, celles
        d'un nom d'entreprise — voyez notre
        <a routerLink="/guides/trouver-nom-de-marque">guide du nom de marque</a>.
      </p>

      <h2 id="criteres">Les critères qui comptent vraiment</h2>
      <ul>
        <li><strong>Le test de la radio</strong>&nbsp;: entendu une fois, il doit s'écrire sans hésitation.
          Si vous devez l'épeler au téléphone, il vous coûtera cher pendant des années.</li>
        <li><strong>Deux à trois syllabes</strong>&nbsp;: assez court pour être retenu, assez long pour
          rester disponible.</li>
        <li><strong>Pas d'enfermement</strong>&nbsp;: un nom trop collé à votre première fonctionnalité
          devient un boulet quand la gamme s'élargit.</li>
        <li><strong>Vérifié sur trois plans</strong>&nbsp;: le domaine (Whois), la marque
          (<a href="https://data.inpi.fr" target="_blank" rel="noopener noreferrer">INPI</a> dans votre
          classe), et les pseudos réseaux sociaux.</li>
        <li><strong>Sans faux ami à l'international</strong> si vous visez plusieurs marchés.</li>
      </ul>

      <app-trois-risques intro="Avant de faire fabriquer un emballage, trois contrôles — le dernier est celui qui coûte le plus cher à rattraper."></app-trois-risques>

      <app-article-cta
        heading="Trouvez le nom de votre produit"
        subheading="Décrivez votre produit, l'IA propose des noms originaux et vérifie le domaine en direct — pas une estimation, une vraie requête Whois."
      ></app-article-cta>

      <h2 id="difference">Ce que fait Namorama que les autres générateurs ne font pas</h2>
      <p>
        La plupart des générateurs de noms produisent des listes séduisantes… dont une large part est
        déjà déposée. Vous découvrez le problème au moment d'acheter le domaine. Deux différences ici&nbsp;:
      </p>
      <ul>
        <li>
          <strong>La disponibilité est réelle, pas estimée.</strong> Chaque nom proposé est testé par une
          requête Whois au moment de la recherche. Un domaine affiché comme libre est réellement
          enregistrable.
        </li>
        <li>
          <strong>Votre marché est analysé avant de générer.</strong> Namorama identifie les produits
          existants de votre secteur et leurs noms&nbsp;: vous dites lesquels vous plaisent ou non, et la
          génération s'en sert pour s'en inspirer — ou s'en démarquer.
        </li>
      </ul>

      <h2 id="methode">La méthode, en trois étapes</h2>
      <ol>
        <li><strong>Décrivez votre produit</strong> en une phrase&nbsp;: ce qu'il fait, pour qui, avec quel
          ton. C'est la matière première de la génération.</li>
        <li><strong>Cadrez</strong>&nbsp;: gardez les noms du marché qui vous inspirent, écartez ceux dont
          le style vous déplaît, ajustez mots-clés, public cible et longueur minimale.</li>
        <li><strong>Choisissez</strong> parmi les noms dont le domaine est libre, comparez les extensions
          dans le tableau, et réservez celui qui vous plaît chez votre registrar.</li>
      </ol>

      <h2 id="secteurs">Les codes changent selon le secteur</h2>
      <p>
        Un nom qui fonctionne pour un logiciel B2B sonnerait faux sur un pot de crème. Quelques repères
        observés sur les marchés que nos utilisateurs ciblent le plus&nbsp;:
      </p>
      <ul>
        <li>
          <strong>Logiciel et SaaS</strong> — court, prononçable à l'anglaise, souvent un mot inventé ou
          un verbe détourné. Les suffixes <code>-flow</code>, <code>-ops</code>, <code>-hub</code>
          fonctionnent, mais sont devenus si courants qu'ils vous font ressembler à tout le monde.
          Extension <code>.com</code> ou <code>.io</code>.
          Voir <a routerLink="/generateur-nom-saas">le générateur dédié au SaaS</a>.
        </li>
        <li>
          <strong>E-commerce et produits physiques</strong> — la lisibilité prime, parce que le nom sera
          lu sur un emballage et tapé de mémoire. Les noms composés de deux mots courants marchent bien.
          Voir <a routerLink="/generateur-nom-ecommerce">le générateur pour boutique en ligne</a>.
        </li>
        <li>
          <strong>Cosmétique et bien-être</strong> — sonorités douces, voyelles ouvertes, références
          naturelles ou latines. Le nom doit être agréable à prononcer, presque à murmurer.
          Voir <a routerLink="/generateur-nom-marque-cosmetique">le générateur cosmétique</a>.
        </li>
        <li>
          <strong>Application mobile</strong> — contrainte spécifique&nbsp;: le nom doit rester lisible
          sous une icône, donc très court, et être trouvable dans un moteur de recherche d'app saturé.
        </li>
      </ul>

      <h2 id="faq">Questions fréquentes</h2>
      <h3>Comment trouver un nom de produit original&nbsp;?</h3>
      <p>
        En partant de ce qui existe déjà, pour vous en écarter délibérément. La plupart des noms
        « originaux » trouvés seul ressemblent en fait beaucoup à ceux du marché, parce qu'on puise dans
        le même vocabulaire. Namorama identifie d'abord les noms utilisés dans votre secteur, puis génère
        en s'en démarquant explicitement.
      </p>
      <h3>Le nom de mon produit doit-il contenir un mot-clé pour le référencement&nbsp;?</h3>
      <p>
        Non. C'était vrai il y a quinze ans, ça ne l'est plus&nbsp;: Google ne privilégie plus les noms de
        domaine à mots-clés exacts, et un nom générique vous rend impossible à distinguer de vos
        concurrents. Mieux vaut un nom distinctif que vous pourrez faire connaître, et travailler le
        référencement dans le contenu.
      </p>
      <h3>Combien de temps faut-il pour trouver un nom de produit&nbsp;?</h3>
      <p>
        En procédant à la main, comptez plusieurs jours, dont l'essentiel passé à découvrir que les noms
        trouvés sont déjà pris. En générant et vérifiant simultanément, une séance de vingt minutes suffit
        généralement à obtenir une liste de dix candidats réellement disponibles.
      </p>
      <h3>Que faire si tous les noms qui me plaisent sont pris&nbsp;?</h3>
      <p>
        Trois leviers, dans cet ordre&nbsp;: allonger d'un ou deux caractères, ce qui change tout&nbsp;;
        passer d'un nom descriptif à un nom inventé&nbsp;; élargir aux extensions pertinentes
        (<code>.fr</code>, <code>.io</code>) plutôt que de vous acharner sur le <code>.com</code>.
        Éviter en revanche les orthographes déformées, qui vous coûteront à chaque conversation.
      </p>
      <h3>Puis-je déposer un nom de produit comme marque&nbsp;?</h3>
      <p>
        Oui, si le signe est distinctif et libre de droits antérieurs dans votre classe d'activité. Un
        nom inventé se protège beaucoup mieux qu'un nom descriptif. Vérifiez l'antériorité auprès de
        l'INPI avant tout engagement, et faites-vous accompagner pour le dépôt lui-même.
      </p>

      <h2 id="suite">Pour aller plus loin</h2>
      <ul>
        <li><a routerLink="/guides/trouver-nom-de-produit">Guide&nbsp;: comment trouver un nom de produit qui marque les esprits</a></li>
        <li><a routerLink="/generateur-nom-saas">Générateur de nom pour SaaS / logiciel B2B</a></li>
        <li><a routerLink="/generateur-nom-ecommerce">Générateur de nom pour boutique en ligne</a></li>
        <li><a routerLink="/nom-de-startup-court-invente">Noms courts et inventés, façon Qonto ou Stripe</a></li>
        <li><a routerLink="/comparatif-generateurs-de-noms">Comparatif des générateurs de noms</a></li>
      </ul>
    </article>
  `,
})
export class GenerateurNomProduitComponent {
  constructor() {
    applyContentSeo({
      title: 'Générateur de nom de produit',
      description:
        "Trouvez un nom de produit original dont le domaine est libre : l'IA analyse votre marché, génère des idées et vérifie chaque domaine par Whois réel.",
      path: '/generateur-nom-de-produit',
    });
  }
}
