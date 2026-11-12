# Proposal

## Why

Les erreurs que le navigateur remonte ne permettent ni de compter les vrais défauts,
ni de corriger ceux qu'on repère.

- **Les annulations noient les erreurs.** Du 07 au 12/11/2026, l'API a reçu 51
  événements `client_unhandled_rejection`. 49 portent le message « signal is aborted
  without reason », et 48 d'entre eux viennent d'**une seule visite** : le 10/11, entre
  14 h 35 et 17 h 53, sous Chrome/macOS, un rejet à chaque analyse ou avis sur un nom.
  Sur la même période, aucun appel HTTP de cette visite n'a échoué. Ce sont des
  requêtes que le code a lui-même annulées (désabonnement d'un `HttpClient` sous
  `withFetch()`, `web/src/app/app.config.ts:347`), que personne n'a subies.
- **La vraie erreur est indéchiffrable.** Le 08/11 à 20 h 49, sur
  `/generateur-nom-ecommerce`, un iPhone sous iOS 17.5 remonte
  `undefined is not an object (evaluating 'n.length')`. Le rejet ne porte ni pile ni
  fichier (`web/src/app/services/analytics.ts:183-188`, à la différence de
  `client_error`, qui joint sa pile). Même avec une pile, le code de production est
  minifié et aucune source map n'est produite : `n` ne désigne rien qu'on puisse
  retrouver.

## What Changes

- **Une annulation voulue par le code n'est plus remontée comme une erreur.** Un
  rejet dont la raison est une `AbortError` ne produit aucun événement.
- **Un rejet non géré joint sa pile**, comme une erreur JavaScript, dans la limite
  de 300 caractères que l'API applique déjà à chaque valeur.
- **La compilation de production produit des source maps cachées.** Le navigateur
  ne les référence pas, et nginx ne les sert pas : elles restent dans l'image web,
  hors du dossier servi. Un script retraduit une pile minifiée en fichiers et lignes
  du code source, à partir des maps de l'image déployée.

Hors périmètre :
- corriger l'erreur `n.length` elle-même : il faut d'abord qu'elle revienne avec une
  pile lisible ;
- chercher quel désabonnement laisse fuir chaque `AbortError` : aucun utilisateur ne
  le voit ;
- envoyer les erreurs à un service tiers (Sentry ou équivalent).
