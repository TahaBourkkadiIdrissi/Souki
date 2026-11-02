from abc import ABC, abstractmethod


class ICommandeRecurrenteService(ABC):
    @abstractmethod
    def lister(self, user_id): pass
    @abstractmethod
    def creer_depuis_commande(self, user_id, commande_id, payload): pass
    @abstractmethod
    def creer_depuis_panier(self, user_id, panier_id, payload): pass
    @abstractmethod
    def modifier_lignes(self, user_id, recurrence_id, payload): pass
    @abstractmethod
    def modifier(self, user_id, recurrence_id, payload): pass
    @abstractmethod
    def sauter(self, user_id, recurrence_id): pass
    @abstractmethod
    def pause(self, user_id, recurrence_id, payload): pass
    @abstractmethod
    def reprendre(self, user_id, recurrence_id): pass
    @abstractmethod
    def arreter(self, user_id, recurrence_id): pass
    @abstractmethod
    def lister_admin(self, *, statut=None, type=None, recherche=None): pass
    @abstractmethod
    def lister_client_admin(self, client_id): pass
    @abstractmethod
    def livraisons_admin(self, date_livraison): pass
    @abstractmethod
    def commande_ids_admin(self, date_debut, date_fin): pass
    @abstractmethod
    def pause_admin(self, recurrence_id, payload): pass
    @abstractmethod
    def reprendre_admin(self, recurrence_id): pass
    @abstractmethod
    def arreter_admin(self, recurrence_id): pass
    @abstractmethod
    def generer_commandes_du_jour(self, today=None): pass
