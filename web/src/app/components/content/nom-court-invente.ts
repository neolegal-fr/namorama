import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TroisRisquesComponent } from './trois-risques';
import { ArticleCtaComponent } from './article-cta';
import { applyContentSeo } from './content-seo';
import { ArticleEnteteComponent } from './article-entete';

/**
 * Page intention « meta-naming » : nom court, inventé, premium façon Qonto/Stripe.
 * Reprend mot pour mot la demande la plus fréquente des utilisateurs réels.
 * Cible « nom de marque court inventé », « nom de startup style Qonto »,
 * « nom premium inventé », « brandable name ».
 */
@Component({
  selector: 'app-nom-court-invente',
  standalone: true,
  imports: [ArticleEnteteComponent, TroisRisquesComponent, RouterModule, ArticleCtaComponent],
  template: `
    <article class="article">
      <app-article-entete>
        <h1>Trouver un nom de marque court et inventé (façon Qonto, Stripe, Notion)</h1>
      </app-article-entete>
      <p class="lead">
        Vous cherchez un nom <strong>court, inventé et premium</strong> — 5 à 8 lettres, prononçable partout,
        qui sonne comme <em>Qonto, Stripe, Figma, Notion ou Brevo</em> — <strong>avec le domaine libre</strong>
        (<code>.com</code>, <code>.fr</code>)&nbsp;? C'est exactement ce que génère l'IA de Namorama, en
        vérifiant la disponibilité en temps réel.
      </p>

      <h2 id="pourquoi">Pourquoi les meilleures marques sont des mots inventés</h2>
      <p>
        Qonto, Stripe, Figma, Notion, Algolia&nbsp;: aucune ne <em>décrit</em> son produit. Un nom
        <strong>arbitraire</strong> présente trois avantages décisifs&nbsp;: il est
        <strong>disponible</strong> (les mots du dictionnaire sont pris en <code>.com</code>), il se
        <strong>protège</strong> facilement en marque, et il devient une <strong>marque forte</strong> qui
        s'étend à de nouveaux produits sans se contredire.
      </p>

      <h2 id="recette">La recette d'un bon nom inventé</h2>
      <ul>
        <li><strong>Court</strong> : 5 à 8 lettres, 2 syllabes, facile à taper.</li>
        <li><strong>Prononçable en français ET en anglais</strong> : une seule lecture évidente, sans hésitation.</li>
        <li><strong>Sonorité premium</strong> : voyelles ouvertes, consonnes nettes (le «&nbsp;o&nbsp;» de Qonto,
          le «&nbsp;i&nbsp;» de Figma).</li>
        <li><strong>Sans mot descriptif</strong> : évitez «&nbsp;tech&nbsp;», «&nbsp;smart&nbsp;», «&nbsp;AI&nbsp;»,
          «&nbsp;pro&nbsp;» — ils datent et sont saturés.</li>
        <li><strong>Le «&nbsp;test radio&nbsp;»</strong> : entendu une fois, on doit pouvoir l'écrire correctement.</li>
      </ul>

      <h2 id="obstacle">Le vrai obstacle : la disponibilité</h2>
      <p>
        Générer un joli nom inventé est facile&nbsp;; en trouver un <em>dont le <code>.com</code> est encore
        libre</em> est le vrai défi. Beaucoup de nos utilisateurs écrivent d'ailleurs leur demande comme un
        brief&nbsp;: «&nbsp;un nom court, inventé, premium, dispo en .com et .fr&nbsp;».
        <a routerLink="/app">Namorama</a> automatise exactement ça&nbsp;: il invente des dizaines de noms
        <em>brandables</em> et <strong>teste chaque domaine par Whois réel</strong>, pour ne vous montrer que
        des noms réellement enregistrables.
      </p>

      <app-trois-risques intro="Un nom court et inventé passe plus souvent les trois contrôles — mais « plus souvent » n'est pas « toujours »."></app-trois-risques>

      <app-article-cta
        heading="Générez votre nom court et inventé"
        subheading="Décrivez votre projet, l'IA invente des noms premium façon Qonto / Stripe et vérifie le domaine (.com, .fr) en direct."
      ></app-article-cta>

      <h2 id="rarete">Ce que coûte vraiment un nom court</h2>
      <p>
        Avant de viser cinq lettres, regardez les chiffres. Sur des noms prononçables tirés au sort et vérifiés
        un par un au Whois le 1<sup>er</sup> août 2026&nbsp;:
      </p>
      <table class="compare">
        <thead>
          <tr><th>Longueur</th><th>.com déjà pris</th><th>Ce que ça implique</th></tr>
        </thead>
        <tbody>
          <tr><td>5 caractères</td><td class="no">≈ 83 %</td><td>Très difficile — beaucoup d'essais</td></tr>
          <tr><td>6 caractères</td><td>≈ 34 %</td><td>Jouable avec de la persévérance</td></tr>
          <tr><td>7 caractères</td><td class="yes">≈ 2,5 %</td><td>Le bon compromis</td></tr>
        </tbody>
      </table>
      <p>
        Autrement dit, deux caractères de plus font basculer la recherche de «&nbsp;presque impossible&nbsp;» à
        «&nbsp;presque toujours faisable&nbsp;». Et n'oubliez pas que Qonto, Stripe ou Notion ont acquis leur
        domaine il y a dix ans, ou l'ont racheté à prix fort sur le marché secondaire.
      </p>

      <h2 id="fabrique">Comment se fabrique un nom court qui tient</h2>
      <ul>
        <li>
          <strong>Alterner consonnes et voyelles.</strong> Les motifs du type consonne-voyelle-consonne-voyelle
          (<em>veli</em>, <em>rako</em>, <em>zuno</em>) se prononcent sans effort dans presque toutes les
          langues, ce qui est précisément le point.
        </li>
        <li>
          <strong>Chercher les lettres rares.</strong> Les <em>k</em>, <em>q</em>, <em>v</em>, <em>x</em> et
          <em>z</em> augmentent nettement vos chances de trouver un domaine libre, et donnent du caractère —
          à condition de rester prononçable.
        </li>
        <li>
          <strong>Tronquer un mot réel.</strong> Beaucoup de marques fortes sont des mots amputés&nbsp;: on
          garde la racine reconnaissable et on gagne en disponibilité.
        </li>
        <li>
          <strong>Fusionner deux racines courtes</strong> plutôt que de coller deux mots entiers, qui
          rallongent et alourdissent.
        </li>
      </ul>
      <p>
        À éviter absolument&nbsp;: l'orthographe déformée pour contourner une indisponibilité. Supprimer une
        voyelle ou substituer un <em>k</em> à un <em>c</em> vous condamne à épeler votre nom à chaque
        conversation, et à perdre le trafic qui va vers l'orthographe normale.
      </p>

      <h2 id="faq">Questions fréquentes</h2>
      <h3>Un nom inventé peut-il être déposé comme marque&nbsp;?</h3>
      <p>
        Oui, et c'est même le cas le plus favorable&nbsp;: un signe arbitraire est bien plus distinctif, donc
        plus facile à protéger, qu'un nom descriptif. La vérification d'antériorité à l'INPI reste indispensable.
      </p>
      <h3>Comment donner du sens à un nom qui n'en a pas&nbsp;?</h3>
      <p>
        Par l'usage, et uniquement par lui. « Qonto » ne voulait rien dire avant Qonto. C'est le coût d'un nom
        inventé&nbsp;: il faut un minimum de communication pour l'installer. En contrepartie, il vous appartient
        entièrement et ne vieillit pas.
      </p>
      <h3>Faut-il racheter un domaine court déjà pris&nbsp;?</h3>
      <p>
        Rarement au démarrage. Les domaines courts se négocient de quelques milliers à plusieurs dizaines de
        milliers d'euros — un budget qui, à ce stade, sert presque toujours mieux ailleurs. Générer un nom de
        sept caractères réellement libre coûte quelques minutes.
      </p>

      <h2 id="suite">Guides liés</h2>
      <ul>
        <li><a routerLink="/generateur-nom-startup-ia">Générateur de nom pour startup IA</a></li>
        <li><a routerLink="/generateur-nom-saas">Générateur de nom pour SaaS / logiciel B2B</a></li>
        <li><a routerLink="/guides/trouver-nom-de-startup">Guide : trouver un nom de startup</a></li>
      </ul>
    </article>
  `,
})
export class NomCourtInventeComponent {
  constructor() {
    applyContentSeo({
      title: 'Nom de marque court et inventé, façon Qonto',
      description:
        "Trouvez un nom de marque court, inventé et premium façon Qonto ou Stripe, avec le domaine (.com, .fr) disponible vérifié en temps réel par l'IA de Namorama.",
      path: '/nom-de-startup-court-invente',
    });
  }
}
