import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TroisRisquesComponent } from './trois-risques';
import { ArticleCtaComponent } from './article-cta';
import { applyContentSeo } from './content-seo';
import { ArticleEnteteComponent } from './article-entete';

/**
 * Guide : trouver un nom d'entreprise (société). Page prérendue (SSG) ciblant
 * « trouver un nom d'entreprise », « nom de société », « idée de nom de boîte ».
 */
@Component({
  selector: 'app-guide-nom-entreprise',
  standalone: true,
  imports: [ArticleEnteteComponent, TroisRisquesComponent, RouterModule, ArticleCtaComponent],
  template: `
    <article class="article">
      <app-article-entete>
        <h1>Comment trouver un nom d'entreprise (et sécuriser le domaine) ?</h1>
      </app-article-entete>
      <p class="lead">
        Le nom de votre entreprise vous suivra des années : sur vos factures, votre site,
        vos cartes de visite, au registre du commerce. Il doit être disponible
        <strong>juridiquement</strong> (INPI, RCS) <strong>et numériquement</strong> (nom de domaine,
        réseaux sociaux). Voici comment trouver un nom solide sans repartir de zéro trois fois.
      </p>

      <h2 id="criteres">Les 5 critères d'un bon nom d'entreprise</h2>
      <ul>
        <li><strong>Mémorable et prononçable</strong> : on doit pouvoir le dicter au téléphone sans l'épeler.</li>
        <li><strong>Disponible en domaine</strong> : idéalement le <code>.com</code> ou le <code>.fr</code>, pas seulement une extension de repli.</li>
        <li><strong>Libre au registre</strong> : vérifiez l'antériorité des marques sur la base INPI avant de vous attacher à un nom.</li>
        <li><strong>Évolutif</strong> : un nom trop descriptif (« Plomberie Dupont Marseille ») vous enferme si vous changez de métier ou de ville.</li>
        <li><strong>Sans ambiguïté à l'international</strong> : vérifiez qu'il ne signifie rien de gênant dans les langues de vos futurs marchés.</li>
      </ul>

      <h2 id="methode">Une méthode en 4 temps</h2>
      <p>
        <strong>1. Listez votre ADN.</strong> Activité, valeurs, promesse client, ton (sérieux, joueur,
        premium…). Ces mots-clés sont la matière première du nom.
      </p>
      <p>
        <strong>2. Générez large.</strong> Mots inventés, contractions, métaphores, préfixes/suffixes.
        Il faut produire beaucoup pour garder peu : c'est exactement le travail que
        <a routerLink="/app">l'IA de Namorama</a> abat en quelques secondes à partir de votre description.
      </p>
      <p>
        <strong>3. Filtrez par disponibilité.</strong> Un nom génial dont le <code>.com</code> est pris
        et coûte 5&nbsp;000&nbsp;€ n'est pas un nom disponible. Namorama teste la disponibilité réelle du
        domaine (requête Whois) pour chaque proposition, vous ne tombez jamais amoureux d'un nom mort-né.
      </p>
      <p>
        <strong>4. Vérifiez l'antériorité.</strong> Avant de déposer, contrôlez la base
        <a href="https://data.inpi.fr" target="_blank" rel="noopener">INPI</a> et faites une recherche
        de marque. C'est l'étape que personne ne doit sauter.
      </p>

      <app-trois-risques intro="Le nom d'une entreprise l'accompagne des années. Trois contrôles la protègent, et sauter les deux derniers coûte bien plus cher que le premier."></app-trois-risques>

      <app-article-cta
        heading="Trouvez le nom de votre entreprise"
        subheading="Décrivez votre activité, l'IA propose des noms et vérifie la disponibilité du domaine en direct."
      ></app-article-cta>

      <h2 id="trois-noms">Dénomination, nom commercial, marque : trois choses différentes</h2>
      <p>
        C'est la confusion la plus fréquente, et celle qui coûte le plus cher quand on s'en aperçoit tard. Une
        entreprise peut porter trois noms distincts, qui ne se protègent pas de la même façon.
      </p>
      <ul>
        <li>
          <strong>La dénomination sociale</strong> — le nom juridique inscrit dans vos statuts et au registre
          du commerce. Il figure sur vos factures et vos contrats. Son unicité n'est vérifiée que faiblement.
        </li>
        <li>
          <strong>Le nom commercial</strong> — celui sous lequel vous vous faites connaître, qui peut être
          différent. C'est celui qu'on voit sur la devanture ou le site.
        </li>
        <li>
          <strong>La marque</strong> — un titre de propriété industrielle, déposé à l'INPI pour des classes
          d'activité précises. C'est le <strong>seul</strong> des trois qui vous permet d'interdire à un tiers
          d'utiliser votre nom.
        </li>
      </ul>
      <p>
        Autrement dit&nbsp;: immatriculer votre société ne protège pas votre nom. Beaucoup de fondateurs
        découvrent l'année suivante qu'un concurrent a déposé la marque correspondante — et qu'il est en
        position de leur demander d'en changer.
      </p>

      <h2 id="verifications">Les quatre vérifications à faire, dans l'ordre</h2>
      <ol>
        <li>
          <strong>Le domaine</strong>, en premier, parce que c'est ce qui part le plus vite et que ça coûte une
          dizaine d'euros. Vérifié réellement, pas estimé.
        </li>
        <li>
          <strong>L'antériorité de marque</strong> sur la base
          <a href="https://data.inpi.fr" target="_blank" rel="noopener noreferrer">INPI</a>, dans les classes
          que vous visez. Un nom identique dans une classe sans rapport avec la vôtre n'est pas forcément
          bloquant&nbsp;; un nom proche dans votre classe l'est.
        </li>
        <li>
          <strong>Le registre du commerce</strong>, pour repérer une société homonyme dans votre secteur ou
          votre région — source de confusion commerciale même sans conflit juridique.
        </li>
        <li>
          <strong>Les pseudos sociaux</strong>, à réserver le jour où vous prenez le domaine. C'est gratuit, et
          récupérer un pseudo occupé est quasiment impossible.
        </li>
      </ol>
      <p>
        Pour un projet qui engage réellement, faites confirmer la recherche d'antériorité par un conseil en
        propriété industrielle avant de déposer&nbsp;: une recherche à l'identique ne suffit pas, ce sont les
        similitudes qui posent problème.
      </p>

      <h2 id="erreurs">Les erreurs classiques à éviter</h2>
      <p>
        Choisir un nom impossible à orthographier, copier un concurrent à une lettre près, négliger le
        domaine jusqu'au dernier moment, ou s'attacher émotionnellement à un nom avant d'avoir vérifié
        sa disponibilité. La bonne séquence est toujours&nbsp;: <em>idées → disponibilité domaine →
        antériorité marque → décision</em>.
      </p>

      <h2 id="faq">Questions fréquentes</h2>
      <h3>Puis-je utiliser un nom déjà immatriculé par une autre société&nbsp;?</h3>
      <p>
        Parfois, si les activités et les zones géographiques n'ont rien à voir — mais c'est un terrain
        glissant, et la marque prime sur l'immatriculation. Si le nom est déposé comme marque dans votre classe
        d'activité, vous vous exposez à une action en contrefaçon, même sans intention de nuire.
      </p>
      <h3>Faut-il déposer la marque dès la création&nbsp;?</h3>
      <p>
        Pas nécessairement. Réservez le domaine immédiatement et vérifiez l'antériorité dès le départ&nbsp;;
        le dépôt lui-même, qui représente plusieurs centaines d'euros et couvre dix ans, a surtout du sens une
        fois le projet confirmé et le nom stabilisé.
      </p>
      <h3>Le nom de l'entreprise doit-il être celui du site&nbsp;?</h3>
      <p>
        C'est nettement plus simple, et c'est ce qui est attendu. Un écart entre les deux se paie en
        mémorisation et en confiance à chaque contact. Réservez au minimum le domaine correspondant à votre nom
        commercial, même si votre dénomination sociale diffère.
      </p>
      <h3>Peut-on changer de nom d'entreprise plus tard&nbsp;?</h3>
      <p>
        Oui, mais c'est lourd&nbsp;: modification des statuts, formalités au registre, refonte des supports,
        redirections du site, perte d'une partie de la notoriété et des liens accumulés. C'est précisément
        pourquoi il vaut la peine de vérifier la disponibilité avant de s'attacher à un nom, pas après.
      </p>

      <h2 id="suite">Pour aller plus loin</h2>
      <p>
        Selon votre projet, ces guides complètent celui-ci&nbsp;:
      </p>
      <ul>
        <li><a routerLink="/generateur-nom-entreprise">Générateur de nom d'entreprise et de société</a></li>
        <li><a routerLink="/recherche-anteriorite-marque-inpi">Recherche d'antériorité de marque (INPI)</a></li>
        <li><a routerLink="/guides/trouver-nom-de-marque">Trouver un nom de marque disponible</a></li>
        <li><a routerLink="/guides/trouver-nom-de-startup">Trouver un nom de startup</a></li>
        <li><a routerLink="/guides/trouver-nom-de-produit">Trouver un nom de produit</a></li>
      </ul>
    </article>
  `,
})
export class GuideNomEntrepriseComponent {
  constructor() {
    applyContentSeo({
      title: "Comment trouver un nom d'entreprise disponible",
      description:
        "La méthode pour trouver un nom d'entreprise mémorable, libre au registre (INPI/RCS) et dont le domaine est vérifié disponible en direct.",
      path: '/guides/trouver-nom-entreprise',
    });
  }
}
