"""VULN-011 : rejeu de reclamation (remboursement repete sur la meme ligne).

Avant correctif, rien ne memorisait qu'une ligne avait deja ete remboursee :
`_ensure_no_duplicate_lines` ne dedoublonne qu'a l'interieur d'UNE demande. Rejouer
le meme corps de requete creditait donc le wallet a chaque appel pendant les 24 h
de la fenetre de reclamation.

Le DAO est teste sur une vraie base SQLite en memoire, et le service sur ce DAO :
ce qui borne le remboursement est la quantite RESTANTE non reclamee, pas la
quantite commandee.
"""

import unittest
from decimal import Decimal

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from dao.claim_dao import ClaimDaoBD
from entities.claim_entity import Claim
from services.claim_service import ClaimNotEligibleError, ClaimService

LIGNE_ID = 42
USER_ID = 7
COMMANDE_ID = 99


class _FakeLigne:
    def __init__(self, ligne_id: int, quantite_kg: float, sous_total: float):
        self.id = ligne_id
        self.quantite_kg = quantite_kg
        self.sous_total = sous_total
        self.produit_id = 1
        self.produit = None


class _FakeItem:
    def __init__(self, quantity_claimed: Decimal, ligne_panier_id: int = LIGNE_ID):
        self.ligne_panier_id = ligne_panier_id
        self.quantity_claimed = quantity_claimed
        self.reason = "abime"


class ClaimReplayTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://")
        Claim.__table__.create(bind=self.engine)
        self.session = sessionmaker(bind=self.engine)()
        self.dao = ClaimDaoBD()
        # 2 kg commandes a 100 DH la ligne.
        self.line_by_id = {LIGNE_ID: _FakeLigne(LIGNE_ID, 2.0, 100.0)}
        self.service = ClaimService(
            claim_dao=self.dao,
            souki_wallet_service=None,  # type: ignore[arg-type]
            commande_dao=None,  # type: ignore[arg-type]
            notification_outbox_service=None,  # type: ignore[arg-type]
            session=self.session,
        )

    def tearDown(self):
        self.session.close()
        self.engine.dispose()

    def _enregistrer_reclamation(self, quantite: str) -> None:
        self.dao.create_claim(
            self.session,
            user_id=USER_ID,
            commande_id=COMMANDE_ID,
            ligne_panier_id=LIGNE_ID,
            reason="abime",
            quantity_claimed=Decimal(quantite),
            amount_refunded=Decimal("50.00"),
            status="REFUNDED",
            is_suspect=False,
        )
        self.session.commit()

    def test_somme_vide_quand_aucune_reclamation(self):
        self.assertEqual(
            self.dao.sum_claimed_quantity(self.session, ligne_panier_id=LIGNE_ID),
            Decimal("0"),
        )

    def test_somme_cumule_les_reclamations_de_la_ligne(self):
        self._enregistrer_reclamation("0.5")
        self._enregistrer_reclamation("0.25")
        self.assertEqual(
            self.dao.sum_claimed_quantity(self.session, ligne_panier_id=LIGNE_ID),
            Decimal("0.750"),
        )

    def test_premiere_reclamation_acceptee(self):
        ligne = self.service._validate_and_get_line(
            self.session, self.line_by_id, _FakeItem(Decimal("2.0"))
        )
        self.assertEqual(int(ligne.id), LIGNE_ID)

    def test_rejeu_integral_refuse(self):
        # L'attaque : la ligne entiere a deja ete remboursee, on rejoue le meme corps.
        self._enregistrer_reclamation("2.0")
        with self.assertRaises(ClaimNotEligibleError):
            self.service._validate_and_get_line(
                self.session, self.line_by_id, _FakeItem(Decimal("2.0"))
            )

    def test_rejeu_partiel_borne_au_reste(self):
        self._enregistrer_reclamation("1.5")
        # Il reste 0.5 kg : 1.0 kg doit etre refuse...
        with self.assertRaises(ClaimNotEligibleError):
            self.service._validate_and_get_line(
                self.session, self.line_by_id, _FakeItem(Decimal("1.0"))
            )
        # ... mais 0.5 kg reste legitime.
        ligne = self.service._validate_and_get_line(
            self.session, self.line_by_id, _FakeItem(Decimal("0.5"))
        )
        self.assertEqual(int(ligne.id), LIGNE_ID)

    def test_autre_ligne_non_impactee(self):
        self._enregistrer_reclamation("2.0")
        autre_ligne = {7: _FakeLigne(7, 1.0, 30.0)}
        ligne = self.service._validate_and_get_line(
            self.session, autre_ligne, _FakeItem(Decimal("1.0"), ligne_panier_id=7)
        )
        self.assertEqual(int(ligne.id), 7)


if __name__ == "__main__":
    unittest.main()
