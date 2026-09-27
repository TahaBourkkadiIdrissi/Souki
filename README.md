# Souki

Souki regroupe trois applications Next.js et une API FastAPI :

| Application | Dossier | Développement local |
| --- | --- | --- |
| Client (`souki.io`) | `apps/client` | `pnpm dev:client` — port 3000 |
| Livreur | `apps/livreur` | `pnpm dev:livreur` — port 3001 |
| Administration | `apps/admin` | `pnpm dev:admin` — port 3002 |
| API | `back-end` | voir le guide de développement |

Le gestionnaire JavaScript du dépôt est **pnpm 11.19.0** avec Node.js 22. Les images de production sont définies dans `docker-compose.yml` ; les trois applications disposent chacune de leur Dockerfile.

## Démarrage

1. Configurer `back-end/.env` depuis `back-end/.env.example`, puis les fichiers `.env.local` des applications nécessaires depuis leurs `.env.example`. Ne pas versionner les secrets.
2. Installer les dépendances à la racine : `pnpm install --frozen-lockfile`.
3. Démarrer l'API selon [le guide de développement](Documentation/QUICKSTART.md), puis les applications utiles avec les commandes du tableau.

## Vérifications

```sh
pnpm check:boundaries
pnpm lint
pnpm typecheck
pnpm build
```

Les tests Python et le déploiement sont décrits dans [la documentation](Documentation/README.md). Les scripts de génération des logos utilisent les originaux de `assets/branding/source` ; leurs rapports et captures sont des résultats locaux régénérables.
