from typing import Optional

from fastapi import Depends, HTTPException, Request
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt

from config import ACCESS_TOKEN_COOKIE_NAME, ALGORITHM, LocalSession, SECRET_KEY
from entities.user_entity import User
from services.authorization_service import AuthorizationService
from services.user_session_service import UserSessionService


# auto_error=False : on tolere l'absence de l'en-tete Authorization pour pouvoir
# retomber sur le cookie httpOnly.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login", auto_error=False)


def resolve_access_token(
    request: Request,
    header_token: Optional[str] = Depends(oauth2_scheme),
) -> str:
    """Recupere le token JWT depuis le cookie httpOnly EN PRIORITE, sinon l'en-tete.

    Le cookie est prioritaire pour le web : pendant la migration, certains composants
    envoient encore un en-tete Authorization potentiellement perime ("Bearer null" apres
    un rechargement). Le cookie first-party fait foi. Les clients sans cookie (app mobile)
    continuent d'utiliser l'en-tete Bearer.
    """
    cookie_token = request.cookies.get(ACCESS_TOKEN_COOKIE_NAME)
    token = cookie_token or header_token
    if not token:
        raise HTTPException(status_code=401, detail="Session expiree ou token invalide")
    return token


def require_auth(token: str = Depends(resolve_access_token)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = int(payload["sub"])
    except (JWTError, KeyError, TypeError, ValueError):
        raise HTTPException(status_code=401, detail="Session expiree ou token invalide")

    session_record = UserSessionService().validate_token_session(token)
    if not session_record:
        raise HTTPException(status_code=401, detail="Session expiree ou invalidee")

    db = LocalSession()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user or not user.is_active:
            raise HTTPException(status_code=401, detail="Compte indisponible")
        principal = AuthorizationService(db).build_principal(user_id)
        setattr(principal, "session_id", session_record.id)
        return principal
    finally:
        db.close()


def require_role(*expected_roles: str, match: str = "any"):
    normalized_roles = {role.upper() for role in expected_roles if role}

    def dependency(principal=Depends(require_auth)):
        if not normalized_roles:
            return principal

        if match == "all":
            if normalized_roles.issubset(principal.roles):
                return principal
        else:
            if principal.has_any_role(normalized_roles):
                return principal

        raise HTTPException(status_code=403, detail="Role insuffisant")

    return dependency


def require_permission(*expected_permissions: str, match: str = "all"):
    normalized_permissions = {permission for permission in expected_permissions if permission}

    def dependency(principal=Depends(require_auth)):
        if not normalized_permissions:
            return principal

        if match == "all":
            if principal.has_all_permissions(normalized_permissions):
                return principal
        else:
            if principal.has_any_permission(normalized_permissions):
                return principal

        raise HTTPException(status_code=403, detail="Permission insuffisante")

    return dependency


def require_admin(principal=Depends(require_permission("admin.panel.access"))):
    return principal
