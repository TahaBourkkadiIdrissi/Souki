# Déploiement de production Souki

Cette branche sépare les interfaces `client`, `livreur` et `admin`. Chaque image
Next.js contient uniquement les routes et dépendances atteignables de son rôle.
Le fournisseur et le parent restent conservés dans le backend historique, mais
leurs routeurs sont désactivés avec `SOUKI_ENABLE_SUPPLIERS=0`. Les tables ne
sont ni supprimées ni vidées.

## Préparation obligatoire

1. Copier `infra/.env.example` vers `infra/.env.production` et remplacer toutes
   les valeurs d'exemple. Les trois origines HTTPS doivent correspondre aux trois
   noms DNS réels.
2. Déposer un certificat couvrant les trois noms dans
   `infra/certs/fullchain.pem` et `infra/certs/privkey.pem`.
3. Sauvegarder le projet Supabase et vérifier que `DATABASE_URL` cible bien la
   base de production.
4. Renseigner l'adresse, le téléphone et les coordonnées GPS du point Souki.
   Le backend refuse de démarrer en production si ces valeurs manquent.

## Initialisation contrôlée

Le serveur HTTP ne modifie jamais le schéma au démarrage. Après sauvegarde,
exécuter une seule fois :

```sh
docker compose --env-file infra/.env.production build
docker compose --env-file infra/.env.production run --rm backend python scripts/bootstrap.py --apply
docker compose --env-file infra/.env.production run --rm backend python scripts/provision_admin.py --apply --email admin@souki.io
```

Le dernier script demande le mot de passe deux fois sans l'afficher. Il crée un
compte `ADMIN` vérifié avec tous les droits actuels (support, finance, catalogue
et opérations). Il refuse de promouvoir ou d'écraser un compte existant.

Lancer ensuite les services :

```sh
docker compose --env-file infra/.env.production up -d
```

Le service `scheduler` est un processus unique séparé. Le backend et les trois
frontends ne publient aucun port directement ; Nginx est le seul point d'entrée.

## Vérifications avant ouverture

- `https://<client>/health` n'existe pas directement : vérifier
  `https://<client>/backend/health` via Nginx.
- Vérifier qu'un compte admin est refusé sur le login client et qu'un compte
  client est refusé sur les espaces admin et livreur.
- Installer la PWA client puis la PWA livreur sur un appareil de test distinct.
- Vérifier le point de collecte Souki sur la carte livreur.
- Exécuter une précommande avec une quantité métier à zéro : le produit actif
  reste commandable et aucun stock physique n'est décrémenté.
- Contrôler les journaux du backend, du scheduler et de Nginx avant d'ouvrir le DNS.

Le calcul JIT existant est volontairement conservé : la quantité achetée inclut
la marge de sécurité, tandis que le prix reste basé sur la quantité réellement
livrée au client.
