from datetime import date, datetime, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from services.order_schedule import (
    MOROCCO_TIMEZONE, orders_closed, delivery_date_for_order, schedule_snapshot,
)
from services.logistics_visibility import is_supplier_order_visible
from services.admin_exception_service import AdminExceptionService


@pytest.mark.parametrize("hour,minute,closed,delivery", [
    (0, 0, False, date(2026, 10, 9)),
    (0, 59, False, date(2026, 10, 9)),
    (1, 0, True, None), (7, 59, True, None),
    (8, 0, False, date(2026, 10, 10)),
    (20, 0, False, date(2026, 10, 10)),
    (23, 59, False, date(2026, 10, 10)),
])
def test_boundaries(hour, minute, closed, delivery):
    now = datetime(2026, 10, 9, hour, minute, tzinfo=MOROCCO_TIMEZONE)
    result = schedule_snapshot(now)
    assert orders_closed(now) is closed
    assert result["delivery_date"] == (delivery.isoformat() if delivery else None)
    assert datetime.fromisoformat(result["next_transition"]) > now
    assert schedule_snapshot(now.astimezone(timezone.utc)) == result


def test_evening_and_after_midnight_share_delivery_batch():
    evening = datetime(2026, 12, 31, 23, 59, tzinfo=MOROCCO_TIMEZONE)
    night = datetime(2027, 1, 1, 0, 59, tzinfo=MOROCCO_TIMEZONE)
    assert delivery_date_for_order(evening) == delivery_date_for_order(night) == date(2027, 1, 1)
    assert schedule_snapshot(evening)["next_transition"] == schedule_snapshot(night)["next_transition"]


def test_yesterday_order_is_not_overdue_on_delivery_day():
    order = SimpleNamespace(date_commande=datetime(2026, 10, 8, 20),
                            date_livraison=date(2026, 10, 9),
                            fournisseur_id=7, statut="A_LIVRER")
    assert is_supplier_order_visible(order, 7, date(2026, 10, 9))
    assert "JOUR_PRECEDENT" not in AdminExceptionService.detect_raisons(order, today=date(2026, 10, 9))
    assert "JOUR_PRECEDENT" in AdminExceptionService.detect_raisons(order, today=date(2026, 10, 10))


def test_scheduler_never_dispatches_failed_batch():
    from services import scheduler_service as scheduler
    with patch.object(scheduler, "datetime") as clock, \
         patch.object(scheduler, "job_agregation_jit", return_value=False), \
         patch.object(scheduler, "job_dispatch_daily") as dispatch:
        clock.now.return_value = datetime(2026, 10, 9, 1, tzinfo=MOROCCO_TIMEZONE)
        scheduler.job_delivery_cycle()
        dispatch.assert_not_called()


def test_jit_cannot_close_before_one():
    from services.jit_service import JITService, JITAlreadyExecutedError
    with patch("services.jit_service.local_now", return_value=datetime(2026, 10, 9, 0, 59, tzinfo=MOROCCO_TIMEZONE)), \
         patch("services.jit_service.today_morocco", return_value=date(2026, 10, 9)):
        with pytest.raises(JITAlreadyExecutedError):
            JITService(MagicMock())._close_batch(MagicMock())


def test_checkout_rechecks_cutoff_after_waiting_for_batch_lock():
    from fastapi import HTTPException
    from dto.checkout_dto import CheckoutRequestDTO, CheckoutItemDTO
    from services.checkout_service import CheckoutService
    session, dao = MagicMock(), MagicMock()
    session.get_bind.return_value.dialect.name = "postgresql"
    payload = CheckoutRequestDTO(items=[CheckoutItemDTO(product_id=1, quantity=1)])
    with patch("services.checkout_service.ORDER_CUTOFF_ENABLED", True), \
         patch("services.checkout_service.is_order_cutoff_active", side_effect=[False, True]):
        with pytest.raises(HTTPException) as error:
            CheckoutService(dao, session).create_checkout(7, payload)
    assert error.value.status_code == 403
    dao.lock_order_batch.assert_called_once()
    dao.create_commande.assert_not_called()
    session.rollback.assert_called_once()


def test_batch_query_includes_previous_evening_and_midnight_only():
    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session
    from entities.commande_entity import Commande
    from services.jit_service import JITService
    engine = create_engine("sqlite://")
    Commande.__table__.create(engine)
    with Session(engine) as session:
        session.add_all([
            Commande(id=1, statut="CONFIRMEE", date_commande=datetime(2026, 10, 8, 23), date_livraison=date(2026, 10, 9)),
            Commande(id=2, statut="CONFIRMEE", date_commande=datetime(2026, 10, 9, 0, 30), date_livraison=date(2026, 10, 9)),
            Commande(id=3, statut="CONFIRMEE", date_commande=datetime(2026, 10, 9, 8), date_livraison=date(2026, 10, 10)),
            Commande(id=4, statut="ANNULEE", date_commande=datetime(2026, 10, 8, 20), date_livraison=date(2026, 10, 9)),
        ])
        session.flush()
        with patch("services.jit_service.today_morocco", return_value=date(2026, 10, 9)):
            assert {c.id for c in JITService(MagicMock())._get_commandes_du_jour(session)} == {1, 2}
    engine.dispose()


def test_completed_batch_is_not_aggregated_or_locked_again():
    from dto.jit_dto import JITLogDTO
    from services.jit_service import JITService
    dao, session = MagicMock(), MagicMock()
    dao.get_completed_log.return_value = JITLogDTO(
        id=1, volume_total=50, nombre_commandes=2, nombre_abonnements=0, statut="succès",
    )
    service = JITService(dao)
    with patch.object(service, "_close_batch"), patch.object(service, "agreger_commandes") as aggregate:
        assert service.executer_job_jit(session).statut == "deja_execute"
        aggregate.assert_not_called()
        dao.create_log.assert_not_called()


@pytest.mark.parametrize("status", ["VERROUILLEE", "EN_ATTENTE_LIVREUR", "A_LIVRER"])
def test_cod_can_be_confirmed_after_route_assignment_before_departure(status):
    from services.cod_confirmation_service import CODConfirmationService
    dao, logs, session = MagicMock(), MagicMock(), MagicMock()
    dao.get_commande_for_cod_update.return_value = SimpleNamespace(mode_paiement="cod", statut=status)
    logs.get_latest_log.return_value = None
    service = CODConfirmationService(dao, logs, session)
    service._apply_confirmation_cod(session=session, commande_id=1,
                                    normalized_statut="CONFIRMEE_PAR_APPEL", admin_id=2)
    logs.create_log.assert_called_once()


def test_cod_cannot_be_changed_after_departure():
    from fastapi import HTTPException
    from services.cod_confirmation_service import CODConfirmationService
    dao, logs, session = MagicMock(), MagicMock(), MagicMock()
    dao.get_commande_for_cod_update.return_value = SimpleNamespace(mode_paiement="cod", statut="EN_ROUTE")
    with pytest.raises(HTTPException):
        CODConfirmationService(dao, logs, session)._apply_confirmation_cod(
            session=session, commande_id=1, normalized_statut="ANNULEE", admin_id=2)
    logs.create_log.assert_not_called()
