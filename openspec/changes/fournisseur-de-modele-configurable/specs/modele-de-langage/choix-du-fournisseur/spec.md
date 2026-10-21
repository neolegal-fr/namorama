# Spec Delta

## Purpose

Permet de servir tous les appels au modèle par OpenAI ou par Claude (Anthropic) selon la seule configuration, sans changer ce que l'utilisateur voit ni ce qu'il paie en crédits, et de basculer sur un secours quand le fournisseur principal n'a plus de crédit.

## ADDED Requirements

### Requirement: La configuration désigne un fournisseur unique pour tous les appels

Le système SHALL lire le fournisseur dans `AI_PROVIDER`, qui vaut `openai` ou `anthropic`. Non définie, la variable SHALL valoir `openai`. Toutes les opérations au modèle SHALL passer par ce fournisseur : `refine`, `suggest_name`, `keywords`, `constraints`, `competitors`, `generate_names`, `analyze`, `pick_best`, `name_variants`, `admin_mail_draft`. Aucune opération ne SHALL appeler directement un fournisseur sans passer par ce choix.

#### Scenario: Configuration absente

- **WHEN** l'API démarre sans `AI_PROVIDER`
- **THEN** toutes les opérations sont servies par OpenAI, avec les modèles et les réglages d'aujourd'hui

#### Scenario: Bascule sur Claude

- **WHEN** l'API démarre avec `AI_PROVIDER=anthropic` et une clé `ANTHROPIC_API_KEY`
- **THEN** une recherche complète, de la reformulation à la notation des noms, ne fait aucun appel à OpenAI
- **AND** le journal de démarrage nomme le fournisseur et les trois modèles retenus

#### Scenario: Retour en arrière

- **WHEN** `AI_PROVIDER` repasse de `anthropic` à `openai` et que l'API redémarre
- **THEN** le comportement est celui d'avant la bascule, sans changement de code ni de base

### Requirement: Chaque fournisseur a ses trois modèles, par rôle

Le système SHALL associer à chaque fournisseur un modèle pour chacun des trois rôles existants : simple (`refine`, `suggest_name`, `keywords`, `constraints`, `name_variants`), créatif (`generate_names`, `pick_best`, `competitors`, `admin_mail_draft`) et analyse (`analyze`). Pour OpenAI, les variables restent `OPENAI_MODEL`, `OPENAI_MODEL_CREATIVE` et `OPENAI_MODEL_ANALYSIS`. Pour Claude, ce sont `ANTHROPIC_MODEL`, `ANTHROPIC_MODEL_CREATIVE` et `ANTHROPIC_MODEL_ANALYSIS`. Un modèle d'analyse non défini SHALL valoir le modèle simple du même fournisseur, comme aujourd'hui.

#### Scenario: Modèle d'analyse non défini

- **WHEN** `AI_PROVIDER=anthropic` et `ANTHROPIC_MODEL_ANALYSIS` n'est pas définie
- **THEN** la notation des noms utilise `ANTHROPIC_MODEL`

#### Scenario: Les variables d'un fournisseur n'affectent pas l'autre

- **WHEN** `AI_PROVIDER=openai` et que les variables `ANTHROPIC_MODEL*` sont définies
- **THEN** elles sont ignorées, et les modèles OpenAI s'appliquent

### Requirement: Le démarrage refuse une configuration inutilisable

L'API MUST refuser de démarrer quand `AI_PROVIDER` ou `AI_FALLBACK_PROVIDER` porte une valeur inconnue, quand la clé du fournisseur principal manque, ou quand `AI_PROVIDER=anthropic` alors que `ANTHROPIC_MODEL` ou `ANTHROPIC_MODEL_CREATIVE` manque : aucun modèle Claude n'a de valeur par défaut. Le message d'erreur MUST nommer la variable en cause. Une clé manquante pour le seul fournisseur de secours SHALL désactiver le secours avec un avertissement, sans empêcher le démarrage.

#### Scenario: Fournisseur inconnu

- **WHEN** l'API démarre avec `AI_PROVIDER=mistral`
- **THEN** le démarrage échoue, et le message nomme `AI_PROVIDER` et ses deux valeurs admises

#### Scenario: Clé absente pour Claude

- **WHEN** l'API démarre avec `AI_PROVIDER=anthropic` sans `ANTHROPIC_API_KEY`
- **THEN** le démarrage échoue, et le message nomme `ANTHROPIC_API_KEY`

#### Scenario: Secours sans clé

- **WHEN** l'API démarre avec `AI_PROVIDER=anthropic`, `AI_FALLBACK_PROVIDER=openai` et sans `OPENAI_API_KEY`
- **THEN** l'API démarre sans secours, et un avertissement le signale

### Requirement: Une opération rend le même résultat exploitable quel que soit le fournisseur

Pour chaque opération, le système SHALL rendre au reste de l'application un résultat de même forme sur les deux fournisseurs : un texte brut pour `refine` et `suggest_name`, un objet JSON conforme au format attendu par l'opération pour toutes les autres. Une réponse que le fournisseur a tronquée faute de budget de sortie, ou qu'il a refusée, SHALL être traitée comme une réponse inexploitable de l'opération, avec le repli que l'opération prévoit déjà (liste vide, analyse absente, texte d'origine). Elle ne SHALL jamais être interprétée partiellement.

#### Scenario: Notation d'un lot sur Claude

- **WHEN** `AI_PROVIDER=anthropic` et qu'un lot de dix noms part à l'analyse
- **THEN** chaque note est rattachée à son nom par le nom recopié, comme sur OpenAI
- **AND** un nom que la réponse ne mentionne pas reste sans analyse

#### Scenario: Réponse tronquée

- **WHEN** le fournisseur arrête une génération de noms sur la limite de sortie
- **THEN** la tentative est comptée comme n'ayant rendu aucun nom, et la recherche continue selon ses seuils habituels

#### Scenario: Refus du modèle

- **WHEN** Claude refuse de répondre à une demande de reformulation
- **THEN** la description d'origine est conservée, et le refus est journalisé avec l'opération

### Requirement: Le repérage du marché cherche sur le web chez les deux fournisseurs

Avec l'un ou l'autre fournisseur, le repérage du marché SHALL d'abord tenter une recherche web, puis se replier sur la connaissance du modèle quand la recherche ne rend rien d'exploitable. Le résultat SHALL indiquer `source: 'web'` seulement si au moins une recherche web a effectivement eu lieu. Le cache de 24 h par description SHALL s'appliquer pareillement, et sa clé ne SHALL PAS dépendre du fournisseur. Ce cache vit en mémoire : une bascule, qui demande un redémarrage, le vide comme tout redéploiement.

#### Scenario: Repérage sur Claude

- **WHEN** `AI_PROVIDER=anthropic` et qu'un utilisateur demande le repérage du marché pour une description jamais vue
- **THEN** le modèle créatif Claude fait une ou plusieurs recherches web, et les concurrents rendus passent par le même contrôle whois qu'aujourd'hui
- **AND** le résultat porte `source: 'web'`

#### Scenario: Recherche web indisponible

- **WHEN** l'outil de recherche web renvoie une erreur
- **THEN** le repérage se replie sur la connaissance du modèle, avec `source: 'model'`, sans erreur visible pour l'utilisateur

### Requirement: Un appel refusé faute de crédit passe au fournisseur de secours

Quand `AI_FALLBACK_PROVIDER` désigne un fournisseur configuré et différent du principal, un appel que le principal refuse **faute de crédit ou de solde** SHALL être rejoué une fois sur le secours, avec le modèle du même rôle. Les autres erreurs (limite de débit, surcharge, requête invalide) ne SHALL PAS déclencher le secours : elles suivent le traitement d'erreur actuel de l'opération. Le passage au secours MUST être journalisé, au plus une fois par heure, avec le fournisseur principal et l'opération. Sans `AI_FALLBACK_PROVIDER`, un appel refusé faute de crédit SHALL échouer comme toute autre erreur du fournisseur.

#### Scenario: Crédits du mois épuisés

- **WHEN** `AI_PROVIDER=anthropic`, `AI_FALLBACK_PROVIDER=openai`, et que l'API Anthropic refuse un appel parce que le solde de crédits est épuisé
- **THEN** l'appel est servi par OpenAI avec le modèle du même rôle, et l'utilisateur obtient son résultat
- **AND** un événement journalisé signale l'épuisement des crédits Anthropic

#### Scenario: Limite de débit

- **WHEN** l'API Anthropic répond par une limite de débit après les nouvelles tentatives du client
- **THEN** l'appel n'est pas rejoué sur OpenAI, et l'opération applique son repli habituel

### Requirement: Le débit en crédits namorama ne dépend pas du fournisseur

Le nombre de crédits namorama débités pour une suggestion, une recherche ou un rapport SHALL être le même quel que soit le fournisseur qui a servi les appels, secours compris.

#### Scenario: Même recherche, deux fournisseurs

- **WHEN** la même recherche rend dix noms, une fois avec `AI_PROVIDER=openai` et une fois avec `AI_PROVIDER=anthropic`
- **THEN** le solde du compte baisse du même nombre de crédits dans les deux cas
