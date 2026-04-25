from fastapi import APIRouter, Depends, HTTPException, Request
from jose import jwt

from auth_dependencies import require_auth
from config import ALGORITHM, SECRET_KEY
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
from services.user_session_service import UserSessionService

auth_router = APIRouter(prefix="/auth", tags=["Auth"])

def _register_session_for_token(token: str, request: Request):
    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    user_id = int(payload.get("sub"))
    UserSessionService().create_session(user_id=user_id, token=token, request=request)


@auth_router.post("/register", response_model=RegisterResponse)
def register(data: UserRegister):
    return AuthService().register(data)


@auth_router.post("/login")
def login(data: LoginRequest, request: Request):
    token = AuthService().login(data)
    if not token:
        raise HTTPException(status_code=401, detail="Identifiants incorrects.")
    _register_session_for_token(token, request)
    return {"access_token": token, "token_type": "bearer"}


@auth_router.post("/admin/login")
def admin_login(data: AdminLoginRequest, request: Request):
    token = AuthService().admin_login(data)
    if not token:
        raise HTTPException(status_code=401, detail="Identifiants incorrects.")
    _register_session_for_token(token, request)
    return {"access_token": token, "token_type": "bearer"}


@auth_router.post("/verify-otp", response_model=OTPVerificationResponse)
def verify_otp(data: OTPVerifyRequest, request: Request):
    res = AuthService().verify_otp(data.user_id, data.code, data.channel)
    token = res.get("access_token")
    if token:
        _register_session_for_token(token, request)
    return res


@auth_router.post("/resend-otp", response_model=OTPVerificationResponse)
def resend_otp(data: OTPResendRequest):
    return AuthService().resend_otp(data.user_id, data.channel)


@auth_router.post("/google")
def google_login(data: GoogleLoginRequest, request: Request):
    token = AuthService().google_login(data.token, data.role)
    if not token:
        raise HTTPException(status_code=401, detail="Token Google invalide ou expire.")
    _register_session_for_token(token, request)
    return {"access_token": token, "token_type": "bearer"}


@auth_router.post("/google-login")
def google_login_legacy(data: GoogleLoginRequest, request: Request):
    token = AuthService().google_login(data.token, data.role)
    if not token:
        raise HTTPException(status_code=401, detail="Token Google invalide ou expire.")
    _register_session_for_token(token, request)
    return {"access_token": token, "token_type": "bearer"}


@auth_router.get("/me", response_model=CurrentUserResponse)
def get_me(principal=Depends(require_auth)):
    return {
        "id": principal.user_id,
        "email": principal.email,
        "phone": principal.phone,
        "role": principal.primary_role,
        "legacy_role": principal.legacy_role,
        "roles": sorted(principal.roles),
        "permissions": sorted(principal.permissions),
        "is_verified": principal.is_verified,
        "is_active": principal.is_active,
        "default_dashboard": principal.default_dashboard,
    }


get_current_user = require_auth
