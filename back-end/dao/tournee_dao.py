from datetime import date
from typing import List

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload, selectinload

from entities.client_entity import Client
from entities.commande_entity import Commande
from entities.ligne_panier_entity import LignePanier
from entities.livreur_entity import Livreur
from entities.panier_entity import Panier
from entities.tournee_entity import Tournee
from entities.user_entity import User
from interfaces.tournee_dao_interface import ITourneeDao


class TourneeDaoBD(ITourneeDao):

    def create_tournee(
        self,
        session: Session,
        livreur_id: int,
        date_tournee: date,
    ) -> Tournee:
        tournee = Tournee(
            livreur_id=livreur_id,
            date_tournee=date_tournee,
            statut="PLANIFIEE",
        )
        session.add(tournee)
        session.flush()
        return tournee

    def get_tournees_by_date(self, session: Session, date_tournee: date) -> List[Tournee]:
        return (
            session.query(Tournee)
            .options(
                joinedload(Tournee.livreur),
                selectinload(Tournee.commandes),
            )
            .filter(Tournee.date_tournee == date_tournee)
            .order_by(Tournee.id.asc())
            .all()
        )

    def get_tournees_with_details(self, session: Session, target_date: date) -> List[Tournee]:
        return (
            session.query(Tournee)
            .options(
                joinedload(Tournee.livreur).joinedload(Livreur.user),
                selectinload(Tournee.commandes)
                .joinedload(Commande.client)
                .joinedload(Client.user)
                .selectinload(User.addresses),
                selectinload(Tournee.commandes)
                .joinedload(Commande.panier)
                .selectinload(Panier.lignes)
                .joinedload(LignePanier.produit),
            )
            .filter(Tournee.date_tournee == target_date)
            .order_by(Tournee.id.asc())
            .all()
        )

    def get_tournee_by_id(
        self,
        session: Session,
        tournee_id: int,
        for_update: bool = False,
    ) -> Tournee | None:
        query = (
            session.query(Tournee)
            .options(joinedload(Tournee.livreur))
            .filter(Tournee.id == tournee_id)
        )
        if for_update:
            query = query.with_for_update(of=Tournee)
        return query.first()

    def get_next_ordre_passage(self, session: Session, tournee_id: int) -> int:
        max_ordre = (
            session.query(func.max(Commande.ordre_passage))
            .filter(Commande.tournee_id == tournee_id)
            .scalar()
        )
        return int(max_ordre or 0) + 1
