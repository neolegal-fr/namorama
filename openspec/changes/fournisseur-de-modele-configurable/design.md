# Design

## Context

Voir `proposal.md` pour le pourquoi, et les deux specs de `modele-de-langage/` pour ce qui est garanti.

Relevé du code au 20/10/2026 (`origin/main`, 39fd2ba) :

- **Trois services construisent chacun leur client OpenAI** : `DomainService` (neuf appels), `NameVariantsService` (un) et `AdminMailService` (un). Aucune abstraction ne les sépare du SDK.
- **Dix appels sur onze sont des Chat Completions** avec `response_format: { type: 'json_object' }` (sauf `refine` et `suggest_name`, en texte), `max_completion_tokens` et `reasoning_effort` (`none` partout, `low` pour `pick_best`). Ils lisent `choices[0].message.content`.
- **Le repérage du marché** (`findSimilarProductDomains`) passe par l'API Responses avec l'outil `web_search` et `reasoning: { effort: 'low' }`. Il lit `output_text` et compte les éléments `web_search_call`. Son repli est une Chat Completion sans outil.
- **Tout appel est enveloppé par `ModelUsageService.mesurer(operation, appel)`**. `lireConsommation` sait déjà lire deux vocabulaires (Chat Completions et Responses). Le coût se calcule en SQL au tarif `model_price` daté, par préfixe de modèle (`cout-sql.ts`). La ligne `web_search` porte les frais d'outil.
- Les parseurs (`parseAnalyses`, `parseCompetitors`…) prennent une chaîne et tolèrent déjà un JSON invalide en rendant un résultat vide.

## Goals / Non-Goals

**Goals:**

- Un seul endroit sait parler à un fournisseur. Les services décrivent ce qu'ils demandent (rôle, consignes, format, budget, raisonnement), pas comment l'API le veut.
- Avec `AI_PROVIDER=openai`, les requêtes envoyées à OpenAI sont identiques à celles d'aujourd'hui, paramètre pour paramètre.
- Comparer la qualité des deux fournisseurs sur de vraies descriptions avant toute bascule en production.

**Non-Goals:**

- Réécrire les consignes pour Claude. Elles restent celles d'aujourd'hui ; leur réglage viendra après la comparaison, opération par opération.
- Une abstraction générique multi-fournisseurs (Mistral, Gemini…). Deux adaptateurs, pas un cadre.

## Decisions

### D1. Un port `ModeleIA`, deux adaptateurs écrits avec les SDK officiels

Un service injectable `ModeleIA` expose deux méthodes :

- `completer(operation, demande)`, où `demande` porte le rôle (`simple`, `creatif`, `analyse`), une consigne système facultative, le message, le format (`texte` ou `json` avec son schéma), le budget de sortie et le raisonnement (`none` ou `low`). Il rend `{ texte, tronque, refuse, fournisseur, modele }`.
- `chercherSurLeWeb(operation, demande)`, pour le seul repérage du marché. Il rend aussi le nombre de recherches effectuées.

`OpenAiAdaptateur` reprend **à l'identique** les appels actuels, avec `openai`. `AnthropicAdaptateur` utilise `@anthropic-ai/sdk` (`messages.create`). Chacun enveloppe son propre appel dans `ModelUsageService.mesurer`, qui reçoit désormais le fournisseur. Les services appelants ne voient plus aucun SDK.

*Écartés :*

- l'endpoint compatible OpenAI d'Anthropic, qui ne garantit ni les sorties structurées ni la recherche web, et masquerait le relevé d'usage natif ;
- une bibliothèque d'agrégation (Vercel AI SDK, LangChain) : une grosse dépendance pour deux fournisseurs, et elle normalise justement les champs d'usage dont le relevé a besoin dans leur détail (cache, raisonnement, recherches) ;
- un `if (provider)` dans chaque méthode de `DomainService` : onze copies de la même bifurcation.

### D2. Le JSON est garanti par un schéma côté Claude

Côté OpenAI, rien ne change : `json_object`. Côté Claude, il n'existe pas de « mode JSON » sans schéma. L'équivalent est la sortie structurée, `output_config: { format: { type: 'json_schema', schema } }`, disponible sur Haiku 5.5, Sonnet 5.5 et Opus 5.5. Chaque opération JSON déclare donc le schéma de la forme que son parseur lit déjà (`{ names: [...] }`, `{ analyses: [...] }`…). Les parseurs ne changent pas : ils reçoivent la même chaîne.

*Écarté : la consigne seule, avec une lecture tolérante.* Une réponse en bloc ```json, ou précédée d'une phrase, ferait tomber l'opération sur son repli vide. On paierait un appel qui ne rend rien, sans que rien ne le signale.

### D3. Le raisonnement `none` se traduit par modèle

Les modèles Claude actuels n'acceptent pas tous de désactiver la réflexion (relevé du skill Claude API au 06/10/2026) :

| modèle | `none` | `low` |
|---|---|---|
| `claude-haiku-5-5` | `thinking: { type: 'disabled' }` | réflexion adaptative, `effort: 'low'` |
| `claude-sonnet-5-5` | `thinking: { type: 'between_tools' }`, sans autre champ (`disabled` renvoie 400) | réflexion adaptative, `effort: 'low'` |
| `claude-opus-5-5` | réflexion non désactivable : `effort: 'low'` | `effort: 'low'` |
| autre | réflexion adaptative, `effort: 'low'` | idem |

La règle se choisit par préfixe du modèle configuré, dans l'adaptateur. La leçon de `CLAUDE.md` vaut ici aussi : le raisonnement est facturé en sortie. Le relevé le mesure (`output_tokens_details.thinking_tokens`, voir D6), ce qui permettra de vérifier que `none` ne coûte rien.

Pour le repérage du marché, `low` reste de mise : c'est le modèle qui décide de chercher sur le web.

### D4. Le budget de sortie est majoré sur Claude, et la troncature se lit dans `stop_reason`

Le tokeniseur Claude compte autrement qu'OpenAI, et la réflexion, quand elle a lieu, se prend sur `max_tokens`. L'adaptateur Anthropic applique donc `max_tokens = ceil(budget × 1,3)`, une majoration à calibrer sur la comparaison (tâche 5). Un `stop_reason` égal à `max_tokens` rend `tronque: true`, et `refusal` rend `refuse: true`. Dans les deux cas, l'opération reçoit une chaîne vide et applique son repli. C'est la règle de `ANALYSES_PAR_APPEL` : un JSON tronqué ne rend pas un nom de moins, il ne rend rien.

### D5. La recherche web Claude, bornée

`chercherSurLeWeb` déclare l'outil serveur `web_search_20260209` (filtrage dynamique) pour Sonnet et Opus 5.5, et la variante de base `web_search_20250305` pour les autres modèles, avec `max_uses: 5`. Les frais sont ceux d'OpenAI, 10 $ les mille recherches, donc la ligne de tarif `web_search` reste commune.

- Le texte rendu est la concaténation des blocs `text` de la réponse ; `parseCompetitors` le lit comme `output_text`.
- Le nombre de recherches vient de `usage.server_tool_use.web_search_requests`. `source: 'web'` exige qu'il soit supérieur à zéro.
- Une erreur d'outil ne lève pas : elle arrive dans un bloc `web_search_tool_result` dont le contenu est un objet d'erreur. Sans aucune recherche réussie, on passe au repli.
- Un `stop_reason` égal à `pause_turn` (boucle serveur interrompue) est relancé **une fois** en renvoyant la réponse partielle, puis on passe au repli.

### D6. `lireConsommation` reconnaît une réponse Anthropic

Une réponse Messages se reconnaît à `type === 'message'`. Sa consommation se lit ainsi :

- `inputTokens = input_tokens + cache_creation_input_tokens + cache_read_input_tokens`. Chez Anthropic, `input_tokens` n'est que la part non cachée, alors que la colonne compte toute l'entrée ;
- `cachedInputTokens = cache_read_input_tokens` ;
- `outputTokens = output_tokens`, qui inclut la réflexion ;
- `reasoningTokens = output_tokens_details.thinking_tokens`, ou 0 si absent ;
- `webSearchCalls = server_tool_use.web_search_requests`.

Les tokens d'écriture de cache sont comptés au plein tarif d'entrée, pas à leur tarif majoré (×1,25). Comme le chantier n'active pas `cache_control`, il ne devrait pas y en avoir : s'il en apparaît, le relevé les montre.

### D7. Une colonne `model_usage.provider`

La colonne est un `varchar(16) NOT NULL DEFAULT 'openai'`, créée par un script daté de `api/migrations/` (`ADD COLUMN IF NOT EXISTS`) à appliquer avant l'image. Le défaut range tout l'historique chez OpenAI, ce qui est exact. Le tableau de bord n'a pas besoin de la colonne pour chiffrer, puisque le préfixe du modèle suffit. Elle sert à filtrer et à contrôler la facture : le total `anthropic` se compare à la Console, le total `openai` à la facture OpenAI.

### D8. Le secours ne joue que sur un refus de crédit

Le secours se déclenche sur un seul cas, celui pour lequel il existe : les crédits du mois épuisés. Une limite de débit ou une surcharge se règle par les nouvelles tentatives du SDK, et basculer dessus multiplierait les appels payants pendant une simple saturation.

| fournisseur | signal « plus de crédit » |
|---|---|
| Anthropic | `BadRequestError` (400) dont le message cite le solde de crédits (« credit balance ») |
| OpenAI | 429 avec le code `insufficient_quota` |

Le signal Anthropic repose sur un texte de message. C'est fragile, mais c'est le seul signal qui existe. Le test épingle la forme exacte, et l'événement journalisé `ai_provider_fallback` (au plus un par heure) montrera tout changement. Le rejeu se fait une seule fois, avec le modèle du même rôle chez le secours, et c'est le secours qui écrit la ligne du relevé.

### D9. Identifiants : une clé API de la Console, jamais le jeton de l'abonnement

Les crédits Max s'appliquent à l'organisation Console liée à l'abonnement (Settings → Billing). La clé `ANTHROPIC_API_KEY` se crée dans cette organisation, dans un espace de travail dédié à namorama. Le jeton OAuth de l'abonnement n'est pas fait pour servir un produit : il n'est pas utilisé.

**Aucun moyen de paiement ni rechargement automatique ne doit être activé sur cette organisation.** Sinon, une fois les 100 $ consommés, la dépense continuerait sur la carte au lieu de déclencher le secours (D8). À défaut, il faut poser une limite de dépense mensuelle sur l'espace de travail.

### D10. Les modèles par rôle sont une décision explicite

Candidats, tarifs par million de tokens (entrée / sortie), relevés au 06/10/2026 :

| rôle | aujourd'hui | candidats Claude |
|---|---|---|
| simple | `gpt-5.6-luna` 0,20 $ / 1,20 $ | `claude-haiku-5-5` 0,10 $ / 0,50 $ |
| créatif | `gpt-5.6-terra` 2,00 $ / 12,00 $ | `claude-sonnet-5-5` 2,00 $ / 10,00 $ · `claude-opus-5-5` 4,00 $ / 20,00 $ |
| analyse | `gpt-5.6-luna` | `claude-haiku-5-5` · `claude-sonnet-5-5` |

Aucun modèle Claude n'est codé en dur : `ANTHROPIC_MODEL` et `ANTHROPIC_MODEL_CREATIVE` sont **obligatoires** quand `AI_PROVIDER=anthropic` (spec `choix-du-fournisseur`). `api/.env.example` montre le tableau. Le choix se fait sur la comparaison de la tâche 5 et sur la projection du tableau de bord, pas a priori.

## Risks / Trade-offs

- **La qualité des noms change.** La génération est le cœur du produit. → Comparaison côte à côte avant bascule (tâche 5), bascule réversible par une variable d'environnement.
- **Les 100 $ ne couvrent peut-être pas le mois.** Le dépôt ne garde aucun total en dollars, et la lecture de la prod n'a pas été faite pendant l'étude. → Avant bascule, saisir les tarifs Claude et lire la projection du simulateur sur 30 jours (tâche 1.1). Le secours OpenAI couvre le reste du mois.
- **La projection sous-estime.** Le simulateur applique un autre tarif aux **mêmes** tokens, alors que le tokeniseur Claude en compte vraisemblablement davantage. → Majorer la projection de 30 %, puis comparer à une semaine de relevé réel.
- **Le signal de crédit épuisé repose sur un texte de message.** → D8 : test épinglé, événement journalisé.
- **Les routes publiques de l'étape 1 n'ont ni crédit ni limite de débit.** Sur Claude, n'importe qui peut consommer les crédits du mois en boucle, comme aujourd'hui avec la facture OpenAI, sauf que le plafond se voit plus tôt. → Rien de neuf dans ce chantier ; le `@nestjs/throttler` déjà demandé dans `CLAUDE.md` devient plus pressant.
- **Les consignes ont été écrites pour GPT.** Claude peut rendre des textes plus longs, ce que le chantier B veut justement corriger. → La comparaison relève la longueur ; le réglage des consignes reste un chantier à part.

## Migration Plan

1. Appliquer `api/migrations/<date>-model-usage-provider.sql` en production.
2. Déployer l'image avec `AI_PROVIDER` non défini. Rien ne change ; vérifier qu'une recherche écrit des lignes `provider = 'openai'`.
3. Saisir les tarifs Claude datés dans Tarifs IA, puis lire la projection du simulateur.
4. Créer la clé dans l'organisation Console liée à Max, sans moyen de paiement (D9).
5. Poser `AI_PROVIDER=anthropic`, `AI_FALLBACK_PROVIDER=openai`, `ANTHROPIC_API_KEY` et les modèles retenus dans l'environnement de prod, puis redémarrer l'API.
6. Une semaine d'observation au tableau de bord : coût par opération, troncatures et refus dans les logs, événements `ai_provider_fallback`.

**Retour arrière** : retirer `AI_PROVIDER` (ou le remettre à `openai`) et redémarrer. La colonne `provider` peut rester ; la retirer ne demanderait qu'un `ALTER TABLE model_usage DROP COLUMN provider`.

## Open Questions

- **Quels modèles Claude par rôle ?** C'est une décision de l'utilisateur, à prendre sur la comparaison (D10). Elle ne change ni les specs ni les tâches, seulement des valeurs d'environnement.
- **La forme exacte de l'erreur Anthropic « solde épuisé »** : à confirmer sur une réponse réelle, avec un espace de travail sans crédit. Le test de D8 l'épinglera.
