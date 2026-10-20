# Design

## Context

Le flux « 10 de plus » se lit dans les deux sens, du bouton jusqu'au serveur et retour.

1. Le bouton appelle `findDomains(true)`, qui envoie `POST /domain/search/stream` (SSE).
2. Le contrôleur fixe `limit = min(10, crédits)` puis appelle `findAvailableDomains`.
3. Ce service enchaîne au plus 5 tentatives. Chacune demande 30 noms au modèle (`generateDomainIdeas`), puis un petit groupe de travailleurs les vérifie et s'arrête dès que `targetCount` est atteint.
4. En fin de course, le contrôleur débite `results.length` dans une transaction et émet `done`.

Quatre constats dans le code actuel guident les choix qui suivent :

- **Exclusion** : `checkedNames` est amorcé avec `excludeNames`. Le front n'y met que `this.domains()`, c'est-à-dire les noms affichés (`wizard.ts:2707`).
- **Prompt** : `exclusionSection` coupe la liste à `excludeNames.slice(0, 200)`, donc garde les **plus anciens**. Au-delà de 200, le modèle ne voit plus les noms qu'il vient de produire. Le filtre serveur `checkedNames.has` empêche la revérification, mais pas la génération inutile.
- **Fin de connexion** : le contrôleur ne surveille pas la fermeture de la requête. Le Stop du front (`cancelSearch`) ne coupe que la lecture côté client.
- **Rythme mesuré** dans les logs : une tentative prend de 4 à 10 s, et 5 tentatives de 22 à 47 s selon les extensions. `.fr` est le plus lent, son registre se refermant au fil des requêtes.

## Goals / Non-Goals

**Goals :**
- rendre 10 noms dans la grande majorité des « 10 de plus » qui en rendent aujourd'hui 2 à 4, sans que l'attente dépasse un plafond connu ;
- ne jamais payer deux fois, en tentatives et en quota de registre, la vérification d'un même nom dans une session.

**Non-Goals :**
- modifier la consigne de génération pour viser des noms plus inventés quand le rendement chute ;
- persister en base les noms testés d'un projet ;
- toucher au mode de vérification du rapport de marque, qui interroge le RDAP seul.

## Decisions

### 1. Le serveur dit ce qu'il a vérifié, le front accumule

L'événement `done` porte `checkedNames` : les noms **effectivement passés à la vérification** pendant cette recherche. Ce n'est pas tout `checkedNames`, qui contient aussi des noms générés et laissés de côté une fois l'objectif atteint.

Le wizard tient un ensemble `testedNames` pour le projet courant. Il y ajoute ces noms à chaque `done`, puis envoie `excludeNames = noms affichés ∪ testedNames`. L'ensemble se vide quand le projet change ou qu'une nouvelle recherche démarre (pas un ajout).

*Écarté : persister les noms testés en base.* Il faudrait une colonne ou une table, plus une migration manuelle en prod (`DB_SYNCHRONIZE` interdit), pour un gain limité au retour sur un vieux projet. À reconsidérer si les mesures le justifient.

*Écarté : envoyer les noms testés au fil de l'eau (événement `candidate`).* Le front les reçoit déjà, mais un nom annoncé en `candidate` peut ne pas avoir été vérifié jusqu'au bout si la recherche s'arrête. `done` est la seule source fiable.

### 2. Le prompt voit les noms les plus récents, le filtre serveur voit tout

- `exclusionSection` passe de `slice(0, 200)` à `slice(-200)`. Les noms les plus récents sont ceux que le modèle risque le plus de reproduire.
- Le filtre `checkedNames.has` reste exhaustif.
- Le DTO borne `excludeNames` à 2 000 entrées (`@ArrayMaxSize`), soit ~25 ko au plus. Le front envoie les 2 000 plus récentes.

### 3. Arrêt sur trois seuils au lieu d'un

La boucle continue tant que `results < targetCount`, et s'arrête au premier des trois seuils :

- objectif atteint ;
- **budget de temps** de 60 s, mesuré depuis le début de la recherche, et vérifié avant chaque nouvelle tentative (une tentative commencée va à son terme) ;
- **plafond de 10 tentatives**.

Les deux valeurs deviennent des constantes nommées en tête de `domain.service.ts`. Le service renvoie `attempts` et `stopReason` (`target`, `time`, `attempts`, `aborted`), que `search_completed` journalise.

*Pourquoi 60 s et 10 tentatives.* Mesuré : 5 tentatives prennent de 22 à 47 s. 60 s laisse donc doubler les tentatives en `.com`, et en ajoute une ou deux en `.fr`, où le registre ralentit. Les résultats s'affichent au fil de l'eau : l'attente n'est pas un écran figé, et le Stop rend la main (décision 4).

*Écarté : demander plus de 30 noms par tentative.* La consigne répartit déjà les 30 entre styles et sous-groupes (`US-044`). La grossir allonge chaque appel sans garantie de rendement, alors que plus de tentatives élargit aussi la liste d'exclusion transmise au modèle.

### 4. La fermeture de la requête annule la recherche

- Le contrôleur crée un `AbortController` et écoute `res.on('close')`. Si la réponse n'est pas terminée à ce moment-là, la connexion est perdue et il appelle `abort()`.
- `findAvailableDomains` reçoit le `signal`. Il le consulte avant chaque tentative et avant chaque vérification d'un candidat, et sort avec `stopReason = 'aborted'`.
- Le contrôleur ne débite rien et n'enregistre rien : pas de `createOrUpdate`, pas d'`addSuggestions`, et pas de `done` à émettre. Il journalise `search_cancelled_by_user` côté serveur. Cet événement existe déjà dans le tunnel, émis par le front.
- Un appel au modèle déjà parti va à son terme : son coût est dépensé de toute façon, et l'annuler demanderait de propager le signal jusqu'au client OpenAI pour quelques secondes gagnées.

On écoute `res.on('close')` et non `req.on('close')` : avec Express, `req` émet `close` dès la fin de la lecture du corps, ce qui couperait toutes les recherches.

### 5. La note cite les extensions et le mode réels

- `NOTE` prend les paramètres `{{extensions}}` et `{{mode}}`. Le wizard les construit depuis `selectedExtensions()` et `matchMode()` : « .fr ou .com », « .fr et .com ».
- `totalChecked` affiché reste celui de la recherche. On cesse en revanche de compter les noms exclus d'office : le serveur renvoie le nombre de noms vérifiés par cette recherche, pas la taille de `checkedNames` amorcée par l'exclusion.

### 6. L'actualisation passe les extensions

`refreshBrandReport` transmet `extensions: this.selectedExtensions()`, comme le fait déjà la première génération (`wizard.ts:1097`).

## Risks / Trade-offs

- **[Coût modèle en hausse sur les marchés saturés]** → Au pire, une recherche passe de 5 à 10 tentatives, soit au plus deux fois plus d'appels de génération sur les seules recherches qui rendaient moins de 10 noms. Le budget de temps borne ce surcoût, et `attempts` dans `search_completed` permettra de le chiffrer dans la semaine.
- **[Quota et limiteur du registre `.fr`]** → Plus de vérifications par recherche, c'est plus de pression sur un registre qui ralentit déjà avec le volume. L'exclusion des noms testés en retire une partie. Si le délai `.fr` dérive, le budget de temps coupe avant.
- **[Recherche annulée après des débits partiels ?]** → Non : le débit n'a lieu qu'en fin de recherche, dans une transaction unique. L'annulation intervient avant elle.
- **[Proxy qui ne remonte pas la fermeture]** → Nginx ferme la connexion amont quand le client part (`proxy_ignore_client_abort` désactivé par défaut). À vérifier une fois en prod avec Stop.
- **[Liste d'exclusion longue dans un même projet]** → Elle est bornée à 2 000 côté serveur, et seuls les 200 noms les plus récents vont au modèle.

## Migration Plan

Pas de migration de données. Le déploiement est habituel : API et web ensemble, puisque `done.checkedNames` est ignoré par un ancien front et facultatif pour le nouveau. Retour arrière : redéployer les images précédentes.
