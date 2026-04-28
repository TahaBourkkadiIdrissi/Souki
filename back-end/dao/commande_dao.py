from datetime import date, datetime, time
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload
from typing import Optional, List
from interfaces.commande_dao_interface import ICommandeVocaleDao
from dto.commande_dto import (
    AbonnementClientDTO,
    AdresseClientDTO,
    CommandeHistoriqueDTO,
    CommandeJourDTO,
    CommandeVocaleClientDTO,
    FicheClientDTO,
    NotificationPrefsDTO,
    PaiementDTO,
    ProduitCommandeJourDTO,
    SessionClientDTO,
)
from entities.abonnement_entity import Abonnement
from entities.address_entity import Address
from entities.commande_entity import Commande
from entities.commande_vocale_entity import CommandeVocale, LigneCommandeVocale
from entities.client_entity import Client
from entities.ligne_panier_entity import LignePanier
from entities.panier_entity import Panier
from entities.product_entity import Product
from entities.user_entity import User
from entities.user_notification_preferences_entity import UserNotificationPreferences
from entities.user_session_entity import UserSession


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
                    client_id=int(commande.client_id) if commande.client_id else None,  # type: ignore
                    date_commande=commande.date_commande,  # type: ignore
                    statut=str(commande.statut) if commande.statut else None,
                    client_nom=client_nom,
                    client_phone=client_phone,
                    is_blacklisted=bool(commande.client.is_blacklisted) if commande.client and commande.client.is_blacklisted is not None else None,
                    produits=produits,
                    volume_total_kg=round(volume_total_kg, 2),
                    montant_total=float(commande.montant_total or 0.0),
                    mode_paiement=str(commande.mode_paiement) if commande.mode_paiement else None,
                    creneau_livraison=str(commande.creneau_livraison) if commande.creneau_livraison else None,
                )
            )

        return commandes_dto

    def get_fiche_client(self, session: Session, client_id: int) -> Optional[FicheClientDTO]:
        client = (
            session.query(Client)
            .join(User, User.id == Client.user_id)
            .options(joinedload(Client.user))
            .filter(Client.user_id == client_id)
            .first()
        )
        if not client:
            return None

        user = client.user
        commandes_dto = []
        commandes = (
            session.query(Commande)
            .options(
                joinedload(Commande.panier)
                .joinedload(Panier.lignes)
                .joinedload(LignePanier.produit),
                joinedload(Commande.paiement),
            )
            .filter(Commande.client_id == client_id)
            .filter(func.upper(func.coalesce(Commande.statut, "")) != "BROUILLON")
            .order_by(Commande.date_commande.desc(), Commande.id.desc())
            .all()
        )

        for commande in commandes:
            produits = []
            if commande.panier:
                for ligne in commande.panier.lignes:
                    produit = ligne.produit
                    produits.append(
                        ProduitCommandeJourDTO(
                            nom_fr=str(produit.nom_fr) if produit else "Produit supprime",
                            quantite_kg=float(ligne.quantite_kg or 0.0),
                        )
                    )

            paiement = commande.paiement
            paiement_dto = None
            if paiement:
                paiement_dto = PaiementDTO(
                    methode=str(paiement.methode) if paiement.methode else None,
                    montant=float(paiement.montant) if paiement.montant is not None else None,
                    valide=bool(paiement.valide) if paiement.valide is not None else None,
                    frais_cmi=float(paiement.frais_cmi) if paiement.frais_cmi is not None else None,
                    montant_net=float(paiement.montant_net) if paiement.montant_net is not None else None,
                )

            payment_validated = bool(commande.payment_validated or (paiement and paiement.valide))
            mode_paiement = str(commande.mode_paiement) if commande.mode_paiement else None
            montant_total = float(commande.montant_total or 0.0)
            montant_a_encaisser = montant_total if self._is_cod_mode(mode_paiement) and not payment_validated else 0.0

            commandes_dto.append(
                CommandeHistoriqueDTO(
                    id=int(commande.id),  # type: ignore
                    date_commande=commande.date_commande,  # type: ignore
                    statut=str(commande.statut) if commande.statut else None,
                    montant_total=montant_total,
                    mode_paiement=mode_paiement,
                    payment_validated=payment_validated,
                    montant_a_encaisser=montant_a_encaisser,
                    creneau_livraison=str(commande.creneau_livraison) if commande.creneau_livraison else None,
                    enroute_at=commande.enroute_at,  # type: ignore
                    delivered_at=commande.delivered_at,  # type: ignore
                    absent_at=commande.absent_at,  # type: ignore
                    produits=produits,
                    paiement=paiement_dto,
                )
            )

        commandes_vocales_dto = []
        try:
            commandes_vocales = (
                session.query(CommandeVocale)
                .filter(CommandeVocale.user_id == client_id)
                .order_by(CommandeVocale.created_at.desc(), CommandeVocale.id.desc())
                .all()
            )
            commandes_vocales_dto = [
                CommandeVocaleClientDTO(
                    id=int(commande_vocale.id),  # type: ignore
                    created_at=commande_vocale.created_at,  # type: ignore
                    langue_detectee=str(commande_vocale.langue_detectee) if commande_vocale.langue_detectee else None,
                    transcription_brute=str(commande_vocale.transcription_brute) if commande_vocale.transcription_brute else None,
                )
                for commande_vocale in commandes_vocales
            ]
        except Exception:
            commandes_vocales_dto = []

        sessions_dto = []
        try:
            sessions = (
                session.query(UserSession)
                .filter(UserSession.user_id == client_id)
                .order_by(UserSession.last_active.desc(), UserSession.created_at.desc())
                .all()
            )
            sessions_dto = [
                SessionClientDTO(
                    device_name=str(user_session.device_name) if user_session.device_name else None,
                    browser=str(user_session.browser) if user_session.browser else None,
                    location=str(user_session.location) if user_session.location else None,
                    ip=str(user_session.ip) if user_session.ip else None,
                    last_active=user_session.last_active,  # type: ignore
                    created_at=user_session.created_at,  # type: ignore
                    is_active=bool(user_session.is_active) if user_session.is_active is not None else None,
                )
                for user_session in sessions
            ]
        except Exception:
            sessions_dto = []

        notifications_dto = None
        try:
            notifications = (
                session.query(UserNotificationPreferences)
                .filter(UserNotificationPreferences.user_id == client_id)
                .first()
            )
            if notifications:
                notifications_dto = NotificationPrefsDTO(
                    email=bool(notifications.email) if notifications.email is not None else None,
                    push=bool(notifications.push) if notifications.push is not None else None,
                    sms=bool(notifications.sms) if notifications.sms is not None else None,
                    order_updates=bool(notifications.order_updates) if notifications.order_updates is not None else None,
                    promotions=bool(notifications.promotions) if notifications.promotions is not None else None,
                    newsletter=bool(notifications.newsletter) if notifications.newsletter is not None else None,
                )
        except Exception:
            notifications_dto = None

        abonnement_dto = None
        try:
            abonnement = (
                session.query(Abonnement)
                .filter(Abonnement.enfant_id == client_id)
                .order_by(Abonnement.actif.desc(), Abonnement.id.desc())
                .first()
            )
            if abonnement:
                abonnement_dto = AbonnementClientDTO(
                    poids_garanti=float(abonnement.poids_garanti) if abonnement.poids_garanti is not None else None,
                    frequence=str(abonnement.frequence) if abonnement.frequence else None,
                    montant_mensuel=float(abonnement.montant_mensuel) if abonnement.montant_mensuel is not None else None,
                    actif=bool(abonnement.actif) if abonnement.actif is not None else None,
                )
        except Exception:
            abonnement_dto = None

        adresses_dto = []
        try:
            adresses = (
                session.query(Address)
                .join(User, User.id == Address.user_id)
                .filter(User.id == client_id)
                .order_by(Address.is_default.desc(), Address.id.desc())
                .all()
            )
            adresses_dto = [
                AdresseClientDTO(
                    neighborhood=str(adresse.neighborhood) if adresse.neighborhood else None,
                    street=str(adresse.street) if adresse.street else None,
                    details=str(adresse.details) if adresse.details else None,
                    ville=str(adresse.ville) if adresse.ville else None,
                    is_default=bool(adresse.is_default) if adresse.is_default is not None else None,
                )
                for adresse in adresses
            ]
        except Exception:
            adresses_dto = []

        return FicheClientDTO(
            id=int(client.user_id),  # type: ignore
            email=str(user.email) if user and user.email else None,
            phone=str(user.phone) if user and user.phone else None,
            created_at=user.created_at if user else None,  # type: ignore
            last_login_at=user.last_login_at if user else None,  # type: ignore
            is_active=bool(user.is_active) if user and user.is_active is not None else None,
            is_blacklisted=bool(client.is_blacklisted) if client.is_blacklisted is not None else None,
            auth_provider=str(user.auth_provider) if user and user.auth_provider else None,
            is_email_verified=bool(user.is_email_verified) if user and user.is_email_verified is not None else None,
            is_phone_verified=bool(user.is_phone_verified) if user and user.is_phone_verified is not None else None,
            adresses=adresses_dto,
            commandes=commandes_dto,
            commandes_vocales=commandes_vocales_dto,
            sessions=sessions_dto,
            notifications=notifications_dto,
            abonnement=abonnement_dto,
        )

    def _is_cod_mode(self, mode_paiement: Optional[str]) -> bool:
        normalized_mode = (mode_paiement or "").strip().casefold()
        return normalized_mode in {"cod", "cash", "especes", "especes_livraison", "cash_on_delivery"}
