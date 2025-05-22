# DEV-SETUP.md

## Initialisation de l’environnement de développement AFFiNE (selfhost)

### 1. Pré-requis

- Docker et Docker Compose installés
- Node.js (version recommandée par le projet)
- Yarn (gestionnaire de paquets)
- Rust (via rustup, pas via apt)

### 2. Configuration du conteneur de développement

#### a. Configuration .devcontainer

Le dossier `.devcontainer` doit contenir :

```
├── devcontainer.json       # Configuration du conteneur VS Code
└── compose.yml             # Service principal pour le développement
```

Le fichier `devcontainer.json` doit inclure :

```json
{
  "name": "AFFiNE (Dev Container)",
  "dockerComposeFile": ["../.docker/dev/compose.yml.example"],
  "service": "affine",
  "workspaceFolder": "/workspaces/AFFiNE",
  "features": {
    "ghcr.io/devcontainers/features/node:1": {
      "version": "lts"
    },
    "ghcr.io/devcontainers/features/rust:1": {}
  },
  "customizations": {
    "vscode": {
      "extensions": ["ms-azuretools.vscode-docker", "rust-lang.rust-analyzer", "esbenp.prettier-vscode", "dbaeumer.vscode-eslint"]
    }
  },
  "postCreateCommand": "npm install -g yarn && yarn install",
  "remoteUser": "root"
}
```

#### b. Configuration Docker

Le fichier `.docker/dev/compose.yml.example` doit inclure :

- PostgreSQL avec l'extension pgvector : `pgvector/pgvector:pg16`
- Redis
- Manticore Search : `manticoresearch/manticore:9.2.14`
- Un service `affine` pour le développement

### 3. Préparation du backend natif (Rust/Cargo)

Installer rustup et la version requise :

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
rustup install 1.86.0
rustup default 1.86.0
```

#### a. Compilation du module natif

```bash
yarn install
yarn affine @affine/server-native build
```

### 4. Configuration de l'environnement

#### a. Configuration des variables d'environnement

Dans le fichier `/workspaces/AFFiNE/packages/backend/server/.env` :

```properties
DATABASE_URL="postgres://affine:affine@postgres:5432/affine"
REDIS_SERVER_HOST=redis

# Manticore search settings
AFFINE_INDEXER_SEARCH_ENDPOINT=http://manticoresearch:9308
AFFINE_INDEXER_SEARCH_PROVIDER=manticoresearch

# Les variables COPILOT_* sont désactivées (pas d'IA en local)
# Les variables MAILER_* sont désactivées (pas d'envoi de mail)
```

Le fichier `.docker/dev/.env` contient les variables pour Docker Compose :

```properties
# PostgreSQL major version
DB_VERSION=16
# Database credentials
DB_PASSWORD=affine
DB_USERNAME=affine
DB_DATABASE_NAME=affine

# Manticore Search version
MANTICORE_VERSION=9.2.14

# Port for the dev container
PORT=3010
```

### 5. Initialisation de la base de données

Lancer la migration Prisma :

```bash
yarn affine server init
```

Entrer un nom de migration, par exemple : `init`

Si erreur `extension "vector" is not available` avec l'image PostgreSQL standard :

- Vérifier que l’image PostgreSQL utilisée inclut bien pgvector.
- Sinon, installer l’extension dans le conteneur PostgreSQL :

```bash
# Dans le conteneur postgres
apt-get update && apt-get install postgresql-16-pgvector
# Puis dans psql
CREATE EXTENSION IF NOT EXISTS vector;
```

### 6. Lancement de l'application

```bash
yarn affine server dev
```

---

## Notes importantes

- Pour toute modification de la config, adapter les fichiers `.env` selon l'environnement.
- Les services Docker doivent communiquer via leurs noms de services (`postgres`, `redis`, `manticoresearch`).
- À l'extérieur des conteneurs, utiliser `localhost` avec les ports exposés.
- Pour les tests natifs, vérifier que le module Rust compile bien et que les fonctionnalités sont accessibles côté Node.js/TypeScript.
- Pour l'IA ou l'envoi de mail, décommenter et renseigner les variables nécessaires dans `.env`.

## Résolution des problèmes courants

### Erreur de connexion à PostgreSQL

Vérifier la configuration dans `.env` :

- Pour le développement dans Docker : `DATABASE_URL="postgres://affine:affine@postgres:5432/affine"`
- Pour accès depuis l'hôte : `DATABASE_URL="postgres://affine:affine@localhost:5432/affine"`

### Erreur de connexion à Manticore Search

Vérifier la configuration dans `.env` :

- Pour le développement dans Docker : `AFFINE_INDEXER_SEARCH_ENDPOINT=http://manticoresearch:9308`
- Pour accès depuis l'hôte : `AFFINE_INDEXER_SEARCH_ENDPOINT=http://localhost:9308`
