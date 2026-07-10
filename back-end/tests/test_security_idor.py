"""TAHA-02 (VULN-004) et SALAH-02 (VULN-003) : autorisation horizontale (anti-IDOR).

Les DAO panier et commande sont testes sur une vraie base SQLite en memoire :
l'utilisateur A ne peut jamais lire le panier / la commande de l'utilisateur B.
"""

import unittest

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from dao.commande_dao import CommandeVocaleDaoBD
from dao.panier_dao import PanierDaoBD
from entities.commande_vocale_entity import CommandeVocale, LigneCommandeVocale
from entities.panier_entity import Panier
from services.panier_service import PanierService

USER_A = 1
USER_B = 2


class _SqliteTestCase(unittest.TestCase):
    tables = ()

    def setUp(self):
        self.engine = create_engine("sqlite://")
        for table in self.tables:
            table.create(bind=self.engine)
        self.session = sessionmaker(bind=self.engine)()

    def tearDown(self):
        self.session.close()
        self.engine.dispose()


class PanierIdorTests(_SqliteTestCase):
    tables = (Panier.__table__,)

    def setUp(self):
        super().setUp()
        self.panier_b = Panier(user_id=USER_B, total_legumes=2.0, total_facture=50.0, marge_brute=0.0)
        self.session.add(self.panier_b)
        self.session.commit()
        self.dao = PanierDaoBD()

    def test_utilisateur_a_ne_lit_pas_le_panier_de_b(self):
        panier = self.dao.get_panier_by_id(self.session, int(self.panier_b.id), USER_A)
        self.assertIsNone(panier)

    def test_le_proprietaire_lit_son_panier(self):
        panier = self.dao.get_panier_by_id(self.session, int(self.panier_b.id), USER_B)
        self.assertIsNotNone(panier)
        self.assertEqual(int(panier.user_id), USER_B)

    def test_service_renvoie_introuvable_pour_le_panier_d_autrui(self):
        service = PanierService(self.dao)
        service.session = self.session
        with self.assertRaises(ValueError):
            service.get_panier_details(int(self.panier_b.id), USER_A)


class CommandeIdorTests(_SqliteTestCase):
    tables = (CommandeVocale.__table__, LigneCommandeVocale.__table__)

    def setUp(self):
        super().setUp()
        commande = CommandeVocale(
            user_id=USER_B,
            transcription_brute="2 kg de tomates",
            json_gemini_brut="{}",
            langue_detectee="darija",
        )
        self.session.add(commande)
        self.session.commit()
        self.commande_id = int(commande.id)
        self.dao = CommandeVocaleDaoBD()

    def test_client_a_ne_lit_pas_la_commande_de_b(self):
        details = self.dao.get_details_for_checkout(self.session, self.commande_id, USER_A)
        self.assertIsNone(details)

    def test_le_proprietaire_lit_sa_commande(self):
        details = self.dao.get_details_for_checkout(self.session, self.commande_id, USER_B)
        self.assertIsNotNone(details)
        self.assertEqual(details["commande_id"], self.commande_id)

    def test_commande_inexistante_reste_introuvable(self):
        self.assertIsNone(self.dao.get_details_for_checkout(self.session, 9999, USER_B))


class EnsureResourceOwnerTests(unittest.TestCase):
    def test_helper_reutilisable_renvoie_404_pour_autrui(self):
        from types import SimpleNamespace

        from fastapi import HTTPException

        from auth_dependencies import ensure_resource_owner

        principal = SimpleNamespace(user_id=USER_A)
        ensure_resource_owner(principal, USER_A)  # proprietaire : passe

        with self.assertRaises(HTTPException) as ctx:
            ensure_resource_owner(principal, USER_B)
        self.assertEqual(ctx.exception.status_code, 404)

        with self.assertRaises(HTTPException):
            ensure_resource_owner(principal, None)


if __name__ == "__main__":
    unittest.main()
