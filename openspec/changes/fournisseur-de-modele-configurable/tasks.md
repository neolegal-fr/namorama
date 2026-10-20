# Tasks

## 1. Avant le code : l'enveloppe tient-elle ?

- [ ] 1.1 Saisir dans Administration → Tarifs IA les tarifs datés de `claude-haiku-5-5`, `claude-sonnet-5-5` et `claude-opus-5-5` (entrée, entrée en cache, sortie), vérifiés sur la page tarifs d'Anthropic le jour de la saisie. Puis relever au simulateur le coût projeté sur 30 jours pour chaque combinaison de modèles de D10, majoré de 30 %. Vérification : les trois tarifs apparaissent à l'écran, et la projection est notée dans ce fichier sous la tâche.
  - Grille vérifiée le 20/10/2026 sur platform.claude.com/docs/en/about-claude/pricing ($/M tokens, entrée · cache lu · sortie) : `claude-haiku-5-5` 0,10 · 0,01 · 0,50 (prompts ≤ 100 000 tokens ; 0,50 · 0,05 · 2,50 au-delà, non modélisé) ; `claude-sonnet-5-5` 2 · 0,10 · 10 ; `claude-opus-5-5` 4 · 0,20 · 20. Recherche web : 10 $ les mille, comme chez OpenAI. Saisie faite dans la base **locale** ; reste à la faire en prod.
- [ ] 1.2 Réclamer les crédits Max (Settings → Billing, organisation Console liée), créer un espace de travail `namorama` sans moyen de paiement ni rechargement automatique, et y créer une clé. Vérification : la Console affiche le solde de crédits sur l'organisation, et un `curl` minimal vers `/v1/messages` avec la clé répond 200.

## 2. Le port et l'adaptateur OpenAI, sans changement de comportement

- [x] 2.1 Créer `api/src/common/modele-ia/` : le port `ModeleIA` (`completer`, `chercherSurLeWeb`), les types de demande et de réponse (D1), et la lecture de configuration (`AI_PROVIDER`, `AI_FALLBACK_PROVIDER`, modèles par rôle et par fournisseur), avec ses contrôles de démarrage. Vérification : des tests unitaires couvrent chaque scénario de l'exigence « Le démarrage refuse une configuration inutilisable ».
- [x] 2.2 Écrire `OpenAiAdaptateur` en y déplaçant les paramètres actuels de chaque appel (`json_object`, `max_completion_tokens`, `reasoning_effort`, API Responses pour `web_search`). Vérification : un test par opération compare la requête envoyée au SDK simulé à celle qu'envoie le code d'aujourd'hui, paramètre pour paramètre.
- [x] 2.3 Faire passer les neuf appels de `DomainService`, ainsi que `NameVariantsService` et `AdminMailService`, par `ModeleIA`, et retirer d'eux tout import d'`openai`. Vérification : `grep -rn "from 'openai'" api/src` ne trouve plus que l'adaptateur, et `npm test` passe, notamment `analyse-groupee`, `recherche-boucle` et `name-variants`.

## 3. Le relevé reconnaît le fournisseur

- [x] 3.1 Écrire `api/migrations/<date>-model-usage-provider.sql` (`ADD COLUMN IF NOT EXISTS provider varchar(16) NOT NULL DEFAULT 'openai'`, commande d'application et retour arrière en en-tête), et ajouter la colonne à l'entité. Vérification : appliqué deux fois de suite sur la base locale, le script ne lève rien.
- [x] 3.2 `mesurer` reçoit le fournisseur, et `lireConsommation` lit une réponse Messages selon D6. Vérification : des tests unitaires reprennent les scénarios « Appel simple », « Entrée en partie servie par le cache » et « Repérage du marché » de la spec `releve-de-consommation`.
- [x] 3.3 Vérifier que `cout-sql.ts` chiffre un appel `claude-*` au tarif saisi et signale un modèle sans tarif. Vérification : un test SQL, ou une lecture du tableau de bord local après un appel réel, montre un coût non nul pour un modèle tarifé et « non chiffré » pour un autre.

## 4. L'adaptateur Anthropic

- [x] 4.1 Ajouter `@anthropic-ai/sdk` à `api/package.json`, et écrire `AnthropicAdaptateur.completer` : consigne en `system`, `max_tokens` majoré (D4), sortie structurée avec le schéma de l'opération (D2), réflexion selon le tableau de D3, `stop_reason` traduit en `tronque` ou `refuse`. Vérification : des tests sur SDK simulé couvrent la requête construite pour chaque famille de modèles, et les scénarios « Réponse tronquée » et « Refus du modèle ».
- [x] 4.2 Déclarer un schéma JSON par opération JSON (`keywords`, `constraints`, `competitors`, `generate_names`, `analyze`, `pick_best`, `name_variants`, `admin_mail_draft`), calqué sur ce que lit son parseur. Vérification : pour chaque opération, un test fait passer un exemple valide du schéma par le parseur existant, qui rend un résultat non vide.
- [x] 4.3 Écrire `AnthropicAdaptateur.chercherSurLeWeb` (D5) : choix de la version de l'outil, `max_uses`, comptage des recherches, erreur d'outil, `pause_turn` relancé une fois. Vérification : des tests sur SDK simulé couvrent « Repérage sur Claude » et « Recherche web indisponible ».
- [x] 4.4 Appels réels en local, avec `AI_PROVIDER=anthropic` et la clé de 1.2 : une recherche complète, une analyse de dix noms, un repérage du marché, un rapport de marque et un brouillon de courriel admin. Vérification : vérifié au navigateur, résultats affichés, et une ligne `model_usage` `provider = 'anthropic'` par appel, avec ses tokens et ses recherches web.
  - 20/10/2026, API du worktree sur Claude (Haiku 5.5 simple et analyse, Sonnet 5.5 créatif, secours OpenAI), base locale. **Fait** : les cinq routes publiques de l'étape 1 en HTTP, puis génération, analyse de 10 noms, pick-best, découpage INPI et brouillon admin appelés sur les services. Tout a répondu, l'analyse rend 10 noms sur 10, et le repérage rend `source: web` avec 7 concurrents. Le relevé compte 9 lignes `provider = 'anthropic'`, toutes chiffrées, pour 0,104 $ au total : `competitors` 0,090 $ (36 572 tokens d'entrée, 1 recherche web), `generate_names` 0,009 $, `pick_best` 0,003 $, `analyze` 0,0017 $ pour 10 noms (3 123 tokens de sortie, sous le budget majoré de 4 420), le reste moins de 0,0002 $ l'appel. Aucun token de réflexion relevé, y compris à `low`.
  - 20/10/2026, au navigateur (front sur 4200, API du worktree sur 3001, Keycloak local, compte de test). Parcours complet sur Claude :
    - reformulation proposée puis adoptée, nom de projet « Algomar », 15 mots-clés, longueur ≥ 7 détectée ;
    - repérage du marché : 8 concurrents pertinents (Lamazuna, Lush, Atelier des algues…), badge « live web search », 4 recherches web pour 0,11 $ ;
    - recherche en flux : 10 noms libres en .com sur 41 vérifiés, 2 tentatives, arrêt sur objectif, 10 crédits débités ;
    - analyse des cartes à la visibilité (lots de 6 puis 2), notes affichées ;
    - rapport de marque « refillkelp » : découpage « refill kelp », notation 76/100, INPI et EUIPO interrogés (aucun dépôt), réseaux vérifiés, 50 crédits débités.
    - Toutes les lignes du relevé sont `anthropic`. Le brouillon admin a été vérifié sur le service avec Claude (voir plus haut), pas à l'écran : le compte de test n'est pas administrateur.
  - **Deux défauts relevés, sans lien avec le fournisseur, à traiter dans un chantier séparé** :
    - pendant la recherche en flux, l'écran affichait « 8 names available » et « 8 credits charged », alors que le serveur avait trouvé et débité 10 noms (`search_completed.found = 10`). Les 10 apparaissent au rechargement ;
    - le rapport affiche « Report sent by email » alors que l'envoi a échoué (`brand_report_emailed`, `sent: false` : le SMTP refuse l'adresse @example.com).

## 5. Comparer avant de basculer

- [ ] 5.1 Écrire `api/scripts/comparer-fournisseurs.ts` : pour une liste de descriptions, il lance reformulation, génération de noms et notation sur les deux fournisseurs, et écrit côte à côte noms, notes, longueur des textes, tokens et coût estimé. Vérification : le script tourne sur trois descriptions et produit un fichier lisible. Il dépense de vrais tokens : le lancer seulement après accord.
  - 20/10/2026 : script écrit ; essai à blanc avec des clés invalides, qui rend les deux 401 et écrit le Markdown. L'essai réel attend la clé de 1.2 et votre accord.
- [ ] 5.2 Le lancer sur une vingtaine de descriptions réelles, anonymisées, et recalibrer la majoration de D4 d'après les tokens de sortie observés. Vérification : le tableau est relu par l'utilisateur, qui choisit les modèles de chaque rôle (question ouverte de `design.md`), et le choix est noté ici.

## 6. Le secours

- [x] 6.1 Implémenter le rejeu sur `AI_FALLBACK_PROVIDER` pour le seul refus de crédit (D8), avec l'événement `ai_provider_fallback` limité à un par heure. Vérification : des tests couvrent « Crédits du mois épuisés », « Limite de débit » et « Appel servi par le secours » (une seule ligne de relevé, `provider = 'openai'`).
- [ ] 6.2 Confirmer la forme réelle de l'erreur Anthropic « solde épuisé » avec un espace de travail sans crédit, et épingler le test de 6.1 sur cette forme. Vérification : la réponse brute est notée dans ce fichier, et le test passe contre elle.

## 7. Configuration, documentation, déploiement

- [x] 7.1 Documenter les nouvelles variables dans `api/.env.example`, avec le tableau des candidats de D10, et les transmettre dans `infra/docker-compose.prod.yml`. Vérification : `docker compose -f infra/docker-compose.prod.yml config` montre les variables.
- [x] 7.2 Mettre à jour `CLAUDE.md` (stack « IA », section « Coût des appels au modèle » : deux fournisseurs, `provider` dans le relevé, contrôle mensuel de complétude contre la facture OpenAI **et** la Console Anthropic). Vérification : relecture du diff.
- [ ] 7.3 Déployer avec `AI_PROVIDER` non défini, migration appliquée d'abord (étapes 1 et 2 du plan de migration). Vérification : en prod, une recherche écrit des lignes `provider = 'openai'`, et aucune erreur nouvelle n'apparaît dans `python3 - errors`.
- [ ] 7.4 Basculer la prod (étapes 5 et 6 du plan de migration), avec l'accord de l'utilisateur. Vérification : au bout d'une semaine, le coût par opération au tableau de bord, le solde de la Console et le nombre d'événements `ai_provider_fallback` sont notés ici. Alors seulement, archiver le chantier.
