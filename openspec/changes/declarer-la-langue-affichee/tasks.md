# Tasks

## 1. Langue déclarée par la coquille cliente

- [ ] 1.1 Exporter `langueInitiale(chemin, langueNavigateur)` depuis `app.config.ts` et l'utiliser dans l'initialiseur, sans changer son comportement. Vérification : `langue-initiale.spec.ts` couvre les scénarios « Même règle que l'application » et passe sous `npx ng test --watch=false --include src/app/langue-initiale.spec.ts`.
- [ ] 1.2 Ajouter à `web/src/index.html`, juste après `<app-root>`, le script qui pose `lang` sur une page non prérendue, et faire comparer par `langue-initiale.spec.ts` le script exécuté et `langueInitiale` pour chaque cas. Vérification : le test passe, et il échoue si l'on retire `fr` des langues du script (essai noté sous la tâche).
- [ ] 1.3 Compiler (`just build`), servir `web/dist` selon les règles de `web/nginx.conf`, et mesurer `lang` à la fin du chargement pour `/app`, `/`, `/en` et `/generateur-nom-de-marque`, avec des navigateurs en anglais, français et allemand. Vérification : `/app` déclare `en`, `fr` et `en` dès le chargement ; `/` et `/generateur-nom-de-marque` restent `fr` ; `/en` reste `en`. Mesures avant et après notées sous la tâche.
- [ ] 1.4 Passer `just design-check`. Vérification : la commande se termine sans erreur.
- [ ] 1.5 Documenter dans CLAUDE.md, « Pages prérendues » : la coquille cliente déclare sa langue avant le démarrage, et pourquoi le script vit après `<app-root>`. Vérification : relecture du paragraphe.

## 2. Livraison

- [ ] 2.1 Ouvrir la pull request, attendre la CI verte. Vérification : `gh pr checks` tout vert.
- [ ] 2.2 Fusionner, attendre la fin du build GitHub Actions, puis `docker compose pull api web && docker compose up -d api web` sur `namorama-prod`. Vérification : `curl https://namorama.com/app` contient le script, et la mesure de 1.3 rejouée sur `https://namorama.com` (requêtes vers `/events` bloquées, pour ne pas créer de visite) donne les mêmes résultats.

## Workflow follow-up

- Après une semaine, relire dans **Administration → Sessions** les sessions anglophones sur `/app` : plus aucune balise `<font>` ne doit envelopper les libellés.
- Archiver le chantier (`/opsx:archive`) une fois ce suivi noté.
