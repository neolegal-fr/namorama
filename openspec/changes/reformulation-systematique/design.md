# Design

## Context

Voir proposal.md, section Why. État actuel :

- `refine()` remplit le signal `refinedDescription`, affiché dans un encadré avec « Utiliser cette version », qui recopie le texte dans `description` puis vide la proposition.
- `goToKeywords()`, `loadCompetitors()` et le lancement de la recherche lisent `refinedDescription() || description()`. L'état sauvegardé avant connexion (localStorage) porte les deux champs, mais le projet n'enregistre que `description`.
- `refineDescription` est un appel `simple` en texte libre, avec une consigne système en français. Le résultat passe par `stripMarkdown`, avec un repli sur la description d'origine si la réponse est vide.
- Le serveur réextrait le cahier des charges de la description reçue à chaque recherche : il ne survit que s'il est écrit dans cette description.

## Goals / Non-Goals

**Goals :**
- Un seul texte de référence, choisi explicitement, persistant et utilisé partout.
- Une reformulation qui n'abîme ni les contraintes du nom ni les faits.

**Non-Goals :**
- Garder côte à côte deux descriptions sur le projet.
- Faire de la reformulation un dialogue (questions à l'utilisateur).

## Decisions

### D1. La confirmation s'insère dans « Continuer »

`goToKeywords()` devient : si le texte courant diffère du dernier texte reformulé (`derniereSourceReformulee`), appeler `refine`, afficher le panneau de confirmation, et attendre le choix. Une fois le choix fait, poser `description` et enchaîner sur le cadrage actuel (nom de projet, contraintes, mots-clés). Si le texte n'a pas changé, enchaîner directement. Le panneau remplace l'encadré actuel, au même endroit, avec un `textarea` prérempli pour la version proposée et deux boutons. « Utiliser cette version » est le bouton principal.

*Écarté : reformuler en arrière-plan pendant la saisie, puis proposer sans attente.* Ce serait un appel par pause de frappe sur une route publique, et une proposition qui change pendant que l'utilisateur la lit.

*Écarté : appliquer la reformulation sans confirmation.* C'est contraire à la décision du 31/10/2026, et cela réécrirait le brief sans que l'utilisateur le voie, cahier des charges compris.

### D2. Suppression de la version « en réserve »

Le signal `refinedDescription` ne vit plus que le temps de la confirmation. Les quatre lectures `refinedDescription() || description()` deviennent `description()`. L'état sauvegardé avant connexion ne porte plus de version proposée. Un ancien état qui en contient une est ignoré à la restauration.

*Écarté : enregistrer aussi la version proposée sur le projet.* Deux descriptions demanderaient de décider laquelle sert à chaque appel, ce qui est exactement l'incohérence qu'on retire.

### D3. Une consigne qui conserve, sans inventer

Nouvelle consigne de `refineDescription` :
- répondre dans la langue de la description ;
- clarifier et structurer sans ajouter de fait (fonctionnalité, public, lieu, chiffre) absent de la description ;
- **recopier dans un dernier paragraphe, dans les termes de l'utilisateur, toute instruction portant sur le nom** (longueur, mots ou terminaisons à éviter, mots imposés, marques de référence, type de nom), et l'omettre s'il n'y en a pas ;
- texte brut, comme aujourd'hui.

La conservation se vérifie sur le vrai modèle : les contraintes extraites de la version proposée doivent égaler celles de la description d'origine.

*Écarté : extraire les contraintes du texte d'origine et les stocker à part.* Le serveur relit la description à chaque recherche, et un projet rouvert n'a que sa description. Il faudrait une colonne de contraintes et une seconde vérité. Un paragraphe recopié, lui, reste visible et modifiable par l'utilisateur dans la confirmation.

*Écarté : un JSON `{ description, cahierDesCharges }` assemblé par le front.* Le résultat serait le même texte, avec un schéma de plus à maintenir chez les deux fournisseurs.

### D4. Délai et échec

L'appel front porte un délai de 10 s (`timeout` RxJS). Une erreur, un dépassement ou une réponse identique au texte d'origine (le repli serveur) ouvre l'étape 2 sans confirmation. Montrer une « proposition » identique au texte saisi n'apprend rien à l'utilisateur.

### D5. Mesure

Les événements `description_refine_shown` `{ longueur }` et `description_refine_chosen` `{ choix: 'reformulation' | 'originale', retouchee: bool }` passent par `AnalyticsService.track()`. `longueur` est un nombre de caractères, jamais le texte.

### Contrats externes modifiés

- `POST /domain/refine` : contrat inchangé. La consigne change, ce qui modifie le texte de la requête OpenAI de l'opération `refine`. `requetes-openai.spec.ts` est mis à jour en conséquence, et c'est un écart assumé à la parité.
- Nouveaux événements front : `description_refine_shown`, `description_refine_chosen`.
- L'état sauvegardé en localStorage avant connexion perd le champ `refinedDescription`.

## Risks / Trade-offs

- [Une attente de plus avant l'étape 2, sur un parcours où les abandons sont précoces] → affichée comme une étape (« Nous relisons votre description… »), bornée à 10 s. `description_refine_chosen` rapporté à `wizard_step_viewed` (étape 1) dira si on perd du monde à cet endroit.
- [Le modèle simple réécrit quand même une contrainte] → paragraphe final visible et retouchable, et vérification sur le vrai modèle avec cinq briefs paraphrasés avant livraison (tâche 2.2).
- [Coût sur route publique sans limite de débit] → environ 0,0008 $ l'appel. Une boucle malveillante coûterait autant que sur les quatre autres routes de l'étape 1, et le throttler prévu les couvre toutes.
- [Les utilisateurs gardent massivement leur texte] → c'est une information, que la mesure rend visible. Si plus de 80 % gardent leur description au bout de 14 jours, revoir la consigne ou revenir à une reformulation optionnelle.

## Migration Plan

Aucune migration de données. Déploiement standard de l'image. Retour arrière : redéployer l'image précédente, sans effet sur les projets, qui n'ont jamais eu qu'une description.
