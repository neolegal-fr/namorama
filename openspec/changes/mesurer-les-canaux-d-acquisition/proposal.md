# Proposal

## Why

Le produit compte ses visites, mais il ne sait pas **d'où elles viennent**. Le relevé du
07/11/2026 en est une bonne illustration :

- **Les enregistrements de session montrent un canal dominant.** Du 31/10 au 07/11/2026,
  11 des 16 sessions de plus de 25 s sont arrivées par un lien portant
  `utm_source=chatgpt.com`, le plus souvent sur une page `/generateur-*`. Cela représente
  8 des 11 personnes environ. Le rejeu ne voit pourtant que les visites qui ont consenti à
  l'enregistrement : la part réelle reste inconnue.
- **Aucune autre source ne le mesure.**
  - `page_viewed` envoie le chemin **sans ses paramètres** (`web/src/app/app.ts:682`). Sur
    les 315 premières pages de session des logs, aucune ne porte de trace d'origine.
  - `visitor_session` n'a ni source ni page d'arrivée
    (`api/src/common/funnel/visitor-session.entity.ts`).
  - Google Analytics ne voit que les visites qui acceptent la bannière : 31 choix de
    consentement enregistrés en 30 jours, pour 254 visites mesurées.
- **Les chiffres de l'entonnoir sont pourtant bons.** 24 % des visites arrivées sans
  compte en créent un (56 sur 236, 30 jours au 07/11/2026). Mais on ne sait pas quel
  canal, ni quelle page, produit ces inscriptions. C'est la donnée qui manque pour choisir
  où investir : pages de contenu, présence dans les assistants, référencement.

## What Changes

- **Chaque visite garde son origine** dès sa première page :
  - la page d'arrivée, sans paramètres ;
  - `utm_source`, `utm_medium` et `utm_campaign`, bornés ;
  - le domaine du site référent, sans chemin ni paramètre.
- **Un canal se déduit à la lecture**, jamais à l'écriture : ChatGPT et assistants IA,
  moteurs de recherche, réseaux sociaux, autres sites, direct ou inconnu. Un classement
  revu plus tard s'applique ainsi à tout l'historique.
- **Une section « Canaux d'acquisition » au tableau de bord**, sur la période choisie, avec
  deux tableaux :
  - par canal ;
  - par page d'arrivée (les 8 premières, le reste regroupé).

  Chaque ligne donne les visites, les comptes créés et les recherches, avec leur taux. Il
  n'y a pas de pourcentage sous 5 visites.
- **« Mesuré depuis le … »** pour toute période qui commence avant la mesure : les visites
  antérieures n'ont pas d'origine et ne se reconstituent pas.
- `page_viewed` porte aussi l'origine dans les logs, pour `scripts/analyze-logs.py`.

**Hors périmètre :**
- l'écart à la période précédente dans ces tableaux (voir design, D5) ;
- les courbes mensuelles par canal ;
- l'attribution d'un paiement ou d'un rapport à un canal : il y en a trop peu (4 rapports,
  aucun paiement en 30 jours) ;
- la reconstitution des visites passées, à partir de nginx ou des logs ;
- le déplacement de la demande de connexion, qui sera discuté une fois les canaux mesurés.

## Capabilities

### New Capabilities
- `canaux-d-acquisition` : ce qu'une visite retient de son origine (page d'arrivée, UTM,
  référent), dans quelles limites, et comment cette origine se range en canaux.

### Modified Capabilities
- `tableau-de-bord` : ajout de la section « Canaux d'acquisition » (deux tableaux sur la
  période, règle des petits nombres, date de début de la mesure).

## Impact

- **API** :
  - cinq colonnes nullables dans `visitor_session`, avec la migration
    `api/migrations/2026-11-07-canaux-d-acquisition.sql`, **à appliquer avant le
    déploiement** ;
  - `FunnelService.visite()` reçoit l'origine ;
  - `EventsController` la lit dans `page_viewed` ;
  - `AdminService` gagne un agrégat `acquisition`, qui échoue seul, comme l'entonnoir.
- **Web** :
  - `AnalyticsService.pageView()` ajoute l'origine à la première page de la visite ;
  - `AdminDashboardComponent` reçoit la nouvelle section.
- **Contrat** : `page_viewed` porte cinq clés optionnelles de plus dans `meta` ; la réponse de
  `GET /admin/stats` gagne le champ `acquisition`. Les deux ajouts sont compatibles.
- **Données personnelles** :
  - aucune adresse complète n'est gardée : le référent est réduit à son domaine ;
  - aucun identifiant de campagne n'est accepté s'il ne respecte pas un format strict ;
  - aucun cookie n'est ajouté. La mesure reste dans le cadre des visites anonymes déjà
    comptées.
- **Interface** : page d'administration seulement. La section reprend l'en-tête
  `nm-entete`, la carte `nm-kpi` et le tableau `nm-table` déjà utilisés par les onglets
  Coûts IA et Fidélité. Aucun nouveau motif, aucun nouveau jeton.
- **Docs** : CLAUDE.md, sections « Entonnoir de conversion » et « Parcours utilisateur ».
