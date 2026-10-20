# Tasks

## 1. Boucle de recherche : seuils, noms vérifiés, annulation (API, service)

- [x] 1.1 Dans `domain.service.ts`, remplacer `maxAttempts = 5` par deux constantes nommées, `BUDGET_RECHERCHE_MS = 60_000` et `MAX_TENTATIVES = 10`. Vérifier le budget de temps avant chaque nouvelle tentative, et faire renvoyer à `findAvailableDomains` `attempts` et `stopReason` (`target` | `time` | `attempts` | `aborted`). Vérifier par un test unitaire (nouveau `recherche-boucle.spec.ts`, modèle et vérificateur simulés) : un marché à 1 nom libre par tentative va au-delà de 5 tentatives, et s'arrête sur `attempts` ou `time` avec la bonne raison.
- [x] 1.2 Tenir dans la boucle l'ensemble des noms **effectivement vérifiés** (passés à `checkExtensions`), distinct de `checkedNames`, et le renvoyer (`verifiedNames`). Renvoyer `totalChecked` comme le nombre de noms vérifiés par cette recherche, sans les exclusions reçues. Vérifier par test : un nom généré et non vérifié après l'objectif atteint n'y figure pas, et un nom de `excludeNames` n'est jamais vérifié.
- [x] 1.3 Accepter une option `signal: AbortSignal`, consultée avant chaque tentative et avant chaque candidat, avec sortie `stopReason = 'aborted'`. Vérifier par test : un signal déclenché après le 3ᵉ résultat arrête toute vérification ultérieure.
- [x] 1.4 Dans `generateDomainIdeas`, passer `excludeNames.slice(0, 200)` à `slice(-200)`. Vérifier par test : avec 300 exclusions, les 200 dernières figurent dans la consigne et la première n'y figure pas.

## 2. Flux SSE : fin de connexion, contrat `done`, journal (API, contrôleur)

- [x] 2.1 Dans `search/stream`, créer un `AbortController` déclenché par `res.on('close')` quand la réponse n'est pas terminée, et transmettre le signal. Sur `stopReason = 'aborted'` : ni `createOrUpdate`, ni débit, ni `addSuggestions`, ni `done`, et un événement `search_cancelled_by_user` côté serveur. Vérifier par un test du contrôleur (sur le modèle de `analyse-lot.controller.spec.ts`) : une fermeture simulée ne déclenche ni `decrementCredits` ni `addSuggestions`.
- [x] 2.2 Ajouter `checkedNames` (les noms vérifiés de 1.2) à l'événement `done`, et `attempts` et `stopReason` à `search_completed`. Vérifier par test du contrôleur que `done` porte les noms vérifiés et que le débit égale le nombre de résultats.
- [x] 2.3 Borner `excludeNames` à 2 000 entrées dans `search-domains.dto.ts` (`@ArrayMaxSize(2000)`). Vérifier par test de validation que 2 001 entrées sont refusées.
- [x] 2.4 Lancer `cd api && npm test` et `npm run build` : tout passe.
- [x] 2.5 Dans `scripts/analyze-logs.py`, mode `funnel` ou nouveau mode `appends` : afficher la répartition de `stopReason` et la moyenne de `attempts` des recherches qui rendent moins que demandé. Vérifier en le jouant sur un fichier NDJSON d'exemple.

## 3. Wizard : exclusion cumulée, note, actualisation du rapport (web)

- [x] 3.1 Dans `wizard.ts`, ajouter un signal `testedNames`, alimenté par `done.checkedNames`, vidé à un changement de projet et à une recherche qui n'est pas un ajout. Envoyer `excludeNames` = noms affichés ∪ `testedNames`, limité aux 2 000 plus récents. Vérifier dans l'onglet réseau du navigateur que le second « 10 de plus » envoie les noms du premier `done`.
- [x] 3.2 Paramétrer `WIZARD.STEP3.NOTE` par `{{extensions}}` et `{{mode}}` dans `fr.json` et `en.json` (« .fr ou .com » / « .fr et .com »), et les fournir dans `wizard.html`. Vérifier au navigateur avec .io seul : la note ne dit pas « .com ».
- [x] 3.3 Passer `extensions: this.selectedExtensions()` dans `refreshBrandReport`. Vérifier au navigateur que le rapport actualisé d'un projet .fr + .com n'affiche ni .io, ni .net, ni .app.
- [x] 3.4 Lancer `cd web && npm run build` (build de production) : il passe, budgets compris.

## 4. Vérification d'ensemble et documentation

- [x] 4.1 En local, sur une description saturée en `.com` seul, enchaîner trois « 10 de plus ». Vérifier : 10 noms par lot ou une note qui cite « .com » ; aucun nom revu d'un lot à l'autre ; Stop en cours de lot → solde de crédits inchangé après rechargement.
  - Vérifié le 20/10/2026 en local, en `.com` seul et longueur ≥ 5. Aucun nom revu d'un lot à l'autre, et le débit égale les noms rendus (29 crédits pour 29 noms). Stop : serveur arrêté en 2 s, solde inchangé après rechargement.
  - Les lots ont rendu 10, 7, 4 et 8 noms, les trois courts arrêtés sur le plafond de 10 tentatives : le modèle repropose 30 à 50 % de noms déjà exclus. Quand un ajout rend moins de 10 noms, c'est le toast `PARTIAL_RESULTS` qui s'affiche, pas la note : il sera reformulé au chantier B.
  - Décision du 20/10/2026 : garder 60 s et 10 tentatives, et trancher sur les mesures de prod (4.3).
- [x] 4.2 Ajouter à `CLAUDE.md` une section « Suggestions supplémentaires » : budget de temps et plafond, exclusion des noms vérifiés, annulation sans débit, champs `attempts` et `stopReason` du journal. Vérifier que les constantes citées existent dans le code.
- [ ] 4.3 Après déploiement, relire une semaine de `search_completed` avec le mode de 2.5. Vérifier que la part des ajouts rendant moins de 10 a baissé, et chiffrer le surcoût en tentatives. Sur Stop en prod, vérifier qu'aucun débit n'apparaît.
