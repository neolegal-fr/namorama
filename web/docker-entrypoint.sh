#!/bin/sh
set -e

# Génère assets/config.json à partir des variables d'environnement au démarrage du conteneur
cat > /usr/share/nginx/html/assets/config.json <<EOF
{
  "apiUrl": "${API_URL:-http://localhost:3000}",
  "keycloakUrl": "${KEYCLOAK_URL:-http://localhost:8080}"
}
EOF

exec nginx -g 'daemon off;'
