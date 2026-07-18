import base64
import json
from typing import Optional, List
from config import LocalSession
from fastapi import HTTPException
from sqlalchemy.orm import Session
from interfaces.commande_service_interface import ICommandeVocaleService
from interfaces.product_dao_interface import IProductDao
from interfaces.commande_dao_interface import ICommandeVocaleDao
from services.catalogue_service import CatalogueService
from dto.commande_dto import VoiceBasketResponseDTO, CommandeCheckoutDTO, LigneCheckoutDTO, CommandeHistoriqueDTO, CommandeJourDTO, FicheClientDTO
from api.algorithms import call_gemini, build_audio_parts, build_text_parts


MIN_AUDIO_SIZE_BYTES = 5000


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
            else :
                self.session.commit()
            self.session.close()

    # ── Méthodes publiques ────────────────────────────────────────────────────
    def traiter_texte(self, user_id: int, texte: str) -> VoiceBasketResponseDTO:
        # Pre-check deterministe (couche plats marocains): si le texte designe un
        # plat connu, la composition est resolue localement sans appeler Gemini.
        dish_match = self._match_dish(texte)
        if dish_match is not None:
            return self._traiter_commande(
                user_id,
                texte_transcrit=texte,
                json_brut_gemini=json.dumps(
                    {
                        "items": dish_match["items"],
                        "transcription": texte,
                        "langue_detectee": "fr",
                        "source": "plat_marocain",
                        "dish_id": dish_match["dish"]["dish_id"],
                    },
                    ensure_ascii=False,
                ),
                langue="fr",
                produits_indisponibles_extra=dish_match["ingredients_manquants"],
            )

        parts = build_text_parts(texte)
        gemini_result = call_gemini(parts)
        return self._traiter_commande(
            user_id,
            texte_transcrit=gemini_result.get("transcription", texte),
            json_brut_gemini=json.dumps(gemini_result),
            langue=gemini_result.get("langue_detectee", "inconnu")
        )

    def _match_dish(self, texte: str):
        try:
            from services.dish_composition_service import dish_composition_service

            if dish_composition_service.product_dao is None:
                dish_composition_service.product_dao = self.product_dao
            return dish_composition_service.items_for_text(texte)
        except Exception:
            # La couche plats ne doit jamais casser le flux vocal existant.
            return None

    def traiter_audio(self, user_id: int, audio_b64: str, mime_type: str) -> VoiceBasketResponseDTO:
        self._validate_audio_payload(audio_b64)
        parts = build_audio_parts(audio_b64, mime_type)
        gemini_result = call_gemini(parts)
        self._validate_gemini_audio_result(gemini_result)

        # Pre-check plats marocains sur la transcription: composition deterministe
        # prioritaire sur l'extraction Gemini quand un plat connu est reconnu.
        transcription = str(gemini_result.get("transcription") or "")
        dish_match = self._match_dish(transcription) if transcription else None
        if dish_match is not None:
            return self._traiter_commande(
                user_id,
                texte_transcrit=transcription,
                json_brut_gemini=json.dumps(
                    {
                        "items": dish_match["items"],
                        "transcription": transcription,
                        "langue_detectee": gemini_result.get("langue_detectee", "inconnu"),
                        "source": "plat_marocain",
                        "dish_id": dish_match["dish"]["dish_id"],
                    },
                    ensure_ascii=False,
                ),
                langue=gemini_result.get("langue_detectee", "inconnu"),
                produits_indisponibles_extra=dish_match["ingredients_manquants"],
            )

        return self._traiter_commande(
            user_id,
            texte_transcrit=gemini_result.get("transcription", ""),
            json_brut_gemini=json.dumps(gemini_result),
            langue=gemini_result.get("langue_detectee", "inconnu")
        )

    def _validate_audio_payload(self, audio_b64: str) -> None:
        try:
            audio_bytes = base64.b64decode(audio_b64, validate=True)
        except Exception as exc:
            raise HTTPException(status_code=400, detail="Audio invalide.") from exc

        if len(audio_bytes) < MIN_AUDIO_SIZE_BYTES:
            raise HTTPException(
                status_code=400,
                detail="Aucune voix detectee. Appuyez et parlez.",
            )

    def _validate_gemini_audio_result(self, gemini_result: dict) -> None:
        if gemini_result.get("error"):
            raise HTTPException(
                status_code=502,
                detail="Assistant vocal indisponible. Reessayez dans quelques instants.",
            )

        transcription = str(gemini_result.get("transcription") or "").strip()
        items = gemini_result.get("items") or []
        if not transcription and not items:
            raise HTTPException(
                status_code=400,
                detail="Aucune voix detectee. Appuyez et parlez.",
            )

    # ── Méthode privée ────────────────────────────────────────────────────────
    def _traiter_commande(
        self, user_id: int, texte_transcrit: str, json_brut_gemini: str, langue: str,
        produits_indisponibles_extra: Optional[List[str]] = None,
    ) -> VoiceBasketResponseDTO:
        commande_entity = self.commande_dao.create_commande(
            self.session, user_id, texte_transcrit, json_brut_gemini, langue # type: ignore
        )
        items_gemini = json.loads(json_brut_gemini).get("items", [])
        print("🛠️ RÉPONSE BRUTE DE GEMINI :")
        print(json_brut_gemini)
        print("🛠️ FIN DE RÉPONSE")
        produits_non_disponibles, lignes_panier_dto, total = list(produits_indisponibles_extra or []), [], 0.0

        for item in items_gemini:
            ligne_dto, nom_manquant = self.catalogue_service.valider_et_ajuster_item(item) # type: ignore
            if ligne_dto:
                self.product_dao.decrement_stock(
                    self.session, ligne_dto.product_id, ligne_dto.quantite_effective # type: ignore
                )
                self.commande_dao.create_ligne(
                    self.session, commande_entity.id, ligne_dto.product_id, # type: ignore
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
            commande_id=commande_entity.id if commande_entity else None # type: ignore
        )
    
    def get_commande_checkout(self, commande_id: int, user_id: int) -> Optional[CommandeCheckoutDTO]:
        # Le Service ne sait pas d'où vient self.session, il l'utilise juste.
        # Le user_id est propage jusqu'au DAO pour filtrer par proprietaire (anti-IDOR).
        data_brutes = self.commande_dao.get_details_for_checkout(self.session, commande_id, user_id) # type: ignore
        
        if not data_brutes:
            return None
        
        lignes_dto = [LigneCheckoutDTO(**ligne) for ligne in data_brutes["lignes"]]
        total = sum(ligne.sous_total for ligne in lignes_dto)
        
        return CommandeCheckoutDTO(
            commande_id=data_brutes["commande_id"],
            transcription=data_brutes["transcription"],
            lignes=lignes_dto,
            total_dh=round(total, 2)
        )

    def get_commandes_du_jour(self, session: Session) -> List[CommandeJourDTO]:
        return self.commande_dao.get_commandes_du_jour(session)

    def get_historique_client(self, client_id: int) -> List[CommandeHistoriqueDTO]:
        return self.commande_dao.get_historique_client(self.session, client_id)  # type: ignore

    def delete_historique_commande(self, client_id: int, commande_id: int) -> bool:
        return self.commande_dao.hide_commande_from_client_history(self.session, client_id, commande_id)  # type: ignore

    def get_fiche_client(self, session: Session, client_id: int) -> Optional[FicheClientDTO]:
        return self.commande_dao.get_fiche_client(session, client_id)
