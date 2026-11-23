#!/usr/bin/env bash
# Tire l'image `web` et recrée son conteneur si elle a changé.
#
# Installé sur le serveur de production dans /var/snap/docker/common/namorama/,
# lancé le lundi à 07:30 heure de Paris par la crontab de `nicolas` :
#
#   CRON_TZ=Europe/Paris
#   30 7 * * 1 /var/snap/docker/common/namorama/publier-les-articles.sh
#
# Le lundi matin, le workflow GitHub `publier-les-articles.yml` a reconstruit
# l'image si un article du blog paraît ce jour-là. Sinon l'image est inchangée et
# ce script n'y touche pas. Seule l'image `web` est concernée : l'API attend
# toujours un déploiement manuel, après ses migrations (CLAUDE.md).
#
# Journal : logs/publication-articles.log, une ligne par passage.
# Chantier OpenSpec `publier-les-articles-a-date`.
set -uo pipefail

DOSSIER=/var/snap/docker/common/namorama
JOURNAL="$DOSSIER/logs/publication-articles.log"
cd "$DOSSIER" || exit 1
mkdir -p "$(dirname "$JOURNAL")"

horodatage() { TZ=Europe/Paris date '+%Y-%m-%dT%H:%M:%S%z'; }
court() { echo "${1#sha256:}" | cut -c1-12; }

# L'image que fait tourner le conteneur, et celle que désigne le tag après pull.
reference=$(docker compose config --images 2>/dev/null | grep -- '-web' | head -n1)
conteneur=$(docker compose ps -q web 2>/dev/null | head -n1)
en_service=$([ -n "$conteneur" ] && docker inspect --format '{{.Image}}' "$conteneur" 2>/dev/null)

if ! sortie=$(docker compose pull -q web 2>&1); then
  echo "$(horodatage) ECHEC pull : $sortie" >> "$JOURNAL"
  exit 1
fi
tiree=$(docker image inspect --format '{{.Id}}' "$reference" 2>/dev/null)

if [ -n "$en_service" ] && [ "$en_service" = "$tiree" ]; then
  echo "$(horodatage) image inchangée $(court "$tiree")" >> "$JOURNAL"
  exit 0
fi

if sortie=$(docker compose up -d web 2>&1); then
  echo "$(horodatage) déployée $(court "$en_service") -> $(court "$tiree")" >> "$JOURNAL"
else
  echo "$(horodatage) ECHEC up : $sortie" >> "$JOURNAL"
  exit 1
fi
