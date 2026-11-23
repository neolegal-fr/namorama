# Cible : ceux qui cherchent un nom pour quelqu'un d'autre

Recherche du 23/11/2026, à l'origine de la série d'articles `web/src/content/articles/agences-*.md`
(un par lundi, du 30/11/2026 au 01/02/2027). Aucun article antérieur ne visait ces lecteurs :
le conseil en propriété industrielle n'y apparaissait que comme l'étape « faites valider par… »,
et le partage de projet n'était mentionné nulle part.

Convention : **[S]** sourcé (lien en fin de document), **[I]** inférence.

## Les acteurs

| Acteur | Volume en France | Place du nom | Ce qui les bloque |
|---|---|---|---|
| Agences de naming (Nomen, Labbrand Paris, Namibie…) | Quelques dizaines dans les annuaires, très peu qui en vivent [S/I] | Le métier entier ; 1 à 3 mois par mission (Nomen, 2017) [S] | Nom aimé puis refusé par le juridique ; disponibilité « dans tous les pays » |
| Agences de communication, branding, web | ~20 000 entreprises de publicité (Insee, 2019) [S] | Une ligne du devis d'identité visuelle [I, appuyé sur l'affaire ci-dessous] | Responsabilité si le nom livré est déposé ; client qui arrive avec un nom pris |
| Freelances (stratèges, designers, concepteurs-rédacteurs) | Non chiffré | Missions de < 500 € à quelques milliers [S, Codeur] | Valeur perçue écrasée par les assistants IA |
| Conseils en propriété industrielle, avocats | > 1 000 CPI en 2017 (CNCPI) [S] | Validation et dépôt, en bout de chaîne | Reçoivent des listes dont presque tout tombe (Azrights) [S] |
| Incubateurs, experts-comptables | > 400 structures ; ~22 000 experts-comptables [S] | Passage obligé de la création, prescripteurs | — |

## Les problèmes, avec leurs preuves

1. **Les registres se remplissent** : 103 645 demandes de marques à l'INPI en 2025, +14,1 % [S, lu].
2. **Le juridique arrive après le coup de cœur** : circuit séquentiel agence → client → conseil ;
   Corsearch décrit le client qui aime un nom que le juridique refuse, et le délai entre les deux [S, lu].
3. **L'IA fait baisser la valeur perçue, pas la difficulté** : JDN (Florian Bourgeois, 05/10/2026),
   quatre assistants, 9 noms sur 12 déjà déposés ou à risque dont 4 identiques [S, lu en entier].
4. **La responsabilité retombe sur l'agence** : Le Monde du Droit, 07/02/2025 (Oratio Avocats) —
   agence de communication condamnée en première instance et en appel pour avoir livré un nom
   déjà déposé, alors que le client avait refusé le devis de dépôt [S, page lue en partie :
   les citations entre guillemets ne sont pas reprises dans les articles, seulement paraphrasées].
5. **Cas réels** : Technis / SNCF (2024, nom « validé par une agence de branding », issue
   inconnue au 23/11/2026) ; Free Electrons → Bootlin (2017-2018) ; Mondo → Monzo (2016) ;
   Hopwork → Malt, Prêt d'Union → Younited Credit (langue) [S].

**Non trouvés, donc jamais affirmés** : un taux publié de noms éliminés par le juridique ; un
délai type de « 6 à 8 semaines » ; un témoignage daté d'agence sur « le client croit que ChatGPT
suffit » ; les tarifs 2026 de La Fabrique du Net (page inaccessible). « Kapten contre Kapten & Son »
est sans source : ne pas citer.

## La concurrence vue d'une agence

| Famille | Exemples | Domaines | Marques | Client |
|---|---|---|---|---|
| Générateurs gratuits | Namelix, Namify, NameSnack, hébergeurs | Souvent `.com` ; Namify 300+ extensions | USPTO au mieux | Rien |
| Listes partageables | Nametastic (Pro 9,99 $/mois, 50 crédits) | 100+ extensions | Non | Listes partagées |
| Plateforme agences | NameStation | Oui | Annoncé, registres non précisés | Espaces par client, rôle Reviewer gratuit ; prix non publiés |
| Assistants IA et apps de registrars | ChatGPT + GoDaddy, Namecheap… | `.com`, pour acheter | Non | Non |
| Recherche de marques | data.inpi.fr, TMview, WIPO (phonétique), EUIPO Early TM Screening (nov. 2025) | — | Gratuit, manuel | — |
| Clearance professionnelle | Corsearch (générateur vérifié en temps réel), Clarivate CompuMark | — | Similarité, US/UE | Sur devis, en anglais |

**Ce qui distingue Namorama** [I] : seul générateur trouvé qui interroge l'INPI et l'EUIPO ;
extensions européennes vérifiées au registre avec un état « non vérifiable » ; français et
cahier des charges garanti par un filtre ; partage avec débit au propriétaire ; sans devis ni
abonnement.

**Ce qui lui manque** [I] : similarité phonétique/visuelle ; registres hors UE (USPTO, UKIPO,
Suisse) ; espaces client, rôle relecteur, commentaires par nom ; marque blanche du rapport ;
Instagram et Facebook ; registre des entreprises. Le quota INPI partagé (~12 rapports par
période) limiterait une agence active.

## Pistes produit (à arbitrer, hors de la série)

1. **Dossier de passation au conseil** : shortlist, orthographes cherchées, classes visées,
   dépôts trouvés, mention « similarité non couverte ». Fait de la limite un positionnement.
2. **Rapprochement phonétique simple** sur les dépôts INPI/EUIPO déjà rapatriés, signalé
   « à faire revoir par un conseil ».
3. **Rôle « relecteur client »** (noter, commenter, sans chercher) et commentaires par nom :
   aujourd'hui un invité en lecture ne peut pas mettre un favori.
4. **Marque blanche** du rapport PDF : NameStation l'a annoncée sans la livrer.
5. **Quota INPI** : un second compte, ou un cache des recherches, avant de pousser la cible.

## À corriger ailleurs

- `/comparatif-generateurs-de-noms` affirme que « personne, Namorama compris, ne vérifie
  automatiquement les marques déposées » : faux depuis le rapport INPI/EUIPO.
- Les articles antérieurs citent 83 % / 34 % de `.com` pris à 5 / 6 caractères ; `CLAUDE.md`
  retient ~75 % / ~25 % (borne basse, `TAKEN_RATE`). La série suit `CLAUDE.md`.
- Plusieurs articles parlent de « vérification Whois » alors que le RDAP passe en premier.

## Calendrier de la série

| Lundi | Chemin | Catégorie |
|---|---|---|
| 30/11/2026 | `/blog/agences-qui-trouve-les-noms-de-marque` (pilier) | Méthode |
| 07/12/2026 | `/blog/agence-responsable-nom-deja-depose` | Marque & droit |
| 14/12/2026 | `/blog/brief-de-naming` | Méthode |
| 21/12/2026 | `/blog/shortlist-de-noms-verifiee` | Méthode |
| 28/12/2026 | `/blog/outils-de-naming-pour-agences` | Comparatifs |
| 04/01/2027 | `/blog/chercher-un-nom-avec-son-client` | Méthode |
| 11/01/2027 | `/blog/agence-et-conseil-en-propriete-industrielle` | Marque & droit |
| 18/01/2027 | `/blog/freelance-naming-face-a-l-ia` | Méthode |
| 25/01/2027 | `/blog/nommer-une-marque-pour-plusieurs-pays` | Méthode |
| 01/02/2027 | `/blog/agence-web-client-sans-nom` | Secteurs |

Chaque article ne renvoie qu'aux articles déjà parus. Une fois la série publiée, les anciens
articles (atelier de nommage, antériorité INPI, comparatif) pourront renvoyer vers elle.

## Sources

- INPI, chiffres clés 2025 : https://www.inpi.fr/a-la-une/chiffres-cles-inpi-2025
- JDN, « Naming par IA : 9 noms sur 12 », 05/10/2026 : https://www.journaldunet.com/intelligence-artificielle/1555681-naming-par-ia-9-noms-sur-12-deja-deposes-ou-a-risque/
- Le Monde du Droit, contrat de naming, 07/02/2025 : https://www.lemondedudroit.fr/decryptages/97064-contours-contrat-dit-naming.html
- Corsearch, agences et disponibilité : https://corsearch.com/blogs/how-marketing-and-branding-agencies-solve-name-availability
- NameStation : https://www.namestation.com/solutions
- Nametastic : https://nametastic.com/ ; Namify : https://namify.tech/
- EUIPO Early TM Screening, 07/11/2025 : https://intellectual-property-helpdesk.ec.europa.eu/news-events/news/euipo-launches-early-tm-screening-streamline-trademark-applications-2025-11-07_en
- WIPO Global Brand Database : https://www.wipo.int/reference/en/branddb/
- Nomen / Marcel Botton, 2017 : https://www.mondedesgrandesecoles.fr/dans-cerveau-ceux-imaginent-noms-de-marques/
- Insee, secteur 731 : https://www.insee.fr/fr/statistiques/6041778
- CNCPI, chiffres clés : https://www.cncpi.fr/chiffres-cles
- Azrights : https://www.azrights.com/blog/top-three-most-common-naming-mistakes
- Codeur : https://www.codeur.com/projects/292096-trouver-un-nom-de-marque-pour-un-site-internet
- Technis / SNCF : https://economiematin.fr/parasitage-de-marque-technis-attaque-la-sncf-en-justice
- Free Electrons → Bootlin : https://next.ink/news/106098-attaques-par-free-specialistes-linux-free-electrons-deviennent-bootlin.htm
- Mondo → Monzo : https://monzo.com/blog/2016/06/13/new-mondo-changing-our-name/
- Maddyness, changements de nom : https://www.maddyness.com/2020/11/17/naming-startups-changer-de-nom/
