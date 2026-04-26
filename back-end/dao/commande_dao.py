from datetime import date, datetime, time
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload
from typing import Optional, List
from interfaces.commande_dao_interface import ICommandeVocaleDao
from dto.commande_dto import CommandeJourDTO, ProduitCommandeJourDTO
from entities.commande_entity import Commande
from entities.commande_vocale_entity import CommandeVocale, LigneCommandeVocale
from entities.client_entity import Client
from entities.ligne_panier_entity import LignePanier
from entities.panier_entity import Panier
from entities.product_entity import Product


class CommandeVocaleDaoBD(ICommandeVocaleDao):

    def create_commande(
        self, session: Session, user_id: int, transcription: str, json_brut: str, langue: str
    ) -> Optional[CommandeVocale]:
        cmd = CommandeVocale(
            user_id=user_id,
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

    def get_commandes_du_jour(self, session: Session) -> List[CommandeJourDTO]:
        today = date.today()
        start_of_day = datetime.combine(today, time.min)
        end_of_day = datetime.combine(today, time.max)

        commandes = (
            session.query(Commande)
            .join(Client, Client.user_id == Commande.client_id)
            .join(Panier, Panier.id == Commande.panier_id)
            .outerjoin(LignePanier, LignePanier.panier_id == Panier.id)
            .outerjoin(Product, Product.id == LignePanier.produit_id)
            .options(
                joinedload(Commande.client).joinedload(Client.user),
                joinedload(Commande.panier)
                .joinedload(Panier.lignes)
                .joinedload(LignePanier.produit),
            )
            .filter(
                Commande.date_commande >= start_of_day,
                Commande.date_commande <= end_of_day,
                func.upper(func.coalesce(Commande.statut, "")) != "BROUILLON",
            )
            .order_by(Commande.date_commande.desc(), Commande.id.desc())
            .all()
        )

        commandes_dto = []
        for commande in commandes:
            user = commande.client.user if commande.client else None
            client_phone = str(user.phone) if user and user.phone else None
            if user and user.email:
                client_nom = str(user.email)
            elif user and user.phone:
                client_nom = str(user.phone)
            elif commande.client_id:
                client_nom = f"Client #{commande.client_id}"
            else:
                client_nom = "Client inconnu"

            produits = []
            volume_total_kg = 0.0
            if commande.panier:
                for ligne in commande.panier.lignes:
                    produit = ligne.produit
                    quantite_kg = float(ligne.quantite_kg or 0.0)
                    volume_total_kg += quantite_kg
                    produits.append(
                        ProduitCommandeJourDTO(
                            nom_fr=str(produit.nom_fr) if produit else "Produit supprime",
                            quantite_kg=quantite_kg,
                        )
                    )

            commandes_dto.append(
                CommandeJourDTO(
                    id=int(commande.id),  # type: ignore
                    date_commande=commande.date_commande,  # type: ignore
                    statut=str(commande.statut) if commande.statut else None,
                    client_nom=client_nom,
                    client_phone=client_phone,
                    produits=produits,
                    volume_total_kg=round(volume_total_kg, 2),
                    montant_total=float(commande.montant_total or 0.0),
                    mode_paiement=str(commande.mode_paiement) if commande.mode_paiement else None,
                    creneau_livraison=str(commande.creneau_livraison) if commande.creneau_livraison else None,
                )
            )

        return commandes_dto
