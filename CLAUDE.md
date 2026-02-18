# Namespoter

SaaS pour trouver des noms de marque et domaines disponibles à partir d'une description produit, via IA + vérification Whois réelle.

## Stack

- **Frontend** : Angular 21, PrimeNG 21 (Aura theme), Tailwind CSS 4
- **Backend** : NestJS, TypeORM, PostgreSQL
- **Auth** : Keycloak SSO (realm `namespoter`, auto-importé depuis `infra/keycloak/realm-export.json`)
- **IA** : OpenAI GPT-3.5 Turbo
- **Infra** : Docker Compose (`infra/docker-compose.yml`), orchestration via `justfile`

## Commandes

- `just start` : lance Docker + API + Web en dev
- `just stop` : arrête tout
- `just build` : compile API + Web
- `just clean` : supprime node_modules, dist, volumes Docker

## Architecture

```
web/src/
├── app/
│   ├── app.ts                  # Composant racine (menubar, routing, dialog crédits)
│   ├── app.config.ts           # Providers Angular (Keycloak, i18n, PrimeNG)
│   ├── app.routes.ts           # Routes (/ et /projects/:id)
│   ├── components/wizard/      # Wizard 3 étapes (Description → Mots-clés → Domaines)
│   └── services/               # domain.ts, project.ts, user.ts
├── styles.css                  # Tailwind + styles globaux
└── index.html
api/src/
├── domain/                     # Recherche domaines, vérification Whois
├── projects/                   # CRUD projets
├── users/                      # Crédits, profil
└── common/                     # Guards, DTOs, utilitaires
```

## Conventions importantes

### CSS / Styles
- **PrimeNG écrase les classes Tailwind** dans ses composants (Card, Table, Drawer, Dialog, etc.). Utiliser des **inline styles** pour les propriétés de layout critiques (`display`, `flex-direction`, `align-items`, `justify-content`, `gap`, `text-align`, `margin`, `max-width`).
- Tailwind reste utilisable pour les éléments hors PrimeNG et pour les propriétés décoratives.
- Les hover effects nécessitent des classes CSS dans `styles.css` (pas d'inline styles possibles).

### Angular
- Composants standalone avec **signals** (`signal()`, `.set()`, `.update()`)
- Services utilisent RxJS Observables (convention suffixe `$`)
- i18n : FR/EN via `@ngx-translate`, fichiers dans `web/public/assets/i18n/`
- Auth Keycloak avec bearer token via interceptor HTTP

### Système de crédits
- 1 suggestion de domaine = 1 crédit
- Crédits initiaux : 100
- Vérification Whois via commande système `whois` (Linux)

## Fonctionnalités

- Wizard : Description → Reformulation IA → Mots-clés → Recherche domaines
- Tableau matriciel de disponibilité par extension
- Favoris (coups de cœur) avec tri prioritaire
- Projets : sauvegarde, historique, restauration via drawer
- Persistence état wizard avant redirection login (localStorage)
- Accès hybride : public pour le test, connexion requise pour les résultats
