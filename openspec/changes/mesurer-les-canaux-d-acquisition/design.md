# Design

## Context

Le pourquoi est dans proposal.md, les exigences dans `specs/canaux-d-acquisition/spec.md`
et `specs/tableau-de-bord/spec.md`. Voici l'état actuel qui façonne l'approche.

- **Une visite naît au premier `page_viewed`.** `AnalyticsService.pageView()` envoie une
  balise `sendBeacon` vers `POST /events` (`web/src/app/services/analytics.ts:58`).
  `EventsController.track()` appelle `FunnelService.visite()`
  (`api/src/events/events.controller.ts:47`), qui fait un `INSERT … ON DUPLICATE KEY` :
  la première page fait foi (`funnel.service.ts:92`).
- **Le premier affichage part tard.** `suivreLesPages()` n'est appelée qu'après la réponse
  de Keycloak (`app.ts:666-686`). Entre-temps, l'adresse a pu changer :
  - Keycloak ajoute puis retire ses fragments ;
  - `ouvrirLeFeedbackDemande()` retire `?avis` par `replaceState`.

  Le chemin envoyé est de plus coupé avant ses paramètres (`app.ts:682`).
- **Une visite peut naître sans affichage.** `FunnelService.marquer()` crée la ligne
  quand une étape arrive avant la balise, ou sans elle (`funnel.service.ts:115`).
- **`meta` est borné** à 20 clés et 300 caractères par valeur
  (`events.controller.ts:20-21`), puis journalisé tel quel avec l'événement.
- **L'entonnoir du tableau de bord** lit `visitor_session` jointe à `user`, avec le
  prédicat `VISITES_MESUREES`. Il échoue seul et renvoie `null`
  (`admin/admin.service.ts:620-670`).
- **Le tableau `nm-table` existe** dans les onglets Coûts IA et Fidélité
  (`admin-model-costs.component.ts:101`, `admin-retention.component.ts:91`).

## Goals / Non-Goals

**Goals:**
- L'origine est lue **une seule fois**, au démarrage de l'application, et jointe au
  premier affichage de la visite.
- Le serveur ne fait **aucune confiance** au navigateur : il refiltre chaque valeur, même
  déjà filtrée côté client.
- Revoir le classement en canaux ne demande **ni migration ni réécriture** de données.

**Non-Goals:**
- Distinguer le trafic payant du trafic gratuit : le produit n'achète aucun trafic.
- Mesurer l'origine des visites qui refusent toute balise. Elles tombent déjà dans
  « direct ou inconnu » par la voie de `marquer()`.

## Decisions

### D1. L'origine est lue au démarrage, dans le constructeur de `AnalyticsService`

Le service lit `window.location.pathname`, `window.location.search` et `document.referrer`
dès sa création, au démarrage du composant racine. Il réduit le référent à son nom de
domaine (`new URL(...).hostname`), puis joint ces valeurs au **premier** `page_viewed`
qu'il envoie. Les affichages suivants ne les portent pas.

- *Rejeté : lire l'adresse au moment du premier `pageView()`.* Il part après Keycloak, une
  fois les fragments réécrits et `?avis` retiré. La page d'arrivée et les paramètres
  pourraient alors avoir changé.
- *Rejeté : envoyer le référent complet et le réduire au serveur.* Le chemin d'un référent
  peut porter une donnée personnelle. Le réduire dans le navigateur évite qu'elle
  transite, même par erreur, et qu'elle finisse dans les logs.

### D2. Cinq clés à plat dans `meta`, refiltrées par le serveur

Le premier `page_viewed` porte `arrivee`, `utmSource`, `utmMedium`, `utmCampaign` et
`referent`, toutes optionnelles. Une fonction pure, `origineDeLaVisite()`, placée dans
`api/src/common/funnel/origine.ts`, les nettoie selon les règles de la spécification :
- **chemin** : sans paramètres, segments d'identifiant remplacés par `:id`, 120 caractères
  au plus ;
- **paramètres de campagne** : jeu de caractères strict, 60 caractères au plus ;
- **référent** : un nom de domaine valide, qui n'appartient pas au produit.

Les domaines du produit sont ceux de `FRONTEND_URL` et de `KEYCLOAK_AUTH_SERVER_URL`,
plus `namorama.com` et ses sous-domaines.

- *Rejeté : un objet `origine` imbriqué.* `meta` n'est borné que sur ses clés de premier
  niveau : un objet imbriqué échapperait à la limite de 300 caractères, et donc au
  journal borné.
- **Contrat** : `page_viewed` gagne ces cinq clés optionnelles, et les logs les portent. Un
  ancien onglet qui ne les envoie pas crée une visite sans origine, comptée
  « direct ou inconnu ».

### D3. Cinq colonnes nullables, écrites seulement à l'insertion

Les colonnes ajoutées à `visitor_session` sont `landingPath` (120), `utmSource`,
`utmMedium`, `utmCampaign` (60 chacune) et `referrerHost` (120), en `varchar`, toutes
nullables. Elles ne s'écrivent que dans l'`INSERT` de `visite()` : `ON DUPLICATE KEY` ne
les touche pas, et `marquer()` les laisse vides.

- *Rejeté : une table `visit_origin` à part.* Elle demanderait une jointure de plus pour
  une relation 1-1, et la collation de `visitor_session` a déjà mis le tableau de bord à
  500 une fois (CLAUDE.md, « Entonnoir de conversion »).
- *Rejeté : une colonne `canal` calculée à l'écriture.* Une règle corrigée ne
  s'appliquerait pas aux visites déjà enregistrées. Le classement se fait à la lecture
  (D4).

### D4. Le classement en canaux est une fonction TypeScript, appliquée après la requête

`canalDe({ utmSource, referrerHost })` renvoie `ia`, `moteurs`, `reseaux`, `autres` ou
`direct`. La source de campagne prime : on classe d'abord la source, puis le référent à
défaut. L'ordre des tests est IA, moteurs, réseaux, puis autres ; IA passe avant les
moteurs pour que `gemini.google.com` ne compte pas comme Google.

Les listes de domaines vivent dans `origine.ts`, avec ses tests. Une valeur correspond à
un domaine quand elle lui est égale, qu'elle en est un sous-domaine, ou qu'elle est son
premier label : `chatgpt` équivaut ainsi à `chatgpt.com`. Google, Yahoo, Yandex et
Pinterest se reconnaissent quel que soit le pays (`google.fr`, `google.co.uk`).

Le courrier électronique, comme `mail.google.com` ou `utm_medium=email`, compte dans
« Autres sites ». C'est le canal choisi le 07/11/2026 ; un canal propre se décidera s'il
pèse.

- *Rejeté : un `CASE` SQL.* Les listes se dupliqueraient entre SQL et tests, et une
  correspondance par suffixe de domaine s'écrit mal en SQL.
- **Volume** : la requête regroupe par (source, référent, page). À ~36 visites par jour,
  30 jours donnent au plus quelques centaines de groupes. L'agrégation en mémoire est
  négligeable.

### D5. Deux tableaux sans écart, et une section qui échoue seule

`GET /admin/stats` gagne le champ
`acquisition: { depuis, canaux[], pages[] } | null`. Chaque ligne porte `cle`, `visites`,
`sansCompte`, `comptes` et `recherches`. Le front calcule les taux et applique le socle
de 5.

La fenêtre est `[max(début de période, début de la mesure), fin]`. Le début de la mesure
est la première visite qui a une page d'arrivée, et `depuis` porte toujours cette date,
ou `null` si aucune visite n'est encore mesurée. C'est l'interface, qui connaît le début
de la période, qui décide d'afficher « mesuré depuis le … ». Ainsi « pas encore de
mesure » ne se confond pas avec « aucune visite sur la période ».

L'agrégat a son propre `try/catch` et renvoie `null`, comme l'entonnoir : une jointure de
plus ne doit pas pouvoir mettre la page à 500.

- *Rejeté : un écart à la période précédente par ligne.* À ce volume, une ligne de 3 à 8
  visites changerait de « +200 % » d'une semaine à l'autre. Les cartes en tête de page
  disent déjà la tendance.
- **Interface** : la section reprend `nm-entete`, `nm-kpi` et `nm-table`. Les règles de
  `nm-table` sont copiées des onglets qui les définissent déjà, sans nouveau jeton, et le
  libellé du canal s'aligne à gauche comme la colonne « Opération » de Coûts IA. Ce n'est
  ni un nouveau motif ni un écart au système de design.

## Risks / Trade-offs

- **Un référent est souvent vide.** Les applications mobiles et la politique
  `strict-origin` de certains sites l'effacent. Ces visites tombent dans « Direct ou
  inconnu ». → Le libellé dit « ou inconnu », et les liens que nous maîtrisons
  (courriels, réseaux) pourront porter un `utm_source`.
- **ChatGPT n'ajoute pas toujours `utm_source`.** → Le référent `chatgpt.com` est aussi
  classé IA.
- **Le classement peut se tromper** sur un domaine inconnu, rangé dans « Autres sites ».
  → Il se corrige dans `origine.ts`, et la correction vaut rétroactivement (D4).
- **Une balise bloquée** fait perdre l'origine, la visite étant créée par `marquer()`. →
  Elle reste comptée, en « Direct ou inconnu » ou « Inconnue ».

## Migration Plan

1. Appliquer `api/migrations/2026-11-07-canaux-d-acquisition.sql` en production
   (`ADD COLUMN IF NOT EXISTS`, sauvegarde datée d'abord), **avant** l'image.
2. Déployer l'API et le web.
3. Retour arrière : l'image précédente ignore ces colonnes nullables. Le `DROP COLUMN`
   figure en en-tête du script, au besoin.
