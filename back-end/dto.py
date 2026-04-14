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


class ProductResponseDTO(BaseModel):
    id: int
    nom_fr: str
    nom_darija: str
    prix_kg: float
    unite: str
    stock: float

class TextBasketRequest(BaseModel):
    texte: str

class LigneCommandeDTO(BaseModel):
    product_id: int
    nom_produit: str
    quantite_demandee: float
    quantite_effective: float
    prix_unitaire: float
    sous_total: float
    message_ajustement: Optional[str] = None

class VoiceBasketResponseDTO(BaseModel):
    status: str
    transcription: Optional[str] = None
    langue_detectee: Optional[str] = None
    produits_non_disponibles: list[str] = []
    lignes_panier: list[LigneCommandeDTO] = []
    total_dh: float = 0.0
    nombre_articles: int = 0
    commande_id: Optional[int] = None