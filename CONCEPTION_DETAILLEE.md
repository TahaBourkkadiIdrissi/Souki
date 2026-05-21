# Conception détaillée du projet SOUKI

## 1. Objectif

Ce document décrit la conception actuelle du projet SOUKI, fichier par fichier, pour expliquer le rôle de chaque composant backend et frontend.

## 2. Architecture générale

Le projet est structuré en deux parties principales :

- `back-end/` : API FastAPI, logique métier, accès à la base, entités et services.
- `front-end/` : application Next.js, UI, gestion d'état et appels aux endpoints backend.

## 3. Backend

### 3.1. Fichiers racine du backend

- `back-end/main.py` : point d'entrée FastAPI, configuration CORS, démarrage des services, inclusion des routeurs et gestion du cycle de vie.
- `back-end/config.py` : configuration SQLAlchemy, connexion PostgreSQL, création du `engine`, `LocalSession`, déclaration de `Base`, et constantes de sécurité JWT.
- `back-end/settings.py` : chargement des variables d'environnement spécifiques à l'API externe Gemini et signalement en cas de clé manquante.
- `back-end/env_loader.py` : chargement des variables d'environnement du projet depuis le fichier `.env`.
- `back-end/auth_dependencies.py` : fonctions de dépendance pour l'authentification et l'autorisation des routes FastAPI.
- `back-end/dependencies.py` : injection de dépendances FastAPI pour les DAO et services.
- `back-end/rbac_config.py` : configuration RBAC des rôles et permissions.
- `back-end/test_api.http` : collection de requêtes HTTP pour tester l'API manuellement.

### 3.2. Module API

- `back-end/api/__init__.py` : module d'initialisation du package API.
- `back-end/api/keys.py` : gestion centralisée des clés API externes (Gemini, Google, etc.).
- `back-end/api/algorithms.py` : fonctions d'algorithme métier liées à l'IA ou aux prompts.

### 3.3. Contrôleurs (`back-end/controllers`)

Les contrôleurs exposent les endpoints REST et orchestrent les services.

- `back-end/controllers/auth_controller.py` : endpoints d'authentification, login, registre, Google login, OTP et `/me`.
- `back-end/controllers/profile_controller.py` : endpoints de gestion de profil utilisateur et adresses.
- `back-end/controllers/settings_controller.py` : endpoints de configuration ou récupération de paramètres applicatifs.
- `back-end/controllers/catalogue_controller.py` : endpoints de consultation du catalogue de produits.
- `back-end/controllers/commande_controller.py` : endpoints de commande vocale / texte et gestion du panier de commande.
- `back-end/controllers/panier_controller.py` : opérations sur le panier et lignes de panier.
- `back-end/controllers/checkout_controller.py` : parcours de paiement et validation de commande.
- `back-end/controllers/claim_controller.py` : gestion des réclamations ou anomalies.
- `back-end/controllers/dispatch_controller.py` : routage, tournées, anomalies de livraison et opérations de dispatch.
- `back-end/controllers/fournisseur_controller.py` : endpoints fournisseurs et administration fournisseur.
- `back-end/controllers/jit_controller.py` : endpoints JIT (just-in-time) pour agrégation, alertes et déverrouillage.
- `back-end/controllers/livreur_controller.py` : endpoints dédiés aux livreurs.
- `back-end/controllers/produit_pricing_controller.py` : tarification produit et gestion des prix.
- `back-end/controllers/admin_controller.py` : endpoints d'administration et API admin protégée.

### 3.4. Services (`back-end/services`)

Les services contiennent la logique métier et les règles métier.

- `back-end/services/auth_service.py` : logique d'authentification, vérification OTP, création de tokens, connexion et inscription.
- `back-end/services/catalogue_service.py` : logique métier pour récupérer et filtrer le catalogue de produits.
- `back-end/services/catalogue_bootstrap_service.py` : initialisation du catalogue en base au démarrage.
- `back-end/services/commande_service.py` : traitement des commandes, création de commandes, validation et statuts.
- `back-end/services/commande_state_machine.py` : machine à états pour gérer les transitions de statut de commande.
- `back-end/services/checkout_service.py` : parcours de paiement, validation de checkout et mise à jour des statuts.
- `back-end/services/claim_service.py` : traitement des réclamations et anomalies client.
- `back-end/services/client_admin_service.py` : logique métier des clients administrateurs.
- `back-end/services/client_blacklist_service.py` : logique de gestion de blacklist des clients.
- `back-end/services/cod_confirmation_service.py` : validation et journalisation des paiements à la livraison.
- `back-end/services/dashboard_service.py` : récupération et calcul des KPI et tableaux de bord.
- `back-end/services/dispatch_service.py` : logique de dispatch, création et optimisation de tournées.
- `back-end/services/jit_service.py` : calcul de listes d'achats JIT et alertes métier.
- `back-end/services/livreur_service.py` : logiques spécifiques aux livreurs et affectation.
- `back-end/services/fournisseur_service.py` : gestion des fournisseurs et de leurs produits.
- `back-end/services/produit_pricing_service.py` : tarification B2B et règles de prix.
- `back-end/services/panier_service.py` : gestion du panier, agrégation des lignes et calculs des totaux.
- `back-end/services/notification_outbox_service.py` : orchestration de l'envoi de notifications et gestion de la file d'attente.
- `back-end/services/souki_wallet_service.py` : logique du wallet interne Souki.
- `back-end/services/supabase_storage_service.py` : intégration Supabase pour stockage d'avatars ou médias.
- `back-end/services/delivery_outbox_worker.py` : worker asynchrone pour envoyer les notifications de livraison.
- `back-end/services/dispatch_schema_sync_service.py` : synchronisation du schéma de dispatch et migration.
- `back-end/services/delivery_schema_sync_service.py` : synchronisation du schéma de livraison.
- `back-end/services/supplier_schema_sync_service.py` : synchronisation du schéma fournisseur.
- `back-end/services/wallet_schema_sync_service.py` : synchronisation du schéma wallet.
- `back-end/services/rbac_bootstrap_service.py` : bootstrap des rôles et permissions RBAC en base.
- `back-end/services/scheduler_service.py` : démarrage et arrêt du scheduler de tâches périodiques.
- `back-end/services/settings_service.py` : service de lecture et mise à jour des paramètres applicatifs.
- `back-end/services/user_session_service.py` : gestion des sessions utilisateurs et du registre des jetons.
- `back-end/services/email_delivery_service.py` : envoi d'e-mails OTP et alertes JIT via SMTP.
- `back-end/services/date_utils.py` : utilitaires de manipulation de dates et formatage.

### 3.5. DAO (`back-end/dao`)

Les DAO sont responsables de la persistance et de l'accès aux entités.

- `back-end/dao/user_dao.py` : accès aux utilisateurs.
- `back-end/dao/address_dao.py` : accès aux adresses clients.
- `back-end/dao/product_dao.py` : accès aux produits.
- `back-end/dao/produit_pricing_dao.py` : accès aux données de tarification produit.
- `back-end/dao/panier_dao.py` : accès aux paniers et lignes de panier.
- `back-end/dao/commande_dao.py` : accès aux commandes et commandes vocales.
- `back-end/dao/checkout_dao.py` : accès aux données de checkout.
- `back-end/dao/claim_dao.py` : accès aux réclamations.
- `back-end/dao/client_admin_dao.py` : accès aux clients administrateurs.
- `back-end/dao/client_blacklist_dao.py` : accès à la blacklist client.
- `back-end/dao/cod_confirmation_log_dao.py` : accès aux logs de confirmation COD.
- `back-end/dao/notification_outbox_dao.py` : accès à la file d'attente des notifications.
- `back-end/dao/fournisseur_dao.py` : accès aux fournisseurs.
- `back-end/dao/livreur_dao.py` : accès aux livreurs.
- `back-end/dao/jit_dao.py` : accès aux données JIT.
- `back-end/dao/tournee_dao.py` : accès aux tournées de livraison.
- `back-end/dao/souki_wallet_dao.py` : accès aux portefeuilles internes.
- `back-end/dao/dashboard_dao.py` : accès aux données de dashboard.
- `back-end/dao/authorization_dao.py` : accès aux autorisations.

### 3.6. Interfaces (`back-end/interfaces`)

Les interfaces définissent les contrats des DAO et services.

- `back-end/interfaces/user_dao_interface.py` : contrat DAO utilisateur.
- `back-end/interfaces/address_dao_interface.py` : contrat DAO adresse.
- `back-end/interfaces/product_dao_interface.py` : contrat DAO produit.
- `back-end/interfaces/produit_pricing_dao_interface.py` : contrat DAO tarification.
- `back-end/interfaces/panier_dao_interface.py` : contrat DAO panier.
- `back-end/interfaces/commande_dao_interface.py` : contrat DAO commande.
- `back-end/interfaces/checkout_dao_interface.py` : contrat DAO checkout.
- `back-end/interfaces/claim_dao_interface.py` : contrat DAO réclamation.
- `back-end/interfaces/client_admin_dao_interface.py` : contrat DAO client administrateur.
- `back-end/interfaces/client_blacklist_dao_interface.py` : contrat DAO blacklist.
- `back-end/interfaces/cod_confirmation_log_dao_interface.py` : contrat DAO COD log.
- `back-end/interfaces/notification_outbox_dao_interface.py` : contrat DAO notifications.
- `back-end/interfaces/fournisseur_dao_interface.py` : contrat DAO fournisseur.
- `back-end/interfaces/livreur_dao_interface.py` : contrat DAO livreur.
- `back-end/interfaces/jit_dao_interface.py` : contrat DAO JIT.
- `back-end/interfaces/tournee_dao_interface.py` : contrat DAO tournée.
- `back-end/interfaces/souki_wallet_dao_interface.py` : contrat DAO wallet.
- `back-end/interfaces/dashboard_dao_interface.py` : contrat DAO dashboard.
- `back-end/interfaces/authorization_dao_interface.py` : contrat DAO autorisations.
- `back-end/interfaces/catalogue_service_interface.py` : contrat service catalogue.
- `back-end/interfaces/commande_service_interface.py` : contrat service commande.
- `back-end/interfaces/checkout_service_interface.py` : contrat service checkout.
- `back-end/interfaces/claim_service_interface.py` : contrat service réclamation.
- `back-end/interfaces/client_admin_service_interface.py` : contrat service client admin.
- `back-end/interfaces/client_blacklist_service_interface.py` : contrat service blacklist.
- `back-end/interfaces/cod_confirmation_service_interface.py` : contrat service COD.
- `back-end/interfaces/notification_outbox_service_interface.py` : contrat service notifications.
- `back-end/interfaces/fournisseur_service_interface.py` : contrat service fournisseur.
- `back-end/interfaces/livreur_service_interface.py` : contrat service livreur.
- `back-end/interfaces/jit_service_interface.py` : contrat service JIT.
- `back-end/interfaces/dashboard_service_interface.py` : contrat service dashboard.
- `back-end/interfaces/souki_wallet_service_interface.py` : contrat service wallet.
- `back-end/interfaces/produit_pricing_service_interface.py` : contrat service tarification.
- `back-end/interfaces/panier_service_interface.py` : contrat service panier.
- `back-end/interfaces/dispatch_service_interface.py` : contrat service dispatch.
- `back-end/interfaces/checkout_service_interface.py` : contrat service checkout.
- `back-end/interfaces/authorization_service_interface.py` : contrat service autorisation.

### 3.7. DTO (`back-end/dto`)

Les DTO définissent les schémas d'échange et la validation des requêtes/api.

- `back-end/dto/user_dto.py` : schémas utilisateurs, login, enregistrement, réponses de session.
- `back-end/dto/address_dto.py` : schémas d'adresse.
- `back-end/dto/product_dto.py` : schémas produit.
- `back-end/dto/produit_pricing_dto.py` : schémas de tarification.
- `back-end/dto/panier_dto.py` : schémas panier.
- `back-end/dto/commande_dto.py` : schémas commande.
- `back-end/dto/checkout_dto.py` : schémas checkout.
- `back-end/dto/claim_dto.py` : schémas réclamation.
- `back-end/dto/client_admin_dto.py` : schémas client admin.
- `back-end/dto/client_blacklist_dto.py` : schémas blacklist.
- `back-end/dto/cod_confirmation_dto.py` : schémas confirmation COD.
- `back-end/dto/dashboard_dto.py` : schémas dashboard.
- `back-end/dto/jit_dto.py` : schémas JIT.
- `back-end/dto/livreur_dto.py` : schémas livreur.
- `back-end/dto/supplier_dto.py` : schémas fournisseur.
- `back-end/dto/settings_dto.py` : schémas paramètres.

### 3.8. Entités (`back-end/entities`)

Les entités représentent les tables de la base.

- `back-end/entities/user_entity.py` : table utilisateurs.
- `back-end/entities/role_entity.py` : table des rôles.
- `back-end/entities/permission_entity.py` : table des permissions.
- `back-end/entities/role_permission_entity.py` : table jointe rôle-permission.
- `back-end/entities/user_role_entity.py` : table jointe utilisateur-rôle.
- `back-end/entities/address_entity.py` : table adresses.
- `back-end/entities/client_entity.py` : table clients.
- `back-end/entities/client_blacklist_log_entity.py` : historique blacklist.
- `back-end/entities/claim_entity.py` : table réclamations.
- `back-end/entities/commande_entity.py` : commandes.
- `back-end/entities/commande_vocale_entity.py` : commandes vocales.
- `back-end/entities/panier_entity.py` : panier.
- `back-end/entities/ligne_panier_entity.py` : lignes de panier.
- `back-end/entities/produit_b2b_entity.py` : produits B2B.
- `back-end/entities/product_entity.py` : produits.
- `back-end/entities/fournisseur_entity.py` : fournisseurs.
- `back-end/entities/livreur_entity.py` : livreurs.
- `back-end/entities/jit_log_entity.py` : logs JIT.
- `back-end/entities/delivery_event_entity.py` : événements de livraison.
- `back-end/entities/transaction_wallet_entity.py` : transactions wallet.
- `back-end/entities/souki_wallet_entity.py` : wallet Souki.
- `back-end/entities/wallet_entity.py` : entités wallet.
- `back-end/entities/user_session_entity.py` : sessions utilisateur.
- `back-end/entities/cod_confirmation_log_entity.py` : log COD.
- `back-end/entities/verification_code_entity.py` : codes OTP / vérification.
- `back-end/entities/abonnement_entity.py` : abonnements.
- `back-end/entities/anomalie_entity.py` : anomalies.
- `back-end/entities/parent_entity.py` : entité parent (structure hiérarchique).
- `back-end/entities/user_notification_preferences_entity.py` : préférences notification utilisateur.
- `back-end/entities/tournee_entity.py` : tournées de livraison.
- `back-end/entities/__init__.py` : import central des entités.

### 3.9. Schémas SQL et migrations (`back-end/sql`)

- `2026-04-20_add_address_coordinates.sql` : ajout des coordonnées d'adresse.
- `2026-04-21_add_rbac_authz.sql` : ajout des tables RBAC et autorisations.
- `2026-04-25_add_avatar_storage.sql` : ajout du stockage d'avatar.
- `2026-05-01_supabase_full_schema.sql` : script de schéma Supabase complet.
- `2026-05-12_add_fournisseurs.sql` : ajout des fournisseurs.
- `migration_produit_pricing.sql` : migration de tarification produit.

### 3.10. Autres dossiers backend

- `back-end/models/` : package réservé aux modèles métier, actuellement vide ou module d'initialisation.
- `back-end/schemas/` : structure de schémas de validation JSON/Pydantic, aujourd'hui uniquement `claim_schema.py`.

## 4. Frontend

### 4.1. Fichiers racine du frontend

- `front-end/package.json` : dépendances frontend et scripts de développement/build.
- `front-end/pnpm-lock.yaml` / `front-end/package-lock.json` : verrouillage des dépendances.
- `front-end/tsconfig.json` : configuration TypeScript.
- `front-end/next.config.mjs` : configuration Next.js.
- `front-end/postcss.config.mjs` : configuration PostCSS.
- `front-end/next-env.d.ts` : types globales Next.js.

### 4.2. Application Next.js (`front-end/app`)

- `front-end/app/layout.tsx` : layout racine, injection de `AuthProvider`, `ThemeProvider`, et styles globaux.
- `front-end/app/page.tsx` : page d'accueil principale.
- `front-end/app/catalogue/page.tsx` : page catalogue de produits.
- `front-end/app/checkout/page.tsx` : page de checkout / paiement.
- `front-end/app/parametres/page.tsx` : page de paramètres utilisateur ou application.
- `front-end/app/parent/page.tsx` : page dédiée aux parents (cas d'utilisation spécifique).
- `front-end/app/livreur/page.tsx` : interface livreur.
- `front-end/app/verify/page.tsx` : page de vérification OTP ou email.
- `front-end/app/login/page.tsx` : page de login générique.
- `front-end/app/login/client/page.tsx` : page login client.
- `front-end/app/login/livreur/page.tsx` : page login livreur.
- `front-end/app/login/parent/page.tsx` : page login parent.
- `front-end/app/admin/page.tsx` : page d'administration générale.
- `front-end/app/admin/layout.tsx` : layout spécifique à l'espace admin.
- `front-end/app/admin/clients/page.tsx` : interface de gestion des clients.
- `front-end/app/admin/blacklist/page.tsx` : interface de gestion de la blacklist.
- `front-end/app/admin/orders/page.tsx` : page de gestion des commandes.
- `front-end/app/admin/orders/admin-orders-shell.tsx` : wrapper/structure pour commandes admin.
- `front-end/app/admin/orders/admin-orders-client.tsx` : interface client liée aux commandes admin.
- `front-end/app/admin/livreur/page.tsx` : interface des livreurs en admin.
- `front-end/app/admin/pricing/page.tsx` : page de gestion de tarification.
- `front-end/app/admin/produits/page.tsx` : page de gestion des produits.
- `front-end/app/backend/[...path]/route.ts` : route API interne pour le frontend, probablement proxy ou intégration de backend.

### 4.3. Composants (`front-end/components`)

#### 4.3.1. Composants UI réutilisables (`components/ui`)

Ces composants sont une librairie de primitives d'interface :

- `accordion.tsx`, `alert.tsx`, `alert-dialog.tsx`, `aspect-ratio.tsx`, `avatar.tsx`, `badge.tsx`, `breadcrumb.tsx`, `button.tsx`, `button-group.tsx`, `calendar.tsx`, `card.tsx`, `carousel.tsx`, `chart.tsx`, `checkbox.tsx`, `collapsible.tsx`, `command.tsx`, `context-menu.tsx`, `dialog.tsx`, `drawer.tsx`, `dropdown-menu.tsx`, `empty.tsx`, `field.tsx`, `form.tsx`, `hover-card.tsx`, `input.tsx`, `input-otp.tsx`, `input-group.tsx`, `item.tsx`, `kbd.tsx`, `label.tsx`, `menubar.tsx`, `navigation-menu.tsx`, `pagination.tsx`, `popover.tsx`, `progress.tsx`, `radio-group.tsx`, `resizable.tsx`, `scroll-area.tsx`, `select.tsx`, `separator.tsx`, `sheet.tsx`, `sidebar.tsx`, `skeleton.tsx`, `slider.tsx`, `sonner.tsx`, `spinner.tsx`, `switch.tsx`, `table.tsx`, `tabs.tsx`, `textarea.tsx`, `toast.tsx`, `toaster.tsx`, `toggle.tsx`, `toggle-group.tsx`, `tooltip.tsx`, `use-mobile.tsx`, `use-toast.tsx`.

Ces fichiers fournissent les éléments de base de l'UI et gèrent souvent l'accessibilité, le design ou les interactions communes.

#### 4.3.2. Composants d'authentification (`components/auth`)

- `front-end/components/auth/google-login-button.tsx` : bouton de connexion Google utilisé sur les écrans de login.

#### 4.3.3. Composants métier SOUKI (`components/souki`)

- `front-end/components/souki/navbar.tsx` : barre de navigation principale, affichage du menu, actions de connexion/déconnexion.
- `front-end/components/souki/profile-dropdown.tsx` : menu utilisateur et actions de profil.
- `front-end/components/souki/product-card.tsx` : carte produit pour l'affichage du catalogue.
- `front-end/components/souki/delivery-card.tsx` : affichage des informations de livraison.
- `front-end/components/souki/wallet-card.tsx` : carte pour le wallet Souki.
- `front-end/components/souki/kpi-card.tsx` : affichage d'indicateurs clés.
- `front-end/components/souki/order-timeline.tsx` : timeline de commande / suivi.
- `front-end/components/souki/mapbox-locator.tsx` : géolocalisation et carte Mapbox.
- `front-end/components/souki/otp-verification-form.tsx` : formulaire OTP.
- `front-end/components/souki/password-strength.tsx` : indicateur de robustesse de mot de passe.
- `front-end/components/souki/status-badge.tsx` : badge de statut métier.
- `front-end/components/souki/ai-modals.tsx` : modales liées à l'IA ou prompts.

#### 4.3.4. Composants admin (`components/admin`)

- `front-end/components/admin/client-fiche-panel.tsx` : fiche de détail client pour l'interface admin.

### 4.4. Contexte et hooks

- `front-end/contexts/auth-context.tsx` : gestion de l'état d'authentification, validation du token, login/logout, stockage local du token et rôle.
- `front-end/hooks/useAuth.ts` : hook pour consommer le contexte auth depuis les composants.
- `front-end/hooks/useApi.ts` : hook pour les appels API et la consommation de données.
- `front-end/hooks/useProfile.ts` : gestion et lecture du profil utilisateur.
- `front-end/hooks/useWallet.ts` : gestion du wallet et de l'état associé.
- `front-end/hooks/useNotifications.ts` : notifications client.
- `front-end/hooks/useOrderLock.ts` : verrouillage des commandes pour éviter les actions concurrentes.
- `front-end/hooks/useSecurity.ts` : utilitaires de sécurité côté client.
- `front-end/hooks/use-mobile.ts` : détection du mode mobile.
- `front-end/hooks/use-toast.ts` : notifications toast.

### 4.5. Bibliothèques frontend (`front-end/lib`)

- `front-end/lib/api.ts` : wrapper d'appel HTTP vers le backend, gestion de l'URL API, erreurs, et typages des réponses.
- `front-end/lib/catalogue.ts` : fonctions utilitaires spécifiques au catalogue.
- `front-end/lib/delivery-sync-queue.ts` : synchronisation des livraisons locales ou files d'attente côté frontend.
- `front-end/lib/utils.ts` : utilitaires génériques JS/TS réutilisables.

### 4.6. Theming et styles

- `front-end/components/theme-provider.tsx` : gestion du thème clair/sombre et du support système.
- `front-end/app/globals.css` : styles globaux de l'application.
- `front-end/styles/` : styles additionnels ou modules CSS (présence probable selon structure).

## 5. Flux principal

### 5.1. Backend

- `main.py` démarre FastAPI et crée la base si besoin.
- Les services de synchronisation (`SchemaSyncService`) ajustent la base en fonction du schéma.
- Le bootstrap RBAC et catalogue charge les rôles, permissions et produits initiaux.
- Chaque route controller appelle un service dédié, qui utilise des DAO pour accéder à la base via SQLAlchemy.

### 5.2. Frontend

- `layout.tsx` injecte le contexte d'authentification et le thème autour de toutes les pages.
- Le token est stocké en `localStorage` et validé via `GET /auth/me`.
- Les pages `login`, `admin`, `catalogue`, `checkout`, `livreur`, `parametres` utilisent des composants métier et des hooks pour afficher les données du backend.
- Les composants UI fournissent une bibliothèque interne réutilisable pour l'ensemble de l'interface.

## 6. Points clés de conception

- Séparation nette entre routes, services métier, accès aux données et entités.
- Utilisation d'interfaces pour encadrer les DAO et services.
- Bootstrap de données et synchronisation de schéma automatisée au démarrage.
- Authentification token/JWT avec enregistrement de session.
- Frontend Next.js orienté pages et UI composable.
- Support d'un espace admin dédié et de pages métier clients/livreurs.

## 7. Recommandations

- Documenter les variables d'environnement nécessaires dans `back-end/.env`.
- Compléter les commentaires des services et DAO critiques.
- Ajouter un résumé de l'architecture dans `Documentation/` si besoin.
- Prévoir des tests unitaires pour les services et DAO principaux.

---

**Fichier** : `CONCEPTION_DETAILLEE.md`

Ce document est désormais la base la plus complète de la conception du projet SOUKI.
