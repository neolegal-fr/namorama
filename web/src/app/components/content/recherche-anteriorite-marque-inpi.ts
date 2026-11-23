import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TroisRisquesComponent } from './trois-risques';
import { ArticleCtaComponent } from './article-cta';
import { applyContentSeo } from './content-seo';
import { ArticleEnteteComponent } from './article-entete';

/**
 * « Recherche d'antériorité » / « nom de marque disponible INPI ».
 *
 * Tout un pan de recherches françaises tourne autour de l'INPI — « nom de
 * marque disponible inpi », « vérifier la disponibilité d'un nom d'entreprise
 * inpi », « recherche antériorité marque gratuit ». Le produit interroge
 * réellement l'INPI et l'EUIPO dans son rapport de marque, mais rien ne le
 * disait sur une page dédiée.
 *
 * Ligne éditoriale imposée : ne JAMAIS laisser croire que notre signal
 * remplace une recherche d'antériorité complète ou un conseil en propriété
 * industrielle. La page dit ce qu'elle couvre et, tout aussi explicitement, ce
 * qu'elle ne couvre pas.
 */
@Component({
  selector: 'app-recherche-anteriorite-marque-inpi',
  standalone: true,
  imports: [ArticleEnteteComponent, TroisRisquesComponent, RouterModule, ArticleCtaComponent],
  template: `
    <article class="article">
      <app-article-entete>
        <h1>Recherche d'antériorité&nbsp;: vérifier si un nom est disponible à l'INPI</h1>
      </app-article-entete>
      <p class="lead">
        Avant de déposer une marque — et avant même d'imprimer quoi que ce soit — une question tranche tout&nbsp;:
        <strong>quelqu'un a-t-il déjà déposé ce nom pour votre activité&nbsp;?</strong> Voici comment le
        vérifier, ce que la recherche gratuite couvre réellement, et où elle s'arrête.
      </p>

      <h2 id="pourquoi">L'INPI ne vérifie pas à votre place</h2>
      <p>
        C'est le point que presque personne ne sait, et il explique la plupart des mauvaises surprises&nbsp;:
        lors d'un dépôt, <strong>l'INPI ne recherche pas les antériorités</strong>. Il contrôle la forme et
        les motifs absolus de refus (un nom purement descriptif, trompeur, contraire à l'ordre public), puis
        publie votre demande. Un nom déjà déposé par un tiers peut donc être enregistré à votre nom sans
        qu'aucun signal ne s'allume.
      </p>
      <p>
        Le contrôle vient <em>après</em>, et il vient du titulaire antérieur&nbsp;: publication au bulletin
        officiel, puis <strong>délai d'opposition de deux mois</strong> pendant lequel il peut faire barrage.
        S'il ne voit rien passer, l'affaire peut ressurgir des années plus tard, en action en contrefaçon —
        typiquement au moment où votre projet devient visible, c'est-à-dire quand il commence enfin à marcher.
        La recherche d'antériorité est donc entièrement à votre charge.
      </p>

      <h2 id="comment">Comment faire une recherche d'antériorité gratuite</h2>
      <ol>
        <li>
          <strong>Identifiez vos classes.</strong> Une marque n'est jamais protégée «&nbsp;en général&nbsp;»&nbsp;:
          elle l'est pour des produits et services précis, répartis en 45 classes (classification de Nice).
          Un même nom peut appartenir à deux titulaires différents en classe 25 (vêtements) et en classe 42
          (services informatiques). Commencez par savoir dans quelles classes vous exercez&nbsp;: tout le
          reste en dépend.
        </li>
        <li>
          <strong>Cherchez à l'identique</strong> dans la base des marques de l'INPI, gratuite et ouverte à
          tous. C'est la vérification minimale&nbsp;: elle écarte les noms manifestement pris.
        </li>
        <li>
          <strong>Élargissez à l'Europe.</strong> Une marque de l'Union européenne déposée à l'EUIPO produit
          ses effets en France&nbsp;: une recherche limitée à l'INPI laisse un angle mort entier.
        </li>
        <li>
          <strong>Cherchez les similarités, pas seulement les identités.</strong> C'est l'étape que la
          recherche gratuite ne fait pas, et c'est là que se joue le risque réel&nbsp;: le droit des marques
          sanctionne le <em>risque de confusion</em>, pas la copie littérale. Un nom qui se prononce comme un
          autre, ou qui n'en diffère que d'une lettre, peut suffire.
        </li>
        <li>
          <strong>Vérifiez au-delà des marques.</strong> Une dénomination sociale, un nom commercial, un nom
          de domaine antérieur ou un nom notoire peuvent aussi être opposés.
        </li>
      </ol>

      <h2 id="namorama">Ce que Namorama vérifie, et ce qu'il ne vérifie pas</h2>
      <p>
        Le <strong>rapport de marque</strong> de Namorama interroge les bases officielles
        <strong>INPI (France)</strong> et <strong>EUIPO (Union européenne)</strong>, et signale les dépôts
        identiques ou proches avec leurs <strong>classes de Nice</strong>. Il regroupe cela avec la
        disponibilité du nom de domaine et celle des pseudos sur les réseaux sociaux, dans un document unique
        que vous pouvez archiver ou transmettre à un associé.
      </p>
      <p>
        C'est un <strong>signal de disponibilité</strong>, destiné à écarter très tôt les noms manifestement
        pris et à concentrer votre attention — et votre budget — sur deux ou trois finalistes. Ce n'est
        <strong>ni une recherche d'antériorité complète</strong> (elle couvrirait systématiquement les
        similarités phonétiques, visuelles et intellectuelles, les marques semi-figuratives, les
        dénominations sociales), <strong>ni un avis juridique</strong>. Pour un dépôt qui engage votre
        activité, appuyez-vous sur la recherche officielle de l'INPI et, au moindre doute, sur un
        <strong>conseil en propriété industrielle</strong>&nbsp;: quelques centaines d'euros d'analyse
        évitent le seul incident vraiment coûteux du naming — devoir changer de nom une fois lancé.
      </p>

      <app-article-cta
        heading="Vérifiez un nom avant de le déposer"
        subheading="Domaine, réseaux sociaux et marques INPI + EUIPO avec leurs classes, dans un seul rapport."
        label="Vérifier un nom"></app-article-cta>

      <h2 id="quand">Au bon moment&nbsp;: avant le logo, pas après</h2>
      <p>
        L'ordre dans lequel on fait les choses coûte plus cher que les choses elles-mêmes. La séquence qui
        épargne le plus d'argent est contre-intuitive&nbsp;:
      </p>
      <ol>
        <li>Générer des noms et écarter ceux dont le <strong>domaine</strong> est pris — quelques minutes, gratuit.</li>
        <li>Passer les survivants à la <strong>recherche de marque</strong> dans vos classes — quelques minutes.</li>
        <li>Réserver le domaine et le pseudo social du finaliste — une dizaine d'euros.</li>
        <li><em>Ensuite seulement</em>&nbsp;: logo, charte, cartes, enseigne, dépôt de marque.</li>
      </ol>
      <p>
        L'erreur classique consiste à inverser les étapes 2 et 4. On s'attache au nom, on commande l'identité
        visuelle, et on découvre l'antériorité au moment du dépôt — quand le renoncement coûte non plus une
        recherche, mais tout ce qui a été construit autour.
      </p>

      <app-trois-risques intro="La marque déposée est le troisième contrôle, le moins visible, et le seul dont l'échec vous fait changer de nom."></app-trois-risques>

      <h2 id="faq">Questions fréquentes</h2>
      <h3>La recherche d'antériorité est-elle obligatoire&nbsp;?</h3>
      <p>
        Non, aucun texte ne l'impose, et c'est précisément le piège&nbsp;: rien ne vous arrêtera au moment du
        dépôt. Elle est en revanche indispensable en pratique, puisque l'INPI ne la fait pas pour vous et que
        la sanction, elle, arrive plus tard.
      </p>
      <h3>Une marque identique peut-elle coexister avec la mienne&nbsp;?</h3>
      <p>
        Oui, si les produits et services sont suffisamment éloignés pour qu'aucune confusion ne soit possible
        dans l'esprit du public. C'est pour cela que les classes comptent autant que le nom&nbsp;: un même mot
        peut légitimement désigner un logiciel et une marque de chaussures. La limite s'apprécie au cas par
        cas, et les marques notoires bénéficient d'une protection plus large.
      </p>
      <h3>Le nom de mon entreprise est-il protégé automatiquement&nbsp;?</h3>
      <p>
        Non. Immatriculer une société ne protège pas son nom comme marque&nbsp;: la dénomination sociale et le
        nom commercial offrent une protection étroite, limitée à votre secteur et à votre zone d'activité.
        Seul le dépôt de marque donne un monopole d'exploitation.
      </p>
      <h3>Combien de temps la marque est-elle protégée&nbsp;?</h3>
      <p>
        Dix ans, indéfiniment renouvelables. Une marque non renouvelée retombe dans le domaine
        disponible&nbsp;: c'est aussi pourquoi une antériorité repérée mérite d'être regardée de près — elle
        peut être expirée, ou déchue faute d'exploitation.
      </p>
      <h3>Puis-je déposer une marque moi-même&nbsp;?</h3>
      <p>
        Oui, le dépôt en ligne est accessible à tous et se fait en une trentaine de minutes. La difficulté
        n'est pas le formulaire, elle est en amont&nbsp;: choisir les bonnes classes et rédiger le libellé des
        produits et services. Un libellé trop étroit laisse des trous&nbsp;; un libellé trop large expose à
        l'opposition et, à terme, à la déchéance pour non-usage.
      </p>

      <h2 id="suite">À lire aussi</h2>
      <ul>
        <li><a routerLink="/verifier-disponibilite-nom-de-marque">Vérifier la disponibilité d'un nom de marque</a></li>
        <li><a routerLink="/generateur-nom-de-marque">Générateur de nom de marque</a></li>
        <li><a routerLink="/generateur-nom-entreprise">Générateur de nom d'entreprise et de société</a></li>
        <li><a routerLink="/generateur-nom-marque-vetement">Nom de marque de vêtements (classe 25)</a></li>
      </ul>
    </article>
  `,
})
export class RechercheAnterioriteMarqueInpiComponent {
  constructor() {
    applyContentSeo({
      title: "Recherche d'antériorité de marque à l'INPI",
      description:
        "Vérifier si un nom de marque est disponible à l'INPI : classes de Nice, recherche gratuite à l'identique, limites, et pourquoi l'INPI ne vérifie pas pour vous.",
      path: '/recherche-anteriorite-marque-inpi',
    });
  }
}
