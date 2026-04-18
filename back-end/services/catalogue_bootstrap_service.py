from config import LocalSession
from dao.product_dao import ProductDaoBD


CATALOGUE_PRODUCTS = [
    {"id": 1, "nom_fr": "Pommes de terre", "nom_darija": "batata", "prix_kg": 7.0, "unite": "kg", "stock": 120.0},
    {"id": 2, "nom_fr": "Oignons rouge", "nom_darija": "bassla hamra", "prix_kg": 17.0, "unite": "kg", "stock": 90.0},
    {"id": 3, "nom_fr": "Tomates", "nom_darija": "maticha", "prix_kg": 7.0, "unite": "kg", "stock": 140.0},
    {"id": 4, "nom_fr": "Carottes", "nom_darija": "khizou", "prix_kg": 10.0, "unite": "kg", "stock": 90.0},
    {"id": 5, "nom_fr": "Courgettes", "nom_darija": "qra3 khder", "prix_kg": 15.0, "unite": "kg", "stock": 80.0},
    {"id": 6, "nom_fr": "Piments", "nom_darija": "felfla harra", "prix_kg": 12.0, "unite": "kg", "stock": 60.0},
    {"id": 7, "nom_fr": "Aubergines", "nom_darija": "denjal", "prix_kg": 8.0, "unite": "kg", "stock": 85.0},
    {"id": 8, "nom_fr": "Concombres", "nom_darija": "khiar", "prix_kg": 13.0, "unite": "kg", "stock": 70.0},
    {"id": 9, "nom_fr": "Menthe fraiche", "nom_darija": "naanaa", "prix_kg": 2.0, "unite": "lot", "stock": 60.0},
    {"id": 10, "nom_fr": "Persil", "nom_darija": "maadnous", "prix_kg": 2.0, "unite": "lot", "stock": 60.0},
    {"id": 11, "nom_fr": "Coriandre", "nom_darija": "qosbor", "prix_kg": 2.5, "unite": "lot", "stock": 60.0},
    {"id": 12, "nom_fr": "Oranges", "nom_darija": "portoqal", "prix_kg": 10.0, "unite": "kg", "stock": 90.0},
    {"id": 13, "nom_fr": "Citrons", "nom_darija": "hamed", "prix_kg": 15.0, "unite": "kg", "stock": 70.0},
    {"id": 14, "nom_fr": "Poivrons", "nom_darija": "felfla hloua", "prix_kg": 14.0, "unite": "kg", "stock": 70.0},
    {"id": 15, "nom_fr": "Haricots verts", "nom_darija": "loubya khadra", "prix_kg": 18.0, "unite": "kg", "stock": 60.0},
    {"id": 16, "nom_fr": "Laitue", "nom_darija": "khess", "prix_kg": 8.0, "unite": "lot", "stock": 55.0},
    {"id": 17, "nom_fr": "Epinards", "nom_darija": "sbanekh", "prix_kg": 30.0, "unite": "kg", "stock": 45.0},
    {"id": 18, "nom_fr": "Ail", "nom_darija": "touma", "prix_kg": 17.5, "unite": "250g", "stock": 48.0},
    {"id": 19, "nom_fr": "Betteraves", "nom_darija": "barba", "prix_kg": 7.0, "unite": "kg", "stock": 70.0},
    {"id": 20, "nom_fr": "Radis", "nom_darija": "fijl", "prix_kg": 5.0, "unite": "kg", "stock": 65.0},
    {"id": 21, "nom_fr": "Navets", "nom_darija": "left", "prix_kg": 6.0, "unite": "kg", "stock": 70.0},
    {"id": 22, "nom_fr": "Celeri", "nom_darija": "karafs", "prix_kg": 10.5, "unite": "kg", "stock": 50.0},
    {"id": 23, "nom_fr": "Brocoli", "nom_darija": "brokoli", "prix_kg": 12.5, "unite": "kg", "stock": 50.0},
    {"id": 24, "nom_fr": "Chou-fleur", "nom_darija": "chou fleur", "prix_kg": 11.5, "unite": "kg", "stock": 50.0},
    {"id": 25, "nom_fr": "Petit pois", "nom_darija": "jelbana", "prix_kg": 15.0, "unite": "kg", "stock": 55.0},
]


class CatalogueBootstrapService:

    def __init__(self) -> None:
        self.product_dao = ProductDaoBD()

    def sync_catalogue(self) -> None:
        session = LocalSession()
        try:
            self.product_dao.sync_catalogue(session, CATALOGUE_PRODUCTS)
        finally:
            session.close()
