from pydantic import BaseModel, EmailStr, validator
from typing import Optional, List

class UserRegister(BaseModel):
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    password: str
    role: str = "CLIENT" # Par défaut

    @validator('phone')
    def validate_phone(cls, v):
        if v and not v.startswith('+212'):
            raise ValueError("Le numéro doit commencer par +212")
        return v

class LoginRequest(BaseModel):
    login_id: str # Email ou Phone
    password: str

class AddressDTO(BaseModel):
    neighborhood: str
    street: str
    details: Optional[str] = None

class UserResponse(BaseModel):
    id: int
    email: Optional[str]
    phone: Optional[str]
    role: str
    class Config: from_attributes = True