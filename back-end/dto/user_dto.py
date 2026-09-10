import re
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, EmailStr, Field, validator

from dto.phone_validator import validate_moroccan_phone


class UserRegister(BaseModel):
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    password: str
    role: str = "CLIENT"
    code_parrainage: Optional[str] = None

    @validator("code_parrainage")
    def normalize_code_parrainage(cls, v):
        if not v:
            return None
        return v.strip().upper()[:10]

    @validator("role")
    def validate_role(cls, v):
        role = v.upper()
        if role not in {"CLIENT", "PARENT", "LIVREUR", "ADMIN"}:
            raise ValueError("Role invalide")
        return role

    @validator("phone")
    def validate_phone(cls, v):
        return validate_moroccan_phone(v)

    @validator("password")
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError("Le mot de passe doit contenir au moins 8 caractères")
        if not any(char.isupper() for char in v):
            raise ValueError("Le mot de passe doit contenir au moins une lettre majuscule")
        if not any(char.isdigit() for char in v):
            raise ValueError("Le mot de passe doit contenir au moins un chiffre")
        return v

    @validator("email", always=True)
    def validate_contact_method(cls, email, values):
        if not email and not values.get("phone"):
            raise ValueError("Un email ou un numéro de téléphone est requis")
        return email


class LoginRequest(BaseModel):
    login_id: str
    password: str
    role: str


class AdminLoginRequest(BaseModel):
    login_id: str
    password: str


class GoogleLoginRequest(BaseModel):
    token: str
    role: str = "CLIENT"

    @validator("role")
    def validate_role(cls, v):
        role = v.upper()
        if role not in {"CLIENT", "PARENT", "LIVREUR", "FOURNISSEUR"}:
            raise ValueError("Role invalide")
        return role


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=20, max_length=4096)
    new_password: str
    confirm_password: str

    @validator("new_password")
    def validate_new_password(cls, value):
        if len(value) < 8:
            raise ValueError("Le mot de passe doit contenir au moins 8 caractères")
        if not any(char.isupper() for char in value):
            raise ValueError("Le mot de passe doit contenir au moins une lettre majuscule")
        if not any(char.isdigit() for char in value):
            raise ValueError("Le mot de passe doit contenir au moins un chiffre")
        return value

    @validator("confirm_password")
    def validate_confirmation(cls, value, values):
        if values.get("new_password") and value != values["new_password"]:
            raise ValueError("Les mots de passe ne correspondent pas")
        return value


class OTPVerifyRequest(BaseModel):
    user_id: int
    code: str
    channel: Optional[str] = None

    @validator("code", pre=True)
    def normalize_code(cls, v):
        if v is None:
            return v
        return str(v).strip().replace(" ", "")

    @validator("code")
    def validate_code(cls, v):
        if not re.fullmatch(r"\d{6}", v):
            raise ValueError("Le code OTP doit contenir 6 chiffres")
        return v


class OTPResendRequest(BaseModel):
    user_id: int
    channel: Optional[str] = None


class UserResponse(BaseModel):
    id: int
    email: Optional[str]
    phone: Optional[str]
    role: str

    class Config:
        from_attributes = True


class RegisterResponse(UserResponse):
    is_verified: bool
    verification_required: bool
    verification_channel: Optional[str] = None
    verification_target: Optional[str] = None
    expires_in_seconds: Optional[int] = None
    resend_available_in_seconds: Optional[int] = None
    message: str


class OTPVerificationResponse(BaseModel):
    message: str
    access_token: Optional[str] = None
    token_type: Optional[str] = None
    is_verified: bool
    role: Optional[str] = None
    roles: List[str] = Field(default_factory=list)
    permissions: List[str] = Field(default_factory=list)
    default_dashboard: str = "/"
    # Un compte fraichement verifie n'est pas encore onboarde : le front enchaine
    # donc sur l'onboarding, ce qu'il ne fait plus lors d'une simple reconnexion.
    onboarding_completed: bool = False
    verification_channel: Optional[str] = None
    verification_target: Optional[str] = None
    expires_in_seconds: Optional[int] = None
    resend_available_in_seconds: Optional[int] = None


class CurrentUserResponse(BaseModel):
    user: Optional[Dict[str, Any]] = None
    id: int
    email: Optional[str]
    phone: Optional[str]
    role: str
    legacy_role: Optional[str] = None
    roles: List[str] = Field(default_factory=list)
    permissions: List[str] = Field(default_factory=list)
    is_verified: bool
    is_active: bool = True
    default_dashboard: str = "/"
    # False = compte jamais onboarde (le front affiche alors l'onboarding).
    onboarding_completed: bool = False
    profiles: Dict[str, Any] = Field(default_factory=dict)
