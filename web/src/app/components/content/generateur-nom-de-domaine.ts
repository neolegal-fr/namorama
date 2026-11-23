import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TroisRisquesComponent } from './trois-risques';
import { ArticleCtaComponent } from './article-cta';
import { applyContentSeo } from './content-seo';
import { ArticleEnteteComponent } from './article-entete';

/**
 * Tête de rubrique : « générateur de nom de domaine ».
 *
 * Terme très demandé, et jusqu'ici capté par les outils de registrars (Shopify,
 * GoDaddy, OVH…), dont l'intérêt est de vendre un domaine — pas de vous dire
 * qu'un autre irait mieux. C'est l'angle de la page : le biais du vendeur, et
 * ce que « disponible » veut dire quand personne ne cherche à vous vendre
 * quelque chose derrière.
 */
@Component({
  selector: 'app-generateur-nom-de-domaine',
  standalone: true,
  imports: [ArticleEnteteComponent, TroisRisquesComponent, RouterModule, ArticleCtaComponent],
  template: `
    <article class="article">
      <app-article-entete>
        <h1>Générateur de nom de domaine disponible</h1>
      </app-article-entete>
      <p class="lead">
        Décrivez votre projet&nbsp;: l'IA propose des noms, et chaque nom de domaine est
        <strong>testé pour de vrai</strong> auprès du registre avant de vous être montré — pas estimé, pas
        deviné. Une trentaine d'extensions vérifiées (<code>.com</code>, <code>.fr</code>, <code>.io</code>,
        <code>.ai</code>, <code>.store</code>…), et <strong>aucun domaine à vous vendre</strong>&nbsp;: vous
        l'achetez où vous voulez.
      </p>

      <app-article-cta
        heading="Trouvez un nom de domaine libre"
        subheading="Une phrase suffit. L'IA génère, le registre tranche — et nous ne vendons pas de domaines."></app-article-cta>

      <h2 id="verification">Comment nous vérifions qu'un domaine est libre</h2>
      <p>
        C'est le cœur du sujet, et c'est là que les outils divergent le plus. Beaucoup de générateurs se
        contentent d'une heuristique — «&nbsp;le nom ressemble à quelque chose de disponible&nbsp;» — ou
        interrogent une base de données rafraîchie chaque semaine. Namorama fait trois choses, dans cet
        ordre&nbsp;:
      </p>
      <ol>
        <li>
          <strong>Un pré-filtre DNS.</strong> Un domaine qui a des serveurs de noms est forcément
          enregistré&nbsp;: la délégation vient de la zone du registre, on n'y figure pas autrement. Verdict
          en une vingtaine de millisecondes au lieu de plusieurs centaines. La réciproque étant fausse (un
          domaine déposé mais non configuré n'a pas de serveurs de noms), l'absence de délégation ne conclut
          jamais à «&nbsp;libre&nbsp;»&nbsp;: on repasse au registre.
        </li>
        <li>
          <strong>Le RDAP du registre.</strong> Le successeur moderne du Whois. Le verdict y est un code
          HTTP&nbsp;: 404 signifie libre, 200 signifie pris. Pas de texte à interpréter registre par
          registre, donc pas de contresens.
        </li>
        <li>
          <strong>Le Whois en repli.</strong> Beaucoup d'extensions nationales n'exposent pas de RDAP
          (<code>.de</code>, <code>.it</code>, <code>.be</code>, <code>.io</code>, <code>.co</code>…). On
          bascule alors sur le port 43, en normalisant les mises en forme avant de chercher les motifs de
          réponse.
        </li>
      </ol>
      <p>
        Et quand aucune des deux sources ne répond — un registre tombe, un autre refuse nos requêtes, un
        troisième plafonne son quota — le résultat s'affiche «&nbsp;<strong>non vérifiable</strong>&nbsp;».
        C'est le troisième état, et il est là par expérience&nbsp;: sans lui, une panne de registre se
        déguise en verdict. Nous avons vu le <code>.app</code> annoncé pris pendant des semaines parce qu'un
        serveur avait été retiré, et des <code>.de</code>, <code>.it</code>, <code>.ch</code> annoncés libres
        alors qu'ils étaient pris. Un doute qui retombe sur «&nbsp;libre&nbsp;» vous fait payer pour un
        domaine inachetable&nbsp;; sur «&nbsp;pris&nbsp;», il vous fait renoncer au bon nom.
      </p>

      <h2 id="registrars">Pourquoi ne pas simplement utiliser l'outil de son hébergeur</h2>
      <p>
        Les générateurs de GoDaddy, OVH, Hostinger ou Shopify sont gratuits, rapides et souvent bons. Ils ont
        un biais structurel qu'il faut connaître&nbsp;: leur métier est de <strong>vous vendre un
        domaine</strong>. Quand le nom que vous cherchez est pris, ils proposent naturellement une extension
        exotique disponible plutôt que de vous suggérer un autre nom — et une extension de repli mal choisie
        vous coûte plus longtemps qu'un nom recommencé.
      </p>
      <p>
        Namorama ne vend pas de domaines et n'a aucune commission d'affiliation en jeu&nbsp;: quand un nom est
        pris partout, l'outil vous le dit et vous en propose un autre. Vous achetez ensuite chez le registrar
        de votre choix, au prix du marché.
      </p>

      <h2 id="choisir">Choisir un nom de domaine qui tient dans le temps</h2>
      <ul>
        <li>
          <strong>Allongez d'un caractère avant de renoncer.</strong> D'après nos mesures, environ 83&nbsp;%
          des <code>.com</code> prononçables de 5&nbsp;lettres sont pris, contre moins de 3&nbsp;% à
          7&nbsp;lettres. La frontière du «&nbsp;tout est pris&nbsp;» est plus étroite qu'on ne le croit.
        </li>
        <li>
          <strong>Pas de tiret, pas de chiffre, pas d'orthographe contournée.</strong> Ils survivent mal à
          l'oral&nbsp;: vous passerez votre vie à épeler, et une partie de votre trafic ira à l'orthographe
          normale — c'est-à-dire chez quelqu'un d'autre.
        </li>
        <li>
          <strong>Le <code>.fr</code> mérite mieux que son statut de repli.</strong> Il est crédible auprès
          d'une clientèle française, souvent moins cher, et surtout <strong>bien plus disponible</strong>. Un
          nom perdu en <code>.com</code> est fréquemment libre en <code>.fr</code>.
        </li>
        <li>
          <strong>Vérifiez le <code>.com</code> même si vous prenez autre chose.</strong> S'il appartient à un
          tiers actif, une partie de vos visiteurs atterrira chez lui en tapant votre nom de mémoire.
        </li>
        <li>
          <strong>Un domaine libre ne suffit pas.</strong> Le nom peut être déposé comme marque, et c'est le
          seul des trois plans dont l'échec vous fait changer de nom.
        </li>
      </ul>

      <app-trois-risques intro="Le domaine se vérifie en une seconde ; c'est aussi celui des trois contrôles dont l'échec coûte le moins cher."></app-trois-risques>

      <h2 id="faq">Questions fréquentes</h2>
      <h3>Comment savoir si un nom de domaine est vraiment disponible&nbsp;?</h3>
      <p>
        Seule une interrogation du registre fait foi — RDAP, ou Whois pour les extensions qui n'en exposent
        pas. Les listes «&nbsp;domaines disponibles&nbsp;» et les estimations d'outils tiers vieillissent en
        quelques heures. Un domaine affiché libre puis refusé à l'achat, c'est presque toujours une
        vérification qui n'en était pas une.
      </p>
      <h3>Existe-t-il un générateur de nom de domaine gratuit&nbsp;?</h3>
      <p>
        Ceux des registrars le sont, avec le biais commercial décrit plus haut. Chez Namorama, l'essai se fait
        sans inscription et le compte ouvre 100&nbsp;crédits offerts chaque mois — environ 50 noms vérifiés,
        sans abonnement. La vérification a un coût réel&nbsp;: chaque nom déclenche des requêtes vers des
        registres qui appliquent leurs propres quotas.
      </p>
      <h3>Le domaine que je veux est pris par un site inactif&nbsp;: puis-je le récupérer&nbsp;?</h3>
      <p>
        Un domaine sans site visible a quand même un propriétaire — c'est exactement le cas que les outils
        approximatifs confondent avec un domaine libre. Le racheter se négocie souvent à plusieurs milliers
        d'euros, et rien n'oblige le titulaire à répondre. Chercher un autre nom est presque toujours plus
        rentable.
      </p>
      <h3>Faut-il acheter plusieurs extensions&nbsp;?</h3>
      <p>
        Deux suffisent dans la plupart des cas&nbsp;: celle que vous utilisez, et le <code>.com</code> s'il est
        libre, en redirection. Au-delà, la dépense se justifie mal — vous ne pourrez de toute façon pas
        couvrir les centaines d'extensions existantes, et ce n'est pas ce qui protège votre nom. Le dépôt de
        marque, oui.
      </p>

      <h2 id="suite">À lire aussi</h2>
      <ul>
        <li><a routerLink="/generateur-nom-de-marque">Générateur de nom de marque</a></li>
        <li><a routerLink="/generateur-nom-entreprise">Générateur de nom d'entreprise et de société</a></li>
        <li><a routerLink="/verifier-disponibilite-nom-de-marque">Vérifier la disponibilité d'un nom</a></li>
        <li><a routerLink="/comparatif-generateurs-de-noms">Comparatif des générateurs de noms</a></li>
      </ul>
    </article>
  `,
})
export class GenerateurNomDeDomaineComponent {
  constructor() {
    applyContentSeo({
      title: 'Générateur de nom de domaine disponible',
      description:
        "Générateur de nom de domaine par IA : chaque nom est testé auprès du registre (RDAP, repli Whois), sur 30 extensions. Nous ne vendons pas de domaines.",
      path: '/generateur-nom-de-domaine',
    });
  }
}
