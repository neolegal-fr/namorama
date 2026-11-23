import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TroisRisquesComponent } from './trois-risques';
import { ArticleCtaComponent } from './article-cta';
import { applyContentSeo } from './content-seo';
import { ArticleEnteteComponent } from './article-entete';

/**
 * Page de comparaison (intention commerciale) : Namorama vs Looka.
 * Prérendue (SSG), cible « namorama vs looka », « alternative Looka »,
 * « looka français », « générateur de nom + logo vs domaine disponible ».
 */
@Component({
  selector: 'app-comparatif-looka',
  standalone: true,
  imports: [ArticleEnteteComponent, TroisRisquesComponent, RouterModule, ArticleCtaComponent],
  template: `
    <article class="article">
      <app-article-entete>
        <h1>Namorama vs Looka : nom de marque ou logo, que privilégier ?</h1>
      </app-article-entete>
      <p class="lead">
        Looka est avant tout un <strong>créateur de logo et de brand kit</strong> qui propose aussi des noms.
        Namorama part du problème inverse&nbsp;: trouver d'abord un <strong>nom dont le domaine est réellement
        disponible</strong>, adapté à votre marché. Voici comment choisir selon votre priorité.
      </p>

      <h2 id="en-bref">En bref</h2>
      <ul>
        <li><strong>Choisissez Looka</strong> si votre besoin immédiat est un <em>logo</em> et une identité
          visuelle complète (cartes de visite, déclinaisons réseaux sociaux…).</li>
        <li><strong>Choisissez Namorama</strong> si votre priorité est le <em>nom</em> et surtout le
          <em>domaine réellement libre</em>, avec une extension locale (<code>.fr</code>…) et des suggestions
          en français.</li>
      </ul>

      <h2 id="tableau">Tableau comparatif</h2>
      <table class="compare">
        <thead>
          <tr>
            <th>Critère</th>
            <th>Looka</th>
            <th>Namorama</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Génération de noms par IA</td>
            <td class="yes">Oui</td>
            <td class="yes">Oui</td>
          </tr>
          <tr>
            <td>Vérification de disponibilité du domaine</td>
            <td class="no">Basique</td>
            <td class="yes">Whois réel, en direct</td>
          </tr>
          <tr>
            <td>Matrice multi-extensions (.com, .fr, .io…)</td>
            <td class="no">Non</td>
            <td class="yes">Oui, disponibilité par extension</td>
          </tr>
          <tr>
            <td>Extension locale selon votre pays</td>
            <td class="no">Non</td>
            <td class="yes">Oui (ex. France → <code>.fr</code>)</td>
          </tr>
          <tr>
            <td>Suggestions régionales et culturelles</td>
            <td class="no">Non</td>
            <td class="yes">Oui</td>
          </tr>
          <tr>
            <td>Interface et contenu en français</td>
            <td class="no">Anglophone</td>
            <td class="yes">Pensé pour le marché FR</td>
          </tr>
          <tr>
            <td>Logo &amp; brand kit complet</td>
            <td class="yes">Oui (point fort, payant)</td>
            <td class="no">Pas encore</td>
          </tr>
          <tr>
            <td>Modèle</td>
            <td>Noms gratuits, logos/kit à partir de ~20&nbsp;$</td>
            <td>100 crédits offerts/mois, sans abonnement</td>
          </tr>
        </tbody>
      </table>

      <h2 id="ordre">Le vrai sujet : dans quel ordre travailler ?</h2>
      <p>
        La question « nom ou logo » est mal posée. Les deux sont nécessaires, mais ils ne se décident pas
        dans n'importe quel ordre, parce qu'ils n'ont pas la même réversibilité.
      </p>
      <p>
        <strong>Un logo se refait&nbsp;; un nom, beaucoup plus difficilement.</strong> Changer de logo coûte
        quelques centaines d'euros et une après-midi. Changer de nom, c'est reprendre le domaine, les e-mails,
        les pseudos sociaux, les mentions dans la presse, les liens entrants accumulés, les documents
        commerciaux — et repartir de zéro en notoriété. Le nom est la décision la plus engageante des deux,
        et c'est celle qui dépend d'une contrainte extérieure&nbsp;: la disponibilité.
      </p>
      <p>
        Concrètement, le scénario coûteux est toujours le même&nbsp;: on génère un logo superbe sur un nom
        séduisant, on s'y attache pendant deux semaines, puis on découvre que le domaine est pris. Reste alors
        à choisir entre une orthographe tordue, une extension bancale, ou tout recommencer — logo compris.
      </p>

      <h2 id="looka-fort">Là où Looka est fort</h2>
      <p>
        Looka brille sur le <strong>design</strong>&nbsp;: son créateur de logo est réputé, et il permet de
        visualiser instantanément un nom sur une carte de visite ou une devanture, avec un brand kit complet.
        Si l'identité visuelle est votre priorité du moment, c'est un excellent outil tout-en-un.
      </p>
      <p>
        Il est aussi honnête de dire que Looka couvre un besoin que Namorama ne couvre pas du tout. Nous ne
        faisons pas de logo, pas de charte, pas de déclinaison de cartes de visite, et ce n'est pas prévu.
        Si vous cherchez un package d'identité complet en une seule fois, notre outil ne le remplacera pas.
      </p>
      <p>
        Deux limites à connaître, en revanche&nbsp;: l'outil est <strong>entièrement anglophone</strong> — ses
        propositions de noms sonnent anglais, ce qui se remarque sur un marché francophone — et le brand kit
        fonctionne par <strong>abonnement</strong>, un modèle inconfortable pour un besoin qui, par nature, ne
        dure que quelques semaines.
      </p>

      <h2 id="namorama-difference">Là où Namorama fait la différence</h2>
      <p>
        <strong>Le domaine d'abord, pour de vrai.</strong> Un beau logo sur un nom dont le domaine est déjà pris
        ne sert à rien. Namorama interroge le <strong>Whois en temps réel</strong> pour chaque nom et chaque
        extension&nbsp;: vous partez d'un nom réellement réservable.
      </p>
      <p>
        <strong>Pensé pour votre marché.</strong> Selon votre localisation, Namorama propose l'<strong>extension
        locale</strong> (<code>.fr</code> en plus de <code>.com</code>) et active des <strong>suggestions
        régionales et culturelles</strong> qui sonnent juste dans votre langue.
      </p>
      <p>
        Beaucoup d'équipes utilisent d'ailleurs les deux&nbsp;: <strong>Namorama pour verrouiller le nom et le
        domaine</strong>, puis un créateur de logo pour l'identité visuelle.
      </p>

      <app-trois-risques intro="Un logo n'a de valeur que si le nom qu'il porte reste le vôtre. Trois contrôles pour s'en assurer."></app-trois-risques>

      <app-article-cta
        heading="Trouvez d'abord un nom dont le domaine est libre"
        subheading="Lancez une recherche : génération IA et vérification de disponibilité réelle, côte à côte."
      ></app-article-cta>

      <h2 id="lequel">Alors, lequel choisir ?</h2>
      <p>
        Pour un besoin centré <strong>logo / identité visuelle</strong>&nbsp;: Looka. Pour
        <strong>trouver un nom de marque dont le domaine est réellement disponible</strong>, en français et avec
        l'extension locale&nbsp;: Namorama, gratuit pour démarrer (100 crédits offerts, sans abonnement).
      </p>
      <h2 id="ensemble">Les utiliser ensemble, dans le bon ordre</h2>
      <p>
        C'est le scénario que nous recommandons, et il n'a rien de diplomatique&nbsp;: les deux outils
        répondent à deux moments différents du même projet.
      </p>
      <ol>
        <li>
          <strong>Verrouillez le nom et le domaine.</strong> Décrivez votre projet, laissez l'IA proposer des
          noms dont la disponibilité est vérifiée au Whois, et réservez le domaine le jour même — c'est ce qui
          part le plus vite, pour une dizaine d'euros.
        </li>
        <li>
          <strong>Réservez les pseudos sociaux</strong> correspondants dans la foulée. C'est gratuit, et
          récupérer un pseudo déjà pris est quasiment impossible.
        </li>
        <li>
          <strong>Puis créez l'identité visuelle</strong> — avec Looka, un studio, ou un graphiste
          indépendant. À ce stade, le nom est acquis&nbsp;: le travail de design ne risque plus d'être jeté.
        </li>
      </ol>

      <h2 id="faq">Questions fréquentes</h2>
      <h3>Looka vérifie-t-il la disponibilité du domaine&nbsp;?</h3>
      <p>
        Il propose une vérification, mais elle est secondaire dans son parcours&nbsp;: l'outil est construit
        autour du logo, et le domaine y est une option d'achat parmi d'autres. La différence tient moins à la
        présence de la fonction qu'à sa place dans la démarche — chez nous, la disponibilité réelle est le
        filtre qui décide quels noms vous sont montrés.
      </p>
      <h3>Puis-je utiliser un nom trouvé sur Namorama pour créer un logo ailleurs&nbsp;?</h3>
      <p>
        Oui, évidemment. Les noms générés vous appartiennent, sans clause d'exclusivité ni redevance. C'est
        même le parcours le plus courant chez nos utilisateurs.
      </p>
      <h3>Existe-t-il une alternative française à Looka&nbsp;?</h3>
      <p>
        Pour le logo, plusieurs outils français existent, mais aucun n'atteint la qualité de Looka sur ce
        terrain précis. Pour le <em>nom</em> en revanche, un outil pensé pour le marché francophone change
        beaucoup de choses&nbsp;: extensions locales, sonorités qui fonctionnent en français, et absence de
        noms qui « sonnent traduits ».
      </p>
      <h3>Faut-il déposer le nom comme marque avant de faire le logo&nbsp;?</h3>
      <p>
        Réservez le domaine tout de suite, vérifiez l'antériorité de marque à l'INPI dès le départ, mais le
        dépôt lui-même peut attendre que le projet se confirme — il coûte plusieurs centaines d'euros. Le logo,
        lui, peut se faire en parallèle : il n'a pas d'incidence sur la protection du nom.
      </p>

      <p>
        À lire aussi&nbsp;: notre comparaison <a routerLink="/namorama-vs-namelix">Namorama vs Namelix</a>, le
        <a routerLink="/comparatif-generateurs-de-noms">comparatif général des générateurs</a> et le guide
        <a routerLink="/guides/trouver-nom-de-marque">pour trouver un nom de marque disponible</a>.
      </p>

      <app-article-cta></app-article-cta>
    </article>
  `,
})
export class ComparatifLookaComponent {
  constructor() {
    applyContentSeo({
      title: 'Namorama vs Looka : nom de marque ou logo',
      description:
        "Namorama ou Looka ? Comparatif honnête : disponibilité de domaine vérifiée au Whois et extension .fr, face à un créateur de logo anglophone.",
      path: '/namorama-vs-looka',
    });
  }
}
