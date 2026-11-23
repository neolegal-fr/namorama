import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TroisRisquesComponent } from './trois-risques';
import { ArticleCtaComponent } from './article-cta';
import { applyContentSeo } from './content-seo';
import { ArticleEnteteComponent } from './article-entete';

/**
 * Page de comparaison (intention commerciale forte) : Namorama vs Namelix.
 * Prérendue (SSG), cible « namorama vs namelix », « alternative Namelix »,
 * « namelix français », « générateur de nom avec domaine vraiment disponible ».
 */
@Component({
  selector: 'app-comparatif-namelix',
  standalone: true,
  imports: [ArticleEnteteComponent, TroisRisquesComponent, RouterModule, ArticleCtaComponent],
  template: `
    <article class="article">
      <app-article-entete>
        <h1>Namorama vs Namelix : quel générateur de noms de marque choisir ?</h1>
      </app-article-entete>
      <p class="lead">
        Namelix est l'un des générateurs de noms les plus connus, réputé pour ses noms courts et
        « brandables ». Namorama joue sur un autre terrain&nbsp;: la <strong>disponibilité de domaine
        réellement vérifiée</strong> et l'<strong>adaptation au marché francophone</strong>. Voici une
        comparaison honnête pour choisir selon votre projet.
      </p>

      <h2 id="en-bref">En bref</h2>
      <ul>
        <li><strong>Choisissez Namelix</strong> si vous voulez surtout un nom anglophone très « brandable »
          et générer un logo dans la foulée.</li>
        <li><strong>Choisissez Namorama</strong> si votre priorité est un nom <em>dont le domaine est
          réellement libre</em>, avec une extension locale (<code>.fr</code>…) et des suggestions adaptées
          à votre langue et votre culture.</li>
      </ul>

      <h2 id="tableau">Tableau comparatif</h2>
      <table class="compare">
        <thead>
          <tr>
            <th>Critère</th>
            <th>Namelix</th>
            <th>Namorama</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Génération IA à partir d'une description</td>
            <td class="yes">Oui</td>
            <td class="yes">Oui</td>
          </tr>
          <tr>
            <td>Vérification de disponibilité du domaine</td>
            <td class="no">Estimation <code>.com</code>, souvent déjà pris</td>
            <td class="yes">Whois réel, en direct</td>
          </tr>
          <tr>
            <td>Matrice multi-extensions (.com, .fr, .io…)</td>
            <td class="no">Limitée</td>
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
            <td>Choix du registrar</td>
            <td class="no">Renvoi limité</td>
            <td class="yes">Liens vers plusieurs registrars</td>
          </tr>
          <tr>
            <td>Logo / brand kit</td>
            <td class="yes">Oui (payant, via Brandmark)</td>
            <td class="no">Pas encore</td>
          </tr>
          <tr>
            <td>Modèle</td>
            <td>Noms gratuits, logos payants</td>
            <td>100 crédits offerts/mois, sans abonnement</td>
          </tr>
        </tbody>
      </table>

      <h2 id="namelix-fort">Là où Namelix est fort</h2>
      <p>
        Namelix excelle pour produire des noms <strong>courts, modernes et « brandables »</strong> en
        anglais, et il enchaîne naturellement sur la création d'un logo (via Brandmark). Si vous lancez
        un projet anglophone et que le logo fait partie de votre besoin immédiat, c'est un bon point de départ.
      </p>

      <h2 id="namorama-difference">Là où Namorama fait la différence</h2>
      <p>
        <strong>La disponibilité, pour de vrai.</strong> Le reproche le plus fréquent fait aux générateurs
        comme Namelix&nbsp;: les noms proposés sont souvent <em>déjà pris</em>, car la disponibilité affichée
        n'est qu'une estimation. Namorama interroge le <strong>Whois en temps réel</strong> pour chaque nom et
        chaque extension&nbsp;: vous ne tombez jamais amoureux d'un domaine inaccessible.
      </p>
      <p>
        <strong>Pensé pour votre marché.</strong> Selon votre localisation, Namorama propose d'emblée
        l'<strong>extension locale</strong> (un Français voit <code>.fr</code> en plus de <code>.com</code>)
        et active des <strong>suggestions régionales et culturelles</strong> — des noms qui sonnent juste dans
        votre langue, pas seulement en anglais.
      </p>
      <p>
        <strong>Neutre et transparent.</strong> Namorama vous laisse réserver chez le registrar de votre
        choix, sans vous enfermer.
      </p>

      <app-trois-risques intro="Un générateur donne des idées ; il ne dit pas lesquelles sont tenables. Trois contrôles répondent à cette question."></app-trois-risques>

      <app-article-cta
        heading="Comparez par vous-même en 30 secondes"
        subheading="Lancez une recherche : génération IA et vérification de disponibilité réelle, côte à côte."
      ></app-article-cta>

      <h2 id="dispo">Disponibilité du domaine : l'écart qui compte</h2>
      <p>
        Un nom génial dont le domaine est pris (ou vendu plusieurs milliers d'euros en premium) n'est pas un
        nom disponible. C'est toute la différence entre <em>générer des idées</em> et <em>trouver un nom
        réservable</em>. Namorama est conçu autour de cette seconde promesse&nbsp;: chaque suggestion est testée
        en direct, sur toutes les extensions que vous suivez.
      </p>

      <h2 id="lequel">Alors, lequel choisir ?</h2>
      <p>
        Pour un projet anglophone centré sur l'image et le logo&nbsp;: Namelix reste pertinent. Pour
        <strong>trouver un nom de marque dont le domaine est réellement libre</strong>, en français et avec
        l'extension locale, Namorama est l'alternative la plus directe. Et c'est gratuit pour démarrer&nbsp;:
        100 crédits offerts, sans abonnement.
      </p>
      <p>
        Pour aller plus loin&nbsp;: la comparaison <a routerLink="/namorama-vs-looka">Namorama vs Looka</a>, notre
        <a routerLink="/comparatif-generateurs-de-noms">comparatif général des générateurs de noms</a> et notre
        guide <a routerLink="/guides/trouver-nom-de-marque">pour trouver un nom de marque disponible</a>.
      </p>

      <app-article-cta></app-article-cta>
    </article>
  `,
})
export class ComparatifNamelixComponent {
  constructor() {
    applyContentSeo({
      title: 'Namorama vs Namelix : quel générateur choisir',
      description:
        "Namorama ou Namelix ? Comparatif honnête : domaine vérifié au Whois, extension .fr et suggestions en français, face aux noms brandables anglophones.",
      path: '/namorama-vs-namelix',
    });
  }
}
