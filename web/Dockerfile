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

FROM nginx:alpine
COPY --from=builder /app/dist/namorama-web/browser /usr/share/nginx/html
COPY --from=builder /maps /opt/sourcemaps
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh
EXPOSE 80
ENTRYPOINT ["/docker-entrypoint.sh"]
