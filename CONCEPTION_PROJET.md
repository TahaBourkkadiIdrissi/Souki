# Conception du projet SOUKI

## 1. Objectif général

SOUKI est une application AgriTech marocaine destinée à transformer la chaîne d\'approvisionnement des produits frais.
L\'objectif est de permettre aux clients de commander des légumes frais approvisionnés chez les grossistes à l\'aube, avec une livraison à domicile le matin même.

## 2. Architecture globale

Le projet est organisé en deux grandes parties :

- `back-end/` : l\'API et la logique métier serveur.
- `front-end/` : l\'interface utilisateur Next.js.

Le backend suit une architecture en couches claire pour séparer les responsabilités.

## 3. Structure du backend

### 3.1. Entrée de l\'application

- `back-end/main.py` : point d\'entrée FastAPI.
- `back-end/config.py` : configuration de la base de données et paramètres d\'application.
- `back-end/settings.py` : paramètres et variables d\'environnement.
- `back-end/security.py` : fonctions de sécurité (hashing, gestion JWT, etc.).
- `back-end/dependencies.py` : définition des dépendances FastAPI et injection de services.

### 3.2. Contrôleurs (`controllers/`)

Les contrôleurs exposent les routes HTTP et gèrent les requêtes entrantes.

- `auth_controller.py` : authentification, inscription, login, login Google.
- `catalogue_controller.py` : récupération du catalogue de produits.
- `commande_controller.py` : endpoints de panier texte et vocal.
- `profile_controller.py` : gestion du profil utilisateur et adresses.
- `checkout_controller.py` / `livreur_controller.py` / autres selon besoins métiers.

### 3.3. Services (`services/`)

Les services contiennent la logique métier.

- `auth_service.py` : gestion de l\'authentification, des tokens et de la validation des utilisateurs.
- `catalogue_service.py` : règles métier pour le catalogue et l\'accès produit.
- `commande_service.py` : création et traitement des commandes.
- D\'autres services métiers : panier, checkout, livraison, alertes JIT.

### 3.4. DAO et accès aux données (`dao/`)

Les DAO sont responsables de l\'interaction avec la base de données.

- `user_dao.py` : accès utilisateur.
- `product_dao.py` : accès produits.
- `commande_dao.py` : accès commandes.
- `address_dao.py` : accès adresses.

### 3.5. Entités (`entities/`)

Les entités sont les modèles de données persistés en base, normalement SQLAlchemy.

- `user_entity.py`
- `product_entity.py`
- `address_entity.py`
- `commande_vocale_entity.py`

### 3.6. DTO (`dto/`)

Les DTO gèrent la validation et la sérialisation des entrées/sorties.

- `user_dto.py`
- `address_dto.py`
- `product_dto.py`
- `commande_dto.py`

### 3.7. Interfaces (`interfaces/`)

Les interfaces définissent des contrats abstraits pour les services et DAO.

- `IProductDao`, `ICatalogueService`, `ICommandeVocaleService`, etc.

Elles facilitent le test, le découplage et la substitution d\'implémentations.

## 4. Flux fonctionnel principal

### 4.1. Authentification

- Le client envoie des identifiants à l\'endpoint d\'authentification.
- Le backend vérifie l\'utilisateur via le DAO.
- Un token JWT est généré si l\'authentification réussit.
- Les routes protégées vérifient le token avant d\'autoriser l\'appel.

### 4.2. Catalogue produit

- Le client demande le catalogue.
- Le contrôleur appelle le service catalogue.
- Le service utilise le DAO produit pour récupérer les données.
- Les résultats sont transformés en DTO et renvoyés.

### 4.3. Commandes JIT

- Une commande est créée à partir d\'une requête texte ou vocale.
- Le service commande applique les règles métier et les validations.
- Les DAO persistents enregistrent la commande et ses lignes.
- Des notifications/alertes JIT peuvent être envoyées via un service d\'email.

## 5. Modules spécifiques

### 5.1. Email et notifications

- `back-end/services/email_delivery_service.py` : envoie d\'emails OTP et alertes JIT.
- Utilise SMTP via `smtplib` et `EmailMessage`.
- Vérifie que les variables d\'environnement SMTP sont configurées.

### 5.2. Intelligence artificielle et IA

- `back-end/api/algorithms.py` : logique IA, prompts et appels API.
- `back-end/api/keys.py` : gestion des clés API externes (`GEMINI_API_KEY`, `GOOGLE_CLIENT_ID`).

## 6. Frontend

Le frontend est une application Next.js qui consomme l\'API backend.

- `front-end/app/` : pages et layout.
- `front-end/components/` : composants UI réutilisables.
- `front-end/contexts/` : contextes React pour l\'authentification et l\'état global.
- `front-end/hooks/` : hooks personnalisés (`useAuth`, etc.).
- `front-end/lib/` : fonctions utilitaires pour les appels API.

### 6.1. Authentification côté frontend

- Token stocké dans `localStorage`.
- `AuthProvider` charge le token à l\'initialisation.
- Appel `GET /auth/me` pour valider le token et récupérer les données utilisateur.
- La `Navbar` s\'adapte selon l\'état connecté/déconnecté.

## 7. Principes de conception

- Séparation stricte des responsabilités.
- Architecture en couches (Controllers → Services → DAO → Entités).
- Utilisation d\'interfaces pour le découplage.
- Centralisation de la configuration et des secrets.
- Validation des données via DTO.
- Support des tests et de la maintenabilité.

## 8. Points forts actuels

- Code backend organisé et modulaire.
- Frontend capable de consommer l\'API et gérer l\'authentification.
- Services dédiés pour la logique métier et l\'envoi d\'emails.
- Structure prête pour l\'extension JIT, le catalogue et la gestion des commandes.

## 9. Recommandations

- Ajouter un fichier `Documentation/CONCEPTION_PROJET.md` ou `CONCEPTION_PROJET.md` pour documenter cette architecture à jour.
- Compléter les descriptions des entités et des routes existantes.
- Documenter les variables d\'environnement nécessaires dans `.env`.
- Prévoir des tests unitaires pour les services et DAO.

---

**Version** : conception actuelle du projet SOUKI basée sur l\'architecture présente et les dossiers existants.
