FROM node:26-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
# Source maps cachées (angular.json, `hidden`) : sorties du dossier servi, pour
# que nginx ne puisse pas publier le code source, mais gardées dans l'image pour
# retraduire une pile remontée par la production (CLAUDE.md, « Erreurs du
# navigateur »). Ce sont toujours celles du code déployé.
RUN mkdir /maps && cd dist/namorama-web/browser && find . -name '*.map' -exec sh -c 'mkdir -p "/maps/$(dirname "$1")" && mv "$1" "/maps/$1"' _ {} \;

# ── Service du blog (image `namorama-blog`) : `docker build --target ssr` ────────
#
# Rend à la demande les pages du blog à partir des articles en base (chantier
# articles-en-base). nginx (image ci-dessous) reste en frontal et ne lui relaie que
# les adresses du blog. Le bundle serveur embarque ses dépendances : pas de
# node_modules. `browser/` voyage avec lui : dictionnaires i18n, gabarit du plan du
# site et liste des fichiers à la racine (URL d'actifs absolues).
FROM node:26-alpine AS ssr
# L'heure de Paris : un article paraît à sa date, à Paris (CLAUDE.md, « Une seule
# horloge »). L'API décide de la parution ; le service s'y aligne pour ses journaux.
ENV TZ=Europe/Paris
ENV NODE_ENV=production
ENV PORT=4000
WORKDIR /app
COPY --from=builder /app/dist/namorama-web ./dist/namorama-web
USER node
EXPOSE 4000
CMD ["node", "dist/namorama-web/server/server.mjs"]

# ── Site (image `namorama-web`) : nginx, cible par défaut ────────────────────────
# Dernière étape : un `docker build` sans `--target` produit, comme avant, l'image
# web servie par nginx.
FROM nginx:alpine AS web
COPY --from=builder /app/dist/namorama-web/browser /usr/share/nginx/html
COPY --from=builder /maps /opt/sourcemaps
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh
EXPOSE 80
ENTRYPOINT ["/docker-entrypoint.sh"]
