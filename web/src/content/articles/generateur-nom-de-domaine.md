---
path: /generateur-nom-de-domaine
title: Générateur de nom de domaine disponible
description: "Générateur de nom de domaine par IA : chaque nom est testé auprès du registre (RDAP, repli Whois), sur 30 extensions. Nous ne vendons pas de domaines."
titre: Générateur de nom de domaine
extrait: RDAP puis Whois, sur 30 extensions — et aucun domaine à vous vendre.
categorie: Générateurs
publie: 2026-09-03
misAJour: 2026-09-03
---

# Générateur de nom de domaine disponible

Décrivez votre projet : l'IA propose des noms, et chaque nom de domaine est **testé pour de vrai** auprès du registre avant de vous être montré — pas estimé, pas deviné. Une trentaine d'extensions vérifiées (`.com`, `.fr`, `.io`, `.ai`, `.store`…), et **aucun domaine à vous vendre** : vous l'achetez où vous voulez. {.lead}

::: cta heading="Trouvez un nom de domaine libre"
Une phrase suffit. L'IA génère, le registre tranche — et nous ne vendons pas de domaines.
:::

## Comment nous vérifions qu'un domaine est libre {#verification}

C'est le cœur du sujet, et c'est là que les outils divergent le plus. Beaucoup de générateurs se contentent d'une heuristique — « le nom ressemble à quelque chose de disponible » — ou interrogent une base de données rafraîchie chaque semaine. Namorama fait trois choses, dans cet ordre :

1. **Un pré-filtre DNS.** Un domaine qui a des serveurs de noms est forcément enregistré : la délégation vient de la zone du registre, on n'y figure pas autrement. Verdict en une vingtaine de millisecondes au lieu de plusieurs centaines. La réciproque étant fausse (un domaine déposé mais non configuré n'a pas de serveurs de noms), l'absence de délégation ne conclut jamais à « libre » : on repasse au registre.
2. **Le RDAP du registre.** Le successeur moderne du Whois. Le verdict y est un code HTTP : 404 signifie libre, 200 signifie pris. Pas de texte à interpréter registre par registre, donc pas de contresens.
3. **Le Whois en repli.** Beaucoup d'extensions nationales n'exposent pas de RDAP (`.de`, `.it`, `.be`, `.io`, `.co`…). On bascule alors sur le port 43, en normalisant les mises en forme avant de chercher les motifs de réponse.

Et quand aucune des deux sources ne répond — un registre tombe, un autre refuse nos requêtes, un troisième plafonne son quota — le résultat s'affiche « **non vérifiable** ». C'est le troisième état, et il est là par expérience : sans lui, une panne de registre se déguise en verdict. Nous avons vu le `.app` annoncé pris pendant des semaines parce qu'un serveur avait été retiré, et des `.de`, `.it`, `.ch` annoncés libres alors qu'ils étaient pris. Un doute qui retombe sur « libre » vous fait payer pour un domaine inachetable ; sur « pris », il vous fait renoncer au bon nom.

## Pourquoi ne pas simplement utiliser l'outil de son hébergeur {#registrars}

Les générateurs de GoDaddy, OVH, Hostinger ou Shopify sont gratuits, rapides et souvent bons. Ils ont un biais structurel qu'il faut connaître : leur métier est de **vous vendre un domaine**. Quand le nom que vous cherchez est pris, ils proposent naturellement une extension exotique disponible plutôt que de vous suggérer un autre nom — et une extension de repli mal choisie vous coûte plus longtemps qu'un nom recommencé.

Namorama ne vend pas de domaines et n'a aucune commission d'affiliation en jeu : quand un nom est pris partout, l'outil vous le dit et vous en propose un autre. Vous achetez ensuite chez le registrar de votre choix, au prix du marché.

## Choisir un nom de domaine qui tient dans le temps {#choisir}

- **Allongez d'un caractère avant de renoncer.** D'après nos mesures, environ 83 % des `.com` prononçables de 5&nbsp;lettres sont pris, contre moins de 3 % à 7&nbsp;lettres. La frontière du « tout est pris » est plus étroite qu'on ne le croit.
- **Pas de tiret, pas de chiffre, pas d'orthographe contournée.** Ils survivent mal à l'oral : vous passerez votre vie à épeler, et une partie de votre trafic ira à l'orthographe normale — c'est-à-dire chez quelqu'un d'autre.
- **Le `.fr` mérite mieux que son statut de repli.** Il est crédible auprès d'une clientèle française, souvent moins cher, et surtout **bien plus disponible**. Un nom perdu en `.com` est fréquemment libre en `.fr`.
- **Vérifiez le `.com` même si vous prenez autre chose.** S'il appartient à un tiers actif, une partie de vos visiteurs atterrira chez lui en tapant votre nom de mémoire.
- **Un domaine libre ne suffit pas.** Le nom peut être déposé comme marque, et c'est le seul des trois plans dont l'échec vous fait changer de nom.

::: trois-risques
Le domaine se vérifie en une seconde ; c'est aussi celui des trois contrôles dont l'échec coûte le moins cher.
:::

## Questions fréquentes {#faq}

### Comment savoir si un nom de domaine est vraiment disponible ?

Seule une interrogation du registre fait foi — RDAP, ou Whois pour les extensions qui n'en exposent pas. Les listes « domaines disponibles » et les estimations d'outils tiers vieillissent en quelques heures. Un domaine affiché libre puis refusé à l'achat, c'est presque toujours une vérification qui n'en était pas une.

### Existe-t-il un générateur de nom de domaine gratuit ?

Ceux des registrars le sont, avec le biais commercial décrit plus haut. Chez Namorama, l'essai se fait sans inscription et le compte ouvre 100&nbsp;crédits offerts chaque mois — environ 50 noms vérifiés, sans abonnement. La vérification a un coût réel : chaque nom déclenche des requêtes vers des registres qui appliquent leurs propres quotas.

### Le domaine que je veux est pris par un site inactif : puis-je le récupérer ?

Un domaine sans site visible a quand même un propriétaire — c'est exactement le cas que les outils approximatifs confondent avec un domaine libre. Le racheter se négocie souvent à plusieurs milliers d'euros, et rien n'oblige le titulaire à répondre. Chercher un autre nom est presque toujours plus rentable.

### Faut-il acheter plusieurs extensions ?

Deux suffisent dans la plupart des cas : celle que vous utilisez, et le `.com` s'il est libre, en redirection. Au-delà, la dépense se justifie mal — vous ne pourrez de toute façon pas couvrir les centaines d'extensions existantes, et ce n'est pas ce qui protège votre nom. Le dépôt de marque, oui.

## À lire aussi {#suite}

- [Générateur de nom de marque](/generateur-nom-de-marque)
- [Générateur de nom d'entreprise et de société](/generateur-nom-entreprise)
- [Vérifier la disponibilité d'un nom](/verifier-disponibilite-nom-de-marque)
- [Comparatif des générateurs de noms](/comparatif-generateurs-de-noms)
