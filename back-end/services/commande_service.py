import json
from config import LocalSession
from interfaces.commande_service_interface import ICommandeVocaleService
from interfaces.product_dao_interface import IProductDao
from interfaces.commande_dao_interface import ICommandeVocaleDao
from services.catalogue_service import CatalogueService
from dto.commande_dto import VoiceBasketResponseDTO
from api.algorithms import call_gemini, build_audio_parts, build_text_parts


class CommandeVocaleService(ICommandeVocaleService):

    def __init__(self, product_dao: IProductDao, commande_dao: ICommandeVocaleDao) -> None:
        self.product_dao = product_dao
        self.commande_dao = commande_dao
        self.session = None
        self.catalogue_service = None

    # ── Context manager ───────────────────────────────────────────────────────
    def __enter__(self):
        self.session = LocalSession()
        self.catalogue_service = CatalogueService(self.product_dao, self.session)
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            if exc_type is not None:
                self.session.rollback()
            self.session.close()

    # ── Méthodes publiques ────────────────────────────────────────────────────
    def traiter_texte(self, texte: str) -> VoiceBasketResponseDTO:
        parts = build_text_parts(texte)
        gemini_result = call_gemini(parts)
        return self._traiter_commande(
            texte_transcrit=gemini_result.get("transcription", texte),
            json_brut_gemini=json.dumps(gemini_result),
            langue=gemini_result.get("langue_detectee", "inconnu")
        )

    def traiter_audio(self, audio_b64: str, mime_type: str) -> VoiceBasketResponseDTO:
        parts = build_audio_parts(audio_b64, mime_type)
        gemini_result = call_gemini(parts)
        return self._traiter_commande(
            texte_transcrit=gemini_result.get("transcription", ""),
            json_brut_gemini=json.dumps(gemini_result),
            langue=gemini_result.get("langue_detectee", "inconnu")
        )

    # ── Méthode privée ────────────────────────────────────────────────────────
    def _traiter_commande(
        self, texte_transcrit: str, json_brut_gemini: str, langue: str
    ) -> VoiceBasketResponseDTO:
        commande_entity = self.commande_dao.create_commande(
            self.session, texte_transcrit, json_brut_gemini, langue
        )
        items_gemini = json.loads(json_brut_gemini).get("items", [])
        produits_non_disponibles, lignes_panier_dto, total = [], [], 0.0

        for item in items_gemini:
            ligne_dto, nom_manquant = self.catalogue_service.valider_et_ajuster_item(item)
            if ligne_dto:
                self.product_dao.decrement_stock(
                    self.session, ligne_dto.product_id, ligne_dto.quantite_effective
                )
                self.commande_dao.create_ligne(
                    self.session, commande_entity.id, ligne_dto.product_id,
                    ligne_dto.quantite_demandee, ligne_dto.quantite_effective,
                    ligne_dto.prix_unitaire, ligne_dto.sous_total,
                    ligne_dto.message_ajustement
                )
                lignes_panier_dto.append(ligne_dto)
                total += ligne_dto.sous_total
            else:
                produits_non_disponibles.append(nom_manquant)

        return VoiceBasketResponseDTO(
            status="success",
            transcription=texte_transcrit,
            langue_detectee=langue,
            produits_non_disponibles=produits_non_disponibles,
            lignes_panier=lignes_panier_dto,
            total_dh=round(total, 2),
            nombre_articles=len(lignes_panier_dto),
            commande_id=commande_entity.id if commande_entity else None
        )
