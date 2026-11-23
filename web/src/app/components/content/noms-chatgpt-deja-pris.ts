import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ArticleCtaComponent } from './article-cta';
import { applyContentSeo } from './content-seo';
import { ArticleEnteteComponent } from './article-entete';

/**
 * Article : les noms proposés par un assistant IA généraliste sont déjà pris.
 *
 * Une dizaine de projets de production (septembre-octobre 2026) collent dans la
 * description une liste de noms produite par ChatGPT ou un équivalent, pour la
 * faire vérifier. Les douze noms du tableau viennent de ces listes : ce sont des
 * sorties de modèle, pas des données personnelles. Testés au RDAP de Verisign
 * (.com) et de l'AFNIC (.fr) le 23/11/2026.
 *
 * Requêtes visées : « trouver un nom de marque ia », « nom généré par chatgpt »,
 * « vérifier nom de marque disponible ». Bpifrance recommande précisément de
 * doubler la génération par IA d'une recherche à l'INPI.
 */
@Component({
  selector: 'app-noms-chatgpt-deja-pris',
  standalone: true,
  imports: [ArticleEnteteComponent, RouterModule, ArticleCtaComponent],
  template: `
    <article class="article">
      <app-article-entete>
        <h1>Velora, Nuvira, Avelis&nbsp;: pourquoi les noms proposés par ChatGPT sont déjà pris</h1>
      </app-article-entete>
      <p class="lead">
        Demander des idées de noms à ChatGPT, Gemini ou Claude est devenu le premier réflexe. La liste arrive
        en dix secondes, elle sonne bien… et presque tous les noms sont déjà enregistrés. Nous l'avons
        vérifié auprès des registres, et voici comment ne pas y perdre une semaine.
      </p>

      <h2 id="test">Le test&nbsp;: douze noms, douze <code>.com</code> pris</h2>
      <p>
        Plusieurs utilisateurs de Namorama ont collé dans leur projet, pour les faire vérifier, des listes de
        noms produites par un assistant IA. Nous en avons repris douze, tels quels, et interrogé le
        23&nbsp;novembre&nbsp;2026 les registres officiels&nbsp;: le RDAP de Verisign pour le
        <code>.com</code>, celui de l'AFNIC pour le <code>.fr</code>.
      </p>
      <table class="compare">
        <thead><tr><th>Nom proposé par l'IA</th><th><code>.com</code></th><th><code>.fr</code></th></tr></thead>
        <tbody>
          <tr><td>Velora</td><td class="no">pris</td><td class="no">pris</td></tr>
          <tr><td>Nuvira</td><td class="no">pris</td><td class="no">pris</td></tr>
          <tr><td>Avelis</td><td class="no">pris</td><td class="no">pris</td></tr>
          <tr><td>Zoreva</td><td class="no">pris</td><td class="no">pris</td></tr>
          <tr><td>Oryven</td><td class="no">pris</td><td class="no">pris</td></tr>
          <tr><td>Navera</td><td class="no">pris</td><td class="no">pris</td></tr>
          <tr><td>Virelo</td><td class="no">pris</td><td class="no">pris</td></tr>
          <tr><td>Solvane</td><td class="no">pris</td><td class="no">pris</td></tr>
          <tr><td>Velmora</td><td class="no">pris</td><td class="no">pris</td></tr>
          <tr><td>Vellune</td><td class="no">pris</td><td class="no">pris</td></tr>
          <tr><td>Homiara</td><td class="no">pris</td><td class="yes">libre</td></tr>
          <tr><td>Solvessa</td><td class="no">pris</td><td class="yes">libre</td></tr>
        </tbody>
      </table>
      <p>
        <strong>Douze <code>.com</code> sur douze sont enregistrés, et dix <code>.fr</code> sur douze.</strong>
        Ce ne sont pourtant pas des mots du dictionnaire&nbsp;: ce sont des noms inventés, du genre qu'on
        pense être le premier à imaginer.
      </p>
      <p>
        «&nbsp;Enregistré&nbsp;» ne veut pas dire qu'une entreprise l'exploite&nbsp;: une partie de ces
        domaines sont parqués ou à vendre. Mais pour vous, le résultat est le même — le nom n'est pas
        disponible au prix d'un enregistrement, et s'il est à vendre, il l'est au prix que fixe son
        détenteur.
      </p>

      <h2 id="pourquoi">Pourquoi l'IA propose toujours les mêmes noms</h2>
      <p>
        Un modèle de langage produit la suite de lettres la plus <em>probable</em> pour une consigne donnée.
        «&nbsp;Un nom de marque premium, doux, international&nbsp;» converge donc vers les mêmes sonorités&nbsp;:
        les racines <em>vel-</em>, <em>nov-</em>, <em>sol-</em>, <em>aur-</em>, et les terminaisons
        <em>-ora</em>, <em>-ia</em>, <em>-ane</em>, <em>-is</em>. Trois conséquences&nbsp;:
      </p>
      <ul>
        <li>
          <strong>Des milliers de personnes reçoivent la même liste.</strong> Chacune pense tenir une idée
          originale, et la première à enregistrer le domaine l'emporte.
        </li>
        <li>
          <strong>Les revendeurs de domaines l'ont compris.</strong> Les combinaisons qui ressortent le plus
          souvent sont enregistrées d'avance pour être revendues.
        </li>
        <li>
          <strong>Le modèle ne vérifie rien.</strong> Il n'interroge aucun registre, et ses connaissances
          s'arrêtent à la date de son entraînement. Quand il affirme qu'un nom «&nbsp;semble disponible&nbsp;»,
          c'est une phrase, pas une vérification.
        </li>
      </ul>
      <p>
        Bpifrance Création le dit sans détour&nbsp;: les générateurs de noms par intelligence artificielle
        existent, mais «&nbsp;il faut donc doubler l'éventuelle génération d'un nom d'entreprise d'une
        recherche dans la base de l'INPI&nbsp;»
        (<a href="https://bpifrance-creation.fr/encyclopedie/trouver-proteger-tester-son-idee/proteger-son-idee/nom-lentreprise" target="_blank" rel="noopener">source</a>).
      </p>

      <app-article-cta
        heading="Vérifiez votre liste en une minute"
        subheading="Collez les noms proposés par ChatGPT, séparés par des virgules : chaque domaine est vérifié auprès du registre."
        label="Vérifier mes noms"
      ></app-article-cta>

      <h2 id="verifier">Vérifier une liste de noms en une minute</h2>
      <p>
        Inutile de taper chaque nom chez un registrar&nbsp;: c'est lent, et les registrars ont intérêt à vous
        proposer une variante payante. Dans Namorama&nbsp;:
      </p>
      <ol>
        <li>
          Pour <strong>un seul nom</strong>, le <a routerLink="/verifier-disponibilite-nom-de-marque">test
          d'un nom</a> vérifie gratuitement ses domaines, sans inscription.
        </li>
        <li>
          Pour <strong>une liste</strong>, lancez une recherche puis collez vos noms dans le champ de
          vérification des résultats, séparés par des virgules&nbsp;: «&nbsp;velora, nuvira, avelis&nbsp;».
          Chaque domaine est interrogé auprès du registre de son extension, et ce qui n'a pas pu être vérifié
          est affiché comme tel, jamais comme libre.
        </li>
        <li>
          Pour le nom retenu, le <strong>rapport de marque</strong> ajoute les marques INPI et EUIPO avec les
          orthographes voisines, et les pseudos des réseaux sociaux.
        </li>
      </ol>

      <h2 id="mieux">Obtenir de l'IA des noms qui ont une chance d'être libres</h2>
      <p>
        L'IA reste un excellent outil de génération, à condition de la sortir de ses habitudes&nbsp;:
      </p>
      <ul>
        <li>
          <strong>Interdisez ses tics.</strong> Écrivez explicitement les terminaisons à éviter
          («&nbsp;pas de -ora, -ia, -is, -ix&nbsp;») et les racines surexploitées (vel, nov, sol, lumi,
          nex). Namorama applique ce type de consigne en dur après génération, plutôt que de l'espérer.
        </li>
        <li>
          <strong>Acceptez un caractère de plus.</strong> Sur des noms prononçables tirés au sort, environ
          83&nbsp;% des <code>.com</code> de cinq lettres sont pris, contre moins de 3&nbsp;% à sept lettres
          (<a routerLink="/nom-de-startup-court-invente">nos mesures</a>).
        </li>
        <li>
          <strong>Partez de votre métier, pas d'une ambiance.</strong> «&nbsp;Premium et international&nbsp;»
          ne distingue personne. Un ingrédient, un geste, un lieu, une matière donnent au modèle une matière
          première que les autres n'ont pas.
        </li>
        <li>
          <strong>Vérifiez au fil de l'eau.</strong> Générer cent noms puis tout vérifier à la fin, c'est
          s'attacher à des noms déjà pris. Un outil qui écarte les noms pris <em>avant</em> de vous les
          montrer évite ce deuil répété.
        </li>
      </ul>

      <h2 id="faq">Questions fréquentes</h2>
      <h3>ChatGPT peut-il vérifier qu'un nom de domaine est libre&nbsp;?</h3>
      <p>
        Pas de façon fiable&nbsp;: sans accès à un registre au moment de la question, il ne peut que
        supposer. Même avec la recherche web activée, il lit des pages, pas la base du registre. Seule une
        interrogation RDAP ou Whois donne la réponse.
      </p>
      <h3>Un nom pris en <code>.com</code> mais libre en <code>.fr</code> est-il utilisable&nbsp;?</h3>
      <p>
        Pour une activité française, souvent oui. Vérifiez alors qu'aucune marque identique ou proche n'est
        déposée dans vos classes&nbsp;: si le <code>.com</code> appartient à une entreprise active du même
        secteur, la confusion est probable.
      </p>
      <h3>Peut-on déposer comme marque un nom généré par une IA&nbsp;?</h3>
      <p>
        Oui, rien ne l'interdit&nbsp;: ce qui compte est qu'il soit disponible et distinctif. C'est justement
        le point faible des noms de l'IA, qui ressemblent souvent à des marques existantes.
      </p>

      <h2 id="suite">À lire aussi</h2>
      <ul>
        <li><a routerLink="/nom-de-startup-court-invente">Nom court et inventé&nbsp;: ce que coûtent cinq lettres</a></li>
        <li><a routerLink="/comparatif-generateurs-de-noms">Comparatif des générateurs de noms</a></li>
        <li><a routerLink="/recherche-anteriorite-marque-inpi">Recherche d'antériorité de marque (INPI)</a></li>
      </ul>
    </article>
  `,
})
export class NomsChatgptDejaPrisComponent {
  constructor() {
    applyContentSeo({
      title: 'Pourquoi les noms proposés par ChatGPT sont déjà pris',
      description:
        "12 noms de marque proposés par une IA testés au registre : 12 .com sur 12 déjà enregistrés. Pourquoi ChatGPT propose toujours les mêmes noms, et comment vérifier les vôtres.",
      path: '/blog/noms-chatgpt-deja-pris',
    });
  }
}
