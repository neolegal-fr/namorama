import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TroisRisquesComponent } from './trois-risques';
import { ArticleCtaComponent } from './article-cta';
import { applyContentSeo } from './content-seo';
import { ArticleEnteteComponent } from './article-entete';

/**
 * Landing sectorielle : générateur de nom pour SaaS / logiciel B2B.
 * Cible « nom de logiciel SaaS », « nom application B2B », « nom de plateforme ».
 */
@Component({
  selector: 'app-generateur-nom-saas',
  standalone: true,
  imports: [ArticleEnteteComponent, TroisRisquesComponent, RouterModule, ArticleCtaComponent],
  template: `
    <article class="article">
      <app-article-entete>
        <h1>Générateur de nom pour SaaS / logiciel B2B</h1>
      </app-article-entete>
      <p class="lead">
        Vous créez un <strong>SaaS</strong> ou un logiciel métier&nbsp;? Trouvez un nom de produit crédible,
        facile à retenir, avec le <strong>domaine disponible vérifié en temps réel</strong>
        (<code>.com</code>, <code>.io</code>, <code>.fr</code>). Décrivez votre outil, l'IA génère des noms
        <em>brandables</em> et teste chaque domaine par Whois réel.
      </p>

      <h2 id="codes">Les codes du naming SaaS</h2>
      <ul>
        <li><strong>Prononçable et court</strong> : votre nom sera tapé, dicté en démo, cité dans un support
          client. 2 à 3 syllabes idéalement.</li>
        <li><strong>Assez large pour évoluer</strong> : un logiciel de gestion des interventions terrain peut
          s'étendre à d'autres métiers — évitez un nom qui vous enferme dans une seule fonction (un cas réel
          remonté par nos utilisateurs&nbsp;: un SaaS «&nbsp;nettoyage&nbsp;» qui ne devait pas <em>sonner</em>
          nettoyage).</li>
        <li><strong>Crédible en B2B</strong> : sérieux sans être froid. Les suffixes <code>-ify</code>,
          <code>-ops</code>, <code>-flow</code>, <code>-hub</code> fonctionnent bien.</li>
        <li><strong>Extension pro</strong> : <code>.com</code> pour la confiance, <code>.io</code> très admis dans
          le logiciel, <code>.fr</code> si votre cible est française.</li>
      </ul>

      <h2 id="pieges">Les trois pièges du naming SaaS</h2>
      <p>
        Les noms de logiciels se ressemblent tous, et ce n'est pas un hasard&nbsp;: la plupart des fondateurs
        puisent dans le même vocabulaire au même moment. Trois écueils reviennent systématiquement.
      </p>
      <ul>
        <li>
          <strong>La fatigue des suffixes.</strong> <code>-ify</code>, <code>-flow</code>, <code>-ops</code>,
          <code>-hub</code>, <code>-ly</code> ont tellement servi qu'ils ne signalent plus rien, sinon que vous
          êtes un logiciel de plus. Ils restent utiles comme point de départ, jamais comme point d'arrivée.
        </li>
        <li>
          <strong>Le nom-fonctionnalité.</strong> Nommer d'après ce que fait la v1 (« InvoiceSync ») condamne
          la v3 : dès que le produit s'élargit, le nom ment. C'est le premier motif de changement de nom chez
          les éditeurs, et c'est le plus coûteux.
        </li>
        <li>
          <strong>L'orthographe contournée.</strong> Supprimer une voyelle ou remplacer un <em>c</em> par un
          <em>k</em> pour récupérer un domaine pris vous condamne à épeler votre nom à chaque démo, à chaque
          appel support, et à perdre du trafic vers l'orthographe normale.
        </li>
      </ul>

      <h2 id="extension">.com, .io ou .fr : ce que ça change vraiment</h2>
      <p>
        Le <code>.com</code> reste le réflexe de confiance, surtout auprès d'acheteurs grands comptes et
        d'investisseurs. Le <code>.io</code> s'est imposé dans le logiciel et ne surprend plus personne dans un
        contexte technique — il coûte simplement plus cher au renouvellement. Le <code>.fr</code> est
        parfaitement crédible si votre cible est française, et il présente un avantage sous-estimé&nbsp;: il
        reste largement plus disponible que le <code>.com</code>.
      </p>
      <p>
        Le seul vrai risque est le <strong>mélange</strong>&nbsp;: un <code>.io</code> alors que le
        <code>.com</code> correspondant appartient à quelqu'un d'autre vous expose à ce qu'un visiteur atterrisse
        chez un tiers en tapant votre nom de mémoire. Vérifiez les deux avant de choisir — c'est ce que fait la
        vue par extension.
      </p>

      <h2 id="methode">Le domaine d'abord, l'idée ensuite</h2>
      <p>
        La difficulté du naming SaaS n'est pas la créativité, c'est la <strong>disponibilité</strong>&nbsp;: la
        plupart des noms «&nbsp;évidents&nbsp;» sont pris. <a routerLink="/app">Namorama</a> génère des noms
        adaptés à un produit logiciel <strong>et vérifie en direct</strong> les extensions libres, pour que
        chaque suggestion soit réellement enregistrable. Vous gagnez la journée que vous auriez passée à tester
        des noms à la main.
      </p>

      <app-trois-risques intro="Un SaaS se référence, se partage et s'intègre sous un seul nom. Trois contrôles avant de le figer dans une URL d'API."></app-trois-risques>

      <app-article-cta
        heading="Trouvez le nom de votre SaaS"
        subheading="Décrivez votre logiciel, l'IA propose des noms brandables et vérifie le domaine (.com, .io, .fr) en direct."
      ></app-article-cta>

      <h2 id="checklist">Avant de valider</h2>
      <ul>
        <li>Le <code>.com</code> (ou <code>.io</code>) est <strong>réellement libre</strong> — vérifié, pas
          supposé.</li>
        <li>Le nom ne bloque pas votre <strong>expansion produit</strong> future.</li>
        <li>La marque est disponible (INPI) et le handle réseaux sociaux aussi.</li>
      </ul>

      <h2 id="faq">Questions fréquentes</h2>
      <h3>Faut-il un nom court pour un SaaS&nbsp;?</h3>
      <p>
        Court aide, mais pas à n'importe quel prix. D'après nos mesures au Whois, environ 83&nbsp;% des
        <code>.com</code> prononçables de 5 caractères sont déjà pris, contre moins de 3&nbsp;% à 7 caractères.
        Sept caractères est le meilleur compromis&nbsp;: assez court pour être retenu et dicté, assez long pour
        rester trouvable.
      </p>
      <h3>Mon nom doit-il contenir un mot-clé métier pour le référencement&nbsp;?</h3>
      <p>
        Non. Les noms de domaine à mots-clés exacts n'ont plus d'avantage depuis longtemps, et un nom
        générique vous rend indistinguable de vos concurrents. Un SaaS se référence par son contenu et ses
        pages produit, pas par son nom.
      </p>
      <h3>Un nom anglais ou français pour un SaaS vendu en France&nbsp;?</h3>
      <p>
        Un nom inventé, sans langue identifiable, est le choix le plus sûr&nbsp;: il ne vous enferme pas dans un
        marché et ne vieillit pas. Un nom anglais reste bien accepté en B2B technique&nbsp;; un nom français
        très descriptif est en revanche un handicap si vous visez l'export un jour.
      </p>
      <h3>Que faire si le <code>.com</code> est pris par un site inactif&nbsp;?</h3>
      <p>
        Un domaine sans site visible a quand même un propriétaire — c'est précisément le cas que les outils
        qui « estiment » la disponibilité confondent avec un domaine libre. Le racheter est possible mais se
        négocie souvent à plusieurs milliers d'euros. Il est presque toujours plus rentable de chercher un
        autre nom.
      </p>

      <h2 id="suite">Guides liés</h2>
      <ul>
        <li><a routerLink="/generateur-nom-startup-ia">Générateur de nom pour startup IA</a></li>
        <li><a routerLink="/nom-de-startup-court-invente">Nom de startup court et inventé (façon Qonto, Stripe)</a></li>
        <li><a routerLink="/guides/trouver-nom-de-produit">Trouver un nom de produit</a></li>
      </ul>
    </article>
  `,
})
export class GenerateurNomSaasComponent {
  constructor() {
    applyContentSeo({
      title: 'Générateur de nom pour SaaS / logiciel B2B',
      description:
        "Trouvez un nom pour votre SaaS ou logiciel B2B : court, crédible, avec le domaine (.com, .io, .fr) disponible vérifié en temps réel par l'IA de Namorama.",
      path: '/generateur-nom-saas',
    });
  }
}
