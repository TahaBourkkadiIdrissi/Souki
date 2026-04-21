# Plan d'implementation RBAC MVC2 - SOUKI

## 1. Decision d'architecture

### 1.1 Ce qui reste inchange

- `t_users` reste la table centrale d'identite et d'authentification.
- `t_clients`, `t_livreurs`, `t_parents` restent les tables metier.
- Les tables metier ne doivent jamais devenir la source principale d'autorisation.
- La route admin ne doit pas etre exposee dans la navigation publique.

### 1.2 Ce qui change

- `t_users.role` devient un champ legacy de transition, plus la source finale d'autorisation.
- Les roles et permissions effectifs viennent des tables RBAC:
  - `roles`
  - `permissions`
  - `user_roles`
  - `role_permissions`
- Le backend doit verifier les permissions sur chaque route sensible.
- Le frontend ne fait que masquer l'interface; il ne decide jamais seul l'acces.

### 1.3 Regle simple a retenir

- Identite et login: `t_users`
- Donnees metier client/livreur/parent: tables specialisees
- Autorisation centrale: RBAC

### 1.4 Articulation avec les profils metier

- Un utilisateur `CLIENT` doit avoir son profil `t_clients`.
- Un utilisateur `LIVREUR` doit avoir son profil `t_livreurs`.
- Un utilisateur `PARENT` doit avoir son profil `t_parents`.
- Un utilisateur staff/admin n'a pas besoin d'une table metier dediee pour exister.
- Un meme utilisateur peut porter plusieurs roles RBAC, mais le profil metier reste gere par les tables speciales.

Exemple:

- `t_users.id = 42`
- `user_roles`: `CLIENT` + `ADMIN`
- `t_clients.user_id = 42`
- pas de `t_livreurs` si cet utilisateur n'est pas livreur

Cette separation est propre et scalable:

- les tables metier portent la donnee fonctionnelle
- le RBAC porte les droits

## 2. Base de donnees

### 2.1 Fichier SQL fourni

Le script de migration/seed est fourni ici:

- `back-end/sql/2026-04-21_add_rbac_authz.sql`

Ce script:

- durcit `t_users`
- cree les tables RBAC
- seed les roles et permissions
- migre les utilisateurs existants depuis `t_users.role` vers `user_roles`
- garde `t_users.role` pour la transition

### 2.2 Choix sur le mot de passe

Tu as precise que `t_users.password` est deja un hash.

Donc:

- on ne re-hache rien
- on ne duplique pas la colonne maintenant
- on garde `password` pendant la transition
- on renomme plus tard en `password_hash` quand tout le code est pret

Nettoyage final recommande:

```sql
ALTER TABLE t_users RENAME COLUMN password TO password_hash;
ALTER TABLE t_users DROP COLUMN role;
```

Ce nettoyage ne doit etre fait qu'apres la bascule applicative complete.

### 2.3 Tables RBAC

#### `roles`

Contient les roles business et staff.

Exemples:

- `CLIENT`
- `PARENT`
- `LIVREUR`
- `ADMIN`
- `OPS_MANAGER`
- `CATALOG_MANAGER`
- `FINANCE_MANAGER`
- `SUPPORT_AGENT`
- `ADMIN_SUPER`

#### `permissions`

Contient les permissions fines.

Exemples:

- `admin.panel.access`
- `orders.read`
- `orders.assign_livreur`
- `products.manage`
- `payments.read`
- `stats.read`
- `clients.blacklist`

#### `user_roles`

Associe un utilisateur a un ou plusieurs roles.

Points importants:

- plusieurs roles possibles par utilisateur
- date d'attribution
- utilisateur qui a attribue le role
- role temporaire possible avec `expires_at`

#### `role_permissions`

Associe un role a un ensemble de permissions.

Exemple:

- `OPS_MANAGER` -> `orders.read`, `orders.assign_livreur`, `deliveries.manage`

## 3. Backend MVC2 cible

## 3.1 Structure recommandee

```text
back-end/
|-- controllers/
|   |-- auth_controller.py
|   |-- admin_auth_controller.py
|   |-- admin_controller.py
|   |-- livreur_controller.py
|   `-- ...
|-- dao/
|   |-- user_dao.py
|   |-- role_dao.py
|   |-- permission_dao.py
|   `-- authorization_dao.py
|-- entities/
|   |-- user_entity.py
|   |-- role_entity.py
|   |-- permission_entity.py
|   |-- user_role_entity.py
|   `-- role_permission_entity.py
|-- services/
|   |-- auth_service.py
|   |-- authorization_service.py
|   `-- admin_auth_service.py
|-- dto/
|   |-- auth_context_dto.py
|   |-- admin_login_dto.py
|   `-- ...
|-- auth_dependencies.py
`-- main.py
```

## 3.2 Responsabilites par couche

### Model / Entity

- mapper les tables SQLAlchemy
- aucun calcul metier complexe

### DAO / Repository

- charger utilisateur, roles, permissions
- centraliser les jointures SQLAlchemy

### Service

- login
- resolution des roles effectifs
- resolution des permissions effectives
- verification d'acces
- creation des profils metier a l'inscription

### Controller

- parser la requete
- appeler le service
- retourner la reponse HTTP

### Dependency / Guard

- `require_auth`
- `require_role`
- `require_permission`

Dans FastAPI, ces guards sont des dependencies, pas des middlewares globaux a la Express.

## 3.3 Modele principal en memoire

Creer un objet applicatif type `AuthorizationPrincipal`:

```python
from dataclasses import dataclass, field

@dataclass
class AuthorizationPrincipal:
    user_id: int
    email: str | None
    phone: str | None
    is_verified: bool
    is_active: bool
    legacy_role: str | None
    roles: set[str] = field(default_factory=set)
    permissions: set[str] = field(default_factory=set)

    def has_role(self, role: str) -> bool:
        return role.upper() in self.roles

    def has_any_role(self, roles: set[str]) -> bool:
        return any(role.upper() in self.roles for role in roles)

    def has_permission(self, permission: str) -> bool:
        return permission in self.permissions

    def has_all_permissions(self, permissions: set[str]) -> bool:
        return permissions.issubset(self.permissions)
```

## 3.4 Authorization service

Le point cle est ici: ne pas faire confiance au `role` stocke dans le JWT comme source finale.

Le JWT peut contenir:

- `sub`
- `sid` si tu introduis des sessions plus tard
- eventuellement `primary_role` pour le confort UI

Mais le backend doit charger les droits effectifs depuis la base.

```python
class AuthorizationService:
    def __init__(self, db, authorization_dao, user_dao):
        self.db = db
        self.authorization_dao = authorization_dao
        self.user_dao = user_dao

    def build_principal(self, user_id: int) -> AuthorizationPrincipal:
        user = self.user_dao.read(self.db, user_id)
        if not user:
            raise HTTPException(status_code=401, detail="Utilisateur introuvable")
        if not user.is_active:
            raise HTTPException(status_code=403, detail="Compte desactive")
        if not user.is_verified:
            raise HTTPException(status_code=403, detail="Compte non verifie")

        roles = self.authorization_dao.get_active_role_codes(self.db, user_id)
        permissions = self.authorization_dao.get_effective_permission_codes(self.db, user_id)

        # Fallback de transition: si user_roles est vide, on repart du legacy role.
        if not roles and user.role:
            roles = {user.role.upper()}

        return AuthorizationPrincipal(
            user_id=user.id,
            email=user.email,
            phone=user.phone,
            is_verified=user.is_verified,
            is_active=user.is_active,
            legacy_role=user.role,
            roles=set(roles),
            permissions=set(permissions),
        )
```

## 3.5 Guards / dependencies

Creer un fichier `back-end/auth_dependencies.py`.

```python
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt

from config import ALGORITHM, SECRET_KEY, LocalSession
from services.authorization_service import AuthorizationService

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

def require_auth(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        raise HTTPException(status_code=401, detail="Session expiree ou token invalide")

    db = LocalSession()
    try:
        return AuthorizationService(db).build_principal(user_id)
    finally:
        db.close()

def require_role(*expected_roles: str):
    normalized = {role.upper() for role in expected_roles}

    def dependency(principal=Depends(require_auth)):
        if principal.has_any_role(normalized):
            return principal
        raise HTTPException(status_code=403, detail="Role insuffisant")

    return dependency

def require_permission(*expected_permissions: str):
    required = set(expected_permissions)

    def dependency(principal=Depends(require_auth)):
        if principal.has_all_permissions(required):
            return principal
        raise HTTPException(status_code=403, detail="Permission insuffisante")

    return dependency
```

## 3.6 DAO de lecture RBAC

Le DAO doit centraliser les jointures `user_roles -> roles -> role_permissions -> permissions`.

Exemple minimal:

```python
class AuthorizationDao:
    def get_active_role_codes(self, db, user_id: int) -> set[str]:
        rows = (
            db.query(Role.code)
            .join(UserRole, UserRole.role_id == Role.id)
            .filter(UserRole.user_id == user_id)
            .filter(UserRole.is_active.is_(True))
            .filter(or_(UserRole.expires_at.is_(None), UserRole.expires_at > func.now()))
            .filter(Role.is_active.is_(True))
            .all()
        )
        return {row[0] for row in rows}

    def get_effective_permission_codes(self, db, user_id: int) -> set[str]:
        rows = (
            db.query(Permission.code)
            .join(RolePermission, RolePermission.permission_id == Permission.id)
            .join(Role, Role.id == RolePermission.role_id)
            .join(UserRole, UserRole.role_id == Role.id)
            .filter(UserRole.user_id == user_id)
            .filter(UserRole.is_active.is_(True))
            .filter(or_(UserRole.expires_at.is_(None), UserRole.expires_at > func.now()))
            .filter(Role.is_active.is_(True))
            .all()
        )
        return {row[0] for row in rows}
```

## 3.7 Adaptation du login

### Public login

Conserver:

- `/login`
- `/login/client`
- `/login/livreur`
- `/login/parent`

Backend recommande:

- `POST /auth/login`

Le backend authentifie l'identite puis verifie la zone cible.

Exemple:

```python
def login(self, data):
    user = self.user_dao.find_by_identifier(db, data.login_id)
    self._verify_password(data.password, user.password)

    principal = self.authorization_service.build_principal(user.id)

    target = data.role.upper()
    allowed = {
        "CLIENT": "client.dashboard.access",
        "PARENT": "parent.dashboard.access",
        "LIVREUR": "livreur.dashboard.access",
    }

    required_permission = allowed.get(target)
    if not required_permission or not principal.has_permission(required_permission):
        raise HTTPException(status_code=403, detail="Acces refuse pour cet espace")

    return self._issue_access_token(user, principal)
```

### Admin login

Ajouter:

- page frontend: `/admin/login`
- endpoint backend: `POST /auth/admin/login`

```python
def admin_login(self, data):
    user = self.user_dao.find_by_identifier(db, data.login_id)
    self._verify_password(data.password, user.password)

    principal = self.authorization_service.build_principal(user.id)
    if not principal.has_permission("admin.panel.access"):
        raise HTTPException(status_code=403, detail="Acces admin refuse")

    return self._issue_access_token(user, principal)
```

Important:

- pas d'inscription admin publique
- pas de bouton admin sur la home
- creation des comptes admin uniquement par seed, script interne ou console back-office protege

## 3.8 Reponse `GET /auth/me`

Aujourd'hui le frontend recoit seulement `role`.

Il faut faire evoluer la reponse vers:

```json
{
  "id": 42,
  "email": "staff@souki.ma",
  "phone": null,
  "is_verified": true,
  "is_active": true,
  "legacy_role": "ADMIN",
  "roles": ["ADMIN", "OPS_MANAGER"],
  "permissions": [
    "admin.panel.access",
    "orders.read",
    "orders.assign_livreur",
    "deliveries.manage"
  ],
  "default_dashboard": "/admin"
}
```

La propriete `default_dashboard` evite de dupliquer les regles de redirection partout.

## 3.9 Resolution de redirection apres login

Regle recommandee:

1. `admin.panel.access` -> `/admin`
2. `livreur.dashboard.access` -> `/livreur`
3. `parent.dashboard.access` -> `/parent`
4. `client.dashboard.access` -> `/`

Exemple:

```python
def resolve_default_dashboard(principal: AuthorizationPrincipal) -> str:
    if principal.has_permission("admin.panel.access"):
        return "/admin"
    if principal.has_permission("livreur.dashboard.access"):
        return "/livreur"
    if principal.has_permission("parent.dashboard.access"):
        return "/parent"
    return "/"
```

## 3.10 Exemples de routes protegees

### Routes livreur

```python
@router_livreur.get("/tournee")
def get_tournee(
    principal = Depends(require_permission("livreur.dashboard.access", "deliveries.read")),
    service: ILivreurService = Depends(get_livreur_service),
):
    with service:
        return service.get_tournee(principal.user_id)
```

```python
@router_livreur.post("/demarrer-tournee")
def demarrer_tournee(
    principal = Depends(require_permission("livreur.dashboard.access", "deliveries.start_tour")),
    service: ILivreurService = Depends(get_livreur_service),
):
    with service:
        return service.demarrer_tournee(principal.user_id)
```

### Routes admin

```python
admin_router = APIRouter(prefix="/admin", tags=["Admin"])

@admin_router.get("/orders")
def list_orders(principal = Depends(require_permission("admin.panel.access", "orders.read"))):
    ...

@admin_router.post("/orders/{order_id}/assign")
def assign_livreur(
    order_id: int,
    principal = Depends(require_permission("admin.panel.access", "orders.assign_livreur")),
):
    ...

@admin_router.patch("/clients/{user_id}/blacklist")
def blacklist_client(
    user_id: int,
    principal = Depends(require_permission("admin.panel.access", "clients.blacklist")),
):
    ...
```

## 4. Frontend MVC2 / Next.js

## 4.1 Ce qu'il faut changer dans le contexte auth

Dans `front-end/contexts/auth-context.tsx`, faire evoluer le type `User`.

```typescript
export interface User {
  id: number
  email?: string
  phone?: string
  is_verified: boolean
  is_active: boolean
  legacy_role?: string | null
  roles: string[]
  permissions: string[]
  default_dashboard: string
}
```

Ajouter des helpers:

```typescript
const hasRole = (role: string) => user?.roles.includes(role.toUpperCase()) ?? false
const can = (permission: string) => user?.permissions.includes(permission) ?? false
```

## 4.2 Regles d'interface

- la home publique garde les boutons Client et Livreur
- aucun bouton Admin sur la page publique
- l'URL `/admin/login` existe mais n'est pas annoncee dans la navbar publique
- les menus prives sont affiches selon `roles` et `permissions`

Exemple:

```tsx
{can("admin.panel.access") && (
  <Link href="/admin">Back-office</Link>
)}

{can("livreur.dashboard.access") && (
  <Link href="/livreur">Mon espace livreur</Link>
)}
```

Rappel:

- masquer un lien ne securise rien
- la vraie securite est dans les guards backend

## 4.3 Pages a prevoir

- `front-end/app/login/page.tsx`
- `front-end/app/login/client/page.tsx`
- `front-end/app/login/livreur/page.tsx`
- `front-end/app/login/parent/page.tsx`
- `front-end/app/admin/login/page.tsx`
- `front-end/app/admin/page.tsx`

## 4.4 Layout admin

Recommande:

```text
front-end/app/admin/
|-- layout.tsx
|-- login/page.tsx
|-- page.tsx
|-- orders/page.tsx
|-- products/page.tsx
|-- payments/page.tsx
`-- clients/page.tsx
```

Chaque page admin doit:

- verifier `isAuthenticated`
- verifier `can("admin.panel.access")`
- sinon rediriger vers `/admin/login`

## 5. Acces admin professionnel

## 5.1 Methode recommandee

Court terme:

- route dediee `/admin/login`
- endpoint dedie `POST /auth/admin/login`
- aucune presence dans la home publique

Moyen terme production:

- isoler le back-office sur `admin.votre-domaine.com`
- activer MFA/TOTP pour les admins
- journaliser les connexions admin
- rate limiting plus strict sur `/auth/admin/login`

## 5.2 Niveaux d'admin

La bonne approche n'est pas un simple `ADMIN` unique.

Utiliser:

- `ADMIN` pour un acces back-office de base
- `OPS_MANAGER` pour commandes et assignation livreurs
- `CATALOG_MANAGER` pour produits
- `FINANCE_MANAGER` pour paiements et wallets
- `SUPPORT_AGENT` pour support et blacklist
- `ADMIN_SUPER` pour la gouvernance complete

Un meme utilisateur peut cumuler:

- `ADMIN` + `OPS_MANAGER`
- `ADMIN` + `FINANCE_MANAGER`
- `ADMIN_SUPER`

## 5.3 Permissions fines preparees

Le schema fourni couvre deja les cas cites:

- voir les commandes -> `orders.read`
- assigner les livreurs -> `orders.assign_livreur`
- gerer les produits -> `products.manage`
- gerer les paiements -> `payments.read`
- voir les statistiques -> `stats.read`
- blacklister un client -> `clients.blacklist`

## 6. Plan d'implementation progressif

1. Executer `back-end/sql/2026-04-21_add_rbac_authz.sql`.
2. Ajouter les entites SQLAlchemy RBAC.
3. Ajouter `authorization_dao.py`.
4. Ajouter `authorization_service.py`.
5. Ajouter `auth_dependencies.py` avec `require_auth`, `require_role`, `require_permission`.
6. Faire evoluer `AuthService` pour utiliser `AuthorizationService` apres verification du mot de passe.
7. Ajouter `POST /auth/admin/login`.
8. Faire evoluer `GET /auth/me` pour renvoyer `roles`, `permissions`, `default_dashboard`.
9. Remplacer progressivement les controles `user["role"] == "LIVREUR"` par `require_permission(...)`.
10. Ajouter `/admin/login` et le layout admin cote frontend.
11. Mettre a jour `auth-context.tsx` pour consommer roles/permissions.
12. Masquer les menus selon les droits.
13. Verifier les redirections post-login.
14. Une fois la migration validee, supprimer la dependance a `t_users.role`.
15. En cleanup final, renommer `password` en `password_hash` puis supprimer `role`.

## 7. Points de code a modifier en priorite dans le projet actuel

Backend:

- `back-end/services/auth_service.py`
- `back-end/controllers/auth_controller.py`
- `back-end/controllers/livreur_controller.py`
- `back-end/controllers/checkout_controller.py`
- `back-end/controllers/commande_controller.py`
- `back-end/controllers/profile_controller.py`
- `back-end/entities/user_entity.py`

Frontend:

- `front-end/contexts/auth-context.tsx`
- `front-end/hooks/useAuth.ts`
- `front-end/lib/api.ts`
- `front-end/components/souki/navbar.tsx`
- `front-end/app/login/client/page.tsx`
- `front-end/app/login/livreur/page.tsx`
- `front-end/app/login/parent/page.tsx`

## 8. Bonnes pratiques securite

- ne jamais autoriser la creation d'un role admin depuis l'inscription publique
- ne jamais deduire l'autorisation uniquement depuis le frontend
- ne pas stocker toutes les permissions comme verite unique dans un JWT longue duree
- verifier `is_active` et `is_verified` sur chaque appel authentifie
- journaliser les attributions de roles admin
- invalider le cache d'autorisations apres changement de role
- appliquer un rate limit fort sur `/auth/login` et surtout `/auth/admin/login`
- prevoir MFA pour les comptes admin
- preferer a terme des cookies HttpOnly pour la production

## 9. Pieges a eviter

- utiliser `t_clients` ou `t_livreurs` comme source principale d'acces
- supprimer `t_users.role` trop tot
- laisser le frontend choisir seul qu'un utilisateur est admin
- accepter `role=ADMIN` dans le formulaire public
- multiplier les checks `if user.role == ...` dans les controllers
- mettre toutes les permissions dans le JWT puis ne plus relire la base
- oublier de proteger les routes admin backend parce que le lien est cache

## 10. Conclusion operationnelle

La cible recommande pour SOUKI est:

- `t_users` pour l'identite
- `t_clients`, `t_livreurs`, `t_parents` pour la donnee metier
- RBAC central pour les acces
- `/admin/login` comme point d'entree back-office
- controles serveur via `require_auth`, `require_role`, `require_permission`
- migration progressive sans casse grace au maintien temporaire de `t_users.role`

Si l'equipe suit cette trajectoire, vous obtenez:

- un acces admin propre sans bouton public
- des dashboards separes et securises
- une base maintenable
- une autorisation fine et scalable
- une migration progressive compatible avec l'existant
