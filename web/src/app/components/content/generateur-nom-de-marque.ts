import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TroisRisquesComponent } from './trois-risques';
import { ArticleCtaComponent } from './article-cta';
import { applyContentSeo } from './content-seo';
import { ArticleEnteteComponent } from './article-entete';

/**
 * Tête de rubrique : « générateur de nom de marque ».
 *
 * C'est le terme générique le plus demandé du domaine, et il n'avait aucune
 * page dédiée : le site couvrait les secteurs (SaaS, cosmétique, e-commerce)
 * et la méthode (/guides/...), jamais l'outil lui-même. Les deux modificateurs
 * qui reviennent systématiquement dans les recherches — « gratuit » et
 * « IA » — sont donc traités ici, en toutes lettres, plutôt que d'être laissés
 * à des pages qui parlent d'autre chose.
 */
@Component({
  selector: 'app-generateur-nom-de-marque',
  standalone: true,
  imports: [ArticleEnteteComponent, TroisRisquesComponent, RouterModule, ArticleCtaComponent],
  template: `
    <article class="article">
      <app-article-entete>
        <h1>Générateur de nom de marque gratuit, avec le domaine vérifié</h1>
      </app-article-entete>
      <p class="lead">
        Décrivez votre projet en une phrase&nbsp;: l'IA propose des <strong>noms de marque</strong> adaptés, et
        Namorama <strong>vérifie en direct</strong> si le nom de domaine est réellement libre
        (<code>.com</code>, <code>.fr</code>, et une trentaine d'autres extensions). Pas d'estimation, pas de
        «&nbsp;probablement disponible&nbsp;»&nbsp;: une interrogation réelle du registre, nom par nom.
        <strong>100 crédits offerts</strong> à l'inscription, sans abonnement.
      </p>

      <app-article-cta
        heading="Générez des noms de marque disponibles"
        subheading="Une phrase suffit. L'IA génère, le registre tranche — libre ou pris, sans approximation."></app-article-cta>

      <h2 id="difference">Ce qui distingue un générateur utile d'une liste d'idées</h2>
      <p>
        Générer des noms est devenu facile&nbsp;: n'importe quel modèle de langage en produit cinquante en
        quelques secondes, et la plupart des générateurs gratuits ne font rien de plus. Le problème est ailleurs.
        Sur une liste de noms «&nbsp;évidents&nbsp;» pour un secteur donné, l'écrasante majorité est
        <strong>déjà déposée en domaine</strong> — souvent depuis dix ans, parfois par un revendeur qui n'en fera
        rien. Le travail réel commence donc après la génération, et c'est celui que presque personne ne fait
        pour vous.
      </p>
      <p>
        Namorama inverse l'ordre&nbsp;: chaque nom proposé est <strong>testé avant de vous être montré</strong>.
        La vérification passe d'abord par un pré-filtre DNS (un domaine délégué est forcément enregistré), puis
        par le protocole <strong>RDAP</strong> du registre concerné, avec repli sur le <strong>Whois</strong>
        pour les extensions qui n'exposent pas de RDAP. Quand aucune des deux sources ne répond — cela arrive,
        un registre tombe en panne ou refuse nos requêtes — le résultat s'affiche
        «&nbsp;<strong>non vérifiable</strong>&nbsp;», jamais «&nbsp;libre&nbsp;». Un faux
        «&nbsp;libre&nbsp;» vous ferait perdre une journée&nbsp;; un faux «&nbsp;pris&nbsp;» vous ferait écarter
        le bon nom.
      </p>

      <h2 id="gratuit">Le générateur est-il gratuit&nbsp;?</h2>
      <p>
        Oui, pour essayer&nbsp;: la recherche se lance <strong>sans inscription</strong>, et l'inscription
        ouvre <strong>100 crédits offerts, renouvelés chaque mois</strong>. Une suggestion de nom vérifiée
        coûte un crédit — de quoi explorer une cinquantaine de noms par mois sans rien payer, et sans
        abonnement à résilier.
      </p>
      <p>
        Nous préférons l'annoncer clairement plutôt que d'écrire «&nbsp;100&nbsp;% gratuit&nbsp;» en gros et de
        placer la limite en petit&nbsp;: la vérification de disponibilité a un coût réel, chaque nom
        déclenchant des requêtes vers des registres qui appliquent leurs propres quotas. Un générateur
        entièrement gratuit est un générateur qui ne vérifie rien — ou qui se rémunère en vous vendant le
        domaine, ce qui n'incite pas à vous dire qu'il est cher.
      </p>

      <h2 id="ia">Générateur aléatoire, combinatoire ou IA&nbsp;?</h2>
      <ul>
        <li>
          <strong>Combinatoire</strong> (préfixe + suffixe, <code>-ify</code>, <code>-ly</code>, <code>-oo</code>)&nbsp;:
          rapide, mais les résultats se ressemblent tous et sonnent «&nbsp;2014&nbsp;». Utile pour débloquer
          l'imagination, rarement pour choisir.
        </li>
        <li>
          <strong>Aléatoire</strong> (syllabes tirées au sort)&nbsp;: produit des noms disponibles justement
          parce qu'ils ne veulent rien dire. Le domaine est libre, la marque est vide de sens, et il faudra
          des années de publicité pour la remplir.
        </li>
        <li>
          <strong>IA à partir de votre description</strong>&nbsp;: le modèle part de votre marché, de votre
          promesse et de votre ton, et peut produire aussi bien des noms descriptifs que des noms inventés.
          C'est l'approche de Namorama, avec deux réglages qui comptent en France&nbsp;: les
          <strong>noms descriptifs</strong> (compréhensibles au premier coup d'œil) et les
          <strong>références culturelles</strong> (racines latines, grecques, ou clins d'œil français), que
          les outils anglophones ne proposent pas.
        </li>
      </ul>

      <h2 id="qui-nexiste-pas">Comment trouver un nom de marque qui n'existe pas encore</h2>
      <p>
        C'est la formulation la plus fréquente de la question, et elle mérite une réponse précise&nbsp;: un nom
        «&nbsp;qui n'existe pas&nbsp;» n'existe pas non plus. Tout mot prononçable a déjà été déposé quelque
        part, par quelqu'un, dans une classe ou une extension. La vraie question est&nbsp;:
        <strong>libre pour votre usage à vous</strong>. Trois plans, et ils ne se recouvrent pas.
      </p>
      <ol>
        <li>
          <strong>Le domaine</strong> — le seul plan binaire, et le plus facile à vérifier. Un conseil de
          méthode&nbsp;: allongez d'un caractère avant de renoncer. D'après nos mesures au Whois, environ
          83&nbsp;% des <code>.com</code> prononçables de 5&nbsp;lettres sont pris, contre moins de 3&nbsp;% à
          7&nbsp;lettres. Deux lettres de plus changent tout.
        </li>
        <li>
          <strong>Le registre du commerce</strong> — une dénomination sociale identique à celle d'une société
          existante n'est pas interdite en soi, mais elle vous expose à une action en concurrence déloyale si
          vous êtes sur le même secteur.
        </li>
        <li>
          <strong>La marque déposée</strong> — le plan qui coûte cher et qu'on saute le plus souvent. Un nom
          libre en <code>.com</code> peut être déposé à l'<a routerLink="/recherche-anteriorite-marque-inpi">INPI</a>
          dans votre classe de produits.
        </li>
      </ol>

      <app-trois-risques intro="« Qui n'existe pas » recouvre trois vérifications distinctes, dont une seule est gratuite et immédiate."></app-trois-risques>

      <h2 id="methode">Une méthode en quatre temps</h2>
      <ol>
        <li><strong>Décrivez le projet, pas le nom souhaité.</strong> «&nbsp;Application de suivi de chantier
          pour artisans du bâtiment&nbsp;» donne de bien meilleurs résultats que «&nbsp;nom moderne et
          dynamique&nbsp;».</li>
        <li><strong>Choisissez vos extensions d'abord.</strong> Si vos clients sont français, le
          <code>.fr</code> est à la fois plus crédible et nettement plus disponible que le <code>.com</code>.</li>
        <li><strong>Écartez sans regret.</strong> Un nom qu'il faut épeler au téléphone est un nom que vous
          épellerez toute votre vie. Supprimer une voyelle pour récupérer un domaine pris est le regret le
          plus fréquent.</li>
        <li><strong>Vérifiez les trois plans sur votre finaliste</strong>, avant le logo, avant les cartes de
          visite, avant d'en parler autour de vous.</li>
      </ol>

      <h2 id="faq">Questions fréquentes</h2>
      <h3>Un générateur de nom de marque, c'est vraiment gratuit&nbsp;?</h3>
      <p>
        Chez Namorama, la recherche s'essaie sans inscription et le compte ouvre 100&nbsp;crédits offerts
        chaque mois, soit environ 50 noms vérifiés — sans abonnement. Les générateurs annoncés
        «&nbsp;entièrement gratuits&nbsp;» ne vérifient généralement pas la disponibilité réelle, ou
        appartiennent à un vendeur de domaines&nbsp;: le nom est gratuit, l'arrière-boutique ne l'est pas.
      </p>
      <h3>Puis-je déposer un nom généré par une IA&nbsp;?</h3>
      <p>
        Oui. Un nom n'est pas protégé parce qu'une machine l'a proposé, et rien ne s'oppose à son dépôt&nbsp;:
        c'est l'antériorité d'un tiers qui bloque, pas l'origine de l'idée. Vérifiez simplement qu'il n'est pas
        déjà déposé dans vos classes avant de vous engager.
      </p>
      <h3>Combien de noms faut-il générer avant d'en trouver un bon&nbsp;?</h3>
      <p>
        En pratique, une trentaine de noms vérifiés suffisent à faire émerger deux ou trois finalistes
        crédibles. Au-delà, ce n'est plus un problème de génération mais de décision — et générer davantage ne
        la rend pas plus facile.
      </p>
      <h3>Le nom doit-il décrire mon activité&nbsp;?</h3>
      <p>
        Pas nécessairement, et c'est même risqué&nbsp;: un nom purement descriptif est difficile à protéger
        comme marque (il manque de caractère distinctif) et vous enferme dans votre offre du moment. Un nom
        évocateur, ou inventé mais euphonique, vieillit mieux.
      </p>

      <h2 id="suite">À lire aussi</h2>
      <ul>
        <li><a routerLink="/guides/trouver-nom-de-marque">Guide&nbsp;: trouver un nom de marque disponible</a></li>
        <li><a routerLink="/generateur-nom-entreprise">Générateur de nom d'entreprise et de société</a></li>
        <li><a routerLink="/generateur-nom-de-domaine">Générateur de nom de domaine</a></li>
        <li><a routerLink="/recherche-anteriorite-marque-inpi">Recherche d'antériorité de marque (INPI)</a></li>
        <li><a routerLink="/comparatif-generateurs-de-noms">Comparatif des générateurs de noms</a></li>
      </ul>
    </article>
  `,
})
export class GenerateurNomDeMarqueComponent {
  constructor() {
    applyContentSeo({
      title: 'Générateur de nom de marque gratuit (IA)',
      description:
        "Générateur de nom de marque par IA : décrivez votre projet, obtenez des noms dont le domaine est vérifié libre en direct (.com, .fr). 100 crédits offerts.",
      path: '/generateur-nom-de-marque',
    });
  }
}
