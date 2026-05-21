# Fournisseur Backend - Analyse et implementation

## 1. Analyse de l'existant

### Stack technique

- Langage/framework: Python, FastAPI.
- ORM: SQLAlchemy declarative.
- Base de donnees: PostgreSQL/Supabase.
- Auth: JWT avec `python-jose`, sessions serveur via `t_user_sessions`.
- Validation DTO: Pydantic.

### Structure backend

- `entities/`: mapping SQLAlchemy des tables.
- `dao/`: requetes SQLAlchemy et acces donnees.
- `dto/`: modeles Pydantic de requete/reponse.
- `services/`: logique metier, transactions et orchestration.
- `controllers/`: routes FastAPI et guards.
- `interfaces/`: contrats abstraits pour DAO/services.
- `sql/`: scripts SQL manuels.

### RBAC actuel

Tables:

- `roles`: roles systeme, avec `code`, `label`, `description`, `is_system`, `is_active`.
- `permissions`: permissions, avec unicite sur `code` et sur `(resource, action)`.
- `role_permissions`: lien role-permission.
- `user_roles`: lien user-role, avec `is_active`, `assigned_at`, `assigned_by_user_id`, `expires_at`.

Roles existants avant ajout fournisseur:

- `CLIENT`, `PARENT`, `LIVREUR`, `ADMIN`, `OPS_MANAGER`, `CATALOG_MANAGER`, `FINANCE_MANAGER`, `SUPPORT_AGENT`, `ADMIN_SUPER`.

Permissions existantes principales:

- Dashboards client/parent/livreur/admin, profil, checkout, commandes, livraisons, produits back-office, paiements, wallets, stats, clients, roles.

Assignation role utilisateur:

- L'assignation canonique passe par `AuthorizationDao.assign_role_to_user()`, qui cree/reactive une ligne dans `user_roles`.
- `t_users.role` existe encore comme fallback legacy.

### Authentification

- Register cree un `User`, un profil metier (`Client`, `Parent`, `Livreur`) et une ligne `user_roles`.
- Login construit un `AuthorizationPrincipal` depuis `user_roles + roles + permissions`.
- `require_auth` valide le JWT, valide la session serveur, recharge l'utilisateur et reconstruit le principal depuis la base.
- Guards disponibles: `require_role`, `require_permission`, `require_admin`.
- Le refresh token dedie n'est pas present; la validite est geree par JWT + `UserSessionService`.

### Profils metier

- `t_clients`: `Client(user_id)` avec relation `User.client_profile`.
- `t_livreurs`: `Livreur(user_id)` avec relation `User.livreur_profile`.
- `t_parents`: `Parent(user_id)` avec relation `User.parent_profile`.
- Le pattern est une table profil avec PK/FK `user_id` vers `t_users.id`.

### Point d'entree role

- Le role effectif est determine dans `AuthorizationService._load_roles_and_permissions()`.
- Priorite: `user_roles` actifs, puis fallback `t_users.role` si aucun role RBAC actif n'est trouve.

### Points identifies

- `t_users.role` est redondant mais conserve pour migration progressive.
- La contrainte `uq_permissions_resource_action` interdit de creer `supplier.products.read` avec `resource='products', action='read'` car `products.read` existe deja. Les nouveaux codes restent ceux du prompt, mais les resources ont ete namespacées (`supplier.products`, `supplier.orders`, etc.).
- `require_auth` recharge les roles en base a chaque requete; le JWT contient maintenant les roles pour le frontend, mais la base reste source d'autorite.

## 2. Fichiers crees/modifies

Crees:

- `back-end/entities/fournisseur_entity.py`
- `back-end/dto/supplier_dto.py`
- `back-end/dao/fournisseur_dao.py`
- `back-end/interfaces/fournisseur_dao_interface.py`
- `back-end/interfaces/fournisseur_service_interface.py`
- `back-end/services/fournisseur_service.py`
- `back-end/services/supplier_schema_sync_service.py`
- `back-end/controllers/fournisseur_controller.py`
- `back-end/sql/2026-05-12_add_fournisseurs.sql`
- `Documentation/SUPPLIER_BACKEND_IMPLEMENTATION.md`

Modifies:

- `back-end/rbac_config.py`
- `back-end/services/rbac_bootstrap_service.py`
- `back-end/dao/authorization_dao.py`
- `back-end/services/auth_service.py`
- `back-end/controllers/auth_controller.py`
- `back-end/dto/user_dto.py`
- `back-end/entities/user_entity.py`
- `back-end/entities/product_entity.py`
- `back-end/entities/__init__.py`
- `back-end/dependencies.py`
- `back-end/main.py`

## 3. Endpoints ajoutes

- `POST /api/supplier/request`: auth + role `CLIENT`.
- `GET /api/supplier/profile`: auth + role `FOURNISSEUR`.
- `PUT /api/supplier/profile`: auth + permission `supplier.profile.update`.
- `GET /api/supplier/stats`: auth + permission `supplier.stats.read`.
- `GET /api/supplier/orders`: auth + permission `supplier.orders.read`.
- `GET /api/admin/suppliers/pending`: auth + permission `admin.panel.access`.
- `GET /api/admin/suppliers`: auth + permission `admin.panel.access`.
- `POST /api/admin/suppliers/validate`: auth + permission `admin.panel.access`.
- `PUT /api/admin/suppliers/{supplier_user_id}/suspend`: auth + permission `admin.panel.access`.
- `PUT /api/admin/suppliers/{supplier_user_id}/reactivate`: auth + permission `admin.panel.access`.

## 4. Comportement implemente

- Un client peut soumettre une demande fournisseur.
- La demande est creee en `PENDING`.
- L'approbation admin passe le profil en `APPROVED` et ajoute/reactive le role `FOURNISSEUR` dans `user_roles`.
- Le rejet passe en `REJECTED` sans ajouter le role.
- La suspension passe en `SUSPENDED` et desactive le role `FOURNISSEUR`.
- La reactivation repasse en `APPROVED` et reactive le role.
- Les notifications sont poussees dans `t_notification_outbox`.
- `/auth/me` retourne les roles et un bloc `profiles`, dont `fournisseur` si applicable.
- Les JWT emis au login contiennent maintenant `roles`.

## 5. Verification

- Compilation backend: `./.venv/Scripts/python.exe -m compileall back-end` OK.
- Verification SQLAlchemy mappers: `configure_mappers()` OK.
- La connexion DB/migration live n'a pas ete executee dans cette passe.

## 6. Reste a faire frontend

- Ajouter l'ecran de demande fournisseur.
- Ajouter l'ecran admin de validation/rejet/suspension.
- Ajouter la selection post-login multi-roles avec `/auth/me`.
- Ajouter le dashboard fournisseur, produits, commandes et stats.
- Gerer le refresh du JWT apres approbation si un utilisateur etait deja connecte avant validation.
