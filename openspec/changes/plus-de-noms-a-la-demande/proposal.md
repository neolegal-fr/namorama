# Proposal

## Why

Deux retours du 20/10/2026 décrivent le même parcours vu de deux côtés. Pour mandrex, « 10 propositions supplémentaires » en donne parfois moins, et un nouveau clic en ressort quelques-unes. Pour animeworld, nom et domaines « ne collent pas » et certains domaines ne sont pas libres. Les logs confirment.

- **animeworld, en `.com` seul** : 4, 4, 2, 2, 6, 3, 1, 2, 0, 3, 3 noms rendus sur 10 demandés, pour ~150 vérifications par lot.
- **mandrex, le 16/10, en `.fr` + `.com` (les deux libres exigés)** : 2, 4, 3, 3, puis trois fois 0, à ~45 s par lot.

Le code explique l'écart.

- Un « 10 de plus » n'exclut que les noms **affichés**, pas ceux déjà testés et trouvés pris (`wizard.ts:2707`). Le modèle peut donc les reproposer, et ils échouent de nouveau.
- La boucle s'arrête **en silence** au bout de 5 tentatives de 30 noms (`domain.service.ts:1276`), quel que soit le manque.

Deux défauts d'affichage nourrissent la confusion :

- la note de fin de recherche annonce toujours « disponibles en .com », quelles que soient les extensions choisies ;
- un rapport de marque **rafraîchi** revient aux extensions par défaut du serveur (`com, fr, io, net, app`), et montre donc des domaines que l'utilisateur n'a jamais demandés.

Enfin, le bouton Stop n'arrête la recherche que dans le navigateur. Le serveur continue, puis **débite** des noms que l'utilisateur ne verra qu'au rechargement.

## What Changes

- Une demande de suggestions supplémentaires exclut tous les noms **déjà vérifiés** dans le projet, pas seulement les noms affichés. Le serveur renvoie les noms qu'il a effectivement vérifiés, et le front les accumule.
- La boucle de génération ne s'arrête plus à un nombre fixe de tentatives. Elle continue tant qu'il manque des noms, dans un **budget de temps** borné et avec un plafond de tentatives plus haut.
- La recherche s'arrête côté serveur quand le client ferme la connexion. Rien n'est débité, rien n'est enregistré pour une recherche interrompue.
- La note de fin de recherche cite les extensions **réellement demandées** et le mode (« en .fr ou .com », « en .fr et .com »).
- L'actualisation d'un rapport de marque conserve les extensions du projet.
- `search_completed` journalise les tentatives consommées et la raison de l'arrêt (objectif atteint, budget de temps, plafond, interruption). C'est ce qui permettra de mesurer l'effet du chantier.

Hors périmètre :

- infléchir la génération vers des noms plus inventés quand le rendement s'effondre : à décider sur les mesures de ce chantier ;
- conserver les noms testés d'une session à l'autre ;
- aligner la vérification du rapport (RDAP seul) sur celle de la recherche.

## Capabilities

### New Capabilities

- `recherche/suggestions-supplementaires` : ce que garantit « 10 de plus » sur les noms rendus, les noms exclus, la durée, l'interruption et le débit.
- `recherche/note-de-fin-de-recherche` : ce que la note dit quand une recherche rend moins que demandé.
- `rapport-de-marque/actualisation` : ce qu'une actualisation du rapport conserve de la demande initiale.

### Modified Capabilities

Aucune. Le dépôt n'avait pas encore de spécifications OpenSpec.

## Impact

- **API**
  - `api/src/domain/domain.service.ts` : boucle `findAvailableDomains`, budget, noms vérifiés.
  - `api/src/domain/domain.controller.ts` : `search/stream`, détection de la fermeture, événement `done`, événement de log.
- **Front**
  - `web/src/app/components/wizard/wizard.ts` : noms testés accumulés, `excludeNames`, `refreshBrandReport`.
  - `wizard.html` et `web/public/assets/i18n/{fr,en}.json` : la note.
- **Contrat SSE** : l'événement `done` gagne un champ `checkedNames`. L'ajout est rétrocompatible.
- **Coût** : plus de tentatives, c'est plus d'appels au modèle et au registre sur les recherches saturées. Le budget de temps les borne, et le débit reste au nombre de noms rendus.
- **Données** : aucune migration.
