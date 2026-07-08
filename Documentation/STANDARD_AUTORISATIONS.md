# Standard d'autorisation backend

Reference : audit cybersecurite (HAMZA-05, VULN-003, VULN-004).

Ce document definit le standard unique d'authentification, de permission et de
propriete pour toutes les routes du backend FastAPI.

## 1. Authentification

- Toute route privee declare une dependance issue de `auth_dependencies` :
  `require_auth`, `require_permission(...)` ou `require_role(...)`.
- `require_auth` fait foi : il valide le JWT (cookie httpOnly en priorite,
  en-tete `Authorization: Bearer` pour le mobile), verifie que la session est
  active (`UserSessionService`) et que le compte est actif, puis retourne le
  `principal`.
- Interdits :
  - decoder le JWT manuellement dans un controleur ;
  - accepter un JWT dans la query string (WebSocket inclus — utiliser le
    ticket opaque `POST /admin/ws-ticket`).

## 2. Permission

- Le controle d'acces se fait par **permission RBAC**, jamais par comparaison
  manuelle de role :

  ```python
  principal = Depends(require_permission("admin.panel.access"))
  ```

- `require_permission(*perms)` exige toutes les permissions ; `match="any"`
  accepte l'une d'entre elles.
- Interdits :
  - `if user.primary_role != "ADMIN": raise HTTPException(403)` (verification
    manuelle de role) ;
  - dupliquer une dependance admin locale au controleur. Si un alias local est
    necessaire, il doit deleguer a `require_permission` :

  ```python
  get_admin_user = require_permission("admin.panel.access")
  ```

## 3. Propriete (anti-IDOR)

- Toute ressource identifiee par ID et appartenant a un utilisateur doit etre
  chargee **avec le filtre proprietaire au niveau DAO** :

  ```python
  session.query(Panier).filter(Panier.id == panier_id, Panier.user_id == user_id)
  ```

- Le `principal.user_id` est propage explicitement du controleur au service
  puis au DAO. Le controleur ne transmet jamais un `user_id` venant du client.
- Si la ressource est deja chargee, utiliser le helper reutilisable :

  ```python
  from auth_dependencies import ensure_resource_owner
  ensure_resource_owner(principal, commande.client_id)
  ```

- La reponse est **404** (jamais 403) quand la ressource appartient a un autre
  utilisateur : on ne revele pas son existence.
- Interdit : ignorer le principal avec `_ = principal` sur une route privee.
  Si le principal ne sert qu'au controle d'acces, la dependance
  `require_permission` suffit — sans no-op.

## 4. Erreurs

- Les erreurs internes passent par `services.business_errors.internal_error_http`
  (message public generique + identifiant de correlation journalise).
- Aucune reponse ne doit contenir de detail SQL, de stacktrace ou de texte brut
  d'exception interne.

## 5. Checklist revue de code

- [ ] La route privee a une dependance `require_auth` / `require_permission`.
- [ ] Aucun controle manuel de role.
- [ ] Les ressources par ID sont filtrees par proprietaire au DAO (ou
      `ensure_resource_owner`).
- [ ] 404 pour la ressource d'autrui, message generique.
- [ ] Pas de `_ = principal`.
