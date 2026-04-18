from sqlalchemy.orm import Session
from typing import Optional
from interfaces.commande_dao_interface import ICommandeVocaleDao
from entities.commande_vocale_entity import CommandeVocale, LigneCommandeVocale


class CommandeVocaleDaoBD(ICommandeVocaleDao):

    def create_commande(
        self, session: Session, transcription: str, json_brut: str, langue: str
    ) -> Optional[CommandeVocale]:
        cmd = CommandeVocale(
            transcription_brute=transcription,
            json_gemini_brut=json_brut,
            langue_detectee=langue
        )
        session.add(cmd)
        session.flush()
        try:
            session.commit()
            session.refresh(cmd)
            return cmd
        except Exception as e:
            session.rollback()
            print(f"Erreur create commande: {e}")
            return None

    def create_ligne(
        self, session: Session, commande_id: int, product_id: int,
        qte_demandee: float, qte_effective: float, prix: float,
        sous_total: float, message: Optional[str]
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
        
    def get_details_for_checkout(self, session: Session, commande_id: int) -> Optional[dict]:
        cmd = session.query(CommandeVocale).filter(CommandeVocale.id == commande_id).first()
        if not cmd:
            return None
        
        lignes_formatees = []
        for ligne in cmd.lignes:
            lignes_formatees.append({
                "product_id": ligne.product_id,
                "nom_produit": ligne.produit.nom_fr if ligne.produit else "Produit supprimé",
                "quantite_effective": ligne.quantite_effective,
                "prix_unitaire": ligne.prix_unitaire,
                "sous_total": round(ligne.quantite_effective * ligne.prix_unitaire, 2),
                "unite": ligne.produit.unite if ligne.produit else "kg"
            })
            
        return {
            "commande_id": cmd.id,
            "transcription": cmd.transcription_brute,
            "lignes": lignes_formatees
        }
