import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TroisRisquesComponent } from './trois-risques';
import { ArticleCtaComponent } from './article-cta';
import { applyContentSeo } from './content-seo';
import { ArticleEnteteComponent } from './article-entete';

/**
 * « Générateur de nom d'entreprise » — et surtout de SOCIÉTÉ.
 *
 * Le site disait « entreprise » partout et « société » nulle part, alors que
 * les deux mots portent des recherches distinctes et de volume comparable
 * (« générateur de nom de société », « trouver un nom de société non
 * utilisé », « nom de société disponible »). Ce n'est pas un synonyme à
 * saupoudrer : c'est un vocabulaire entier qui manquait.
 *
 * Distinct de /guides/trouver-nom-entreprise, qui donne la MÉTHODE. Ici,
 * l'intention est l'OUTIL — d'où le formulaire mis en avant et les questions
 * qui l'entourent (gratuit, IA, disponibilité au registre).
 */
@Component({
  selector: 'app-generateur-nom-entreprise',
  standalone: true,
  imports: [ArticleEnteteComponent, TroisRisquesComponent, RouterModule, ArticleCtaComponent],
  template: `
    <article class="article">
      <app-article-entete>
        <h1>Générateur de nom d'entreprise et de société</h1>
      </app-article-entete>
      <p class="lead">
        Vous créez une société, une micro-entreprise ou une activité artisanale&nbsp;? Décrivez ce que vous
        faites, et l'IA propose des <strong>noms d'entreprise</strong> disponibles, avec le
        <strong>nom de domaine vérifié en direct</strong> auprès du registre (<code>.fr</code>,
        <code>.com</code>). Gratuit à l'essai, sans inscription, <strong>100 crédits offerts</strong> ensuite.
      </p>

      <app-article-cta
        heading="Trouvez le nom de votre entreprise"
        subheading="Décrivez votre activité en une phrase. L'IA génère, le registre confirme que le domaine est libre."></app-article-cta>

      <h2 id="trois-noms">Trois noms différents, qu'on confond tout le temps</h2>
      <p>
        Avant de générer quoi que ce soit, il faut savoir lequel des trois vous cherchez — ils n'obéissent pas
        aux mêmes règles et ne se vérifient pas au même endroit.
      </p>
      <ul>
        <li>
          <strong>La dénomination sociale</strong> — le nom juridique de la société, celui des statuts et du
          Kbis. Il peut être parfaitement austère&nbsp;: personne ne le lit à part votre banque et
          l'administration.
        </li>
        <li>
          <strong>Le nom commercial</strong> — celui de l'enseigne, du site, de la facture. C'est celui que vos
          clients retiennent, et c'est presque toujours celui qu'on cherche ici. Un
          <strong>auto-entrepreneur</strong> peut en déclarer un&nbsp;: il n'est pas obligé de commercer sous
          son nom de famille.
        </li>
        <li>
          <strong>La marque</strong> — la seule des trois qui donne un <em>monopole</em>, et seulement si elle
          est déposée. Immatriculer une société ne protège pas son nom&nbsp;; c'est l'erreur la plus coûteuse
          et la plus répandue.
        </li>
      </ul>
      <p>
        Les trois peuvent être identiques, et c'est souvent le plus simple. Mais ce n'est pas obligatoire, et
        se sentir contraint d'aligner les trois fait renoncer à de bons noms sans raison.
      </p>

      <h2 id="disponible">«&nbsp;Nom de société disponible&nbsp;»&nbsp;: disponible où&nbsp;?</h2>
      <p>
        Un nom d'entreprise ne se vérifie pas à un seul guichet, et c'est ce qui rend la recherche pénible.
        Quatre endroits, dans l'ordre de ce que ça coûte de se tromper&nbsp;:
      </p>
      <ol>
        <li>
          <strong>Le nom de domaine.</strong> Immédiat, binaire, et le seul que vous pouvez sécuriser dans
          l'heure pour une dizaine d'euros. C'est ce que Namorama vérifie pour chaque nom proposé, par
          interrogation réelle du registre — jamais par estimation.
        </li>
        <li>
          <strong>Le registre du commerce.</strong> Une dénomination déjà employée par une société du même
          secteur vous expose à une action en concurrence déloyale, même sans marque déposée.
        </li>
        <li>
          <strong>Les marques déposées.</strong> C'est là que se joue le risque juridique réel&nbsp;:
          <a routerLink="/recherche-anteriorite-marque-inpi">la base de l'INPI</a> (et l'EUIPO à l'échelle
          européenne) dit si quelqu'un détient déjà ce nom dans vos classes de produits ou de services.
        </li>
        <li>
          <strong>Les réseaux sociaux.</strong> Le moins grave, le plus irréversible&nbsp;: aucune plateforme
          ne libère un pseudo inactif.
        </li>
      </ol>

      <app-trois-risques intro="Créer une société ne protège pas son nom. Voici les trois contrôles qui, eux, engagent vraiment."></app-trois-risques>

      <h2 id="artisan">Artisans et services&nbsp;: le piège du nom trop descriptif</h2>
      <p>
        Nettoyage, espaces verts, transport, bâtiment, onglerie, services à la personne&nbsp;: dans ces
        métiers, le réflexe est de nommer l'activité — «&nbsp;Propreté Plus&nbsp;», «&nbsp;Jardin
        Services&nbsp;». C'est compréhensible, et cela pose trois problèmes concrets.
      </p>
      <ul>
        <li>
          <strong>Un nom descriptif se protège mal.</strong> L'INPI refuse ou fragilise les marques qui se
          contentent de décrire le produit&nbsp;: elles manquent de caractère distinctif. Vous ne pourrez pas
          empêcher le concurrent d'en face de s'appeler presque pareil.
        </li>
        <li>
          <strong>Il est déjà pris, partout.</strong> Ces combinaisons sont les premières épuisées&nbsp;:
          domaine déposé depuis quinze ans, dix entreprises homonymes dans dix départements.
        </li>
        <li>
          <strong>Il vous enferme.</strong> Une entreprise de nettoyage qui ajoute la remise en état, puis le
          multiservice, traîne un nom qui ment sur la moitié de son offre.
        </li>
      </ul>
      <p>
        La formule qui fonctionne le mieux tient en deux temps&nbsp;: un nom distinctif (inventé, un patronyme,
        un mot évocateur) et une baseline qui, elle, décrit l'activité et se change sans rien casser. Le
        référencement local se joue de toute façon sur votre fiche établissement et vos pages, pas sur les
        mots contenus dans votre raison sociale.
      </p>

      <h2 id="ia">Générer avec l'IA plutôt qu'avec ChatGPT seul</h2>
      <p>
        Un modèle de langage généraliste produit volontiers trente noms d'entreprise en dix secondes. Le
        problème est qu'il ne peut pas savoir s'ils sont libres&nbsp;: il n'interroge aucun registre, et son
        entraînement est daté. En pratique, il propose massivement des noms déposés depuis des années — et il
        les propose avec aplomb.
      </p>
      <p>
        Namorama fait les deux moitiés du travail&nbsp;: la génération, puis la <strong>vérification réelle</strong>
        de chaque candidat (pré-filtre DNS, puis RDAP du registre, repli Whois). Ce qui n'a pas pu être
        vérifié est marqué «&nbsp;non vérifiable&nbsp;» plutôt que présenté comme libre. C'est un détail
        d'affichage qui vous évite d'aller jusqu'au registrar pour découvrir le contraire.
      </p>

      <h2 id="faq">Questions fréquentes</h2>
      <h3>Comment savoir si un nom d'entreprise est déjà pris&nbsp;?</h3>
      <p>
        Vérifiez dans cet ordre&nbsp;: le nom de domaine (immédiat), la base des marques de l'INPI (votre
        classe de produits) et le registre du commerce. Un nom peut être libre en <code>.com</code> et pourtant
        totalement bloqué par une marque antérieure&nbsp;: c'est le cas le plus fréquent, et le plus coûteux.
      </p>
      <h3>Un auto-entrepreneur peut-il choisir un nom commercial&nbsp;?</h3>
      <p>
        Oui. Le nom légal reste votre nom de famille, mais vous pouvez déclarer un nom commercial et l'utiliser
        sur votre site, vos devis et vos factures — à condition qu'il ne porte pas atteinte à une marque
        existante. Le nom commercial ne vous protège pas pour autant&nbsp;: seul le dépôt de marque le fait.
      </p>
      <h3>Faut-il déposer le nom de sa société comme marque&nbsp;?</h3>
      <p>
        Si le nom porte votre activité commerciale, oui — l'immatriculation ne vaut pas protection. Le dépôt
        français couvre une à trois classes pour quelques centaines d'euros. Commencez par vérifier qu'il est
        libre&nbsp;: déposer un nom déjà pris fait perdre à la fois la redevance et le nom.
      </p>
      <h3>Le générateur fonctionne-t-il pour la Belgique, la Suisse ou le Québec&nbsp;?</h3>
      <p>
        La génération et la vérification de domaine, oui — les extensions <code>.be</code>, <code>.ch</code>,
        <code>.ca</code> font partie des extensions vérifiées, avec les réserves d'usage quand un registre
        refuse nos requêtes. La vérification de marque, en revanche, porte sur l'<strong>INPI</strong> (France)
        et l'<strong>EUIPO</strong> (Union européenne)&nbsp;: hors de ce périmètre, elle ne remplace pas une
        recherche auprès du registre local.
      </p>

      <h2 id="suite">À lire aussi</h2>
      <ul>
        <li><a routerLink="/guides/trouver-nom-entreprise">Guide&nbsp;: trouver un nom d'entreprise (la méthode)</a></li>
        <li><a routerLink="/generateur-nom-de-marque">Générateur de nom de marque</a></li>
        <li><a routerLink="/recherche-anteriorite-marque-inpi">Recherche d'antériorité de marque (INPI)</a></li>
        <li><a routerLink="/verifier-disponibilite-nom-de-marque">Vérifier la disponibilité d'un nom</a></li>
      </ul>
    </article>
  `,
})
export class GenerateurNomEntrepriseComponent {
  constructor() {
    applyContentSeo({
      title: "Générateur de nom d'entreprise et de société",
      description:
        "Générateur de nom d'entreprise et de société par IA : des noms disponibles, avec le domaine (.fr, .com) vérifié en direct au registre. Gratuit à l'essai.",
      path: '/generateur-nom-entreprise',
    });
  }
}
