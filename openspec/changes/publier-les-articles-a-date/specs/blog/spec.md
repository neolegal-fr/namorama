# Spec Delta

## Purpose

Permettre de fusionner des articles à l'avance et de les voir paraître chacun à sa date,
sans intervention.

## ADDED Requirements

### Requirement: Article programmé
Un article dont la date `publie` est postérieure à la date du build, à l'heure de Paris,
SHALL être absent des routes, du prérendu, de l'index `/blog` et du plan du site.

#### Scenario: Article de la semaine suivante
- **WHEN** l'image est construite le 30/11/2026 et un article porte `publie: 2026-12-07`
- **THEN** son adresse n'est pas prérendue, il n'apparaît ni sur `/blog` ni dans `sitemap.xml`

#### Scenario: Article du jour
- **WHEN** l'image est construite le 30/11/2026 à 05:00 UTC et un article porte `publie: 2026-11-30`
- **THEN** l'article est prérendu et listé en tête de `/blog`

### Requirement: Lien vers un article programmé
La compilation SHALL échouer quand un article publiable contient un lien interne vers un
article programmé, en nommant le fichier, le lien et la date de parution de la cible.

#### Scenario: Renvoi prématuré
- **WHEN** l'article publié le 30/11/2026 renvoie à `/blog/agences-outils-de-naming`, programmé le 21/12/2026
- **THEN** la compilation du 30/11/2026 échoue avec un message qui cite ce lien et la date 2026-12-21

### Requirement: Prévisualisation des articles programmés
La variable `ARTICLES_JUSQU_AU` SHALL remplacer la date du build pour décider quels
articles sont compilés.

#### Scenario: Relire la série avant fusion
- **WHEN** l'auteur lance `ARTICLES_JUSQU_AU=2027-02-01 npm start`
- **THEN** tous les articles programmés jusqu'au 01/02/2027 sont servis en local

### Requirement: Parution hebdomadaire automatique
Chaque lundi, l'image `web` de `main` SHALL être reconstruite si un article devient
publiable ce jour-là, puis déployée en production sans intervention ; un lundi sans
article SHALL ne rien reconstruire ni redéployer.

#### Scenario: Lundi de parution
- **WHEN** le lundi 07/12/2026 un article porte `publie: 2026-12-07`
- **THEN** l'image `web` est reconstruite le matin, la production la tire à 07:30 et `/blog` liste l'article

#### Scenario: Lundi sans parution
- **WHEN** aucun article ne porte la date du lundi
- **THEN** le workflow s'arrête sans construire, et le script du serveur journalise « image inchangée »
