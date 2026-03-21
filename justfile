# Justfile pour Namorama

# Démarrer l'infrastructure et les serveurs de développement
start:
    docker-compose -f infra/docker-compose.yml up -d
    @echo "Attente du démarrage des bases de données..."
    sleep 5
    (cd api && npm run start:dev) & (cd web && npm start)

# Arrêter tous les services (Docker et processus Node)
stop:
    docker-compose -f infra/docker-compose.yml stop
    @bash -c 'trap "" TERM; pkill -f "nest" 2>/dev/null; pkill -f "ng serve" 2>/dev/null; exit 0'

# Redémarrer l'écosystème
restart: stop start

# Compiler les applications pour la production
build:
    @echo "Compilation de l'API (NestJS)..."
    cd api && npm run build
    @echo "Compilation du Web (Angular)..."
    cd web && npm run build

# Installer les dépendances Node (legacy-peer-deps requis pour nest-keycloak-connect)
install:
    cd api && npm install --legacy-peer-deps
    cd web && npm install

# Nettoyer les dépendances, les builds et les volumes Docker
clean:
    docker-compose -f infra/docker-compose.yml down -v
    rm -rf api/node_modules api/dist web/node_modules web/dist web/.angular
    @echo "Nettoyage terminé."
