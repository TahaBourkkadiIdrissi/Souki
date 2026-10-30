from datetime import date, datetime
from typing import Literal
from pydantic import BaseModel, Field, field_validator

Frequence = Literal["QUOTIDIENNE", "TOUS_LES_3_JOURS", "HEBDOMADAIRE", "TOUTES_LES_2_SEMAINES"]
ModePaiementRecurrent = Literal["cod", "wallet"]


class CommandeRecurrenteLigneInDTO(BaseModel):
    product_id: int = Field(gt=0)
    quantite: float = Field(gt=0, le=1000)


class CommandeRecurrenteDepuisCommandeDTO(BaseModel):
    frequence: Frequence
    premiere_livraison: date | None = None


class CommandeRecurrenteLignesUpdateDTO(BaseModel):
    lignes: list[CommandeRecurrenteLigneInDTO] = Field(min_length=1, max_length=80)


class CommandeRecurrenteUpdateDTO(BaseModel):
    frequence: Frequence | None = None
    prochaine_livraison: date | None = None
    mode_paiement: ModePaiementRecurrent | None = None
    contact_phone: str | None = Field(default=None, max_length=20)
    delivery_address: str | None = Field(default=None, max_length=200)
    delivery_city: str | None = Field(default=None, max_length=100)
    # Recopie dans t_addresses.details (100 caracteres) par le checkout.
    delivery_instructions: str | None = Field(default=None, max_length=100)

    @field_validator("contact_phone", "delivery_address", "delivery_city", "delivery_instructions", mode="before")
    @classmethod
    def strip_text(cls, value):
        return value.strip() if isinstance(value, str) else value


class CommandeRecurrentePauseDTO(BaseModel):
    jusqu_au: date


class CommandeRecurrenteLigneDTO(BaseModel):
    product_id: int
    nom_produit: str
    unite: str
    image_url: str | None = None
    quantite: float
    prix_unitaire: float
    prix_reference: float | None = None
    sous_total: float
    variation: float = 0.0
    disponible: bool = True


class CommandeRecurrenteLivraisonDTO(BaseModel):
    date_livraison: date
    statut: str
    commande_id: int | None = None
    montant: float | None = None
    motif: str | None = None


class CommandeRecurrenteDTO(BaseModel):
    id: int
    type: str
    panier_souki_id: int | None = None
    commande_origine_id: int | None = None
    frequence: str
    prochaine_livraison: date
    statut: str
    pause_jusqu_au: date | None = None
    mode_paiement: str
    creneau_livraison: str
    contact_phone: str
    delivery_address: str
    delivery_city: str
    delivery_instructions: str | None = None
    lignes: list[CommandeRecurrenteLigneDTO] = Field(default_factory=list)
    sous_total_estime: float = 0.0
    frais_livraison_estimes: float = 0.0
    total_estime: float = 0.0
    variation_prix: float = 0.0
    modifiable: bool = True
    message: str | None = None
    dernieres_livraisons: list[CommandeRecurrenteLivraisonDTO] = Field(default_factory=list)
    created_at: datetime | None = None


class CommandeRecurrenteAdminDTO(CommandeRecurrenteDTO):
    client_id: int
    client_nom: str | None = None
    client_phone: str | None = None


class CommandeRecurrenteLivraisonAdminDTO(CommandeRecurrenteLivraisonDTO):
    recurrence_id: int
    type: str
    client_id: int
    client_nom: str | None = None


class RapportGenerationRecurrentesDTO(BaseModel):
    date_livraison: date
    ignore: bool = False
    creees: int = 0
    sautees: int = 0
    echecs: int = 0
