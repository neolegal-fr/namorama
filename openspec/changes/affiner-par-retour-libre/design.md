# Design

## Context

Voir proposal.md, section Why. Ce qui contraint l'approche :

- La recherche réextrait le cahier des charges de la description à chaque appel (`extractNamingConstraints`, `findAvailableDomains`), puis retire les puces écartées (`retirerContraintes`), fixe les bornes (`bornesDeLongueur`) et filtre chaque nom généré (`respecteLesContraintes`). Le filtre est la seule garantie, la consigne n'est qu'une aide.
- La consigne du style standard fixe quatre sous-groupes à parts égales (`short`, `compound`, `metaphor`, `sound`), dont les bornes de longueur dérivent des contraintes.
- « 10 de plus » envoie déjà `excludeNames`, et le front tient `testedNames` pour la session.
- Trois décisions produit tranchées le 31/10/2026 : les retours s'additionnent, ils n'agissent que sur les recherches suivantes, et ils ne modifient pas la description.

## Goals / Non-Goals

**Goals :**
- Qu'un retour change effectivement les noms suivants, y compris quand il contredit une instruction fixe de la consigne.
- Que ce qui est vérifiable soit garanti par le filtre existant, sans nouvelle mécanique de filtrage.
- Un seul appel de plus par recherche, et seulement quand des retours existent.

**Non-Goals :**
- Montrer à l'utilisateur l'interprétation de chaque retour.
- Juger ou classer les noms déjà affichés.

## Decisions

### D1. Interpréter les retours en une sortie structurée, pas les recopier dans la consigne

Un appel `simple` (`operation: 'feedback'`, `raisonnement: 'none'`) reçoit la liste ordonnée des retours actifs et les bornes de longueur courantes, et rend un JSON au schéma `SCHEMA_RETOURS` :

```
{ minLength, maxLength, avoidWords[], avoidEndings[], requiredWords[],
  formesRetirees: ("compound"|"metaphor"|"sound"|"short")[],
  langue: string|null, preference: string|null }
```

La consigne demande de résoudre les contradictions au profit du plus récent. Les bornes courantes servent à traduire « plus courts » en nombre. La sortie est nettoyée comme celle des contraintes du brief : bornes dans les plages permises, mot imposé écarté s'il ne figure pas dans le texte d'un retour, formes hors énumération ignorées, `preference` tronquée à 200 caractères.

*Écarté : ajouter les retours tels quels à la consigne de génération.* C'est le plus simple, mais « pas de noms composés » y contredirait le sous-groupe `compound`, et rien ne garantirait « plus de -ia ». Le modèle créatif arbitrerait seul, sans trace de ce qu'il a compris.

*Écarté : réutiliser `extractNamingConstraints` sur la description augmentée des retours.* L'extraction actuelle ne connaît ni les formes ni la langue, et y mêler les retours brouillerait l'origine des bornes journalisée par `search_completed`.

### D2. Priorité par construction : les bornes d'un retour remplacent celles du brief

Après `retirerContraintes`, les champs non nuls de l'interprétation remplacent `briefMinLength` et `briefMaxLength`. Les listes (mots à éviter, terminaisons, mots imposés) s'ajoutent à celles du brief. `bornesDeLongueur` reste inchangée : un réglage explicite y prime déjà sur le brief, il prime donc sur le retour. `OrigineDesBornes` gagne la valeur `retour`.

*Écarté : faire primer le retour sur le réglage explicite parce qu'il est plus récent.* Le réglage est un contrôle visible que l'utilisateur peut modifier à tout moment. Le faire céder en silence à une phrase créerait un réglage qui ment.

### D3. Les formes retirées et la langue pilotent la consigne

`generateDomainIdeas` reçoit `formesRetirees`. Les sous-groupes retirés sortent de la répartition, et leur quota est redistribué sur les formes restantes. Si toutes étaient retirées, on garde la répartition d'origine et la préférence seule s'applique. `langue` remplace la consigne de langue issue de la locale (`localeInstruction`). `preference` alimente une section « USER FEEDBACK — most recent wins » placée après celle des noms aimés et rejetés. Le texte est assaini comme les mots-clés (sauts de ligne, triples guillemets) et mis entre guillemets.

*Écarté : laisser la répartition intacte et compter sur le filtre.* « Composé » ne se vérifie pas mécaniquement de façon fiable : `snapflow` et `velora` ne se distinguent pas par une règle de chaînes.

### D4. Les retours vivent sur le projet, le serveur ne les persiste pas pendant la recherche

Colonne `project.retours` (`text`, JSON d'une liste de textes), exposée et modifiable par les routes projet existantes, avec les mêmes droits que `likedExamples`. Le front l'envoie dans `search/stream` et l'enregistre par la mise à jour du projet, comme il le fait déjà pour les autres réglages. Le DTO borne la liste à 10 entrées de 200 caractères, côté recherche comme côté projet.

*Écarté : que `search/stream` écrive les retours sur le projet.* Ce serait une deuxième voie d'écriture du projet, hors des contrôles de droits de `ProjectsService`. Un projet non encore enregistré (visiteur qui vient de se connecter) n'aurait pas d'endroit où écrire.

*Écarté : `simple-array`.* Il sépare sur les virgules, qu'un retour contient naturellement (« plus court, plus doux »).

### D5. Un cache d'interprétation, borné

L'interprétation est mise en cache en mémoire par (liste des retours, bornes courantes), 24 h, au plus 500 entrées, sur le modèle du cache marché. Une suite de « 10 de plus » sans nouveau retour ne repaie rien. Comme ailleurs, un appel servi par le cache n'écrit pas de ligne dans `model_usage`.

### D6. Échec d'interprétation : on cherche quand même

Une réponse vide, tronquée ou invalide donne une interprétation vide, sauf `preference`, qui reprend alors les retours concaténés (bornés à 400 caractères). La recherche part et la consigne garde au moins le signal brut. L'échec se journalise par le mécanisme commun de `ModeleIA` (`feedback : réponse tronquée par …`).

### Contrats externes modifiés

- `POST /domain/search/stream` : champ optionnel `retours: string[]` (≤ 10 × 200).
- Routes projet : champ `retours` en lecture et en écriture.
- `search_completed` : `retours` (nombre), `retoursCompris` (`{ bornes: bool, contraintes: n, formesRetirees: n, langue: bool, preference: bool }`), et `origineDesBornes` peut valoir `retour`.
- Nouvel événement front `name_feedback_added` `{ origine: 'suggestion' | 'saisie', actifs: n }`.
- Requêtes OpenAI : nouvelle opération `feedback`, présente seulement quand des retours existent. Sans retour, les requêtes restent identiques, et `requetes-openai.spec.ts` le vérifie.

## Risks / Trade-offs

- [Le modèle simple comprend mal un retour ambigu (« moins bizarre »)] → il atterrit dans `preference`, sans effet dur. Vérification sur le vrai modèle avec des retours paraphrasés avant livraison.
- [Un retour très contraignant vide la recherche] → `done` porte déjà `ecartes` par motif, et la note de fin dit que le brief a tout écarté. La puce retirable donne le moyen d'en sortir.
- [Injection de consigne par le texte du retour] → route authentifiée et payante, texte borné, assaini, entre guillemets, interprété par un schéma fermé. Seule `preference` atteint la consigne créative, bornée à 200 caractères.
- [Retours devenus obsolètes, accumulés sur un vieux projet] → affichés en puces, retirables d'un clic, plafonnés à 10.

## Migration Plan

1. Appliquer `api/migrations/2026-11-XX-retours-sur-les-noms.sql` (`ALTER TABLE project ADD COLUMN IF NOT EXISTS retours TEXT NULL`). Retour arrière : `DROP COLUMN retours`, sans perte pour le reste.
2. Déployer l'image. Une image antérieure ignore la colonne, donc un retour arrière de l'image ne demande pas de défaire la migration.
