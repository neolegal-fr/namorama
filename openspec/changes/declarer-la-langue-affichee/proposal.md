# Proposal

## Why

Les pages rendues dans le navigateur annoncent le français pendant tout leur
chargement, **quelle que soit la langue qu'elles vont afficher**.

- **Ce qu'on voit dans les sessions enregistrées.** Le 31/10/2026, un visiteur arrive
  sur `/en` depuis un lien ChatGPT et passe à `/app` par la connexion. Sur `/app`, les
  libellés qu'il clique sont enveloppés dans des balises `<font>`, signe d'un
  traducteur automatique du navigateur. Ce traducteur les réécrit d'anglais en
  anglais, en les abîmant au passage : « E.g.: » devient « Eg: », et des espaces
  invisibles s'insèrent dans « Trademark & social ». Sur `/en`, prérendue en anglais,
  aucune balise `<font>` n'apparaît. Ce sont 2 sessions sur 16 : peu, mais le défaut
  touche **tous** les visiteurs non francophones de l'application.
- **Ce qu'on mesure.** Relevé du 07/11/2026 sur la compilation de production, servie
  selon les règles de `web/nginx.conf` :
  - `/app` est servie avec `lang="fr"` pour un navigateur anglais ou allemand ;
  - elle l'est **encore à la fin du chargement** ;
  - elle ne passe à `en` qu'une fois l'application démarrée, alors que l'interface
    s'affiche en anglais.

  Un traducteur qui se fie à la déclaration propose donc de traduire « depuis le
  français » une page anglaise.
- **La cause.**
  - `web/src/index.html:2` déclare `lang="fr"` en dur.
  - Les pages prérendues corrigent cet attribut au rendu
    (`components/content/content-seo.ts:89`), mais `/app`, `/projects/…` et le reste
    sont servies par la coquille `index.csr.html` (`web/nginx.conf:99`).
  - Leur langue n'est posée que dans `App.ngOnInit` (`app.ts:594`). Ce point ne
    s'exécute qu'après le chargement du dictionnaire et la réponse de Keycloak, qui
    sont tous deux attendus au démarrage (`app.config.ts:215-235`).

## What Changes

- **La coquille cliente déclare la langue qu'elle affichera, avant tout script
  applicatif.** La règle est celle de l'application : la langue de l'URL si elle en
  porte une, sinon celle du navigateur si elle est servie (fr, en), sinon l'anglais.
- **Une page prérendue garde la langue posée au rendu** : la landing française reste
  `fr` pour un navigateur anglais, `/en` reste `en`.
- **Les deux exemplaires de la règle ne peuvent pas diverger sans qu'un test échoue.** Le
  script en ligne ne peut pas importer de module : la règle existe donc dans le script et
  dans une fonction de l'application, et un test exécute le script de `index.html` pour
  le comparer à la fonction, cas par cas.

**Hors périmètre :**
- interdire la traduction (`translate="no"`) : un visiteur espagnol doit pouvoir
  traduire l'application anglaise, et c'est la déclaration correcte qui le lui permet ;
- servir de nouvelles langues ;
- les guides, monolingues français, qui sont déjà prérendus en `fr`.

## Capabilities

### New Capabilities
- `langue-de-la-page` : la langue que chaque page déclare au navigateur, et à quel
  moment.

### Modified Capabilities
_(aucune)_

## Impact

- **Web** :
  - `web/src/index.html` gagne un court script en ligne, comme celui du thème ;
  - `app.config.ts` lit la langue initiale par une fonction partagée, au comportement
    inchangé.
- **API** : aucun changement.
- **Contrat** : aucun. Les pages prérendues restent identiques, et la coquille ne
  diffère que par son attribut `lang` au chargement.
- **Interface** : rien de visible pour un visiteur dont le navigateur ne traduit pas.
  Aucun composant ni jeton du système de design n'est touché.
- **Docs** : CLAUDE.md, section « Pages prérendues ».
