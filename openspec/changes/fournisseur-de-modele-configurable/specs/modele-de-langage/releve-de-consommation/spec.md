# Spec Delta

## Purpose

Garantit que chaque appel au modèle, quel que soit le fournisseur qui l'a servi, est noté dans le relevé de consommation avec des tokens comparables, et que son coût se calcule au tarif daté du bon modèle, sans qu'aucune dépense ne devienne invisible.

## ADDED Requirements

### Requirement: Un appel Claude est noté dans le relevé comme un appel OpenAI

Le système SHALL écrire une ligne `model_usage` pour chaque appel servi par Claude, aux mêmes conditions que pour OpenAI : une ligne par appel, aucune pour un appel qui lève, aucune pour un résultat servi par un cache. Les colonnes SHALL garder le sens qu'elles ont aujourd'hui :

- `inputTokens` : toute l'entrée facturée, part lue en cache comprise ;
- `cachedInputTokens` : la part de l'entrée lue en cache ;
- `outputTokens` : toute la sortie facturée, raisonnement compris ;
- `reasoningTokens` : la part de la sortie consacrée au raisonnement, quand la réponse la détaille ; 0 sinon ;
- `webSearchCalls` : le nombre de recherches web facturées.

Une réponse Claude sans relevé d'usage SHALL être notée à zéro et signalée, comme une réponse OpenAI sans `usage`.

#### Scenario: Appel simple

- **WHEN** Claude rend une reformulation pour 300 tokens d'entrée et 120 de sortie
- **THEN** la ligne `model_usage` porte `inputTokens = 300`, `outputTokens = 120`, l'opération `refine` et le modèle nommé dans la réponse

#### Scenario: Entrée en partie servie par le cache

- **WHEN** une réponse Claude détaille 200 tokens d'entrée non cachés, 50 tokens écrits en cache et 800 lus en cache
- **THEN** la ligne porte `inputTokens = 1050` et `cachedInputTokens = 800`

#### Scenario: Repérage du marché

- **WHEN** Claude fait trois recherches web pendant un repérage du marché
- **THEN** la ligne porte `webSearchCalls = 3`

### Requirement: Le relevé dit quel fournisseur a servi l'appel

Chaque ligne `model_usage` SHALL porter le fournisseur qui a effectivement servi l'appel, `openai` ou `anthropic`, y compris quand l'appel est passé au secours. Les lignes antérieures au chantier SHALL être lues comme servies par `openai`.

#### Scenario: Appel servi par le secours

- **WHEN** un appel refusé par Anthropic faute de crédit est servi par OpenAI
- **THEN** une seule ligne est écrite, avec le fournisseur `openai` et le modèle OpenAI de la réponse

#### Scenario: Historique

- **WHEN** le tableau de bord lit un appel enregistré avant la mise en production du chantier
- **THEN** cet appel apparaît comme servi par `openai`

### Requirement: Le coût d'un appel Claude se calcule au tarif daté de son modèle

Le coût d'un appel Claude SHALL se calculer comme celui d'un appel OpenAI : tokens × tarif `model_price` en vigueur à la date de l'appel, le modèle du tarif étant un préfixe du modèle de l'appel, et les recherches web au tarif `web_search` en vigueur. Un appel Claude sans tarif correspondant SHALL apparaître « non chiffré », jamais compté à zéro. Les tokens écrits dans le cache de prompt SHALL être comptés au plein tarif d'entrée : une surestimation plutôt qu'un oubli.

#### Scenario: Tarif saisi

- **WHEN** un tarif `claude-haiku-5-5` existe depuis une date antérieure à l'appel
- **THEN** le tableau de bord chiffre l'appel à ce tarif

#### Scenario: Tarif manquant

- **WHEN** un appel sur `claude-sonnet-5-5` n'a aucun tarif correspondant
- **THEN** le tableau de bord le signale comme non chiffré
