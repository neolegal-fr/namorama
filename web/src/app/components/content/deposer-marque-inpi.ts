import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ArticleCtaComponent } from './article-cta';
import { applyContentSeo } from './content-seo';
import { ArticleEnteteComponent } from './article-entete';

/**
 * Article : déposer sa marque à l'INPI — prix, délais, opposition.
 *
 * Requêtes visées (autocomplétion Google, 23/11/2026) : « dépôt de marque inpi
 * prix », « déposer un nom de marque inpi », « protéger un nom ». Namorama ne
 * dépose rien : l'article répond à la question, et place la vérification
 * préalable là où elle évite de perdre la redevance.
 *
 * Chaque montant et délai a été relu sur la page INPI citée le 23/11/2026.
 * À revoir à chaque changement de tarif de l'INPI.
 */
@Component({
  selector: 'app-deposer-marque-inpi',
  standalone: true,
  imports: [ArticleEnteteComponent, RouterModule, ArticleCtaComponent],
  template: `
    <article class="article">
      <app-article-entete>
        <h1>Déposer sa marque à l'INPI&nbsp;: prix, délais et opposition</h1>
      </app-article-entete>
      <p class="lead">
        Un dépôt de marque en France coûte <strong>190&nbsp;€ pour une classe</strong>, et il faut compter
        <strong>au moins cinq mois</strong> avant son enregistrement. Entre les deux, une fenêtre de deux mois
        pendant laquelle n'importe quel titulaire d'une marque antérieure peut s'y opposer. Voici le
        calendrier réel, et ce qu'il faut vérifier avant de payer.
      </p>

      <h2 id="prix">Combien coûte un dépôt de marque&nbsp;?</h2>
      <table class="compare">
        <thead><tr><th>Poste</th><th>Montant</th></tr></thead>
        <tbody>
          <tr><td>Dépôt en ligne, une classe</td><td>190&nbsp;€</td></tr>
          <tr><td>Chaque classe supplémentaire</td><td>40&nbsp;€</td></tr>
          <tr><td>Exemple&nbsp;: trois classes</td><td>270&nbsp;€</td></tr>
          <tr><td>Recherche de disponibilité confiée à l'INPI</td><td>à partir de 50&nbsp;€</td></tr>
          <tr><td>Former une opposition (si vous êtes le titulaire antérieur)</td><td>400&nbsp;€, + 150&nbsp;€ par droit en plus</td></tr>
        </tbody>
      </table>
      <p>
        Sources&nbsp;: INPI,
        <a href="https://www.inpi.fr/realiser-demarches/propriete-intellectuelle/deposant-et-cout-dune-marque" target="_blank" rel="noopener">coût d'une marque</a>,
        <a href="https://www.inpi.fr/services-et-prestations-domaine/disponibilite-dune-marque-dun-logo-dun-nom-de-societe-dun-nom-de" target="_blank" rel="noopener">recherche de disponibilité</a> et
        <a href="https://www.inpi.fr/realiser-demarches/propriete-intellectuelle/sopposer-lenregistrement-dune-marque" target="_blank" rel="noopener">opposition</a>,
        consultées le 23&nbsp;novembre&nbsp;2026. Les montants qui circulent ailleurs («&nbsp;entre 50 et
        300&nbsp;€&nbsp;») datent souvent d'avant la réforme&nbsp;: fiez-vous à la page de l'INPI.
      </p>
      <p>
        La redevance n'est <strong>pas remboursée</strong> si la marque est refusée ou si une opposition
        aboutit. C'est tout l'intérêt de vérifier avant.
      </p>

      <h2 id="classes">Combien de classes choisir&nbsp;?</h2>
      <p>
        Une marque ne protège un nom que pour les produits et services que vous désignez, rangés selon la
        classification de Nice en <strong>45 classes</strong>
        (<a href="https://www.inpi.fr/realiser-demarches/propriete-intellectuelle/etapes-cles-du-depot-de-marque" target="_blank" rel="noopener">INPI</a>).
        Quelques repères&nbsp;:
      </p>
      <ul>
        <li><strong>Classe 25</strong>&nbsp;: vêtements, chaussures, chapellerie — la plus encombrée (voir notre <a routerLink="/generateur-nom-marque-vetement">guide mode</a>).</li>
        <li><strong>Classe 3</strong>&nbsp;: cosmétiques, parfums&nbsp;; <strong>classe 14</strong>&nbsp;: bijoux.</li>
        <li><strong>Classe 9</strong>&nbsp;: logiciels téléchargeables, applications&nbsp;; <strong>classe 42</strong>&nbsp;: logiciel en ligne (SaaS), développement.</li>
        <li><strong>Classe 35</strong>&nbsp;: publicité, gestion d'entreprise, et la vente au détail en ligne.</li>
        <li><strong>Classe 37</strong>&nbsp;: construction, réparation, installation (électricité, rénovation)&nbsp;; <strong>classe 43</strong>&nbsp;: restauration, hébergement.</li>
      </ul>
      <p>
        Le bon nombre est celui de votre activité réelle et de son prolongement probable dans les cinq ans.
        Déposer dans dix classes «&nbsp;pour être tranquille&nbsp;» coûte plus cher, augmente le risque
        d'opposition, et une marque non exploitée pendant cinq ans peut être déchue pour les produits
        concernés.
      </p>

      <h2 id="calendrier">Le calendrier d'un dépôt</h2>
      <ol>
        <li>
          <strong>Jour J&nbsp;: le dépôt en ligne.</strong> La date de dépôt fixe votre priorité&nbsp;: à
          partir de ce jour, un dépôt identique postérieur passe après le vôtre.
        </li>
        <li>
          <strong>Environ six semaines&nbsp;: la publication</strong> au Bulletin officiel de la propriété
          industrielle (BOPI).
        </li>
        <li>
          <strong>Deux mois après la publication&nbsp;: la fin de la période d'opposition.</strong> Le délai
          est fixé par l'article L712-4 du Code de la propriété intellectuelle
          (<a href="https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000039381569" target="_blank" rel="noopener">Légifrance</a>).
        </li>
        <li>
          <strong>Cinq mois au minimum&nbsp;: l'enregistrement</strong>, publié au BOPI une fois l'examen
          achevé
          (<a href="https://www.inpi.fr/realiser-demarches/propriete-intellectuelle/etapes-cles-du-depot-de-marque" target="_blank" rel="noopener">INPI</a>).
        </li>
      </ol>
      <p>
        La marque est ensuite protégée <strong>dix ans</strong> en France à compter de la date de dépôt,
        renouvelable indéfiniment
        (<a href="https://www.inpi.fr/realiser-demarches/propriete-intellectuelle/marque-apres-son-depot" target="_blank" rel="noopener">INPI</a>).
      </p>

      <h2 id="opposition">L'opposition&nbsp;: le risque que vous pouvez éviter</h2>
      <p>
        <strong>L'INPI ne vérifie pas pour vous</strong> qu'une marque identique ou proche existe déjà. Il
        examine que votre signe peut être une marque (qu'il n'est pas purement descriptif ou trompeur), puis
        il laisse aux titulaires de droits antérieurs le soin de réagir. S'ils forment opposition, la
        procédure dure de six mois à un an, et vous pouvez perdre la marque pour tout ou partie des produits
        visés.
      </p>
      <p>
        Les droits qu'on peut vous opposer ne sont pas que des marques françaises&nbsp;: une marque de
        l'Union européenne, une dénomination sociale, un nom commercial ou un nom de domaine exploités avant
        votre dépôt peuvent l'être aussi. D'où l'ordre de vérification que nous recommandons&nbsp;:
      </p>
      <ol>
        <li><strong>Le nom de domaine</strong> en <code>.fr</code> et <code>.com</code>&nbsp;: un site actif sous ce nom est un signal immédiat.</li>
        <li><strong>Les marques INPI et EUIPO</strong>, à l'identique <em>et</em> dans les orthographes voisines (espacée, collée, avec ou sans tiret).</li>
        <li><strong>Les entreprises immatriculées</strong> sous ce nom dans votre secteur.</li>
        <li>Pour un nom à fort enjeu, une <strong>recherche de similarité</strong> (phonétique, visuelle) par l'INPI ou un conseil en propriété industrielle.</li>
      </ol>

      <app-article-cta
        heading="Vérifiez votre nom avant de payer le dépôt"
        subheading="Domaines, marques INPI et EUIPO avec les orthographes voisines, pseudos des réseaux : en une saisie."
        label="Tester un nom"
      ></app-article-cta>

      <h2 id="orthographes">Le piège des orthographes</h2>
      <p>
        La base de l'INPI indexe des mots. Une marque déposée en deux mots («&nbsp;Neo Legal&nbsp;») n'est pas
        trouvée par une recherche sur la forme collée («&nbsp;neolegal&nbsp;»), ni l'inverse. C'est le faux
        négatif le plus fréquent d'une recherche gratuite faite à la main&nbsp;: on conclut «&nbsp;aucun
        dépôt&nbsp;», on paie 190&nbsp;€, et l'opposition arrive deux mois plus tard. Le rapport de marque de
        Namorama cherche systématiquement les autres orthographes d'un nom pour cette raison.
      </p>

      <h2 id="faq">Questions fréquentes</h2>
      <h3>Peut-on déposer sa marque soi-même, sans avocat&nbsp;?</h3>
      <p>
        Oui, le dépôt se fait en ligne sur le site de l'INPI. Un conseil en propriété industrielle devient
        utile pour une recherche de similarité, un libellé de produits délicat, ou une extension à
        l'étranger.
      </p>
      <h3>La marque française me protège-t-elle à l'étranger&nbsp;?</h3>
      <p>
        Non&nbsp;: elle vaut pour la France. Pour l'Union européenne, il faut une marque de l'UE auprès de
        l'EUIPO&nbsp;; au-delà, une extension internationale via l'OMPI.
      </p>
      <h3>Créer ma société protège-t-il déjà mon nom&nbsp;?</h3>
      <p>
        En partie seulement&nbsp;: la dénomination sociale est protégée contre un usage créant une confusion,
        mais elle ne donne pas le monopole d'une marque sur des produits et services. Les deux se
        complètent (voir <a routerLink="/blog/nom-entreprise-artisan">dénomination, nom commercial et
        marque</a>).
      </p>
      <h3>Quand faut-il déposer&nbsp;?</h3>
      <p>
        Avant d'investir dans ce qui coûte cher à refaire&nbsp;: logo, enseigne, véhicules, emballages,
        campagne. Et après avoir vérifié que le nom est libre — dans cet ordre.
      </p>

      <h2 id="suite">À lire aussi</h2>
      <ul>
        <li><a routerLink="/recherche-anteriorite-marque-inpi">Recherche d'antériorité de marque&nbsp;: comment faire</a></li>
        <li><a routerLink="/verifier-disponibilite-nom-de-marque">Vérifier la disponibilité d'un nom de marque</a></li>
        <li><a routerLink="/blog/noms-chatgpt-deja-pris">Pourquoi les noms proposés par ChatGPT sont déjà pris</a></li>
      </ul>
    </article>
  `,
})
export class DeposerMarqueInpiComponent {
  constructor() {
    applyContentSeo({
      title: "Déposer sa marque à l'INPI : prix, délais et opposition",
      description:
        "Dépôt de marque INPI : 190 € pour une classe, 40 € par classe en plus, publication sous 6 semaines, 2 mois d'opposition, 5 mois minimum. Le calendrier réel et quoi vérifier avant.",
      path: '/blog/deposer-marque-inpi-prix-delais',
    });
  }
}
