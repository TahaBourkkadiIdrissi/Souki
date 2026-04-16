from dao import UserDao, AddressDao
from entities import User, Address
from security import hash_password, verify_password, create_access_token
from config import LocalSession
import re
import json
import google.genai as genai
from abc import ABC, abstractmethod
from typing import Optional,List
from dto import VoiceBasketResponseDTO, LigneCommandeDTO, ProductResponseDTO
from dao import IProductDao, ICommandeVocaleDao, ProductDaoBD, CommandeVocaleDaoBD
from settings import settings
import base64 


class AuthService:
    def register(self, data):
        db = LocalSession()
        try:
            # Sécurité : On interdit de s'enregistrer comme ADMIN via l'API publique
            if data.role.upper() == "ADMIN":
                data.role = "CLIENT"
                
            new_user = User(
                email=data.email,
                phone=data.phone,
                password=hash_password(data.password),
                role=data.role.upper()
            )
            return UserDao.create(db, new_user)
        finally:
            db.close() # <-- Libère la connexion pour le prochain utilisateur

    def login(self, data):
        db = LocalSession()
        try:
            user = UserDao.find_by_identifier(db, data.login_id)
            if user and verify_password(data.password, user.password):
                return create_access_token({"sub": str(user.id), "role": user.role})
            return None
        finally:
            db.close() # <-- Libère la connexion

class ProfileService:
    def add_address(self, user_id: int, data):
        db = LocalSession()
        try:
            if AddressDao.get_count(db, user_id) >= 3:
                return None # Limite atteinte
            
            # Note : data.dict() est déprécié dans Pydantic V2, on utilise model_dump() si tu es sur une version récente
            address_data = data.dict() if hasattr(data, 'dict') else data.model_dump()
            
            new_addr = Address(user_id=user_id, **address_data)
            return AddressDao.create(db, new_addr)
        finally:
            db.close() # <-- Libère la connexion











MODELS = ["models/gemini-2.5-flash", "models/gemini-2.0-flash", "models/gemini-2.0-flash-lite"]
SYSTEM_PROMPT = """Tu es l'assistant vocal SOUKI. Extrais les produits. Réponds UNIQUEMENT avec un JSON valide, sans markdown.
Format exact : {"transcription": "texte", "langue_detectee": "darija|français|mixte", "items": [{"produit_darija": "btata", "produit_fr": "Pommes de terre", "quantite": 2.0, "unite": "kg"}], "produits_non_disponibles": []}
Règles: "nos" ou "noss" = 0.5. Si pas de quantité = 1."""

# ==========================================
# INTERFACES SERVICES
# ==========================================
class ICatalogueService(ABC):
    @abstractmethod
    def get_catalogue_complet(self) -> List[ProductResponseDTO]: pass

class ICommandeVocaleService(ABC):
    @abstractmethod
    def traiter_texte(self, texte: str) -> VoiceBasketResponseDTO: pass
    
    @abstractmethod
    def traiter_audio(self, audio_b64: str, mime_type: str) -> VoiceBasketResponseDTO: pass

# ==========================================
# IMPLEMENTATIONS SERVICES
# ==========================================
class CatalogueService(ICatalogueService):
    # On injecte l'interface du DAO, et optionnellement une session partagée
    def __init__(self, product_dao: IProductDao, session=None) -> None:
        self.product_dao = product_dao
        self.session = session

    def __enter__(self):
        if self.session is None:
            self.session = LocalSession()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            if exc_type is not None:
                self.session.rollback()
            self.session.close()

    def get_catalogue_complet(self) -> List[ProductResponseDTO]:
        products = self.product_dao.get_all(self.session)
        return [ProductResponseDTO(
            id=p.id, nom_fr=str(p.nom_fr), nom_darija=str(p.nom_darija),
            prix_kg=float(p.prix_kg), unite=str(p.unite), stock=float(p.stock)
        ) for p in products]

    def valider_et_ajuster_item(self, item_gemini: dict):
        alias = item_gemini.get("produit_darija") or item_gemini.get("produit_fr")
        if not alias: return None, "Inconnu"
        
        produit = self.product_dao.get_by_alias(self.session, alias)
        if not produit: return None, alias

        qte_demandee = float(item_gemini.get("quantite", 1.0))
        qte_effective = qte_demandee
        message = None

        if qte_demandee > produit.stock:
            qte_effective = produit.stock
            if qte_effective == 0: return None, alias
            message = f"Stock limité à {produit.stock} {produit.unite} pour {produit.nom_fr}"

        sous_total = round(qte_effective * produit.prix_kg, 2)
        return LigneCommandeDTO(
            product_id=produit.id, nom_produit=produit.nom_fr, quantite_demandee=qte_demandee,
            quantite_effective=qte_effective, prix_unitaire=produit.prix_kg, sous_total=sous_total,
            message_ajustement=message
        ), None


class CommandeVocaleService(ICommandeVocaleService):
    # On injecte les interfaces des DAO
    def __init__(self, product_dao: IProductDao, commande_dao: ICommandeVocaleDao) -> None:
        self.product_dao = product_dao
        self.commande_dao = commande_dao
        self.session = None
        self.catalogue_service = None
        self.client = genai.Client(api_key=settings.GEMINI_API_KEY)

    def __enter__(self):
        self.session = LocalSession()
        # On passe la session au catalogue pour garantir la même transaction
        self.catalogue_service = CatalogueService(self.product_dao, self.session)
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type is not None:
            self.session.rollback()
        self.session.close()

    def _call_gemini(self, prompt_parts: list) -> dict:
        last_error = None
        for model_name in MODELS:
            try:
                response = self.client.models.generate_content(model=model_name, contents=prompt_parts)
                raw = response.text.strip()
                raw = re.sub(r'^```json\s*', '', raw)
                raw = re.sub(r'^```\s*', '', raw)
                raw = re.sub(r'\s*```$', '', raw)
                return json.loads(raw)
            except Exception as e:
                last_error = e
                if "429" not in str(e) and "quota" not in str(e).lower(): raise e
        raise last_error

    def traiter_commande(self, texte_transcrit: str, json_brut_gemini: str, langue: str) -> VoiceBasketResponseDTO:
        commande_entity = self.commande_dao.create_commande(self.session, texte_transcrit, json_brut_gemini, langue)
        items_gemini = json.loads(json_brut_gemini).get("items", [])
        produits_non_disponibles, lignes_panier_dto, total = [], [], 0.0

        for item in items_gemini:
            ligne_dto, nom_manquant = self.catalogue_service.valider_et_ajuster_item(item)
            if ligne_dto:
                self.product_dao.decrement_stock(self.session, ligne_dto.product_id, ligne_dto.quantite_effective)
                self.commande_dao.create_ligne(self.session, commande_entity.id, ligne_dto.product_id, ligne_dto.quantite_demandee, ligne_dto.quantite_effective, ligne_dto.prix_unitaire, ligne_dto.sous_total, ligne_dto.message_ajustement)
                lignes_panier_dto.append(ligne_dto)
                total += ligne_dto.sous_total
            else:
                produits_non_disponibles.append(nom_manquant)

        return VoiceBasketResponseDTO(status="success", transcription=texte_transcrit, langue_detectee=langue, produits_non_disponibles=produits_non_disponibles, lignes_panier=lignes_panier_dto, total_dh=round(total, 2), nombre_articles=len(lignes_panier_dto), commande_id=commande_entity.id if commande_entity else None)

    def traiter_audio(self, audio_b64: str, mime_type: str) -> VoiceBasketResponseDTO:
        from google.genai import types 
        
        audio_part = types.Part.from_bytes(
            data=base64.b64decode(audio_b64), 
            mime_type=mime_type
        )
        
        prompt_parts = [
            SYSTEM_PROMPT, 
            audio_part, 
            "Analyse cette commande vocale et retourne le JSON structuré."
        ]
        
        gemini_result = self._call_gemini(prompt_parts)
        return self.traiter_commande(gemini_result.get("transcription", ""), json.dumps(gemini_result), gemini_result.get("langue_detectee", "inconnu"))

    def traiter_texte(self, texte: str) -> VoiceBasketResponseDTO:
        prompt_parts = [SYSTEM_PROMPT, f"Commande client : \"{texte}\"\n\nRetourne le JSON structuré."]
        gemini_result = self._call_gemini(prompt_parts)
        return self.traiter_commande(gemini_result.get("transcription", texte), json.dumps(gemini_result), gemini_result.get("langue_detectee", "inconnu"))
        #git add . 