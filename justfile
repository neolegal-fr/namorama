# Justfile pour Namorama

# Démarrer l'infrastructure et les serveurs de développement
start:
    docker-compose -f infra/docker-compose.yml up -d
    @echo "Attente du démarrage des bases de données..."
    sleep 5
    (cd api && npm run start:dev) & (cd web && API_INTERNE_URL=http://localhost:3001 npm start)

# Arrêter les serveurs de la copie principale (ports 3001 et 4200) et Docker.
# Par port, pas par motif : `pkill -f nest` tuait aussi les serveurs des
# worktrees d'agents (just agent-*), et Docker n'est arrêté que si aucun
# d'eux ne tourne encore — la base et Keycloak leur sont communs.
stop:
    @scripts/agent-env.sh stop-port 3001
    @scripts/agent-env.sh stop-port 4200
    @bash -c 'if ss -Hltn | grep -qE ":(300[2-9]|3010|420[1-9]) "; then echo "Docker laissé en marche : un worktree d agent tourne encore (just agent-status)"; else docker-compose -f infra/docker-compose.yml stop; fi'

# Redémarrer l'écosystème
restart: stop start

# Compiler les applications pour la production
build:
    @echo "Compilation de l'API (NestJS)..."
    cd api && npm run build
    @echo "Compilation du Web (Angular)..."
    cd web && npm run build

# Contrôle du système de design : refuse toute valeur en dur ajoutée
# (couleur, style en ligne, taille en px, !important) hors des jetons.
# Le même tourne en CI sur chaque PR. Voir docs/systeme-de-design.md §1.
design-check:
    node web/scripts/verifier-design.mjs

# Après un nettoyage : abaisse la référence du cliquet, jamais ne la relève.
design-resserrer:
    node web/scripts/verifier-design.mjs --resserrer

# Installer les dépendances Node (legacy-peer-deps requis pour nest-keycloak-connect)
install:
    cd api && npm install --legacy-peer-deps
    cd web && npm install

# ⚠ `down -v` efface le volume MariaDB : la base de la copie principale ET celles
# de tous les worktrees d'agents. Jamais depuis un agent.
# Nettoyer les dépendances, les builds et les volumes Docker (toutes les bases)
clean:
    docker-compose -f infra/docker-compose.yml down -v
    rm -rf api/node_modules api/dist web/node_modules web/dist web/.angular
    @echo "Nettoyage terminé."

# ─── Développement sous WSL ────────────────────────────────────────────────
#
# Le navigateur tourne sous Windows, l'API dans la distribution : `localhost`
# n'y désigne pas la même machine, et `web/public/assets/config.json` doit
# porter l'IP de la distribution pour que le front joigne l'API.
#
# Cette IP ne doit PAS être versionnée — elle change à chaque redémarrage de
# WSL et ne vaut que pour ce poste. `--skip-worktree` retire donc le fichier
# du diff tant que l'adresse locale est posée : plus de modification à écarter
# à chaque commit, et plus d'IP privée partie en production par mégarde.
dev-api-url:
    @bash -c 'ip=$(hostname -I | awk "{print \$1}"); \
      git update-index --no-skip-worktree web/public/assets/config.json 2>/dev/null || true; \
      printf "{\n  \"apiUrl\": \"http://%s:3001\",\n  \"keycloakUrl\": \"http://localhost:8080\"\n}\n" "$ip" > web/public/assets/config.json; \
      git update-index --skip-worktree web/public/assets/config.json; \
      echo "config.json → http://$ip:3001 (masqué du suivi Git)"'

# Revenir à l'état versionné et réarmer le suivi du fichier.
dev-api-url-reset:
    @bash -c 'git update-index --no-skip-worktree web/public/assets/config.json 2>/dev/null || true; \
      git checkout -- web/public/assets/config.json; \
      echo "config.json → localhost:3001 (suivi Git réarmé)"'

# ─── Plusieurs agents en parallèle ─────────────────────────────────────────
#
# Chaque agent travaille dans son worktree ; ces recettes lui donnent aussi sa
# base (`namorama_wN`), son API (3001+N) et son front (4200+N). Sans elles, deux
# branches partagent la base `namorama` et DB_SYNCHRONIZE y fait s'écraser leurs
# schémas. Détails dans scripts/agent-env.sh et dans CLAUDE.md.

# Préparer le worktree courant (N de 1 à 9, choisi libre si omis)
agent-env n="":
    @scripts/agent-env.sh env {{n}}

# Lancer l'API et le front de ce worktree en arrière-plan (.agent-run/*.log)
agent-start:
    @scripts/agent-env.sh start

# Arrêter les serveurs de ce worktree, et eux seuls
agent-stop:
    @scripts/agent-env.sh stop

# Lister les worktrees, leurs ports et ce qui tourne
agent-status:
    @scripts/agent-env.sh status

# Avant de supprimer un worktree : arrêter, supprimer sa base, libérer N
agent-clean:
    @scripts/agent-env.sh clean

# Autoriser les ports 4201-4209 dans le Keycloak local déjà initialisé
agent-realm:
    @scripts/agent-env.sh realm

# ─── Articles du blog (rédaction par jeton) ─────────────────────────────────
#
# Les articles vivent en base : ces recettes les lisent et les écrivent par
# l'API, avec un jeton de rédaction créé dans Administration → Articles.
#   export NAMORAMA_JETON_ARTICLES=nmr_…   (jamais dans le dépôt)
#   export NAMORAMA_API_URL=http://localhost:3003   (défaut : la production)
# Guide : docs/ecrire-un-article.md.

# Lister les articles (brouillons, programmés, publiés)
[no-cd]
article-liste:
    @node "{{justfile_directory()}}/scripts/article.mjs" liste

# Lire un article au format Markdown (avec sa ligne « # revision: N »)
[no-cd]
article-lire chemin fichier="":
    @node "{{justfile_directory()}}/scripts/article.mjs" lire {{chemin}} {{fichier}}

# Vérifier un fichier sans rien enregistrer (--publier : comme à la publication)
[no-cd]
article-verifier fichier *drapeaux:
    @node "{{justfile_directory()}}/scripts/article.mjs" verifier {{fichier}} {{drapeaux}}

# Enregistrer un fichier (création en brouillon, ou modification de la révision lue)
[no-cd]
article-envoyer fichier *drapeaux:
    @node "{{justfile_directory()}}/scripts/article.mjs" envoyer {{fichier}} {{drapeaux}}

# Publier un ou plusieurs articles (ensemble, s'ils se citent)
[no-cd]
article-publier +chemins:
    @node "{{justfile_directory()}}/scripts/article.mjs" publier {{chemins}}

# Repasser un article en brouillon
[no-cd]
article-depublier chemin:
    @node "{{justfile_directory()}}/scripts/article.mjs" depublier {{chemin}}

# Importer un dossier de fichiers .md en un lot, publié (migration des anciens articles)
[no-cd]
article-importer dossier:
    @node "{{justfile_directory()}}/scripts/article.mjs" importer {{dossier}}
