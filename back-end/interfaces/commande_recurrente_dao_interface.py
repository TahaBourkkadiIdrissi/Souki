from abc import ABC, abstractmethod


class ICommandeRecurrenteDao(ABC):
    @abstractmethod
    def get(self, session, recurrence_id, *, lock=False): pass
    @abstractmethod
    def get_owned(self, session, recurrence_id, client_id, *, lock=False): pass
    @abstractmethod
    def list_by_client(self, session, client_id): pass
    @abstractmethod
    def list_all(self, session, *, statut=None, type=None, recherche=None, limit=300): pass
    @abstractmethod
    def list_echeances(self, session, today): pass
    @abstractmethod
    def get_owned_commande(self, session, commande_id, client_id): pass
    @abstractmethod
    def get_products(self, session, product_ids): pass
    @abstractmethod
    def get_client(self, session, user_id): pass
    @abstractmethod
    def get_contact(self, session, user_id): pass
    @abstractmethod
    def get_users(self, session, user_ids): pass
    @abstractmethod
    def create(self, session, values, lignes): pass
    @abstractmethod
    def update(self, session, recurrence, values): pass
    @abstractmethod
    def replace_lignes(self, session, recurrence, lignes): pass
    @abstractmethod
    def set_prix_reference(self, session, recurrence, prix_par_produit): pass
    @abstractmethod
    def get_livraison(self, session, recurrence_id, date_livraison): pass
    @abstractmethod
    def save_livraison(self, session, recurrence_id, date_livraison, statut, *, commande_id=None, montant=None, motif=None): pass
    @abstractmethod
    def dernieres_livraisons(self, session, recurrence_ids, limit=5): pass
    @abstractmethod
    def livraisons_du_jour(self, session, date_livraison): pass
    @abstractmethod
    def commande_ids(self, session, date_debut, date_fin): pass
    @abstractmethod
    def jit_deja_execute(self, session, date_livraison): pass
    @abstractmethod
    def wallet_balance(self, session, user_id): pass
