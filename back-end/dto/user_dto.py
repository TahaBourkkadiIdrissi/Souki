from pydantic import BaseModel, EmailStr, validator
from typing import Optional


class UserRegister(BaseModel):
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    password: str
    role: str = "CLIENT"

    @validator('phone')
    def validate_phone(cls, v):
        if v and not v.startswith('+212'):
            raise ValueError("Le numéro doit commencer par +212")
        return v


class LoginRequest(BaseModel):
    login_id: str   # Email ou Phone
    password: str


class GoogleLoginRequest(BaseModel):
    token: str


class UserResponse(BaseModel):
    id: int
    email: Optional[str]
    phone: Optional[str]
    role: str

    class Config:
        from_attributes = True
