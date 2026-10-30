from sqlalchemy import and_, or_
from sqlalchemy.orm import selectinload
from entities.address_entity import Address
from entities.client_entity import Client
from entities.commande_entity import Commande
from entities.commande_recurrente_entity import CommandeRecurrente, CommandeRecurrenteLigne, CommandeRecurrenteLivraison
from entities.jit_log_entity import JITLog
from entities.panier_entity import Panier
from entities.product_entity import Product
from entities.souki_wallet_entity import SoukiWallet
from entities.user_entity import User
from interfaces.commande_recurrente_dao_interface import ICommandeRecurrenteDao


class CommandeRecurrenteDao(ICommandeRecurrenteDao):
    def _query(self, session):
        return session.query(CommandeRecurrente).options(
            selectinload(CommandeRecurrente.lignes).selectinload(CommandeRecurrenteLigne.produit)
        )

    def get(self, session, recurrence_id, *, lock=False):
        query = self._query(session).filter(CommandeRecurrente.id == recurrence_id)
        if lock:
            query = query.with_for_update(of=CommandeRecurrente)
        return query.populate_existing().first()

    def get_owned(self, session, recurrence_id, client_id, *, lock=False):
        query = self._query(session).filter(CommandeRecurrente.id == recurrence_id, CommandeRecurrente.client_id == client_id)
        if lock:
            query = query.with_for_update(of=CommandeRecurrente)
        return query.populate_existing().first()

    def list_by_client(self, session, client_id):
        return self._query(session).filter(
            CommandeRecurrente.client_id == client_id, CommandeRecurrente.statut != "ARRETEE",
        ).order_by(CommandeRecurrente.prochaine_livraison, CommandeRecurrente.id).all()

    def list_all(self, session, *, statut=None, type=None, recherche=None, limit=300):
        query = self._query(session).join(User, User.id == CommandeRecurrente.client_id)
        if statut:
            query = query.filter(CommandeRecurrente.statut == statut)
        if type:
            query = query.filter(CommandeRecurrente.type == type)
        if recherche:
            pattern = f"%{recherche}%"
            query = query.filter(or_(User.nom.ilike(pattern), User.prenom.ilike(pattern), User.phone.ilike(pattern),
                                     CommandeRecurrente.contact_phone.ilike(pattern)))
        return query.order_by(CommandeRecurrente.created_at.desc(), CommandeRecurrente.id.desc()).limit(limit).all()

    def list_echeances(self, session, today):
        rows = session.query(CommandeRecurrente.id).filter(
            CommandeRecurrente.prochaine_livraison <= today,
            or_(CommandeRecurrente.statut == "ACTIVE",
                and_(CommandeRecurrente.statut == "EN_PAUSE", CommandeRecurrente.pause_jusqu_au <= today)),
        ).order_by(CommandeRecurrente.id).all()
        return [row.id for row in rows]

    def get_owned_commande(self, session, commande_id, client_id):
        return session.query(Commande).options(selectinload(Commande.panier).selectinload(Panier.lignes)).filter(
            Commande.id == commande_id, Commande.client_id == client_id,
        ).first()

    def get_products(self, session, product_ids):
        if not product_ids:
            return []
        return session.query(Product).filter(Product.id.in_(list(product_ids))).all()

    def get_client(self, session, user_id):
        return session.query(Client).filter(Client.user_id == user_id).first()

    def get_contact(self, session, user_id):
        user = session.get(User, user_id)
        address = session.query(Address).filter(Address.user_id == user_id).order_by(
            Address.is_default.desc(), Address.id.desc()).first()
        return dict(
            phone=(user.phone if user else None) or "",
            street=(address.street if address else None) or "",
            ville=(address.ville if address else None) or "",
            details=address.details if address else None,
        )

    def get_users(self, session, user_ids):
        if not user_ids:
            return {}
        return {user.id: user for user in session.query(User).filter(User.id.in_(list(user_ids))).all()}

    def create(self, session, values, lignes):
        row = CommandeRecurrente(**values)
        row.lignes = [CommandeRecurrenteLigne(**ligne) for ligne in lignes]
        session.add(row)
        session.flush()
        return row

    def update(self, session, recurrence, values):
        for key, value in values.items():
            setattr(recurrence, key, value)
        session.flush()

    def replace_lignes(self, session, recurrence, lignes):
        recurrence.lignes.clear()
        session.flush()
        recurrence.lignes.extend(CommandeRecurrenteLigne(**ligne) for ligne in lignes)
        session.flush()

    def set_prix_reference(self, session, recurrence, prix_par_produit):
        for ligne in recurrence.lignes:
            if ligne.product_id in prix_par_produit:
                ligne.prix_reference = prix_par_produit[ligne.product_id]
        session.flush()

    def get_livraison(self, session, recurrence_id, date_livraison):
        return session.query(CommandeRecurrenteLivraison).filter_by(
            recurrence_id=recurrence_id, date_livraison=date_livraison).first()

    def save_livraison(self, session, recurrence_id, date_livraison, statut, *, commande_id=None, montant=None, motif=None):
        row = self.get_livraison(session, recurrence_id, date_livraison)
        if row is None:
            row = CommandeRecurrenteLivraison(recurrence_id=recurrence_id, date_livraison=date_livraison)
            session.add(row)
        row.statut, row.commande_id, row.montant, row.motif = statut, commande_id, montant, motif
        session.flush()
        return row

    def dernieres_livraisons(self, session, recurrence_ids, limit=5):
        if not recurrence_ids:
            return {}
        rows = session.query(CommandeRecurrenteLivraison).filter(
            CommandeRecurrenteLivraison.recurrence_id.in_(list(recurrence_ids))
        ).order_by(CommandeRecurrenteLivraison.date_livraison.desc(), CommandeRecurrenteLivraison.id.desc()).all()
        grouped = {}
        for row in rows:
            items = grouped.setdefault(row.recurrence_id, [])
            if len(items) < limit:
                items.append(row)
        return grouped

    def livraisons_du_jour(self, session, date_livraison):
        return session.query(CommandeRecurrenteLivraison, CommandeRecurrente).join(
            CommandeRecurrente, CommandeRecurrente.id == CommandeRecurrenteLivraison.recurrence_id,
        ).filter(CommandeRecurrenteLivraison.date_livraison == date_livraison).order_by(
            CommandeRecurrenteLivraison.statut, CommandeRecurrenteLivraison.id).all()

    def commande_ids(self, session, date_debut, date_fin):
        rows = session.query(CommandeRecurrenteLivraison.commande_id).filter(
            CommandeRecurrenteLivraison.commande_id.isnot(None),
            CommandeRecurrenteLivraison.date_livraison >= date_debut,
            CommandeRecurrenteLivraison.date_livraison <= date_fin,
        ).all()
        return [row.commande_id for row in rows]

    def jit_deja_execute(self, session, date_livraison):
        return session.query(JITLog.id).filter(
            JITLog.date_livraison == date_livraison, JITLog.statut.in_(("succès", "aucune_commande")),
        ).first() is not None

    def wallet_balance(self, session, user_id):
        wallet = session.query(SoukiWallet).filter(SoukiWallet.user_id == user_id).first()
        return float(wallet.balance) if wallet is not None and wallet.balance is not None else None
