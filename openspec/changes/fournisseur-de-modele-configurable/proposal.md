# Proposal

## Why

Depuis le 7/10/2026, l'abonnement Claude Max 5x comprend **100 $ de crédits API par mois**, utilisables sur la Claude Platform (l'API Anthropic). Ils ne servent à rien aujourd'hui : namorama ne parle qu'à OpenAI, et chaque appel au modèle se paie en plus de l'abonnement. Basculer sur Claude peut ramener la facture des appels à zéro, tant qu'elle tient dans l'enveloppe.

Une bascule sèche serait risquée. Les crédits sont plafonnés et ne se reportent pas, la qualité des noms générés reste à comparer, et l'API Anthropic n'a ni le même format de réponse ni la même recherche web. Il faut donc pouvoir **choisir le fournisseur à la configuration**, revenir en arrière sans redéployer de code, et ne pas tomber en panne le jour où les crédits du mois s'épuisent.

## What Changes

- Une variable de configuration choisit le fournisseur de **tous** les appels au modèle : `openai` (défaut, comportement actuel) ou `anthropic`.
- Chaque fournisseur a ses trois modèles configurables, pour les rôles existants : simple, créatif, analyse.
- Les onze appels actuels passent par un point d'entrée commun : les neuf de la recherche, `name_variants` et `admin_mail_draft`. Le repérage du marché garde sa recherche web sur les deux fournisseurs.
- Un fournisseur de secours facultatif : quand le fournisseur principal refuse un appel faute de crédit, l'appel est rejoué sur le secours, et l'incident est journalisé.
- Le relevé `model_usage` note la consommation des appels Claude dans les mêmes colonnes, et chacun de ses appels porte le fournisseur qui l'a servi.
- Le démarrage vérifie la configuration : il refuse un fournisseur inconnu ou une clé absente pour le fournisseur choisi.

Hors périmètre :

- le cache de prompt Anthropic (`cache_control`) : nos consignes sont courtes, et son écriture se facture à part. À reconsidérer sur mesures ;
- un choix du fournisseur **par opération** (la notation sur Claude, la génération sur OpenAI…) : la configuration le permettra plus tard, mais ce chantier ne choisit qu'un fournisseur pour tout ;
- l'API Batch et le mode rapide ;
- toute connexion par le jeton OAuth de l'abonnement Max : seule une clé API de la Console est utilisée.

## Capabilities

### New Capabilities

- `modele-de-langage/choix-du-fournisseur` : comment la configuration désigne le fournisseur et ses modèles, ce que vérifie le démarrage, ce que chaque opération garantit sur l'un et l'autre fournisseur (JSON exploitable, recherche web, troncature, refus), et le passage au secours.
- `modele-de-langage/releve-de-consommation` : ce que le relevé note pour un appel Claude, et comment le coût de cet appel se calcule.

### Modified Capabilities

Aucune. Les specs principales d'OpenSpec ne couvrent encore ni les appels au modèle ni le relevé.

## Impact

- **API**
  - `api/src/domain/domain.service.ts` : neuf appels, dont le repérage du marché (API Responses et `web_search`).
  - `api/src/brand-report/trademark/name-variants.service.ts`, `api/src/admin/admin-mail.service.ts` : un appel chacun.
  - `api/src/common/model-usage/` : lecture de la consommation d'une réponse Anthropic, colonne `provider`.
- **Dépendance** : `@anthropic-ai/sdk`.
- **Configuration** : `AI_PROVIDER`, `AI_FALLBACK_PROVIDER`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `ANTHROPIC_MODEL_CREATIVE`, `ANTHROPIC_MODEL_ANALYSIS`, dans `api/.env.example` et `infra/docker-compose.prod.yml`.
- **Données** : une colonne `model_usage.provider`, par un script de `api/migrations/` à appliquer avant l'image. Des tarifs Claude datés, ajoutés depuis l'écran Tarifs IA.
- **Documentation** : `CLAUDE.md`, section « Coût des appels au modèle ».
- **Coût** : avec `AI_PROVIDER=openai`, rien ne change. Avec `anthropic`, la dépense passe sur les crédits de l'organisation Console liée à l'abonnement, jusqu'à leur épuisement.
