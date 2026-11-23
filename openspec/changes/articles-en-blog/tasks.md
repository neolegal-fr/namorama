# Tasks

## 1. Registre et présentation en blog

- [x] 1.1 Créer `articles.ts` (registre : chemin, titre, extrait, catégorie, dates, temps de lecture) avec les 19 articles existants, dates tirées de git. Vérifier par `articles.spec.ts` : chemins uniques, tous présents dans `app.routes.server.ts` en prérendu, dates au format ISO.
  - 23/11/2026 : `articles.spec.ts` passe (12 fichiers, 93 tests).
- [x] 1.2 Créer l'en-tête `<app-article-entete>` et le substituer au fil d'Ariane des 19 articles. Vérifier au navigateur sur deux articles (dont un mis à jour) : fil Accueil › Blog › catégorie, auteur, dates, temps de lecture.
  - Vérifié au navigateur (build prérendu servi en local) : `/guides/trouver-nom-de-marque` affiche « Publié le 10 juin 2026, mis à jour le 3 septembre 2026 · 9 min » ; viewport 390 px sans débordement.
- [x] 1.3 Étendre `applyContentSeo` : `BlogPosting` en `@graph` avec le JSON-LD de la page, `article:published_time` / `article:modified_time`. Vérifier par `content-seo.spec.ts` (avec et sans balisage propre) et dans le HTML prérendu de `/generateur-nom-de-marque`.
  - HTML prérendu de `/generateur-nom-de-marque` : `article:published_time` 2026-09-03 et `BlogPosting` signé. Aucun article ne déclarait de `FAQPage` ; le cas `@graph` est couvert par le test.
- [x] 1.4 Créer la page `/blog` (liste triée, filtre par catégorie), router `/guides` vers `/blog` (route Angular + 301 nginx), mettre à jour menu, accueil et `sitemap.xml`. Supprimer `guides-index.ts`. Vérifier au navigateur (filtre, liens) et par `npm run build` (routes prérendues).
  - « Prerendered 27 static routes ». Playwright : 22 cartes, « Secteurs » → 6, « Tous » → 22, clic sur une carte navigue ; `/guides` → 301 `/blog` (serveur local imitant nginx).

## 2. Nouveaux articles

- [x] 2.1 `/blog/nom-entreprise-artisan` : nom d'artisan et de service de proximité, sources service-public et INPI. Vérifier : build, rendu au navigateur, liens sortants valides.
  - Build et rendu vérifiés ; 15 noms descriptifs testés au RDAP Verisign/AFNIC le 23/11/2026 : 15/15 pris en .fr et .com.
- [x] 2.2 `/blog/noms-chatgpt-deja-pris` : test RDAP de noms produits par un assistant IA, méthode de vérification, source Bpifrance. Vérifier : chiffres recontrôlés le jour de la publication.
  - RDAP le 23/11/2026 : 12/12 .com pris, 10/12 .fr pris (homiara et solvessa libres en .fr).
- [x] 2.3 `/blog/deposer-marque-inpi-prix-delais` : prix, délais, opposition, sources INPI et Légifrance. Vérifier : chaque montant et délai recoupé sur la page INPI citée.
  - Montants et délais relus le 23/11/2026 sur les pages INPI citées (190 €, 40 €/classe, ~6 semaines, 2 mois, 5 mois min, opposition 400 € + 150 €, 6 mois à 1 an).
- [x] 2.4 Mettre à jour `CLAUDE.md` (section blog : registre, dates, ajout d'un article). Vérifier que la procédure décrite suffit à ajouter un article sans autre fichier oublié.
  - Section « Blog : un registre, des adresses qui ne bougent pas » ajoutée ; la procédure d'ajout liste les quatre fichiers que `articles.spec.ts` contrôle.

## 3. Livraison

- [x] 3.1 PR, CI verte, fusion, déploiement (`docker compose pull web && up -d web`).
  PR #197 fusionnée le 23/11/2026, build `main` vert, image `web` déployée.
- [x] 3.2 Vérifier en production : `/blog` 200, `/guides` 301 → `/blog`, un ancien article 200, `BlogPosting` présent dans le HTML servi.
  23/11/2026 : `/blog` 200 avec 22 cartes ; `/guides` 301 → `/blog` ; `/guides/trouver-nom-de-marque`, les trois `/blog/…` et `/generateur-nom-saas` 200 ; `BlogPosting`, `article:published_time` et « Publié le 23 novembre 2026 » dans le HTML servi ; `sitemap.xml` à 27 URL.

## Workflow follow-up

- [ ] Resoumettre le plan du site dans la Search Console et suivre l'indexation des trois nouveaux articles à J+30.
