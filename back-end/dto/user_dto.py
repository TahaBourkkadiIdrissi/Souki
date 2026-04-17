import re
from pydantic import BaseModel, EmailStr, validator
from typing import Optional

class UserRegister(BaseModel):
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    password: str
    role: str = "CLIENT"

    @validator('phone')
    def validate_phone(cls, v):
        if v:
            # Regex : +212 suivi de 6 ou 7, puis 8 chiffres (total 9 après +212)
            pattern = r"^\+212[67]\d{8}$"
            if not re.match(pattern, v):
                # Message d'erreur clair pour éviter le [object Object]
                raise ValueError("Le numéro doit être au format +212XXXXXXXXX (9 chiffres commençant par 6 ou 7)")
        return v

    @validator('password')
    def validate_password(cls, v):
        # Minimum 8 caractères
        if len(v) < 8:
            raise ValueError("Le mot de passe doit contenir au moins 8 caractères")
        # Au moins une majuscule
        if not any(char.isupper() for char in v):
            raise ValueError("Le mot de passe doit contenir au moins une lettre majuscule")
        # Au moins un chiffre
        if not any(char.isdigit() for char in v):
            raise ValueError("Le mot de passe doit contenir au moins un chiffre")
        return v


class LoginRequest(BaseModel):
    login_id: str   # Email ou Phone
    password: str
    role: str       # NOUVEAU : On exige le rôle lors de la connexion


class GoogleLoginRequest(BaseModel):
    token: str


class UserResponse(BaseModel):
    id: int
    email: Optional[str]
    phone: Optional[str]
    role: str

    class Config:
        from_attributes = True