import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TroisRisquesComponent } from './trois-risques';
import { ArticleCtaComponent } from './article-cta';
import { applyContentSeo } from './content-seo';
import { ArticleEnteteComponent } from './article-entete';

/**
 * Article comparatif (intention commerciale) : Namorama face aux autres
 * approches de génération de noms. Page prérendue (SSG) ciblant « meilleur
 * générateur de nom de marque », « alternative Namelix », « générateur de nom
 * avec domaine disponible ».
 */
@Component({
  selector: 'app-comparatif-generateurs',
  standalone: true,
  imports: [ArticleEnteteComponent, TroisRisquesComponent, RouterModule, ArticleCtaComponent],
  template: `
    <article class="article">
      <app-article-entete>
        <h1>Générateurs de noms de marque : comment choisir (et pourquoi la disponibilité change tout)</h1>
      </app-article-entete>
      <p class="lead">
        Tous les générateurs de noms ne se valent pas. La vraie ligne de partage n'est pas
        la créativité — c'est <strong>la fiabilité de la disponibilité de domaine</strong>.
        Comparons les approches pour vous éviter de tomber amoureux d'un nom inaccessible.
      </p>

      <h2 id="approches">Quatre familles d'outils</h2>
      <p>
        Une trentaine d'outils se partagent cette requête. Derrière la diversité apparente, ils ne
        relèvent que de quatre logiques, et le choix se joue presque entièrement là.
      </p>
      <ul>
        <li>
          <strong>Les générateurs combinatoires</strong> (Panabee, Naminum, Bustaname, Mergewords)
          assemblent votre mot-clé avec des préfixes, suffixes et syllabes. Instantanés et gratuits,
          mais les résultats sont mécaniques&nbsp;: <em>votremot-ly</em>, <em>votremot-ify</em>,
          <em>get-votremot</em>. La disponibilité affichée est le plus souvent une estimation.
        </li>
        <li>
          <strong>Les générateurs IA</strong> (Namelix, NameSnack, la plupart des outils lancés
          depuis 2023) produisent des noms nettement plus brandables à partir d'une description.
          C'est le vrai saut qualitatif de ces dernières années. Leur angle mort reste le même&nbsp;:
          la disponibilité est indicative, parfois absente, souvent limitée au <code>.com</code>.
        </li>
        <li>
          <strong>Les outils de registrar</strong> (GoDaddy, Hostinger, Domainr, LeanDomainSearch)
          partent du domaine et remontent vers le nom. La disponibilité y est fiable — c'est leur
          métier — mais la génération reste pauvre, et l'objectif commercial est de vous vendre un
          domaine, pas de vous aider à bien nommer.
        </li>
        <li>
          <strong>Les suites d'identité de marque</strong> (Looka, Brandroot, Squadhelp) vendent un
          nom accompagné d'un logo et d'une charte. Pertinent si vous cherchez une identité clé en
          main, plus cher, et le nom n'est qu'une porte d'entrée vers le reste de l'offre.
        </li>
      </ul>
      <p>
        Namorama appartient à une cinquième catégorie, plus étroite&nbsp;: génération IA
        <strong>et</strong> vérification réelle du domaine dans la même passe, avec en amont une
        analyse des noms déjà utilisés sur votre marché.
      </p>

      <h2 id="criteres">Les critères qui comptent vraiment</h2>
      <table class="compare">
        <thead>
          <tr>
            <th>Critère</th>
            <th>Générateur combinatoire</th>
            <th>Générateur IA simple</th>
            <th>Namorama</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Originalité des noms</td>
            <td class="no">Faible</td>
            <td class="yes">Élevée</td>
            <td class="yes">Élevée</td>
          </tr>
          <tr>
            <td>Compréhension du projet (IA)</td>
            <td class="no">Non</td>
            <td class="yes">Oui</td>
            <td class="yes">Oui</td>
          </tr>
          <tr>
            <td>Disponibilité de domaine</td>
            <td class="no">Estimée</td>
            <td class="no">Souvent absente</td>
            <td class="yes">Whois réelle, en direct</td>
          </tr>
          <tr>
            <td>Vue multi-extensions (.com/.fr/.io…)</td>
            <td class="no">Rare</td>
            <td class="no">Rare</td>
            <td class="yes">Tableau matriciel</td>
          </tr>
          <tr>
            <td>Analyse des noms du secteur</td>
            <td class="no">Non</td>
            <td class="no">Non</td>
            <td class="yes">Oui, avant génération</td>
          </tr>
          <tr>
            <td>Suggestions en français</td>
            <td class="no">Rare</td>
            <td class="no">Souvent anglophones</td>
            <td class="yes">Oui, et 18 autres langues</td>
          </tr>
          <tr>
            <td>Extensions locales (.fr, .be, .ch)</td>
            <td class="no">Rare</td>
            <td class="no">Rare</td>
            <td class="yes">Oui, au choix</td>
          </tr>
          <tr>
            <td>Vérification de marque déposée</td>
            <td class="no">Non</td>
            <td class="no">Non</td>
            <td>Lien INPI pré-rempli</td>
          </tr>
          <tr>
            <td>Sans abonnement</td>
            <td>Variable</td>
            <td>Variable</td>
            <td class="yes">Oui, 100 crédits offerts</td>
          </tr>
        </tbody>
      </table>
      <p>
        Une ligne mérite d'être lue honnêtement&nbsp;: <strong>personne</strong>, Namorama compris,
        ne vérifie automatiquement les marques déposées. C'est l'angle mort de toute la catégorie, et
        nous y revenons plus bas.
      </p>

      <h2 id="disponibilite">Ce que « disponible » veut dire vraiment</h2>
      <p>
        C'est le point où les outils divergent le plus, et celui que personne n'explique. « Disponible »
        recouvre au moins quatre situations très différentes&nbsp;:
      </p>
      <ul>
        <li>
          <strong>Réellement libre</strong> — aucun enregistrement au registre. Vous pouvez le réserver
          au tarif standard, aujourd'hui. C'est le seul cas qui vous intéresse.
        </li>
        <li>
          <strong>Enregistré mais sans site</strong> — le domaine ne renvoie rien dans un navigateur, ce
          qui trompe les outils qui se contentent de tester une réponse HTTP ou une résolution DNS. Il a
          pourtant un propriétaire.
        </li>
        <li>
          <strong>En période de rédemption</strong> — expiré mais pas encore relâché. Il apparaît parfois
          comme libre alors qu'il est indisponible pendant plusieurs semaines, et que son ancien
          propriétaire peut le récupérer en priorité.
        </li>
        <li>
          <strong>Libre mais « premium »</strong> — techniquement disponible, mais mis en vente par le
          registre ou un revendeur à plusieurs centaines ou milliers d'euros. Disponible, oui. Accessible,
          c'est autre chose.
        </li>
      </ul>
      <p>
        Un outil qui devine à partir d'une heuristique confond régulièrement ces cas. Namorama interroge
        le <strong>registre Whois en temps réel</strong>, c'est-à-dire la source qui fait foi&nbsp;: un
        nom affiché comme libre l'est au moment de la recherche. C'est plus lent qu'une estimation — une
        recherche prend une poignée de secondes par nom — et c'est le prix de la fiabilité.
      </p>

      <h2 id="chiffres">La disponibilité en chiffres</h2>
      <p>
        La rareté est très mal comprise, y compris par les outils qui vous laissent viser des noms de
        quatre lettres. Nous avons mesuré, le 1<sup>er</sup> août 2026, la part de domaines
        <code>.com</code> déjà déposés sur des noms prononçables tirés au sort et vérifiés un par un
        au Whois&nbsp;:
      </p>
      <table class="compare">
        <thead>
          <tr>
            <th>Longueur du nom</th>
            <th>.com déjà pris</th>
            <th>Ce que ça implique</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>5 caractères</td>
            <td class="no">≈ 83 %</td>
            <td>Très difficile — comptez beaucoup d'essais</td>
          </tr>
          <tr>
            <td>6 caractères</td>
            <td>≈ 34 %</td>
            <td>Jouable avec de la persévérance</td>
          </tr>
          <tr>
            <td>7 caractères</td>
            <td class="yes">≈ 2,5 %</td>
            <td>Le bon compromis dans la plupart des cas</td>
          </tr>
        </tbody>
      </table>
      <p>
        Deux caractères de plus font passer la difficulté de « presque impossible » à « presque
        toujours faisable ». C'est pourquoi Namorama propose un réglage explicite de longueur minimale,
        avec un avertissement chiffré quand vous descendez sous sept caractères — plutôt que de vous
        laisser chercher à l'aveugle.
      </p>

      <app-trois-risques intro="C'est là que se joue la différence entre un générateur de noms et un outil de choix de nom : le nombre de contrôles."></app-trois-risques>

      <app-article-cta
        heading="Comparez par vous-même en 30 secondes"
        subheading="Lancez une recherche : vous verrez la génération IA et la vérification de disponibilité réelle côte à côte.">
      </app-article-cta>

      <h2 id="questions">Six questions à poser avant de choisir un outil</h2>
      <ol>
        <li>
          <strong>La disponibilité est-elle vérifiée ou estimée&nbsp;?</strong> Cherchez la mention
          explicite de « Whois ». En son absence, considérez que c'est une estimation.
        </li>
        <li>
          <strong>Quand la vérification a-t-elle lieu&nbsp;?</strong> Un résultat mis en cache la
          semaine dernière ne vaut rien&nbsp;: les bons domaines partent vite.
        </li>
        <li>
          <strong>Quelles extensions&nbsp;?</strong> Si vous visez la France, un outil qui ne teste
          que le <code>.com</code> vous fait passer à côté de l'essentiel.
        </li>
        <li>
          <strong>Dans quelle langue les noms sont-ils générés&nbsp;?</strong> La plupart des outils
          pensent en anglais. Pour un marché francophone, un nom qui « sonne » anglais peut coûter en
          proximité comme en prononciation.
        </li>
        <li>
          <strong>Que se passe-t-il si rien n'est trouvé&nbsp;?</strong> Un outil sérieux vous explique
          pourquoi et propose d'élargir les critères, au lieu d'afficher une liste vide.
        </li>
        <li>
          <strong>Combien ça coûte réellement&nbsp;?</strong> Méfiez-vous des outils gratuits en apparence
          dont le vrai produit est la revente de domaines premium ou un abonnement mensuel dont vous
          n'aurez besoin qu'une semaine.
        </li>
      </ol>

      <h2 id="limites">Ce qu'aucun générateur ne fait à votre place</h2>
      <p>
        Autant le dire clairement, y compris pour nous&nbsp;: un domaine libre ne signifie pas qu'un nom
        est utilisable. Trois vérifications restent à votre charge.
      </p>
      <ul>
        <li>
          <strong>La marque déposée.</strong> Un nom peut être libre en <code>.com</code> et déjà déposé
          à l'INPI dans votre classe d'activité. C'est le risque juridique le plus sérieux, et aucun
          générateur du marché ne le contrôle automatiquement. Namorama vous fournit un lien de recherche
          INPI pré-rempli pour chaque nom retenu — c'est une aide, pas une garantie, et une recherche
          d'antériorité auprès d'un conseil reste la seule réponse solide avant un dépôt.
        </li>
        <li>
          <strong>Le sens dans les autres langues.</strong> Un nom inventé peut vouloir dire quelque chose
          de malheureux ailleurs. Si vous visez plusieurs marchés, faites-le lire à des locuteurs natifs.
        </li>
        <li>
          <strong>Le test de la radio.</strong> Dictez le nom au téléphone à quelqu'un qui ne l'a jamais
          vu. S'il faut l'épeler, il vous coûtera cher pendant des années — en support, en bouche-à-oreille,
          en publicité.
        </li>
      </ul>

      <h2 id="pour-qui">Quel outil pour quel besoin ?</h2>
      <ul>
        <li>
          <strong>Vous explorez, sans intention immédiate</strong> — un générateur combinatoire gratuit
          suffit largement. Ne payez rien à ce stade.
        </li>
        <li>
          <strong>Vous voulez un nom ET son identité visuelle</strong> — une suite comme Looka a du sens,
          à condition d'accepter son tarif et un nom souvent moins travaillé que le logo. Voir notre
          comparaison <a routerLink="/namorama-vs-looka">Namorama vs Looka</a>.
        </li>
        <li>
          <strong>Vous allez réserver un domaine pour de vrai</strong> — pour une startup, une boutique,
          une application ou un nouveau produit — il vous faut un outil qui relie le nom à une
          disponibilité réelle. C'est précisément le rôle de Namorama, et la comparaison détaillée avec
          l'outil IA le plus connu est ici&nbsp;: <a routerLink="/namorama-vs-namelix">Namorama vs Namelix</a>.
          Pour l'outil lui-même, voir le <a routerLink="/generateur-nom-de-marque">générateur de nom de marque</a>
          et le <a routerLink="/generateur-nom-de-domaine">générateur de nom de domaine</a>.
        </li>
      </ul>

      <h2 id="faq">Questions fréquentes</h2>
      <h3>Un générateur de noms gratuit suffit-il&nbsp;?</h3>
      <p>
        Pour produire des idées, oui. Pour aboutir à un domaine réservable, rarement&nbsp;: le temps passé
        à tester manuellement la disponibilité de dizaines de noms dépasse vite le coût d'un outil qui le
        fait pour vous. Namorama offre 100 crédits par mois, de quoi mener une recherche complète sans payer.
      </p>
      <h3>Pourquoi tous les noms que j'aime sont-ils déjà pris&nbsp;?</h3>
      <p>
        Parce que les noms « évidents » d'un marché ont été enregistrés il y a longtemps, et parce que la
        rareté explose quand le nom raccourcit (voir les chiffres plus haut). La sortie est en général de
        viser un nom inventé ou évocateur plutôt que descriptif, et d'accepter un ou deux caractères de plus.
      </p>
      <h3>Faut-il absolument un <code>.com</code>&nbsp;?</h3>
      <p>
        Pas systématiquement. Le <code>.com</code> reste le réflexe international et rassure, mais un
        <code>.fr</code> est parfaitement crédible pour une activité française, et le <code>.io</code>
        s'est imposé dans le logiciel. L'important est de vérifier la disponibilité sur toutes les
        extensions que vous envisagez, pas seulement une.
      </p>
      <h3>Un nom généré par IA peut-il être déposé comme marque&nbsp;?</h3>
      <p>
        Oui&nbsp;: ce qui compte est le caractère distinctif du signe et l'absence d'antériorité, pas la
        manière dont il a été trouvé. Un nom inventé est même généralement plus facile à protéger qu'un
        nom descriptif. La vérification d'antériorité reste indispensable.
      </p>

      <app-article-cta></app-article-cta>
    </article>
  `,
})
export class ComparatifGenerateursComponent {
  constructor() {
    applyContentSeo({
      title: 'Comparatif des générateurs de noms de marque',
      description:
        'Comment choisir un générateur de noms ? Comparatif des approches (combinatoire, IA, Whois réel) et pourquoi la disponibilité du domaine fait la différence.',
      path: '/comparatif-generateurs-de-noms',
    });
  }
}
