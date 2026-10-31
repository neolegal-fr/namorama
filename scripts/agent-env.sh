#!/usr/bin/env bash
# Environnement d'exécution propre à un worktree, pour que plusieurs agents
# travaillent en parallèle sans se marcher dessus.
#
# Le code est déjà isolé par les worktrees. Ce qui ne l'est pas, c'est ce qu'ils
# partagent à l'exécution :
#   - la base `namorama`, avec DB_SYNCHRONIZE=true : deux branches aux entités
#     différentes y réécrivent le schéma l'une contre l'autre à chaque démarrage
#     — une colonne ajoutée par l'une est supprimée par l'autre, données comprises ;
#   - les ports 3001 (API) et 4200 (front) ;
#   - web/public/assets/config.json, versionné, qui pointe sur :3001.
#
# Un worktree reçoit donc un numéro N (1 à 9) : base `namorama_wN`, API sur
# 3001+N, front sur 4200+N. Le numéro est noté dans `.agent-env` à la racine du
# worktree (ignoré par Git) ; les autres commandes le relisent.
#
# Usage (depuis la racine d'un worktree, via `just`) :
#   agent-env.sh env [N]     prépare le worktree (N libre choisi si absent)
#   agent-env.sh start       lance API + front de CE worktree, en arrière-plan
#   agent-env.sh stop        arrête API + front de CE worktree
#   agent-env.sh status      numéro, ports, processus
#   agent-env.sh clean       arrête, supprime la base, rend config.json à Git
#   agent-env.sh realm       autorise les ports 4201-4209 dans le Keycloak local
#   agent-env.sh stop-port P arrête ce qui écoute sur le port P (et ses enfants)
set -euo pipefail

DB_CONTAINER=namorama-db
DB_ROOT_PASSWORD=root_password      # celui d'infra/docker-compose.yml (dev)
KC_CONTAINER=namorama-auth
MAX_N=9

racine() { git rev-parse --show-toplevel; }

# La copie principale est celle de l'utilisateur : on n'y pose jamais un
# environnement d'agent. Dans un worktree, --git-dir et --git-common-dir diffèrent.
exiger_worktree() {
  local dir common
  dir=$(cd "$(git rev-parse --git-dir)" && pwd)
  common=$(cd "$(git rev-parse --git-common-dir)" && pwd)
  if [[ "$dir" == "$common" ]]; then
    echo "✗ Copie principale : les commandes agent-* ne servent que dans un worktree." >&2
    echo "  Elle garde la base namorama et les ports 3001/4200 (just start / just stop)." >&2
    exit 1
  fi
}

copie_principale() { dirname "$(cd "$(git rev-parse --git-common-dir)" && pwd)"; }

port_occupe() { ss -Hltn "sport = :$1" 2>/dev/null | grep -q .; }

lire_n() {
  local f; f="$(racine)/.agent-env"
  [[ -f "$f" ]] || { echo "✗ Worktree non préparé : lancer d'abord « just agent-env »." >&2; exit 1; }
  # shellcheck disable=SC1090
  source "$f"
  echo "$AGENT_N"
}

# Numéros déjà réservés par les worktrees voisins (qu'ils tournent ou non).
numeros_reserves() {
  local wt
  git worktree list --porcelain | sed -n 's/^worktree //p' | while read -r wt; do
    if [[ -f "$wt/.agent-env" && "$wt" != "$(racine)" ]]; then sed -n 's/^AGENT_N=//p' "$wt/.agent-env"; fi
  done
}

choisir_n() {
  local reserves n
  reserves=$(numeros_reserves | tr '\n' ' ')
  for ((n = 1; n <= MAX_N; n++)); do
    [[ " $reserves " == *" $n "* ]] && continue
    port_occupe $((3001 + n)) && continue
    port_occupe $((4200 + n)) && continue
    echo "$n"; return
  done
  echo "✗ Aucun numéro libre de 1 à $MAX_N (réservés : $reserves)." >&2
  exit 1
}

sql_root() { docker exec -i "$DB_CONTAINER" mariadb -uroot -p"$DB_ROOT_PASSWORD" -e "$1"; }

# Remplace (ou ajoute) VAR=valeur dans un fichier .env.
poser() {
  local fichier=$1 var=$2 val=$3
  if grep -q "^${var}=" "$fichier"; then
    python3 - "$fichier" "$var" "$val" <<'PY'
import sys, re
f, var, val = sys.argv[1:]
txt = open(f).read()
txt = re.sub(rf'^{re.escape(var)}=.*$', lambda m: f'{var}={val}', txt, flags=re.M)
open(f, 'w').write(txt)
PY
  else
    printf '%s=%s\n' "$var" "$val" >> "$fichier"
  fi
}

cmd_env() {
  exiger_worktree
  local r n principal env_src api_port web_port base url_db kc
  r=$(racine)
  principal=$(copie_principale)
  env_src="$principal/api/.env"
  [[ -f "$env_src" ]] || { echo "✗ $env_src introuvable : rien à recopier." >&2; exit 1; }

  if [[ -f "$r/.agent-env" ]]; then
    n=$(lire_n)
    [[ -n "${1:-}" && "$1" != "$n" ]] && { echo "✗ Worktree déjà en N=$n. « just agent-clean » avant d'en changer." >&2; exit 1; }
  elif [[ -n "${1:-}" ]]; then
    n=$1
    [[ "$n" =~ ^[1-9]$ ]] || { echo "✗ N doit valoir 1 à $MAX_N." >&2; exit 1; }
    [[ " $(numeros_reserves | tr '\n' ' ') " == *" $n "* ]] && { echo "✗ N=$n est déjà pris par un autre worktree." >&2; exit 1; }
  else
    n=$(choisir_n)
  fi
  api_port=$((3001 + n)); web_port=$((4200 + n)); base="namorama_w$n"

  # 1. Base dédiée, dans le conteneur MariaDB partagé (même collation qu'init.sql).
  docker ps --format '{{.Names}}' | grep -qx "$DB_CONTAINER" \
    || { echo "✗ Conteneur $DB_CONTAINER arrêté : docker compose -f infra/docker-compose.yml up -d mariadb" >&2; exit 1; }
  sql_root "CREATE DATABASE IF NOT EXISTS \`$base\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
            GRANT ALL ON \`$base\`.* TO 'admin'@'%'; FLUSH PRIVILEGES;"
  # Une base neuve part d'une copie de la base locale `namorama` : schéma et
  # données, pour tester sur autre chose qu'un écran vide. La copie n'est faite
  # qu'une fois — relancer agent-env ne repart pas de zéro.
  local tables
  tables=$(sql_root "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$base'" | tail -1)
  if [[ "$tables" == "0" ]]; then
    echo "… copie de la base namorama vers $base"
    docker exec "$DB_CONTAINER" sh -c \
      "mariadb-dump -uroot -p'$DB_ROOT_PASSWORD' --single-transaction --routines --triggers namorama \
       | mariadb -uroot -p'$DB_ROOT_PASSWORD' '$base'"
  fi

  # 2. api/.env : celui de la copie principale (clés, SMTP…), ports et base remplacés.
  cp "$env_src" "$r/api/.env"
  url_db=$(sed -n 's/^DATABASE_URL=//p' "$r/api/.env")
  url_db="${url_db%/*}/$base"
  poser "$r/api/.env" PORT "$api_port"
  poser "$r/api/.env" DATABASE_URL "$url_db"
  poser "$r/api/.env" FRONTEND_URL "http://localhost:$web_port"
  # La base est à ce seul worktree : la synchroniser sur les entités de la
  # branche ne peut plus écraser le schéma d'un autre. C'est même ce qui fait
  # apparaître les colonnes ajoutées par la branche.
  poser "$r/api/.env" DB_SYNCHRONIZE true
  # La copie principale peut ne pas avoir de .env côté web : on recopie s'il existe.
  [[ -f "$principal/web/.env" ]] && cp "$principal/web/.env" "$r/web/.env"

  # 3. config.json : pointe sur l'API du worktree, et sort du diff.
  kc=$(sed -n 's/^KEYCLOAK_AUTH_SERVER_URL=//p' "$r/api/.env")
  git -C "$r" update-index --no-skip-worktree web/public/assets/config.json 2>/dev/null || true
  printf '{\n  "apiUrl": "http://localhost:%s",\n  "keycloakUrl": "%s"\n}\n' "$api_port" "${kc:-http://localhost:8080}" \
    > "$r/web/public/assets/config.json"
  git -C "$r" update-index --skip-worktree web/public/assets/config.json

  printf 'AGENT_N=%s\nAPI_PORT=%s\nWEB_PORT=%s\nDB_NAME=%s\n' "$n" "$api_port" "$web_port" "$base" > "$r/.agent-env"

  # 4. Dépendances : un worktree neuf n'a pas de node_modules.
  [[ -d "$r/api/node_modules" ]] || (cd "$r/api" && npm install --legacy-peer-deps --no-audit --no-fund)
  [[ -d "$r/web/node_modules" ]] || (cd "$r/web" && npm install --no-audit --no-fund)

  echo "✓ Worktree N=$n : base $base, API http://localhost:$api_port, front http://localhost:$web_port"
  echo "  Base copiée de namorama ; DB_SYNCHRONIZE l'aligne sur les entités de la branche au démarrage."
}

# Lance une commande dans son propre groupe de processus, pour pouvoir l'arrêter
# entière (npm → nest → node) sans toucher à rien d'autre.
lancer() {
  local nom=$1 dossier=$2; shift 2
  local r; r=$(racine)
  mkdir -p "$r/.agent-run"
  (cd "$dossier" && setsid nohup "$@" > "$r/.agent-run/$nom.log" 2>&1 < /dev/null & echo $! > "$r/.agent-run/$nom.pid")
}

cmd_start() {
  exiger_worktree
  local r; r=$(racine); lire_n > /dev/null
  # shellcheck disable=SC1091
  source "$r/.agent-env"
  for p in "$API_PORT" "$WEB_PORT"; do
    port_occupe "$p" && { echo "✗ Port $p déjà occupé (« just agent-status »)." >&2; exit 1; }
  done
  # Les variables d'environnement priment sur api/.env : on les pose aussi ici,
  # au cas où le .env aurait été remplacé à la main.
  lancer api "$r/api" env PORT="$API_PORT" FRONTEND_URL="http://localhost:$WEB_PORT" npm run start:dev
  lancer web "$r/web" npx ng serve --port "$WEB_PORT"
  echo "✓ Lancés : API :$API_PORT, front :$WEB_PORT — journaux dans .agent-run/{api,web}.log"
}

# Tue le groupe de processus d'un PID, puis attend qu'il ait disparu.
arreter_groupe() {
  local pid=$1 pgid
  pgid=$(ps -o pgid= -p "$pid" 2>/dev/null | tr -d ' ') || true
  [[ -z "$pgid" ]] && return 0
  kill -TERM -- "-$pgid" 2>/dev/null || true
  for _ in 1 2 3 4 5 6 7 8 9 10; do kill -0 -- "-$pgid" 2>/dev/null || return 0; sleep 0.5; done
  kill -KILL -- "-$pgid" 2>/dev/null || true
}

# Arrête ce qui écoute sur un port donné, et lui seulement. C'est ce qui
# remplace `pkill -f nest`, qui tuait les serveurs de tous les worktrees.
#
# On tue l'écouteur et ses ancêtres node/npm/sh (le watcher de Nest, le `npm run`
# qui l'a lancé), sans quoi le mode watch peut relancer ce qu'on vient d'arrêter.
# On s'arrête au premier ancêtre d'une autre nature — shell interactif, `just`,
# session d'agent : un groupe de processus entier y mènerait aussi.
cmd_stop_port() {
  local port=$1 pids pid cible comm cibles=()
  # `|| true` : rien n'écoute ⇒ grep sort en 1, ce que pipefail + set -e
  # transformeraient en échec muet de toute la commande.
  pids=$(ss -Hltnp "sport = :$port" 2>/dev/null | grep -oP 'pid=\K[0-9]+' | sort -u || true)
  [[ -z "$pids" ]] && return 0
  for pid in $pids; do
    cible=$pid
    while [[ -n "$cible" && "$cible" -gt 1 ]]; do
      comm=$(ps -o comm= -p "$cible" 2>/dev/null) || break
      [[ "$comm" =~ ^(node|npm.*|sh|ng.*|nest.*)$ ]] || break
      cibles+=("$cible")
      cible=$(ps -o ppid= -p "$cible" 2>/dev/null | tr -d ' ')
    done
  done
  ((${#cibles[@]})) || return 0
  kill -TERM "${cibles[@]}" 2>/dev/null || true
  for _ in 1 2 3 4 5 6 7 8 9 10; do port_occupe "$port" || break; sleep 0.5; done
  port_occupe "$port" && kill -KILL "${cibles[@]}" 2>/dev/null || true
  echo "  port $port libéré"
}

cmd_stop() {
  exiger_worktree
  local r f; r=$(racine)
  for f in "$r"/.agent-run/*.pid; do
    [[ -f "$f" ]] || continue
    arreter_groupe "$(cat "$f")"
    rm -f "$f"
  done
  if [[ -f "$r/.agent-env" ]]; then
    # shellcheck disable=SC1091
    source "$r/.agent-env"
    # Filet : un serveur lancé à la main sur les ports du worktree.
    cmd_stop_port "$API_PORT"; cmd_stop_port "$WEB_PORT"
  fi
  echo "✓ Serveurs du worktree arrêtés"
}

cmd_status() {
  local r wt; r=$(racine)
  echo "Worktrees et leurs environnements :"
  git worktree list --porcelain | sed -n 's/^worktree //p' | while read -r wt; do
    if [[ -f "$wt/.agent-env" ]]; then
      # shellcheck disable=SC1091
      ( source "$wt/.agent-env"
        etat_api=$(port_occupe "$API_PORT" && echo "en marche" || echo "arrêtée")
        etat_web=$(port_occupe "$WEB_PORT" && echo "en marche" || echo "arrêté")
        printf '  N=%s  %-45s API :%s (%s)  front :%s (%s)  base %s\n' \
          "$AGENT_N" "${wt#"$(copie_principale)/"}" "$API_PORT" "$etat_api" "$WEB_PORT" "$etat_web" "$DB_NAME" )
    elif [[ "$wt" == "$(copie_principale)" ]]; then
      printf '  —    %-45s API :3001 (%s)  front :4200 (%s)  base namorama\n' "copie principale" \
        "$(port_occupe 3001 && echo "en marche" || echo "arrêtée")" "$(port_occupe 4200 && echo "en marche" || echo "arrêté")"
    else
      printf '  —    %-45s non préparé (just agent-env)\n' "${wt#"$(copie_principale)/"}"
    fi
  done
}

cmd_clean() {
  exiger_worktree
  local r; r=$(racine)
  [[ -f "$r/.agent-env" ]] || { echo "Rien à nettoyer."; return 0; }
  cmd_stop
  # shellcheck disable=SC1091
  source "$r/.agent-env"
  [[ "$DB_NAME" =~ ^namorama_w[1-9]$ ]] || { echo "✗ Base inattendue « $DB_NAME » : refus de la supprimer." >&2; exit 1; }
  sql_root "DROP DATABASE IF EXISTS \`$DB_NAME\`;"
  git -C "$r" update-index --no-skip-worktree web/public/assets/config.json 2>/dev/null || true
  git -C "$r" checkout -- web/public/assets/config.json
  rm -f "$r/.agent-env" "$r/api/.env"
  rm -rf "$r/.agent-run"
  echo "✓ Base $DB_NAME supprimée, config.json rendu à Git, N=$AGENT_N libéré"
}

# Le realm n'est importé qu'à la création : un Keycloak local déjà initialisé
# ignore les changements de realm-export.json. On ajoute donc les ports des
# worktrees au client namorama-web par l'API d'administration, sans retirer
# ce qui s'y trouve déjà.
cmd_realm() {
  docker ps --format '{{.Names}}' | grep -qx "$KC_CONTAINER" \
    || { echo "✗ Conteneur $KC_CONTAINER arrêté : docker compose -f infra/docker-compose.yml up -d keycloak" >&2; exit 1; }
  local kc="docker exec -i $KC_CONTAINER /opt/keycloak/bin/kcadm.sh"
  $kc config credentials --server http://localhost:8080 --realm master --user admin --password admin > /dev/null
  local id actuel nouveau
  id=$($kc get clients -r namorama -q clientId=namorama-web --fields id --format csv --noquotes)
  actuel=$($kc get "clients/$id" -r namorama --fields redirectUris,webOrigins)
  nouveau=$(python3 - "$actuel" "$MAX_N" <<'PY'
import json, sys
c, max_n = json.loads(sys.argv[1]), int(sys.argv[2])
for n in range(1, max_n + 1):
    u = f"http://localhost:{4200 + n}"
    if u + "/*" not in c["redirectUris"]: c["redirectUris"].append(u + "/*")
    if u not in c["webOrigins"]: c["webOrigins"].append(u)
print(json.dumps(c))
PY
)
  echo "$nouveau" | $kc update "clients/$id" -r namorama -f - > /dev/null
  echo "✓ Client namorama-web : ports 4201 à 420$MAX_N autorisés dans le Keycloak local"
}

case "${1:-}" in
  env)       shift; cmd_env "$@" ;;
  start)     cmd_start ;;
  stop)      cmd_stop ;;
  status)    cmd_status ;;
  clean)     cmd_clean ;;
  realm)     cmd_realm ;;
  stop-port) shift; cmd_stop_port "$1" ;;
  *) sed -n '2,/^set -euo/p' "$0" | sed '$d; s/^# \{0,1\}//'; exit 1 ;;
esac
