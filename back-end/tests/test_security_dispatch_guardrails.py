"""HAMZA-04 / BUG-001, BUG-004 : garde-fous metier du dispatch.

Aucune commande non validee (EN_ATTENTE, CONFIRMEE, BROUILLON...) ne peut
entrer dans une tournee : seuls VERROUILLEE (JIT) et REFUS_LIVREUR (reprise)
sont dispatchables.
"""

import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from dao.commande_dao import DISPATCHABLE_COMMANDE_STATUSES
from services import dispatch_service as dispatch_module
from services.dispatch_service import (
    DISPATCH_STATUS_PROGRESSIONS,
    DispatchService,
    DispatchServiceError,
    LOCKED_DISPATCH_STATUS,
)


class DispatchStatusGuardrailTests(unittest.TestCase):
    def test_seuls_verrouillee_et_refus_livreur_sont_dispatchables(self):
        self.assertEqual(
            set(DISPATCH_STATUS_PROGRESSIONS.keys()),
            {"VERROUILLEE", "REFUS_LIVREUR"},
            "EN_ATTENTE et CONFIRMEE ne doivent pas etre dispatchables (BUG-004)",
        )

    def test_le_dao_ne_considere_que_verrouillee_par_defaut(self):
        self.assertEqual(DISPATCHABLE_COMMANDE_STATUSES, ("VERROUILLEE",))

    def _service(self):
        return DispatchService(MagicMock(), MagicMock(), MagicMock(), session=MagicMock())

    def test_commande_en_attente_refusee_au_dispatch(self):
        service = self._service()
        commande = SimpleNamespace(id=1, statut="EN_ATTENTE")
        with self.assertRaises(DispatchServiceError):
            service._mettre_commande_en_attente_livreur(MagicMock(), commande, actor_id=1)

    def test_commande_confirmee_refusee_au_dispatch(self):
        service = self._service()
        commande = SimpleNamespace(id=2, statut="CONFIRMEE")
        with self.assertRaises(DispatchServiceError):
            service._mettre_commande_en_attente_livreur(MagicMock(), commande, actor_id=1)

    def test_commande_verrouillee_progresse_vers_en_attente_livreur(self):
        service = self._service()
        commande = SimpleNamespace(id=3, statut=LOCKED_DISPATCH_STATUS)
        with patch.object(dispatch_module, "changer_statut") as changer:
            service._mettre_commande_en_attente_livreur(MagicMock(), commande, actor_id=1)
        changer.assert_called_once()
        self.assertEqual(changer.call_args.kwargs["nouveau_statut"], "EN_ATTENTE_LIVREUR")

    def test_filtre_verrouillage_du_dispatch_quotidien(self):
        service = self._service()
        verrouillee = SimpleNamespace(statut="VERROUILLEE")
        en_attente = SimpleNamespace(statut="EN_ATTENTE")
        self.assertTrue(service._is_commande_locked_for_dispatch(verrouillee))
        self.assertFalse(service._is_commande_locked_for_dispatch(en_attente))


if __name__ == "__main__":
    unittest.main()
