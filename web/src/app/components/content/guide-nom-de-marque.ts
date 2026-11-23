import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TroisRisquesComponent } from './trois-risques';
import { ArticleCtaComponent } from './article-cta';
import { applyContentSeo } from './content-seo';
import { ArticleEnteteComponent } from './article-entete';

/**
 * Article pilier : guide pratique pour trouver un nom de marque disponible.
 * Page prérendue (SSG) ciblant les requêtes informationnelles « trouver un nom
 * de marque », « idée de nom d'entreprise », « nom de marque disponible ».
 */
@Component({
  selector: 'app-guide-nom-de-marque',
  standalone: true,
  imports: [ArticleEnteteComponent, TroisRisquesComponent, RouterModule, ArticleCtaComponent],
  template: `
    <article class="article">
      <app-article-entete>
        <h1>Comment trouver un nom de marque disponible (avec son domaine) ?</h1>
      </app-article-entete>
      <p class="lead">
        Trouver un nom de marque, c'est facile. En trouver un qui soit à la fois mémorable,
        pertinent <strong>et dont le nom de domaine est encore libre</strong>, beaucoup moins.
        Voici une méthode en 5 étapes, et comment l'IA de Namorama l'accélère.
      </p>

      <h2 id="pourquoi-cest-dur">Pourquoi c'est si difficile aujourd'hui</h2>
      <p>
        Des centaines de millions de domaines sont déjà enregistrés. La plupart des noms
        « évidents » pour votre secteur sont pris depuis longtemps. Résultat : on trouve un
        beau nom… avant de découvrir que le <code>.com</code> est occupé, ou pire, déposé
        comme marque. Le bon réflexe est donc d'inverser la démarche : générer largement,
        puis filtrer immédiatement sur la disponibilité réelle.
      </p>
      <p>
        L'ampleur du phénomène est rarement comprise. Nous avons mesuré, le 1<sup>er</sup> août 2026,
        la part de <code>.com</code> déjà déposés sur des noms prononçables tirés au sort et vérifiés
        un par un au Whois : <strong>environ 83 % en 5 caractères</strong>, 34 % en 6 caractères, et
        moins de 3 % en 7 caractères. Autrement dit, deux caractères de plus font basculer la
        recherche de « presque impossible » à « presque toujours faisable ». Si vous vous acharnez
        sur un nom très court parce que Qonto ou Stripe en ont un, sachez que vous jouez contre des
        probabilités très défavorables.
      </p>
      <p>
        Deuxième piège, plus coûteux : confondre <em>domaine libre</em> et <em>nom utilisable</em>.
        Un nom peut être disponible en <code>.com</code> et déjà déposé comme marque dans votre
        classe d'activité. La disponibilité du domaine est une condition nécessaire, jamais suffisante.
      </p>

      <h2 id="methode">La méthode en 5 étapes</h2>
      <h3>1. Clarifiez votre positionnement</h3>
      <p>
        Avant de chercher des mots, posez votre projet en une phrase : que vendez-vous,
        à qui, avec quelle promesse ? Un bon nom traduit une intention. Notez aussi le ton
        recherché (sérieux, joueur, technique, premium…).
      </p>
      <h3>2. Explorez plusieurs pistes créatives</h3>
      <p>Les noms de marque qui fonctionnent relèvent en général d'une de ces familles :</p>
      <ul>
        <li><strong>Évocateurs</strong> — suggèrent un bénéfice ou une sensation (ex. Stripe, Slack).</li>
        <li><strong>Inventés</strong> — mots-valises ou néologismes uniques et déposables (ex. Spotify, Zalando).</li>
        <li><strong>Descriptifs détournés</strong> — un mot concret utilisé hors de son sens premier (ex. Amazon, Apple).</li>
        <li><strong>Composés</strong> — deux racines fusionnées qui racontent l'usage (ex. Namorama, Facebook).</li>
      </ul>
      <p>
        Un arbitrage mérite d'être fait consciemment ici, car il vous suivra longtemps :
        <strong>plus un nom décrit votre activité, plus il est facile à comprendre — et plus il est
        difficile à protéger, à faire ressortir et à conserver quand l'activité évolue</strong>.
        « Plomberie Express » se comprend instantanément, ne se distingue d'aucun concurrent, et
        deviendra un frein le jour où vous ferez aussi du chauffage. À l'inverse, un nom inventé
        demande un budget de communication pour installer son sens, mais vous appartient vraiment.
      </p>
      <p>
        Le point de départ le plus productif consiste à regarder ce qui existe déjà sur votre marché,
        non pour copier, mais pour situer votre ton : si tous vos concurrents ont un nom descriptif en
        français, un nom inventé vous fera immédiatement remarquer — et réciproquement, un nom trop
        exotique dans un secteur conservateur peut inquiéter. C'est exactement ce que Namorama fait
        avant de générer : il identifie les produits déjà présents sur votre marché avec leur domaine,
        vous dites lesquels vous plaisent ou non, et la génération s'en inspire ou s'en démarque.
      </p>
      <h3>3. Vérifiez la disponibilité du domaine — tout de suite</h3>
      <p>
        C'est l'étape que la plupart des gens repoussent à tort. Tester la disponibilité au
        fil de l'eau évite de tomber amoureux d'un nom inaccessible. Privilégiez une
        vérification <strong>Whois réelle</strong> plutôt qu'une simple estimation : seule la
        requête au registre dit si un domaine est vraiment réservable à l'instant T.
      </p>
      <h3>4. Filtrez sur la prononciation et la mémorisation</h3>
      <p>
        Lisez chaque candidat à voix haute. Est-il facile à épeler au téléphone ? Évitez les
        doubles sens malheureux et vérifiez qu'il « passe » aussi dans les autres langues de
        vos marchés cibles.
      </p>
      <h3>5. Sécurisez le nom</h3>
      <p>
        Une fois le bon nom trouvé et le domaine libre confirmé, réservez le domaine sans
        attendre chez votre registrar, et vérifiez l'antériorité de marque (INPI en France,
        EUIPO en Europe) avant tout dépôt.
      </p>
      <p>
        L'ordre compte : le domaine se réserve en cinq minutes pour une dizaine d'euros, le dépôt de
        marque prend des mois et coûte plusieurs centaines d'euros. Commencez donc par le domaine —
        c'est ce qui part le plus vite — puis instruisez la question de la marque. Pensez aussi à
        réserver les pseudos correspondants sur les réseaux sociaux le même jour : c'est gratuit, et
        récupérer un pseudo pris est presque impossible.
      </p>

      <h2 id="qui-nexiste-pas">«&nbsp;Trouver un nom qui n'existe pas&nbsp;»&nbsp;: ce que ça veut dire vraiment</h2>
      <p>
        C'est la façon la plus courante de formuler la recherche, et elle mérite d'être corrigée&nbsp;: un nom
        prononçable «&nbsp;qui n'existe pas&nbsp;» n'existe pas. Tout assemblage de syllabes tenable a déjà été
        déposé quelque part, par quelqu'un, dans une extension ou une classe. Viser l'inexistence absolue,
        c'est se condamner à des noms illisibles — et à chercher indéfiniment.
      </p>
      <p>
        La question utile est&nbsp;: <strong>libre pour mon usage à moi</strong>. Elle se décompose en trois
        vérifications qui ne se recouvrent pas, et qu'on peut mener dans l'ordre du coût croissant.
      </p>
      <ul>
        <li>
          <strong>Le domaine est-il enregistrable&nbsp;?</strong> Binaire, immédiat, et le moins grave&nbsp;: un
          nom perdu ici vous coûte une heure. C'est la seule des trois qui se règle dans la minute, pour une
          dizaine d'euros. Astuce de méthode&nbsp;: avant de renoncer, allongez d'un caractère — environ
          83&nbsp;% des <code>.com</code> prononçables de 5&nbsp;lettres sont pris, contre moins de 3&nbsp;% à
          7&nbsp;lettres.
        </li>
        <li>
          <strong>Une société l'utilise-t-elle déjà&nbsp;?</strong> Un homonyme dans un autre secteur n'a
          souvent aucune conséquence&nbsp;; un homonyme sur votre marché vous expose à la concurrence
          déloyale, même sans marque déposée.
        </li>
        <li>
          <strong>Est-il déposé comme marque dans vos classes&nbsp;?</strong> La seule des trois qui vous
          oblige à changer de nom, et la seule qu'on ne voit pas venir. C'est l'objet de la
          <a routerLink="/recherche-anteriorite-marque-inpi">recherche d'antériorité</a>.
        </li>
      </ul>
      <p>
        Un nom «&nbsp;non utilisé&nbsp;» au sens strict n'est donc ni nécessaire ni suffisant. Ce qu'il vous
        faut, c'est un nom que <em>personne ne peut vous reprendre</em> — ce n'est pas la même chose, et cela
        se vérifie beaucoup plus vite.
      </p>

      <h2 id="erreurs">Cinq erreurs qui coûtent cher</h2>
      <ol>
        <li>
          <strong>Tomber amoureux avant de vérifier.</strong> C'est l'erreur la plus fréquente. Après
          deux semaines passées à imaginer le logo, personne n'a envie d'abandonner le nom — on finit
          par accepter un <code>.net</code> bancal ou une orthographe tordue.
        </li>
        <li>
          <strong>Choisir une orthographe « créative ».</strong> Remplacer un <em>c</em> par un
          <em>k</em> ou supprimer une voyelle pour contourner l'indisponibilité vous condamne à épeler
          votre nom à chaque conversation, et à perdre du trafic vers l'orthographe normale.
        </li>
        <li>
          <strong>Se laisser enfermer par le nom.</strong> Un nom collé à votre première offre
          (« ParisVeloExpress ») devient un boulet dès que vous changez de ville, de produit ou de cible.
        </li>
        <li>
          <strong>Ignorer les autres langues.</strong> Vérifiez au minimum que votre nom n'a pas de sens
          malheureux en anglais, en espagnol et en allemand si vous visez l'international.
        </li>
        <li>
          <strong>Négliger l'antériorité de marque.</strong> Un domaine libre ne dit rien du droit des
          marques. C'est le seul risque de cette liste qui puisse vous obliger à tout recommencer après
          coup, communication comprise.
        </li>
      </ol>

      <app-trois-risques intro="Une marque se construit sur trois disponibilités, pas une. Elles ne se valent pas, et l'ordre dans lequel on les néglige décide de ce qu'on risque."></app-trois-risques>

      <app-article-cta
        heading="Laissez l'IA générer et vérifier à votre place"
        subheading="Décrivez votre projet : Namorama propose des dizaines de noms et teste leur disponibilité en domaine en temps réel.">
      </app-article-cta>

      <h2 id="namorama">Comment Namorama accélère chaque étape</h2>
      <p>
        Namorama réunit la génération créative et la vérification de disponibilité au même
        endroit, pour supprimer les allers-retours :
      </p>
      <ul>
        <li><strong>Reformulation par l'IA</strong> — votre description est analysée pour
          extraire l'univers de marque et des mots-clés exploitables.</li>
        <li><strong>Génération de noms originaux</strong> — l'IA propose des candidats
          inventifs, prononçables et adaptés à votre secteur, au-delà des évidences déjà prises.</li>
        <li><strong>Vérification Whois en direct</strong> — chaque nom est testé sur les
          extensions (.com, .fr, .io, .co…) ; un nom affiché comme libre l'est réellement.</li>
        <li><strong>Vue matricielle par extension</strong> — un tableau compare d'un coup
          d'œil tous les noms sur toutes les extensions.</li>
      </ul>
      <p>
        Envie d'approfondir un aspect précis ? Voyez notre comparatif des
        <a routerLink="/comparatif-generateurs-de-noms">générateurs de noms de marque</a>
        pour situer les différentes approches.
      </p>

      <h2 id="faq">Questions fréquentes</h2>
      <h3>Faut-il absolument le .com ?</h3>
      <p>
        C'est un plus pour la crédibilité, mais de nombreuses marques réussissent avec un
        .io, .co, .fr ou une extension sectorielle. L'important est la cohérence et la
        disponibilité durable.
      </p>
      <h3>Combien de noms tester avant de choisir ?</h3>
      <p>
        Une liste de 15 à 30 candidats disponibles est confortable pour arbitrer. Namorama
        en génère bien plus en quelques secondes, vous gardez les meilleurs.
      </p>
      <h3>Quelle longueur de nom viser ?</h3>
      <p>
        Sept caractères est le meilleur compromis : d'après nos mesures, moins de 3 % des
        <code>.com</code> prononçables de cette longueur sont pris, contre environ 83 % à cinq
        caractères. Descendre en dessous de sept est possible, mais demande beaucoup plus d'essais —
        et c'est un choix à faire en connaissance de cause, pas par imitation des marques que vous admirez.
      </p>
      <h3>Un nom de marque doit-il dire ce que fait l'entreprise ?</h3>
      <p>
        Non, et c'est souvent une mauvaise idée. Aucune des marques que vous citeriez spontanément —
        Apple, Amazon, Stripe, Qonto — ne décrit son activité. Un nom descriptif se comprend plus vite
        au démarrage, mais il se protège mal juridiquement, se confond avec la concurrence et vieillit
        mal quand l'activité s'élargit.
      </p>
      <h3>Puis-je utiliser un nom si le domaine est libre ?</h3>
      <p>
        Pas nécessairement. La disponibilité du domaine et la disponibilité de la marque sont deux
        questions indépendantes. Un nom peut être libre en <code>.com</code> tout en étant déposé à
        l'INPI dans votre classe : dans ce cas, l'utiliser vous expose à une action en contrefaçon.
        Vérifiez systématiquement, et faites appel à un conseil en propriété industrielle avant un dépôt.
      </p>
      <h3>Comment trouver un nom de marque qui n'existe pas encore ?</h3>
      <p>
        En cherchant «&nbsp;libre pour votre usage&nbsp;» plutôt qu'«&nbsp;inexistant&nbsp;». Générez large,
        écartez d'abord ce dont le domaine est pris, puis vérifiez l'antériorité de marque dans vos classes
        sur les deux ou trois survivants. Les noms inventés et les mots rares donnent les meilleurs taux de
        disponibilité&nbsp;; les mots courants de votre secteur, les pires — ce sont les premiers épuisés.
      </p>
      <h3>Existe-t-il un moyen gratuit de vérifier qu'un nom n'est pas pris ?</h3>
      <p>
        Oui, pour l'essentiel. La disponibilité d'un nom de domaine se vérifie gratuitement auprès du registre,
        et la recherche à l'identique dans la base des marques de l'INPI l'est aussi. Ce qui est payant, c'est
        la recherche de <em>similarités</em> — celle qui repère les noms proches, et donc le vrai risque de
        confusion.
      </p>
      <h3>Faut-il déposer la marque immédiatement ?</h3>
      <p>
        Réservez le domaine tout de suite — c'est peu coûteux et cela part vite. Le dépôt de marque,
        lui, peut attendre que le projet se confirme : il représente plusieurs centaines d'euros et
        n'a de sens qu'une fois le nom stabilisé. Vérifiez en revanche l'antériorité dès le départ,
        pour ne pas construire sur un nom qui vous sera contesté.
      </p>

      <h2 id="suite">À lire aussi</h2>
      <ul>
        <li><a routerLink="/generateur-nom-de-marque">Générateur de nom de marque</a></li>
        <li><a routerLink="/generateur-nom-entreprise">Générateur de nom d'entreprise et de société</a></li>
        <li><a routerLink="/recherche-anteriorite-marque-inpi">Recherche d'antériorité de marque (INPI)</a></li>
        <li><a routerLink="/verifier-disponibilite-nom-de-marque">Vérifier la disponibilité d'un nom</a></li>
      </ul>

      <app-article-cta></app-article-cta>
    </article>
  `,
})
export class GuideNomDeMarqueComponent {
  constructor() {
    applyContentSeo({
      title: 'Comment trouver un nom de marque disponible',
      description:
        "La méthode en 5 étapes pour trouver un nom de marque mémorable qui n'est pas déjà pris : domaine vérifié en direct, homonymes et antériorité de marque.",
      path: '/guides/trouver-nom-de-marque',
    });
  }
}
