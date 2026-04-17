from sqlalchemy.orm import Session
from typing import Optional
from entities import CommandeVocale, LigneCommandeVocale
from interfaces import ICommandeVocaleDao


class CommandeVocaleDaoBD(ICommandeVocaleDao):
    def create_commande(
        self,
        session: Session,
        transcription: str,
        json_brut: str,
        langue: str
    ) -> Optional[CommandeVocale]:
        cmd = CommandeVocale(
            transcription_brute=transcription,
            json_gemini_brut=json_brut,
            langue_detectee=langue
        )
        session.add(cmd)
        try:
            session.commit()
            session.refresh(cmd)
            return cmd
        except Exception as e:
            session.rollback()
            print(f"Erreur create commande: {e}")
            return None

    def create_ligne(
        self,
        session: Session,
        commande_id: int,
        product_id: int,
        qte_demandee: float,
        qte_effective: float,
        prix: float,
        sous_total: float,
        message: Optional[str]
    ) -> bool:
        ligne = LigneCommandeVocale(
            commande_id=commande_id,
            product_id=product_id,
            quantite_demandee=qte_demandee,
            quantite_effective=qte_effective,
            prix_unitaire=prix,
            sous_total=sous_total,
            message_ajustement=message
        )
        session.add(ligne)
        try:
            session.commit()
            return True
        except Exception as e:
            session.rollback()
            print(f"Erreur create ligne: {e}")
            return False
