import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TroisRisquesComponent } from './trois-risques';
import { ArticleCtaComponent } from './article-cta';
import { applyContentSeo } from './content-seo';
import { ArticleEnteteComponent } from './article-entete';

/**
 * Landing sectorielle : générateur de nom pour startup IA. Cible « nom de
 * startup IA », « nom entreprise intelligence artificielle », « nom marque IA ».
 * Cluster n°1 des recherches réelles en prod.
 */
@Component({
  selector: 'app-generateur-nom-startup-ia',
  standalone: true,
  imports: [ArticleEnteteComponent, TroisRisquesComponent, RouterModule, ArticleCtaComponent],
  template: `
    <article class="article">
      <app-article-entete>
        <h1>Générateur de nom pour startup IA</h1>
      </app-article-entete>
      <p class="lead">
        Trouvez un <strong>nom de marque pour votre startup d'intelligence artificielle</strong> — court,
        premium et facile à prononcer — avec le <strong>domaine disponible vérifié en temps réel</strong>
        (<code>.ai</code>, <code>.com</code>, <code>.io</code>). Décrivez votre projet, l'IA propose des
        dizaines de noms <em>brandables</em> et teste chaque domaine par Whois réel.
      </p>

      <h2 id="codes">À quoi ressemble un bon nom de startup IA&nbsp;?</h2>
      <ul>
        <li><strong>Court et inventé</strong> : 5 à 8 lettres, sans mot descriptif. Les meilleures marques tech
          (Qonto, Stripe, Notion, Mistral) ne <em>décrivent</em> pas le produit — elles sonnent bien.</li>
        <li><strong>Sans «&nbsp;AI&nbsp;» collé partout</strong> : «&nbsp;SmartAI&nbsp;», «&nbsp;DataAI&nbsp;»
          sont génériques et déjà pris. Un nom arbitraire vieillit mieux et se protège plus facilement.</li>
        <li><strong>Prononçable en français et en anglais</strong> : votre startup vise souvent l'international
          dès le départ.</li>
        <li><strong>Extension crédible</strong> : <code>.ai</code> est devenu un signal fort dans l'écosystème IA,
          mais un <code>.com</code> ou <code>.io</code> libre reste un atout de confiance.</li>
      </ul>

      <h2 id="methode">La contrainte n°1 : un domaine réellement libre</h2>
      <p>
        Le vrai problème n'est pas de <em>trouver une idée</em> de nom, mais d'en trouver une
        <em>dont le domaine est encore disponible</em>. Les générateurs classiques proposent de jolis noms…
        déjà enregistrés. <a routerLink="/app">Namorama</a> inverse la logique&nbsp;: il génère des noms
        inventés adaptés à l'IA <strong>puis vérifie la disponibilité en direct</strong> sur <code>.ai</code>,
        <code>.com</code>, <code>.io</code> et l'extension de votre choix. Vous ne repartez qu'avec des noms
        réellement enregistrables aujourd'hui.
      </p>

      <app-trois-risques intro="L'IA propose vite. Ces trois contrôles disent lequel de ses noms tiendra dans deux ans."></app-trois-risques>

      <app-article-cta
        heading="Nommez votre startup IA"
        subheading="Décrivez votre produit IA, l'IA génère des noms premium et vérifie le domaine (.ai, .com, .io) en direct."
      ></app-article-cta>

      <h2 id="cliches">Les clichés du naming IA, et pourquoi les éviter</h2>
      <p>
        Aucun secteur n'a produit autant de noms interchangeables en aussi peu de temps. Les schémas
        saturés sont identifiables en un coup d'œil&nbsp;:
      </p>
      <ul>
        <li>
          <strong>Le suffixe <code>-AI</code></strong> accolé à un mot courant. C'est devenu si systématique
          que le suffixe ne signale plus rien — sinon que vous nommez en 2024. Il vieillira exactement comme
          les <code>-2.0</code> et les <code>e-</code> avant lui.
        </li>
        <li>
          <strong>Le champ lexical cognitif</strong> — <em>mind</em>, <em>brain</em>, <em>neuro</em>,
          <em>synapse</em>, <em>cortex</em>. Épuisé, en domaine comme en marque.
        </li>
        <li>
          <strong>La mythologie grecque</strong>, réflexe du secteur depuis dix ans. Les noms disponibles y
          sont désormais rares et les collisions fréquentes.
        </li>
      </ul>
      <p>
        Le vrai test&nbsp;: votre nom fonctionnera-t-il encore quand l'IA ne sera plus un argument mais une
        évidence, comme l'est devenu le cloud&nbsp;? Les marques qui ont traversé les vagues technologiques
        précédentes portent des noms qui ne mentionnaient jamais la technologie.
      </p>

      <h2 id="levee">Ce que votre nom dit à un investisseur</h2>
      <p>
        Si vous prévoyez de lever des fonds, deux détails comptent plus qu'on ne le croit. D'abord, un nom que
        l'on doit épeler en réunion, ou dont le <code>.com</code> appartient visiblement à quelqu'un d'autre,
        envoie un signal d'amateurisme — c'est injuste, mais c'est ainsi. Ensuite, un nom trop collé à votre
        cas d'usage initial complique le récit du pivot, alors que les startups IA pivotent
        particulièrement souvent.
      </p>

      <h2 id="extension">.ai, .com ou .io pour une startup IA&nbsp;?</h2>
      <p>
        Le <code>.ai</code> affiche immédiatement votre positionnement et de nombreuses startups IA l'adoptent.
        Le <code>.com</code> reste le réflexe de confiance mondial&nbsp;; le <code>.io</code> est un classique de
        la tech. La règle pragmatique&nbsp;: choisissez un nom dont <strong>au moins une extension forte est
        libre maintenant</strong>, plutôt qu'un nom parfait dont le <code>.com</code> est inaccessible.
      </p>

      <h2 id="faq">Questions fréquentes</h2>
      <h3>Faut-il mettre « AI » dans le nom&nbsp;?</h3>
      <p>
        Généralement non. C'est le réflexe le plus répandu, donc celui qui distingue le moins, et il date votre
        marque. Mieux vaut un nom qui tiendra quand l'IA sera un acquis — vous expliquerez ce que vous faites
        dans votre accroche, pas dans votre nom.
      </p>
      <h3>Le <code>.ai</code> vaut-il son prix&nbsp;?</h3>
      <p>
        Il est nettement plus cher que le <code>.com</code> au renouvellement, et c'est un coût récurrent à
        assumer. Il signale clairement le secteur et reste bien plus disponible, ce qui le rend séduisant au
        démarrage&nbsp;; en contrepartie, il inscrit durablement votre marque dans une catégorie que vous
        quitterez peut-être.
      </p>
      <h3>Un nom inventé ou un mot existant&nbsp;?</h3>
      <p>
        Inventé, dans la grande majorité des cas. Les mots existants pertinents sont pris depuis longtemps en
        <code>.com</code>, et ils se protègent mal comme marque. Un nom inventé de 6 à 8 caractères offre le
        meilleur rapport entre disponibilité, mémorisation et solidité juridique.
      </p>
      <h3>Mon nom doit-il fonctionner en anglais&nbsp;?</h3>
      <p>
        Si vous visez un marché international ou des investisseurs étrangers, oui&nbsp;: vérifiez au minimum la
        prononciation et l'absence de faux ami. Un nom inventé sans langue identifiable reste le choix le plus
        sûr — c'est d'ailleurs ce que font la plupart des marques qui s'exportent.
      </p>

      <h2 id="suite">Guides liés</h2>
      <ul>
        <li><a routerLink="/nom-de-startup-court-invente">Nom de startup court et inventé (façon Qonto, Stripe)</a></li>
        <li><a routerLink="/generateur-nom-saas">Générateur de nom pour SaaS / logiciel B2B</a></li>
        <li><a routerLink="/guides/trouver-nom-de-startup">Guide : trouver un nom de startup</a></li>
      </ul>
    </article>
  `,
})
export class GenerateurNomStartupIaComponent {
  constructor() {
    applyContentSeo({
      title: 'Générateur de nom pour startup IA',
      description:
        "Trouvez un nom de marque pour votre startup IA : court, premium, avec le domaine (.ai, .com, .io) disponible vérifié en temps réel par l'IA de Namorama.",
      path: '/generateur-nom-startup-ia',
    });
  }
}
