from abc import ABC, abstractmethod
import json
from typing import List, Optional
from config import LocalSession
from dto import VoiceBasketResponseDTO, LigneCommandeDTO
from interfaces import IProductDao, ICommandeVocaleDao
from api.algorithms import _call_gemini, SYSTEM_PROMPT


class ICommandeVocaleService(ABC):
    @abstractmethod
    def traiter_texte(self, texte: str) -> VoiceBasketResponseDTO:
        """Traite une commande en texte"""
        pass

    @abstractmethod
    def traiter_audio(self, audio_b64: str, mime_type: str) -> VoiceBasketResponseDTO:
        """Traite une commande audio"""
        pass


class CommandeVocaleService(ICommandeVocaleService):
    def __init__(self, product_dao: IProductDao, commande_dao: ICommandeVocaleDao, session=None):
        self.product_dao = product_dao
        self.commande_dao = commande_dao
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

    def traiter_texte(self, texte: str) -> VoiceBasketResponseDTO:
        if not self.session:
            self.session = LocalSession()

        try:
            # Appeler Gemini avec le texte
            gemini_response = _call_gemini(texte, mime_type=None, is_text=True)

            if not gemini_response:
                return VoiceBasketResponseDTO(status="error", transcription=texte)

            return self._traiter_reponse_gemini(gemini_response, texte)
        finally:
            if not hasattr(self, '_in_context'):
                self.session.close()

    def traiter_audio(self, audio_b64: str, mime_type: str) -> VoiceBasketResponseDTO:
        if not self.session:
            self.session = LocalSession()

        try:
            # Appeler Gemini avec l'audio
            gemini_response = _call_gemini(audio_b64, mime_type=mime_type, is_text=False)

            if not gemini_response:
                return VoiceBasketResponseDTO(status="error")

            return self._traiter_reponse_gemini(gemini_response)
        finally:
            if not hasattr(self, '_in_context'):
                self.session.close()

    def _traiter_reponse_gemini(self, gemini_response: str, transcription: Optional[str] = None) -> VoiceBasketResponseDTO:
        """Parse la réponse Gemini et construit le panier"""
        try:
            # Extraire le JSON de la réponse
            json_str = self._extract_json(gemini_response)
            data = json.loads(json_str)

            transcription_detectee = data.get("transcription", transcription or "")
            langue = data.get("langue_detectee", "")
            items = data.get("items", [])
            produits_non_dispo = data.get("produits_non_disponibles", [])

            # Créer la commande
            commande = self.commande_dao.create_commande(
                self.session, # type: ignore
                transcription_detectee,
                gemini_response,
                langue
            )

            if not commande:
                return VoiceBasketResponseDTO(status="error")

            # Traiter les lignes de commande
            lignes: List[LigneCommandeDTO] = []
            total_dh = 0.0

            for item in items:
                produit_darija = item.get("produit_darija", "")
                quantite = item.get("quantite", 1.0)

                # Chercher le produit
                product = self.product_dao.get_by_alias(self.session, produit_darija) # type: ignore

                if not product:
                    produits_non_dispo.append(produit_darija)
                    continue

                # Vérifier le stock
                quantite_effective = min(quantite, product.stock)

                if quantite_effective > 0:
                    sous_total = quantite_effective * product.prix_kg
                    total_dh += sous_total

                    # Créer la ligne
                    message = None
                    if quantite_effective < quantite:
                        message = f"Stock limité: {quantite_effective}/{quantite} demandé(e)"

                    self.commande_dao.create_ligne(
                        self.session, # type: ignore
                        commande.id, # type: ignore
                        product.id, # type: ignore
                        quantite,
                        quantite_effective,
                        product.prix_kg, # type: ignore
                        sous_total,
                        message
                    )

                    # Décrémenter le stock
                    self.product_dao.decrement_stock(self.session, product.id, quantite_effective) # type: ignore

                    lignes.append(LigneCommandeDTO(
                        product_id=product.id, # type: ignore
                        nom_produit=product.nom_fr, # type: ignore
                        quantite_demandee=quantite,
                        quantite_effective=quantite_effective,
                        prix_unitaire=product.prix_kg, # type: ignore
                        sous_total=sous_total,
                        message_ajustement=message
                    ))

            return VoiceBasketResponseDTO(
                status="success",
                transcription=transcription_detectee,
                langue_detectee=langue,
                produits_non_disponibles=produits_non_dispo,
                lignes_panier=lignes,
                total_dh=total_dh,
                nombre_articles=len(lignes),
                commande_id=commande.id # type: ignore
            )

        except Exception as e:
            print(f"Erreur traitement Gemini: {e}")
            return VoiceBasketResponseDTO(status="error")

    @staticmethod
    def _extract_json(text: str) -> str:
        """Extrait un JSON valide d'un texte"""
        start = text.find('{')
        end = text.rfind('}') + 1
        if start != -1 and end > start:
            return text[start:end]
        return "{}"
