import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ArticleCtaComponent } from './article-cta';
import { applyContentSeo } from './content-seo';
import { ArticleEnteteComponent } from './article-entete';

/**
 * Article : nom d'entreprise d'artisan et de service de proximité.
 *
 * Opportunité relevée dans les projets de production (22/11/2026) : une
 * trentaine sur 218 viennent d'artisans et d'indépendants de proximité
 * (électricité, rénovation, nettoyage, conciergerie, micro-crèche, coaching…),
 * alors qu'aucune page ne leur parlait. L'autocomplétion Google confirme la
 * demande (« nom de société de nettoyage », « nom micro entreprise »).
 *
 * Les quinze noms descriptifs du tableau ont été testés au RDAP de Verisign
 * (.com) et de l'AFNIC (.fr) le 23/11/2026 : tous pris dans les deux.
 */
@Component({
  selector: 'app-nom-entreprise-artisan',
  standalone: true,
  imports: [ArticleEnteteComponent, RouterModule, ArticleCtaComponent],
  template: `
    <article class="article">
      <app-article-entete>
        <h1>Nom d'entreprise d'artisan&nbsp;: électricien, nettoyage, rénovation, conciergerie…</h1>
      </app-article-entete>
      <p class="lead">
        Vous vous installez comme électricien, peintre, agent d'entretien, concierge Airbnb ou coach&nbsp;?
        Vous allez devoir choisir <strong>jusqu'à trois noms</strong>, dont un seul est obligatoire. Et le
        réflexe le plus courant — nommer le métier, «&nbsp;Élec Services&nbsp;», «&nbsp;Propreté
        Plus&nbsp;» — mène presque toujours à un nom déjà pris.
      </p>

      <h2 id="constat">Ce que nous voyons passer</h2>
      <p>
        Sur les 218 projets créés dans Namorama par de vrais utilisateurs entre mars et novembre 2026, une
        trentaine viennent d'artisans et d'indépendants de proximité&nbsp;: électricité et dépannage,
        rénovation et peinture, nettoyage de particuliers ou de chantiers, conciergerie de locations
        saisonnières, micro-crèche, coaching sportif, photographie, décoration intérieure, formation à la
        sécurité. Trois traits reviennent presque à chaque fois&nbsp;:
      </p>
      <ul>
        <li>la <strong>ville</strong> ou le département figure dans la description&nbsp;;</li>
        <li>les extensions choisies sont <code>.fr</code> et <code>.com</code>, rarement autre chose&nbsp;;</li>
        <li>
          beaucoup veulent dépasser le nom d'artisan&nbsp;: plusieurs demandent une marque commerciale à
          part entière, parce qu'ils visent d'autres villes après la première.
        </li>
      </ul>
      <p>Ce guide part de ces cas réels.</p>

      <h2 id="trois-noms">Trois noms, un seul obligatoire</h2>
      <p>
        <strong>La dénomination</strong> est obligatoire. Pour un entrepreneur individuel (micro-entreprise
        comprise), c'est en principe votre nom, suivi ou précédé de la mention «&nbsp;EI&nbsp;» ou
        «&nbsp;entrepreneur individuel&nbsp;», et elle doit figurer sur tous vos documents professionnels
        — devis, factures, publicité
        (<a href="https://entreprendre.service-public.gouv.fr/vosdroits/F23283" target="_blank" rel="noopener">service-public.fr</a>).
        Pour une société (SASU, EURL…), c'est la dénomination sociale des statuts&nbsp;; elle est protégée
        dans toute la France dès l'immatriculation au Registre national des entreprises
        (<a href="https://www.inpi.fr/ressources/propriete-intellectuelle/denomination-sociale-nom-commercial-et-lenseigne" target="_blank" rel="noopener">INPI</a>).
      </p>
      <p>
        <strong>Le nom commercial</strong> est facultatif. C'est celui que vos clients retiennent&nbsp;: sur
        la camionnette, la fiche Google, le site. Il peut être votre nom, un pseudonyme ou un terme inventé,
        et il se déclare à l'immatriculation. Sa protection n'est pas automatique&nbsp;: elle naît de son
        usage public et se limite en général à la zone où vous avez des clients
        (<a href="https://www.inpi.fr/ressources/propriete-intellectuelle/denomination-sociale-nom-commercial-et-lenseigne" target="_blank" rel="noopener">INPI</a>).
      </p>
      <p>
        <strong>La marque</strong>, enfin, est la seule qui vous donne un monopole national sur le nom, dans
        les classes de produits et services que vous choisissez. Elle se dépose à l'INPI, 190&nbsp;€ pour une
        classe en ligne&nbsp;: nous détaillons le
        <a routerLink="/blog/deposer-marque-inpi-prix-delais">prix et le calendrier d'un dépôt</a>.
      </p>
      <p>
        Pour un artisan qui reste local, dénomination et nom commercial suffisent souvent. Dès que vous
        visez plusieurs villes, une franchise, ou que vous investissez dans des véhicules floqués, le dépôt
        de marque devient une assurance bon marché.
      </p>

      <h2 id="descriptif">Le nom descriptif est déjà pris — nous l'avons mesuré</h2>
      <p>
        Nous avons testé le 23 novembre 2026, directement auprès des registres (RDAP de Verisign pour le
        <code>.com</code>, de l'AFNIC pour le <code>.fr</code>), quinze noms du type que l'on trouve en
        premier quand on décrit son métier&nbsp;:
      </p>
      <table class="compare">
        <thead><tr><th>Nom testé</th><th><code>.fr</code></th><th><code>.com</code></th></tr></thead>
        <tbody>
          <tr><td>elecservices, elecpro, electropro</td><td class="no">pris</td><td class="no">pris</td></tr>
          <tr><td>renovpro, renovhabitat, batipro, batiservices</td><td class="no">pris</td><td class="no">pris</td></tr>
          <tr><td>propreteplus, netpro, nettoyagepro, cleanpro</td><td class="no">pris</td><td class="no">pris</td></tr>
          <tr><td>jardinservices, multiservices, homeservices</td><td class="no">pris</td><td class="no">pris</td></tr>
          <tr><td>conciergerieplus</td><td class="no">pris</td><td class="no">pris</td></tr>
        </tbody>
      </table>
      <p>
        <strong>Quinze sur quinze</strong>, dans les deux extensions. Ajouter la ville
        («&nbsp;elecservices-toulouse&nbsp;») libère parfois le domaine, mais pas le problème&nbsp;: vous
        restez homonyme d'entreprises voisines, et un nom qui ne fait que décrire le service est jugé peu
        distinctif — il se protège mal comme marque, et vous ne pourrez pas empêcher un concurrent de
        s'appeler presque pareil.
      </p>
      <p>
        Le troisième défaut est commercial. L'entreprise de nettoyage de canapés qui ajoute l'entretien de
        chantiers, puis le dépannage automobile à domicile — un cas réel parmi nos projets —, traîne un nom
        qui ne dit plus qu'un tiers de son activité.
      </p>

      <app-article-cta
        heading="Trouvez un nom d'artisan qui soit libre"
        subheading="Décrivez votre métier et votre ville : l'IA propose des noms, le registre confirme que le .fr et le .com sont libres."
      ></app-article-cta>

      <h2 id="formule">La formule qui fonctionne&nbsp;: un nom distinctif, une baseline descriptive</h2>
      <p>
        Les artisans dont le nom tient dans la durée séparent deux rôles&nbsp;:
      </p>
      <ul>
        <li>
          <strong>Le nom</strong> est distinctif&nbsp;: inventé, évocateur, ou bâti sur votre patronyme. Il
          se retient, se protège, et survit à un changement d'offre.
        </li>
        <li>
          <strong>La baseline</strong> décrit&nbsp;: «&nbsp;Électricité générale · Toulouse et
          alentours&nbsp;». Elle se change sur la camionnette et le site sans rien casser.
        </li>
      </ul>
      <p>
        Le référencement local n'en souffre pas&nbsp;: Google classe les artisans sur leur fiche
        d'établissement, leurs avis et leurs pages de service, pas sur les mots contenus dans leur raison
        sociale.
      </p>

      <h3>Trois pistes selon votre projet</h3>
      <ul>
        <li>
          <strong>Vous restez local et vous êtes la marque</strong> (coach, photographe, décoratrice)&nbsp;:
          votre nom ou prénom, éventuellement associé à un mot («&nbsp;Atelier&nbsp;», «&nbsp;Studio&nbsp;»),
          est souvent le meilleur choix. Vérifiez seulement que le domaine est libre et qu'aucune marque
          proche n'existe dans votre activité.
        </li>
        <li>
          <strong>Vous voulez grandir</strong> (plusieurs équipes, plusieurs villes)&nbsp;: un nom inventé ou
          évocateur, court, facile à dire au téléphone et à épeler. C'est la piste où un générateur fait
          gagner le plus de temps, parce que les bonnes combinaisons libres sont rares.
        </li>
        <li>
          <strong>Vous êtes à deux</strong> (une conciergerie, un atelier)&nbsp;: évitez d'accoler vos deux
          prénoms. Le jour où l'un part, le nom ment.
        </li>
      </ul>

      <h2 id="verifier">Les vérifications, dans l'ordre</h2>
      <ol>
        <li>
          <strong>Le domaine</strong> en <code>.fr</code> et <code>.com</code>&nbsp;: immédiat, et c'est le
          premier à disparaître. Namorama l'interroge auprès du registre pour chaque nom proposé.
        </li>
        <li>
          <strong>Les marques</strong> dans votre activité (bâtiment, nettoyage, services à la
          personne…)&nbsp;: la recherche à l'identique sur DATA INPI est gratuite&nbsp;; le
          <a routerLink="/verifier-disponibilite-nom-de-marque">rapport de marque</a> de Namorama la fait aussi,
          avec les orthographes voisines.
        </li>
        <li>
          <strong>Les entreprises du même secteur dans votre zone</strong>&nbsp;: un nom commercial
          antérieur, même non déposé, peut vous être opposé localement. Une recherche dans l'annuaire des
          entreprises et sur Google Maps, dans votre département, suffit à repérer l'homonyme gênant.
        </li>
        <li>
          <strong>Les pages Facebook et Instagram</strong>&nbsp;: moins grave, mais un client qui tombe sur
          un homonyme local vous confondra avec lui.
        </li>
      </ol>

      <h2 id="faq">Questions fréquentes</h2>
      <h3>Un auto-entrepreneur peut-il avoir un nom commercial&nbsp;?</h3>
      <p>
        Oui. La dénomination reste obligatoire sur vos documents, mais vous pouvez déclarer en plus un nom
        commercial lors de l'immatriculation et l'utiliser sur votre site, votre véhicule et vos
        supports.
      </p>
      <h3>Faut-il mettre sa ville dans le nom&nbsp;?</h3>
      <p>
        Plutôt dans la baseline et sur le site que dans le nom. Une ville dans le nom rassure au début, puis
        gêne dès que vous travaillez dans la commune voisine ou ouvrez une deuxième agence.
      </p>
      <h3>Mon nom de famille est-il un bon nom d'entreprise&nbsp;?</h3>
      <p>
        Pour une activité de confiance personnelle (coaching, artisanat d'art, photographie), souvent oui.
        Pour une entreprise qui doit pouvoir être cédée ou grandir sans vous, un nom distinct est plus
        souple.
      </p>
      <h3>Est-ce que Namorama vérifie le registre des entreprises&nbsp;?</h3>
      <p>
        Non&nbsp;: Namorama vérifie les noms de domaine, les marques (INPI, EUIPO) et, dans le rapport, les
        pseudos des réseaux sociaux. La recherche d'homonymes parmi les entreprises immatriculées reste à
        faire dans l'annuaire des entreprises.
      </p>

      <h2 id="suite">À lire aussi</h2>
      <ul>
        <li><a routerLink="/generateur-nom-entreprise">Générateur de nom d'entreprise et de société</a></li>
        <li><a routerLink="/guides/trouver-nom-entreprise">La méthode pour trouver un nom d'entreprise</a></li>
        <li><a routerLink="/blog/deposer-marque-inpi-prix-delais">Déposer sa marque à l'INPI&nbsp;: prix, délais, opposition</a></li>
        <li><a routerLink="/recherche-anteriorite-marque-inpi">Recherche d'antériorité de marque</a></li>
      </ul>
    </article>
  `,
})
export class NomEntrepriseArtisanComponent {
  constructor() {
    applyContentSeo({
      title: "Nom d'entreprise d'artisan : électricien, nettoyage, rénovation",
      description:
        "Dénomination obligatoire, nom commercial facultatif, marque : comment nommer son entreprise d'artisan. Et pourquoi 15 noms descriptifs testés sur 15 sont déjà pris.",
      path: '/blog/nom-entreprise-artisan',
    });
  }
}
