# Namespoter 🚀

Namespoter vous aide à trouver le nom de domaine idéal pour votre prochain produit en utilisant la puissance de l'IA et une vérification Whois en temps réel.

## 🛠 Stack
- **Web**: Angular 21 + PrimeNG 21 + PrimeFlex 4 — système de design : `docs/systeme-de-design.md`
- **API**: NestJS + TypeORM + PostgreSQL
- **Auth**: Keycloak (SSO)
- **IA**: OpenAI GPT-3.5

## 🚀 Démarrage Rapide

### Pré-requis
- Docker & Docker Compose
- Just (recommandé pour les commandes)
- Une clé API OpenAI

### Installation
1. Configurez votre environnement :
   ```bash
   cp api/.env.example api/.env # Et renseignez votre OPENAI_API_KEY
   ```
2. Lancez l'infrastructure et les serveurs de développement :
   ```bash
   just start
   ```

### Commandes Just utiles
- `just start` : Démarre Docker, l'API et le Web.
- `just stop` : Arrête tout proprement.
- `just build` : Compile le projet (API + Web).
- `just clean` : Nettoie les node_modules et les volumes Docker.

## 🔑 Keycloak
Le Realm `namorama` est pré-configuré.
- Console Admin : `http://localhost:8080` (admin/admin)
- L'auto-inscription est activée.

## 📄 Licence
Propriété de NeoLegal.