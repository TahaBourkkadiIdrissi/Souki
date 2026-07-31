from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.security import OAuth2PasswordBearer
from jose import jwt

from auth_dependencies import require_auth
from config import (
    ACCESS_TOKEN_COOKIE_NAME,
    ACCESS_TOKEN_EXPIRE_MINUTES,
    ALGORITHM,
    COOKIE_SAMESITE,
    COOKIE_SECURE,
    SECRET_KEY,
)
from dto.user_dto import (
    AdminLoginRequest,
    CurrentUserResponse,
    GoogleLoginRequest,
    LoginRequest,
    OTPResendRequest,
    OTPVerificationResponse,
    OTPVerifyRequest,
    RegisterResponse,
    UserRegister,
)
from services.auth_service import AuthService
from services.client_ip import extract_client_ip
from services.rate_limit_service import (
    ADMIN_LOGIN_POLICY,
    SIGNUP_IP_MAX_ATTEMPTS,
    SIGNUP_IP_WINDOW_SECONDS,
    USER_LOGIN_POLICY,
    ip_action_quota,
    login_rate_limiter,
)
from services.user_session_service import UserSessionService

auth_router = APIRouter(prefix="/auth", tags=["Auth"])

# Lecture optionnelle du token depuis l'en-tete (pour /logout, qui doit fonctionner
# meme si l'en-tete est absent — le token vient alors du cookie).
_optional_bearer = OAuth2PasswordBearer(tokenUrl="auth/login", auto_error=False)


def _register_session_for_token(token: str, request: Request):
    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    user_id = int(payload.get("sub"))
    UserSessionService().create_session(user_id=user_id, token=token, request=request)


def _set_auth_cookie(response: Response, token: str):
    """Pose le JWT dans un cookie httpOnly (inaccessible au JS, anti-XSS)."""
    response.set_cookie(
        key=ACCESS_TOKEN_COOKIE_NAME,
        value=token,
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        path="/",
    )


@auth_router.post("/register", response_model=RegisterResponse)
def register(data: UserRegister, request: Request):
    # VULN-014 : chaque inscription declenche un envoi d'email facture. Limite par
    # IP, seul niveau disponible avant qu'un compte existe.
    client_ip = extract_client_ip(request)
    ip_action_quota.ensure_within_quota(
        "register", client_ip, SIGNUP_IP_MAX_ATTEMPTS, SIGNUP_IP_WINDOW_SECONDS
    )
    return AuthService().register(data, client_ip=client_ip)


@auth_router.post("/login")
def login(data: LoginRequest, request: Request, response: Response):
    # Anti brute force (VULN-009) : limite par IP et par identifiant, delai
    # progressif apres echecs, reponse 429 generique (pas de fuite d'existence).
    client_ip = extract_client_ip(request)
    login_rate_limiter.ensure_can_attempt("user", USER_LOGIN_POLICY, client_ip, data.login_id)
    result = AuthService().login(data)
    if not result:
        login_rate_limiter.register_failure("user", USER_LOGIN_POLICY, client_ip, data.login_id)
        raise HTTPException(status_code=401, detail="Identifiants incorrects.")
    login_rate_limiter.register_success("user", client_ip, data.login_id)
    token = result["token"]
    _register_session_for_token(token, request)
    _set_auth_cookie(response, token)
    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    return {
        "access_token": token,
        "token_type": "bearer",
        "roles": payload.get("roles", []),
        "role": payload.get("role"),
        "default_dashboard": payload.get("default_dashboard", "/"),
        # Utilisateur complet : permet au front d'eviter un second appel /auth/me.
        "user": result["user"],
    }


@auth_router.post("/admin/login")
def admin_login(data: AdminLoginRequest, request: Request, response: Response):
    # Limite plus stricte pour l'espace admin + alerte de securite apres echecs.
    client_ip = extract_client_ip(request)
    login_rate_limiter.ensure_can_attempt("admin", ADMIN_LOGIN_POLICY, client_ip, data.login_id)
    try:
        result = AuthService().admin_login(data)
    except HTTPException as exc:
        if exc.status_code == 403:
            # Un compte non-admin qui sonde l'espace admin compte comme un echec.
            login_rate_limiter.register_failure("admin", ADMIN_LOGIN_POLICY, client_ip, data.login_id)
        raise
    if not result:
        login_rate_limiter.register_failure("admin", ADMIN_LOGIN_POLICY, client_ip, data.login_id)
        raise HTTPException(status_code=401, detail="Identifiants incorrects.")
    login_rate_limiter.register_success("admin", client_ip, data.login_id)
    token = result["token"]
    _register_session_for_token(token, request)
    _set_auth_cookie(response, token)
    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    return {
        "access_token": token,
        "token_type": "bearer",
        "roles": payload.get("roles", []),
        "role": payload.get("role"),
        "default_dashboard": payload.get("default_dashboard", "/admin"),
        "user": result["user"],
    }


@auth_router.post("/verify-otp", response_model=OTPVerificationResponse)
def verify_otp(data: OTPVerifyRequest, request: Request, response: Response):
    res = AuthService().verify_otp(data.user_id, data.code, data.channel)
    token = res.get("access_token")
    if token:
        _register_session_for_token(token, request)
        _set_auth_cookie(response, token)
    return res


@auth_router.post("/resend-otp", response_model=OTPVerificationResponse)
def resend_otp(data: OTPResendRequest, request: Request):
    # VULN-013/014 : route non authentifiee prenant un user_id brut. La limite par
    # IP borne l'enumeration de comptes et l'envoi d'emails vers des tiers ; le
    # service repond de facon neutre, qu'un envoi ait eu lieu ou non.
    ip_action_quota.ensure_within_quota(
        "resend-otp",
        extract_client_ip(request),
        SIGNUP_IP_MAX_ATTEMPTS,
        SIGNUP_IP_WINDOW_SECONDS,
    )
    return AuthService().resend_otp(data.user_id, data.channel)


@auth_router.post("/google")
def google_login(data: GoogleLoginRequest, request: Request, response: Response):
    result = AuthService().google_login(data.token, data.role)
    if not result:
        raise HTTPException(status_code=401, detail="Token Google invalide ou expire.")
    token = result["token"]
    _register_session_for_token(token, request)
    _set_auth_cookie(response, token)
    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    return {
        "access_token": token,
        "token_type": "bearer",
        "roles": payload.get("roles", []),
        "role": payload.get("role"),
        "default_dashboard": payload.get("default_dashboard", "/"),
        "user": result["user"],
    }


@auth_router.post("/google-login")
def google_login_legacy(data: GoogleLoginRequest, request: Request, response: Response):
    result = AuthService().google_login(data.token, data.role)
    if not result:
        raise HTTPException(status_code=401, detail="Token Google invalide ou expire.")
    token = result["token"]
    _register_session_for_token(token, request)
    _set_auth_cookie(response, token)
    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    return {
        "access_token": token,
        "token_type": "bearer",
        "roles": payload.get("roles", []),
        "role": payload.get("role"),
        "default_dashboard": payload.get("default_dashboard", "/"),
        "user": result["user"],
    }


@auth_router.get("/me", response_model=CurrentUserResponse)
def get_me(principal=Depends(require_auth)):
    return AuthService().export_current_principal(principal)


@auth_router.post("/logout")
def logout(
    request: Request,
    response: Response,
    header_token: Optional[str] = Depends(_optional_bearer),
):
    """Invalide la session courante et supprime le cookie httpOnly."""
    token = header_token or request.cookies.get(ACCESS_TOKEN_COOKIE_NAME)
    if token:
        try:
            UserSessionService().invalidate_token_session(token)
        except Exception:
            # La suppression du cookie doit aboutir meme si l'invalidation echoue.
            pass
    response.delete_cookie(key=ACCESS_TOKEN_COOKIE_NAME, path="/")
    return {"status": "ok"}


get_current_user = require_auth
