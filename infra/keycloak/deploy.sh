#!/usr/bin/env bash
# Déploie le thème Keycloak et redémarre le container si besoin.
# Usage : ./deploy.sh [user@host]
set -euo pipefail

HOST="${1:-nicolas@192.168.1.95}"
REMOTE_DIR="~/namespoter-keycloak"
LOCAL_THEME="$(dirname "$0")/themes"
LOCAL_COMPOSE="$(dirname "$0")/docker-compose.yml"

echo "==> Synchronisation des thèmes vers $HOST:$REMOTE_DIR/themes"
ssh "$HOST" "mkdir -p $REMOTE_DIR/themes"
scp -r "$LOCAL_THEME/namespoter" "$HOST:$REMOTE_DIR/themes/"

echo "==> Copie du docker-compose.yml"
scp "$LOCAL_COMPOSE" "$HOST:$REMOTE_DIR/docker-compose.yml"

echo "==> Rechargement du thème dans le container Keycloak"
ssh "$HOST" "
  # Si le container est géré par docker-compose, on le redémarre proprement
  if [ -f $REMOTE_DIR/.env ]; then
    cd $REMOTE_DIR && docker compose restart keycloak
  else
    # Sinon, simple redémarrage pour recharger le volume
    docker restart keycloak
  fi
"

echo "==> Déploiement terminé"
