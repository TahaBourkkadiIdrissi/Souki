from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List


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
    produits_non_disponibles: List[str] = []
    lignes_panier: List[LigneCommandeDTO] = []
    total_dh: float = 0.0
    nombre_articles: int = 0
    commande_id: Optional[int] = None

class LigneCheckoutDTO(BaseModel):
    product_id: int
    nom_produit: str
    quantite_effective: float
    prix_unitaire: float
    sous_total: float
    unite: str
    image: str = "https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&h=300&fit=crop"

class CommandeCheckoutDTO(BaseModel):
    commande_id: int
    transcription: Optional[str] = None
    lignes: List[LigneCheckoutDTO]
    total_dh: float

class ProduitCommandeJourDTO(BaseModel):
    nom_fr: str
    quantite_kg: float

class PaiementDTO(BaseModel):
    methode: Optional[str] = None
    montant: Optional[float] = None
    valide: Optional[bool] = None
    frais_cmi: Optional[float] = None
    montant_net: Optional[float] = None

class SessionClientDTO(BaseModel):
    device_name: Optional[str] = None
    browser: Optional[str] = None
    location: Optional[str] = None
    ip: Optional[str] = None
    last_active: Optional[datetime] = None
    created_at: Optional[datetime] = None
    is_active: Optional[bool] = None

class NotificationPrefsDTO(BaseModel):
    email: Optional[bool] = None
    push: Optional[bool] = None
    sms: Optional[bool] = None
    order_updates: Optional[bool] = None
    promotions: Optional[bool] = None
    newsletter: Optional[bool] = None

class AbonnementClientDTO(BaseModel):
    poids_garanti: Optional[float] = None
    frequence: Optional[str] = None
    montant_mensuel: Optional[float] = None
    actif: Optional[bool] = None

class CommandeVocaleClientDTO(BaseModel):
    id: int
    created_at: Optional[datetime] = None
    langue_detectee: Optional[str] = None
    transcription_brute: Optional[str] = None

class CommandeHistoriqueDTO(BaseModel):
    id: int
    date_commande: Optional[datetime] = None
    statut: Optional[str] = None
    montant_total: Optional[float] = None
    mode_paiement: Optional[str] = None
    payment_validated: Optional[bool] = None
    montant_a_encaisser: Optional[float] = None
    creneau_livraison: Optional[str] = None
    enroute_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    absent_at: Optional[datetime] = None
    produits: List[ProduitCommandeJourDTO] = []
    paiement: Optional[PaiementDTO] = None

class AdresseClientDTO(BaseModel):
    neighborhood: Optional[str] = None
    street: Optional[str] = None
    details: Optional[str] = None
    ville: Optional[str] = None
    is_default: Optional[bool] = None

class FicheClientDTO(BaseModel):
    id: int
    email: Optional[str] = None
    phone: Optional[str] = None
    created_at: Optional[datetime] = None
    last_login_at: Optional[datetime] = None
    is_active: Optional[bool] = None
    is_blacklisted: Optional[bool] = None
    auth_provider: Optional[str] = None
    is_email_verified: Optional[bool] = None
    is_phone_verified: Optional[bool] = None
    adresses: List[AdresseClientDTO] = []
    commandes: List[CommandeHistoriqueDTO] = []
    commandes_vocales: List[CommandeVocaleClientDTO] = []
    sessions: List[SessionClientDTO] = []
    notifications: Optional[NotificationPrefsDTO] = None
    abonnement: Optional[AbonnementClientDTO] = None

class CommandeJourDTO(BaseModel):
    id: int
    client_id: Optional[int] = None
    date_commande: Optional[datetime] = None
    statut: Optional[str] = None
    client_nom: str
    client_phone: Optional[str] = None
    is_blacklisted: Optional[bool] = None
    produits: List[ProduitCommandeJourDTO] = []
    volume_total_kg: float = 0.0
    montant_total: float = 0.0
    mode_paiement: Optional[str] = None
    creneau_livraison: Optional[str] = None

class CommandeCODDemainDTO(BaseModel):
    id: int
    client_id: Optional[int] = None
    nom_client: Optional[str] = None
    telephone: Optional[str] = None
    adresse: Optional[str] = None
    montant: Optional[float] = None
    creneau_livraison: Optional[str] = None
    statut_confirmation_cod: str = "NON_CONFIRMEE"

class UpdateConfirmationCODDTO(BaseModel):
    statut: str

class BatchConfirmationCODDTO(BaseModel):
    commande_ids: List[int]
    statut: str

class BatchConfirmationCODResponseDTO(BaseModel):
    success: List[int]
    failed: List[int]
    total: int
    message: str

class ConfirmationCODResponseDTO(BaseModel):
    commande_id: int
    statut_confirmation_cod: str
    commande_statut: Optional[str] = None
    logged_at: Optional[datetime] = None
    message: str
