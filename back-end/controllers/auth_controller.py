from fastapi import APIRouter, Depends, HTTPException

from auth_dependencies import require_auth
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

auth_router = APIRouter(prefix="/auth", tags=["Auth"])


@auth_router.post("/register", response_model=RegisterResponse)
def register(data: UserRegister):
    return AuthService().register(data)


@auth_router.post("/login")
def login(data: LoginRequest):
    token = AuthService().login(data)
    if not token:
        raise HTTPException(status_code=401, detail="Identifiants incorrects.")
    return {"access_token": token, "token_type": "bearer"}


@auth_router.post("/admin/login")
def admin_login(data: AdminLoginRequest):
    token = AuthService().admin_login(data)
    if not token:
        raise HTTPException(status_code=401, detail="Identifiants incorrects.")
    return {"access_token": token, "token_type": "bearer"}


@auth_router.post("/verify-otp", response_model=OTPVerificationResponse)
def verify_otp(data: OTPVerifyRequest):
    return AuthService().verify_otp(data.user_id, data.code, data.channel)


@auth_router.post("/resend-otp", response_model=OTPVerificationResponse)
def resend_otp(data: OTPResendRequest):
    return AuthService().resend_otp(data.user_id, data.channel)


@auth_router.post("/google")
def google_login(data: GoogleLoginRequest):
    token = AuthService().google_login(data.token, data.role)
    if not token:
        raise HTTPException(status_code=401, detail="Token Google invalide ou expire.")
    return {"access_token": token, "token_type": "bearer"}


@auth_router.post("/google-login")
def google_login_legacy(data: GoogleLoginRequest):
    token = AuthService().google_login(data.token, data.role)
    if not token:
        raise HTTPException(status_code=401, detail="Token Google invalide ou expire.")
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
