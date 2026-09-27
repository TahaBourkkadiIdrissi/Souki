# Démarrage local

## Prérequis

- Node.js 22 et pnpm 11.19.0 (version déclarée dans le `package.json` racine).
- Python 3.13 et une base PostgreSQL accessible pour les parcours métier.
- Les secrets restent dans les fichiers locaux exclus de Git.

## Configuration

Depuis la racine du dépôt, copier `back-end/.env.example` vers `back-end/.env` et renseigner les paramètres nécessaires. Pour chaque interface lancée, copier son `apps/<rôle>/.env.example` vers `apps/<rôle>/.env.local`. La variable `BACKEND_INTERNAL_URL` cible l'API locale sur le port 8000.

Installer les dépendances JavaScript :

```sh
pnpm install --frozen-lockfile
```

Créer un environnement Python, l'activer et installer les dépendances du backend depuis `back-end/requirements.lock.txt`. Depuis `back-end/`, démarrer l'API :

```sh
python -m uvicorn main:app --reload --port 8000
```

## Interfaces

Exécuter les commandes nécessaires dans des terminaux distincts, depuis la racine :

| Interface | Commande | URL locale |
| --- | --- | --- |
| Client | `pnpm dev:client` | `http://localhost:3000` |
| Livreur | `pnpm dev:livreur` | `http://localhost:3001` |
| Administration | `pnpm dev:admin` | `http://localhost:3002` |

## Vérifications

```sh
pnpm check:boundaries
pnpm lint
pnpm typecheck
pnpm build
```

Pour les tests Python, exécuter `python scripts/test_local.py` depuis `back-end/`. Ce script fournit des identifiants fictifs et désactive l'initialisation de la base pour les tests unitaires. Voir [le déploiement de production](DEPLOIEMENT_PRODUCTION.md) pour les conteneurs, les certificats et l'initialisation contrôlée.
