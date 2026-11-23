import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TroisRisquesComponent } from './trois-risques';
import { ArticleCtaComponent } from './article-cta';
import { applyContentSeo } from './content-seo';
import { ArticleEnteteComponent } from './article-entete';

/**
 * Guide : trouver un nom de startup. Page prérendue (SSG) ciblant
 * « nom de startup », « trouver un nom de startup », « naming startup ».
 */
@Component({
  selector: 'app-guide-nom-de-startup',
  standalone: true,
  imports: [ArticleEnteteComponent, TroisRisquesComponent, RouterModule, ArticleCtaComponent],
  template: `
    <article class="article">
      <app-article-entete>
        <h1>Comment trouver un nom de startup (court, mémorable, dispo) ?</h1>
      </app-article-entete>
      <p class="lead">
        Une startup nomme vite, communique vite, et lève parfois vite&nbsp;: le nom doit tenir sur un slide,
        une URL et un logo dès le premier jour. La contrainte numéro un&nbsp;: <strong>un nom de domaine
        disponible</strong>, idéalement en <code>.com</code>, <code>.io</code> ou <code>.ai</code>.
      </p>

      <h2 id="codes">Les codes du naming startup</h2>
      <ul>
        <li><strong>Court</strong> : 2 à 3 syllabes, facile à taper et à retenir.</li>
        <li><strong>Inventé ou évocateur</strong> : les mots du dictionnaire sont presque tous pris en <code>.com</code>.</li>
        <li><strong>« Brandable »</strong> : un nom qui peut devenir un verbe ou une marque forte (« to google », « to zoom »).</li>
        <li><strong>Extension crédible</strong> : <code>.com</code> reste roi, mais <code>.io</code>, <code>.ai</code> et <code>.co</code> sont parfaitement acceptés dans la tech.</li>
      </ul>

      <h2 id="techniques">Techniques qui fonctionnent</h2>
      <p>
        <strong>Contractions et fusions</strong> (Pinterest = pin + interest), <strong>suffixes courts</strong>
        (-ly, -io, -ify), <strong>voyelles retirées</strong> (Flickr, Tumblr), <strong>mots étrangers ou
        latins</strong> (Sonos, Algolia). L'enjeu n'est pas de trouver une idée, mais d'en trouver
        <em>une dont le domaine est libre</em>.
      </p>
      <p>
        C'est là que <a routerLink="/app">Namorama</a> change la donne&nbsp;: décrivez votre startup en une
        phrase, l'IA propose des dizaines de noms <em>brandables</em> et teste en direct la disponibilité du
        domaine (Whois réel). Vous ne perdez plus une journée à vérifier des noms déjà pris à la main.
      </p>

      <app-trois-risques intro="Une startup qui décolle attire l'attention — y compris celle des titulaires de marques. Trois contrôles, à faire avant la première levée."></app-trois-risques>

      <app-article-cta
        heading="Trouvez le nom de votre startup"
        subheading="Décrivez votre projet, l'IA génère des noms brandables et vérifie le domaine en direct."
      ></app-article-cta>

      <h2 id="longueur">Pourquoi les noms très courts sont un piège</h2>
      <p>
        Qonto, Stripe, Notion&nbsp;: les modèles que tout fondateur cite ont des noms de cinq ou six lettres.
        L'imitation est compréhensible, mais elle se heurte à une réalité mesurable. Sur des noms prononçables
        tirés au sort et vérifiés au Whois, nous avons observé qu'<strong>environ 83&nbsp;% des
        <code>.com</code> de 5 caractères sont déjà pris</strong>, contre à peu près 34&nbsp;% à
        6 caractères, et moins de 3&nbsp;% à 7 caractères.
      </p>
      <p>
        Deux caractères de plus font donc basculer la recherche de «&nbsp;presque impossible&nbsp;» à
        «&nbsp;presque toujours faisable&nbsp;». Rappelez-vous aussi que ces marques ont acheté leur domaine il
        y a dix ans, ou l'ont racheté à prix fort. Viser cinq lettres est un choix légitime, à condition de
        savoir qu'il coûtera soit beaucoup de temps, soit beaucoup d'argent.
      </p>

      <h2 id="pivot">Un nom qui survit au pivot</h2>
      <p>
        La plupart des startups changent de produit, de cible ou de modèle avant de trouver leur marché. Un nom
        collé au premier positionnement devient alors un frein narratif&nbsp;: il faut l'expliquer à chaque
        présentation, ou en changer au pire moment.
      </p>
      <p>
        D'où la préférence, presque systématique dans l'écosystème, pour les noms <strong>évocateurs ou
        inventés</strong> plutôt que descriptifs. Un nom qui ne promet rien de précis ne peut pas devenir faux.
      </p>

      <h2 id="extension">Faut-il absolument le .com ?</h2>
      <p>
        Le <code>.com</code> inspire confiance et reste le réflexe mondial, mais beaucoup de belles réussites
        sont parties sur <code>.io</code>, <code>.ai</code> ou <code>.co</code>. La règle pragmatique&nbsp;:
        choisissez un nom dont au moins une extension forte est libre aujourd'hui, plutôt qu'un nom parfait
        dont le <code>.com</code> est inaccessible. Vous pourrez toujours racheter l'extension premium plus tard.
      </p>

      <h2 id="faq">Questions fréquentes</h2>
      <h3>Un nom inventé ou un mot existant&nbsp;?</h3>
      <p>
        Inventé, dans la grande majorité des cas&nbsp;: les mots existants pertinents sont pris depuis
        longtemps en <code>.com</code> et se protègent mal comme marque. Un nom inventé de 6 à 8 caractères
        offre le meilleur compromis entre disponibilité, mémorisation et solidité juridique.
      </p>
      <h3>Le nom compte-t-il pour lever des fonds&nbsp;?</h3>
      <p>
        Il ne fera pas la décision, mais il pèse sur la première impression. Un nom qu'on doit épeler en
        réunion, ou dont le <code>.com</code> appartient manifestement à quelqu'un d'autre, envoie un signal
        d'amateurisme. C'est injuste, et c'est ainsi.
      </p>
      <h3>Faut-il un nom qui fonctionne en anglais&nbsp;?</h3>
      <p>
        Si l'international fait partie du plan, vérifiez au minimum la prononciation et l'absence de faux ami.
        Un nom inventé sans langue identifiable reste le choix le plus robuste.
      </p>
      <h3>Que faire si tous les bons noms sont pris&nbsp;?</h3>
      <p>
        Trois leviers, dans cet ordre&nbsp;: allonger d'un ou deux caractères, ce qui change tout&nbsp;; passer
        du descriptif à l'inventé&nbsp;; élargir aux extensions crédibles de votre secteur. À éviter&nbsp;: les
        orthographes déformées, qui se paient à chaque conversation.
      </p>

      <h2 id="suite">Guides liés</h2>
      <ul>
        <li><a routerLink="/guides/trouver-nom-de-marque">Trouver un nom de marque disponible</a></li>
        <li><a routerLink="/guides/trouver-nom-entreprise">Trouver un nom d'entreprise</a></li>
        <li><a routerLink="/guides/trouver-nom-de-produit">Trouver un nom de produit</a></li>
      </ul>
    </article>
  `,
})
export class GuideNomDeStartupComponent {
  constructor() {
    applyContentSeo({
      title: 'Comment trouver un nom de startup',
      description:
        "Court, brandable, dispo en .com / .io / .ai : la méthode pour nommer une startup et vérifier la disponibilité du domaine en direct avec l'IA de Namorama.",
      path: '/guides/trouver-nom-de-startup',
    });
  }
}
