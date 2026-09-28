# Descriptions des produits

Dans le dashboard admin, ouvrir Produits / Pricing, puis Modifier sur le produit.
Le champ Description du produit est enregistré avec le bouton Sauvegarder.
Il est aussi disponible lors de la création. Un champ vide rétablit la description
par défaut existante du client. Limite : 5 000 caractères.

La fiche PWA de l'Accueil et celle ouverte depuis les cartes Produits utilisent
le même composant `ProductDetailSheet` et la description du catalogue API.

La fiche web `/produit/[slug]` utilise aussi la description enregistrée dans
l'admin, ainsi que ses métadonnées et ses données structurées Product. Le texte
par défaut est conservé si la description est absente. Le catalogue serveur est
chargé sans cache persistant : une nouvelle visite ou un rechargement affiche
la description mise à jour, sans reconstruction du site.

## Déploiement

Avant de démarrer le nouveau backend en production, appliquer à la base PostgreSQL
le script idempotent `back-end/sql/migration_product_description.sql`.
Cette étape est nécessaire lorsque `SOUKI_SKIP_DB_INIT` est activé (valeur par
défaut en production). Sinon, la synchronisation de schéma existante au démarrage
ajoute automatiquement la colonne.

Puis, depuis `/opt/souki`, reconstruire les applications modifiées :

```bash
sudo docker compose --env-file infra/.env up -d --build backend client admin
```

## Vérification locale

- Tests backend : `python -m unittest discover -s tests -p test_product_description.py`
  depuis `back-end`, avec les dépendances et l'environnement de test habituels.
- Test navigateur : `node tools/product-detail-runtime-check.mjs` depuis la racine.
  Utilise une API fictive en mémoire et les ports 3410, 3411, 3419. Edge est utilisé
  par défaut ; `SOUKI_TEST_BROWSER` permet de sélectionner un autre canal Playwright.
