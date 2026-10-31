import { Component, OnInit, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { RouterModule } from '@angular/router';
import { applyContentSeo } from '../content/content-seo';

@Component({
  selector: 'app-privacy',
  standalone: true,
  imports: [RouterModule],
  template: `
    <div class="max-w-3xl mx-auto px-4 py-12 text-900">
      @if (lang() === 'fr') {
        <h1 class="text-3xl font-bold mb-2">Politique de confidentialité</h1>
        <p class="text-500 text-sm mb-8">Dernière mise à jour : octobre 2026</p>

        <h2 class="text-xl font-semibold mt-8 mb-3">1. Responsable du traitement</h2>
        <p>
          <strong>NEOLEGAL</strong> — SAS au capital de 1 000 €, SIREN 911 289 502<br>
          2758 VC Ancien Chemin d'Arles, 13210 Saint-Rémy-de-Provence, France<br>
          Contact : <a href="mailto:dpo@namorama.com" class="text-primary">dpo&#64;namorama.com</a>
        </p>

        <h2 class="text-xl font-semibold mt-8 mb-3">2. Données collectées</h2>
        <p>Dans le cadre de l'utilisation de Namorama, nous collectons les données suivantes :</p>
        <ul class="list-disc pl-6 mt-2 space-y-1">
          <li><strong>Données de compte</strong> : adresse email, prénom, nom (fournis lors de l'inscription via Keycloak)</li>
          <li><strong>Données d'usage</strong> : historique de recherches (descriptions de projets, mots-clés, noms de domaine consultés), projets sauvegardés</li>
          <li><strong>Données de paiement</strong> : traitement délégué à Stripe ; nous ne stockons aucune donnée bancaire</li>
          <li><strong>Données techniques</strong> : adresse IP, type de navigateur, langue préférée (via token Keycloak)</li>
          <li><strong>Feedbacks</strong> : messages envoyés volontairement via le formulaire de retour</li>
        </ul>

        <h2 class="text-xl font-semibold mt-8 mb-3">3. Finalités et bases légales</h2>
        <table class="w-full text-sm mt-2 border-collapse">
          <thead>
            <tr class="border-b border-surface">
              <th class="text-left py-2 pr-4 font-semibold">Finalité</th>
              <th class="text-left py-2 font-semibold">Base légale</th>
            </tr>
          </thead>
          <tbody>
            <tr class="border-b border-surface"><td class="py-2 pr-4">Fourniture du service (recherche de domaines, projets)</td><td class="py-2">Exécution du contrat</td></tr>
            <tr class="border-b border-surface"><td class="py-2 pr-4">Gestion des crédits et facturation</td><td class="py-2">Exécution du contrat</td></tr>
            <tr class="border-b border-surface"><td class="py-2 pr-4">Authentification sécurisée (Keycloak)</td><td class="py-2">Exécution du contrat</td></tr>
            <tr class="border-b border-surface"><td class="py-2 pr-4">Amélioration du service (feedbacks)</td><td class="py-2">Intérêt légitime</td></tr>
            <tr><td class="py-2 pr-4">Obligations légales et comptables</td><td class="py-2">Obligation légale</td></tr>
          </tbody>
        </table>

        <h2 class="text-xl font-semibold mt-8 mb-3">4. Durée de conservation</h2>
        <ul class="list-disc pl-6 mt-2 space-y-1">
          <li>Données de compte : durée de la relation contractuelle + 3 ans</li>
          <li>Historique de recherches : durée de la relation contractuelle</li>
          <li>Données de paiement : 10 ans (obligations comptables)</li>
          <li>Feedbacks : 3 ans à compter de la réception</li>
          <li>Logs techniques : 12 mois</li>
        </ul>

        <h2 class="text-xl font-semibold mt-8 mb-3">5. Destinataires des données</h2>
        <p>Vos données peuvent être transmises aux sous-traitants suivants, dans le strict cadre de la fourniture du service :</p>
        <ul class="list-disc pl-6 mt-2 space-y-1">
          <li><strong>OVH</strong> — hébergement (France)</li>
          <li><strong>Stripe</strong> — paiement en ligne (États-Unis, clauses contractuelles types UE)</li>
          <li><strong>OpenAI</strong> — génération de noms par IA (États-Unis, clauses contractuelles types UE)</li>
        </ul>
        <p class="mt-3">Aucune donnée n'est vendue ou cédée à des tiers à des fins commerciales.</p>

        <h2 class="text-xl font-semibold mt-8 mb-3">6. Transferts hors UE</h2>
        <p>
          Stripe et OpenAI sont des prestataires établis aux États-Unis. Ces transferts sont encadrés par des clauses contractuelles types (CCT) approuvées par la Commission européenne, garantissant un niveau de protection adéquat.
        </p>

        <h2 class="text-xl font-semibold mt-8 mb-3">7. Vos droits</h2>
        <p>Conformément au RGPD, vous disposez des droits suivants :</p>
        <ul class="list-disc pl-6 mt-2 space-y-1">
          <li><strong>Droit d'accès</strong> : obtenir une copie de vos données</li>
          <li><strong>Droit de rectification</strong> : corriger des données inexactes</li>
          <li><strong>Droit à l'effacement</strong> : demander la suppression de vos données</li>
          <li><strong>Droit à la portabilité</strong> : recevoir vos données dans un format structuré</li>
          <li><strong>Droit d'opposition</strong> : vous opposer à certains traitements</li>
          <li><strong>Droit à la limitation</strong> : restreindre le traitement dans certains cas</li>
        </ul>
        <p class="mt-3">
          Pour exercer vos droits, contactez notre DPO : <a href="mailto:dpo@namorama.com" class="text-primary">dpo&#64;namorama.com</a><br>
          Nous répondrons dans un délai d'un mois. En cas de réponse insatisfaisante, vous pouvez saisir la <a href="https://www.cnil.fr" target="_blank" rel="noopener" class="text-primary">CNIL</a>.
        </p>

        <h2 class="text-xl font-semibold mt-8 mb-3">8. Cookies et mesure d'usage</h2>
        <p>
          Les cookies et identifiants <strong>strictement nécessaires</strong> sont toujours actifs : session d'authentification, préférences de langue et de thème, mémorisation de vos choix de cookies (<code>cc_cookie</code>), et un identifiant de visite anonyme, propre à l'onglet et effacé à sa fermeture (<code>nm_sid</code>), qui nous permet de compter les visites sans vous identifier.
        </p>
        <p class="mt-3">Deux usages facultatifs ne fonctionnent qu'avec votre accord, demandé séparément :</p>
        <ul class="list-disc pl-6 space-y-1 mt-2">
          <li>
            <strong>Mesure d'audience (Google Analytics 4)</strong> : pages consultées et durée des visites, pour comprendre comment Namorama est utilisé. Ces données sont traitées par Google.
          </li>
          <li>
            <strong>Enregistrement de session</strong> : vos actions dans l'application (clics, défilement, pages vues, erreurs techniques) sont enregistrées pour que nous puissions revoir un parcours et repérer ce qui vous a bloqué. Tout ce que vous tapez est masqué <em>dans votre navigateur, avant tout envoi</em>, de même que vos descriptions de projet, mots-clés et adresses e-mail. Ni vos échanges réseau ni vos pages d'administration ne sont enregistrés. Les enregistrements restent sur le serveur de Namorama, sans sous-traitant, ne sont consultés que par l'équipe, et sont <strong>effacés après 30 jours</strong>.
          </li>
        </ul>
        <p class="mt-3">
          Vous pouvez donner ou retirer votre accord à tout moment, catégorie par catégorie, grâce au lien <strong>« Gérer les cookies »</strong> en pied de page. Le retrait prend effet immédiatement : plus rien n'est enregistré à partir de cet instant. Aucun cookie publicitaire n'est déposé.
        </p>

        <h2 class="text-xl font-semibold mt-8 mb-3">9. Sécurité</h2>
        <p>
          Nous mettons en œuvre des mesures techniques et organisationnelles appropriées pour protéger vos données : chiffrement des communications (HTTPS/TLS), authentification sécurisée (Keycloak), accès restreint aux données personnelles.
        </p>

        <h2 class="text-xl font-semibold mt-8 mb-3">10. Modifications</h2>
        <p>
          Cette politique peut être mise à jour à tout moment. La date de dernière mise à jour est indiquée en haut de page. Nous vous informerons de tout changement significatif par email.
        </p>

        <div class="mt-10 flex gap-4">
          <a routerLink="/legal" class="text-primary text-sm">Mentions légales</a>
          <span class="text-400">·</span>
          <a routerLink="/" class="text-primary text-sm">← Retour à l'accueil</a>
        </div>
      } @else {
        <h1 class="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p class="text-500 text-sm mb-8">Last updated: October 2026</p>

        <h2 class="text-xl font-semibold mt-8 mb-3">1. Data Controller</h2>
        <p>
          <strong>NEOLEGAL</strong> — SAS, share capital €1,000, SIREN 911 289 502<br>
          2758 VC Ancien Chemin d'Arles, 13210 Saint-Rémy-de-Provence, France<br>
          Contact: <a href="mailto:dpo@namorama.com" class="text-primary">dpo&#64;namorama.com</a>
        </p>

        <h2 class="text-xl font-semibold mt-8 mb-3">2. Data Collected</h2>
        <p>When using Namorama, we collect the following data:</p>
        <ul class="list-disc pl-6 mt-2 space-y-1">
          <li><strong>Account data</strong>: email address, first name, last name (provided at registration via Keycloak)</li>
          <li><strong>Usage data</strong>: search history (project descriptions, keywords, domain names checked), saved projects</li>
          <li><strong>Payment data</strong>: processed by Stripe — we store no banking data</li>
          <li><strong>Technical data</strong>: IP address, browser type, preferred language (via Keycloak token)</li>
          <li><strong>Feedback</strong>: messages voluntarily submitted through the feedback form</li>
        </ul>

        <h2 class="text-xl font-semibold mt-8 mb-3">3. Purposes and Legal Bases</h2>
        <table class="w-full text-sm mt-2 border-collapse">
          <thead>
            <tr class="border-b border-surface">
              <th class="text-left py-2 pr-4 font-semibold">Purpose</th>
              <th class="text-left py-2 font-semibold">Legal basis</th>
            </tr>
          </thead>
          <tbody>
            <tr class="border-b border-surface"><td class="py-2 pr-4">Service provision (domain search, projects)</td><td class="py-2">Contract performance</td></tr>
            <tr class="border-b border-surface"><td class="py-2 pr-4">Credit management and billing</td><td class="py-2">Contract performance</td></tr>
            <tr class="border-b border-surface"><td class="py-2 pr-4">Secure authentication (Keycloak)</td><td class="py-2">Contract performance</td></tr>
            <tr class="border-b border-surface"><td class="py-2 pr-4">Service improvement (feedback)</td><td class="py-2">Legitimate interest</td></tr>
            <tr><td class="py-2 pr-4">Legal and accounting obligations</td><td class="py-2">Legal obligation</td></tr>
          </tbody>
        </table>

        <h2 class="text-xl font-semibold mt-8 mb-3">4. Retention Period</h2>
        <ul class="list-disc pl-6 mt-2 space-y-1">
          <li>Account data: duration of the contractual relationship + 3 years</li>
          <li>Search history: duration of the contractual relationship</li>
          <li>Payment data: 10 years (accounting obligations)</li>
          <li>Feedback: 3 years from receipt</li>
          <li>Technical logs: 12 months</li>
        </ul>

        <h2 class="text-xl font-semibold mt-8 mb-3">5. Data Recipients</h2>
        <p>Your data may be shared with the following sub-processors, strictly for service delivery purposes:</p>
        <ul class="list-disc pl-6 mt-2 space-y-1">
          <li><strong>OVH</strong> — hosting (France)</li>
          <li><strong>Stripe</strong> — online payments (USA, EU standard contractual clauses)</li>
          <li><strong>OpenAI</strong> — AI name generation (USA, EU standard contractual clauses)</li>
        </ul>
        <p class="mt-3">No data is sold or transferred to third parties for commercial purposes.</p>

        <h2 class="text-xl font-semibold mt-8 mb-3">6. International Transfers</h2>
        <p>
          Stripe and OpenAI are US-based providers. Transfers are governed by standard contractual clauses (SCCs) approved by the European Commission, ensuring an adequate level of protection.
        </p>

        <h2 class="text-xl font-semibold mt-8 mb-3">7. Your Rights</h2>
        <p>Under the GDPR, you have the following rights:</p>
        <ul class="list-disc pl-6 mt-2 space-y-1">
          <li><strong>Right of access</strong>: obtain a copy of your data</li>
          <li><strong>Right to rectification</strong>: correct inaccurate data</li>
          <li><strong>Right to erasure</strong>: request deletion of your data</li>
          <li><strong>Right to portability</strong>: receive your data in a structured format</li>
          <li><strong>Right to object</strong>: object to certain processing activities</li>
          <li><strong>Right to restriction</strong>: restrict processing in certain cases</li>
        </ul>
        <p class="mt-3">
          To exercise your rights, contact our DPO: <a href="mailto:dpo@namorama.com" class="text-primary">dpo&#64;namorama.com</a><br>
          We will respond within one month. If unsatisfied, you may lodge a complaint with your national data protection authority.
        </p>

        <h2 class="text-xl font-semibold mt-8 mb-3">8. Cookies and usage measurement</h2>
        <p>
          <strong>Strictly necessary</strong> cookies and identifiers are always active: authentication session, language and theme preferences, your cookie choices (<code>cc_cookie</code>), and an anonymous visit identifier scoped to the browser tab and erased when it closes (<code>nm_sid</code>), which lets us count visits without identifying you.
        </p>
        <p class="mt-3">Two optional uses only run with your consent, asked for separately:</p>
        <ul class="list-disc pl-6 space-y-1 mt-2">
          <li>
            <strong>Audience measurement (Google Analytics 4)</strong>: pages visited and visit duration, to understand how Namorama is used. This data is processed by Google.
          </li>
          <li>
            <strong>Session recording</strong>: your actions in the app (clicks, scrolling, pages viewed, technical errors) are recorded so that we can review a journey and find what got in your way. Everything you type is masked <em>in your browser, before anything is sent</em>, as are your project descriptions, keywords and email addresses. Neither your network traffic nor administration pages are recorded. Recordings stay on Namorama's own server, with no third-party processor, are only viewed by the team, and are <strong>deleted after 30 days</strong>.
          </li>
        </ul>
        <p class="mt-3">
          You can give or withdraw consent at any time, category by category, with the <strong>“Manage cookies”</strong> link in the footer. Withdrawal takes effect immediately: nothing more is recorded from that moment. No advertising cookies are used.
        </p>

        <h2 class="text-xl font-semibold mt-8 mb-3">9. Security</h2>
        <p>
          We implement appropriate technical and organisational measures to protect your data: encrypted communications (HTTPS/TLS), secure authentication (Keycloak), and restricted access to personal data.
        </p>

        <h2 class="text-xl font-semibold mt-8 mb-3">10. Changes</h2>
        <p>
          This policy may be updated at any time. The date of last update is shown at the top of this page. We will notify you of any significant changes by email.
        </p>

        <div class="mt-10 flex gap-4">
          <a routerLink="/legal" class="text-primary text-sm">Legal Notice</a>
          <span class="text-400">·</span>
          <a routerLink="/" class="text-primary text-sm">← Back to home</a>
        </div>
      }
    </div>
  `,
})
export class PrivacyComponent implements OnInit {
  lang = signal('fr');

  constructor(private translate: TranslateService) {
    applyContentSeo({
      title: 'Politique de confidentialité',
      description:
        'Politique de confidentialité de Namorama : données collectées, finalités, bases légales, durées de conservation et vos droits (RGPD).',
      path: '/privacy',
    });
  }

  ngOnInit() {
    // FR par défaut (notamment au prerender, où currentLang peut être absent) :
    // on ne bascule en anglais que si la langue active commence par « en ».
    this.lang.set(this.translate.currentLang()?.startsWith('en') ? 'en' : 'fr');
    this.translate.onLangChange.subscribe(e => {
      this.lang.set(e.lang?.startsWith('en') ? 'en' : 'fr');
    });
  }
}
