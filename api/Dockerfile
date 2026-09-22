# `--omit=optional` : `keycloak-connect` déclare `chromedriver: "latest"` en
# dépendance optionnelle. Rien ici ne pilote de navigateur — c'est un reliquat
# de sa propre suite de tests Selenium — mais npm l'installait, avec son script
# `install` qui télécharge un binaire de navigateur, et toute sa dépendance
# transitive : axios, basic-ftp, extract-zip, form-data, follow-redirects.
# À elle seule, cette branche portait 35 des 50 alertes de sécurité du dépôt,
# dont l'unique critique et le seul paquet sans correctif publié.
FROM node:26-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --legacy-peer-deps --omit=optional
COPY . .
RUN npm run build

FROM node:26-alpine AS production
RUN apk add --no-cache whois
# L'heure de la BASE, et non UTC. MariaDB date elle-même la moitié des colonnes
# (`CURRENT_TIMESTAMP`, `NOW()`) à l'heure de Paris ; l'API datait l'autre
# moitié (`new Date()`, sérialisé dans le fuseau du processus) en UTC. Deux
# horloges dans une même table : 66 comptes sur 79 avaient une dernière activité
# antérieure à leur création, et la fenêtre « 24h » du tableau de bord perdait
# ses deux dernières heures. Node embarque les données de fuseau (ICU) : pas
# besoin de `tzdata`. Voir `HorlogeService`, qui vérifie l'accord au démarrage.
ENV TZ=Europe/Paris
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --omit=optional --legacy-peer-deps
COPY --from=builder /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/main"]
