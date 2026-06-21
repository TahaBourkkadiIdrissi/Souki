from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, validator

from dto.phone_validator import validate_moroccan_phone


class SupplierStatus(str, Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    SUSPENDED = "SUSPENDED"


class AdminSupplierAction(str, Enum):
    APPROVE = "APPROVE"
    REJECT = "REJECT"
    SUSPEND = "SUSPEND"


class SupplierRequestDTO(BaseModel):
    shop_name: str = Field(min_length=2, max_length=180)
    description: Optional[str] = None
    phone: str
    address: str = Field(min_length=3)
    ville: Optional[str] = None
    code_postal: Optional[str] = None
    siret: Optional[str] = None
    logo_url: Optional[str] = None
    couverture_url: Optional[str] = None
    horaires: Optional[Dict[str, Any]] = None
    produit_ids: List[int] = Field(min_items=1)

    @validator("phone")
    def validate_phone(cls, v):
        result = validate_moroccan_phone(v)
        if result is None:
            raise ValueError("Le téléphone du fournisseur est requis")
        return result


class SupplierProfileDTO(BaseModel):
    user_id: int
    shop_name: str
    shop_slug: Optional[str] = None
    description: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    ville: Optional[str] = None
    statut: SupplierStatus
    rejected_reason: Optional[str] = None
    rating: float = 0
    nb_avis: int = 0
    logo_url: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SupplierUpdateDTO(BaseModel):
    shop_name: Optional[str] = Field(default=None, min_length=2, max_length=180)
    description: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = Field(default=None, min_length=3)
    ville: Optional[str] = None
    logo_url: Optional[str] = None
    couverture_url: Optional[str] = None
    horaires: Optional[Dict[str, Any]] = None

    @validator("phone")
    def validate_phone(cls, v):
        return validate_moroccan_phone(v)


class AdminSupplierValidationDTO(BaseModel):
    supplier_user_id: int
    action: AdminSupplierAction
    rejected_reason: Optional[str] = None

    @validator("rejected_reason", always=True)
    def validate_rejected_reason(cls, value, values):
        if values.get("action") == AdminSupplierAction.REJECT and not value:
            raise ValueError("rejected_reason est obligatoire si action=REJECT")
        return value


class PendingSupplierRequestDTO(SupplierProfileDTO):
    user_email: Optional[str] = None
    user_phone: Optional[str] = None


class SupplierListItemDTO(PendingSupplierRequestDTO):
    validated_by: Optional[int] = None
    validated_at: Optional[datetime] = None


class SupplierPageDTO(BaseModel):
    status: str = "success"
    page: int
    page_size: int
    total: int
    items: List[SupplierListItemDTO] = Field(default_factory=list)


class SupplierStatsDTO(BaseModel):
    status: str = "success"
    products_count: int = 0
    active_products_count: int = 0
    orders_count: int = 0
    revenue_total: float = 0.0


class SupplierOrdersDTO(BaseModel):
    status: str = "success"
    orders: List[dict] = Field(default_factory=list)


class SupplierPreparationLineDTO(BaseModel):
    product_id: int
    nom_fr: str
    quantite_kg: float
    unite: str


class SupplierPreparationOrderDTO(BaseModel):
    id: int
    statut: str
    date_commande: Optional[datetime] = None
    creneau_livraison: Optional[str] = None
    montant_total: float = 0
    client_nom: str
    client_phone: Optional[str] = None
    adresse: Optional[str] = None
    produits: List[SupplierPreparationLineDTO] = Field(default_factory=list)


class SupplierPickingItemDTO(BaseModel):
    product_id: int
    nom_fr: str
    quantite_kg: float
    unite: str


class SupplierPreparationDTO(BaseModel):
    status: str = "success"
    date: str
    nombre_commandes: int
    picking: List[SupplierPickingItemDTO] = Field(default_factory=list)
    commandes: List[SupplierPreparationOrderDTO] = Field(default_factory=list)


class SupplierProductOfferDTO(BaseModel):
    produit_id: int
    nom_fr: str
    nom_darija: str
    unite: str
    prix_affiche: Optional[float] = None
    prix_gros: Optional[float] = None
    stock: float = 0
    is_active: bool = True

    class Config:
        from_attributes = True


class SupplierCatalogueItemDTO(BaseModel):
    produit_id: int
    nom_fr: str
    nom_darija: str
    unite: str
    prix_affiche: Optional[float] = None
    deja_propose: bool = False


class SupplierProductCreateDTO(BaseModel):
    produit_id: int
    prix_gros: Optional[float] = None
    stock: float = 0


class SupplierProductUpdateDTO(BaseModel):
    prix_gros: Optional[float] = None
    stock: Optional[float] = None
    is_active: Optional[bool] = None


class SupplierProductSelectionDTO(BaseModel):
    produit_ids: List[int] = Field(min_items=1)


class SupplierProductsListDTO(BaseModel):
    status: str = "success"
    items: List[SupplierProductOfferDTO] = Field(default_factory=list)
