"""Scénario E2E orchestré avec état partagé.

La base configurée dans le projet est la base distante réelle. Pour garantir un test
déterministe sans toucher aux données de production, les frontières DAO/Session sont
simulées, tandis que les services métier réels sont exécutés dans l'ordre du flux.
"""

import uuid
from datetime import date, datetime, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException

from dto.jit_dto import ZoneJITDTO
from dto.livreur_dto import DeliveryEventRequestDTO, DeliveryTargetStatus
from services.dispatch_service import DispatchService
from services.fournisseur_service import FournisseurService
from services.jit_service import JITService
from services.livreur_service import LivreurService
from services.notification_jit_service import notifier_fournisseur


TODAY = date(2026, 6, 20)


class QueryResult:
    def __init__(self, *, all_items=None, first_item=None):
        self.all_items = all_items or []
        self.first_item = first_item

    def filter(self, *args):
        return self

    def order_by(self, *args):
        return self

    def options(self, *args):
        return self

    def with_for_update(self, *args, **kwargs):
        return self

    def all(self):
        return self.all_items

    def first(self):
        return self.first_item


def address(lat, lng, ville):
    return SimpleNamespace(
        latitude=lat,
        longitude=lng,
        is_default=True,
        street="Rue test",
        neighborhood="Centre",
        ville=ville,
        details=None,
    )


def product_line(product_id, name, quantity):
    product = SimpleNamespace(id=product_id, nom_fr=name, unite="kg")
    return SimpleNamespace(produit=product, quantite_kg=quantity)


def commande(command_id, client_id, lat, lng, lines):
    user = SimpleNamespace(
        id=client_id,
        email=f"client{client_id}@test.local",
        phone=f"0600000{client_id}",
        addresses=[address(lat, lng, "Fès")],
    )
    client = SimpleNamespace(user=user)
    return SimpleNamespace(
        id=command_id,
        client_id=client_id,
        client=client,
        panier=SimpleNamespace(lignes=lines),
        statut="CONFIRMEE",
        status_version=1,
        fournisseur_id=None,
        date_commande=datetime(2026, 6, 20, 10, command_id),
        creneau_livraison="09h-11h",
        montant_total=100.0,
        mode_paiement="WALLET",
        tournee_id=None,
        livreur_id=None,
        ordre_passage=None,
        tournee=None,
        enroute_at=None,
        delivered_at=None,
        absent_at=None,
        retour_depot_at=None,
    )


def apply_status(*args, **kwargs):
    command = kwargs["commande"]
    command.statut = kwargs["nouveau_statut"]
    command.status_version = int(command.status_version or 1) + 1


def test_chaine_logistique_deux_fournisseurs_deux_zones():
    supplier_1 = SimpleNamespace(
        user_id=10,
        latitude=34.0331,
        longitude=-5.0003,
        shop_name="Ferme Fès",
    )
    supplier_2 = SimpleNamespace(
        user_id=20,
        latitude=33.8935,
        longitude=-5.5473,
        shop_name="Ferme Meknès",
    )
    zones = [
        ZoneJITDTO(
            id=1,
            nom_ville="fes",
            lat_centre=34.0331,
            lng_centre=-5.0003,
            rayon_km=20,
            fournisseur_id=10,
        ),
        ZoneJITDTO(
            id=2,
            nom_ville="meknes",
            lat_centre=33.8935,
            lng_centre=-5.5473,
            rayon_km=20,
            fournisseur_id=20,
        ),
    ]
    commands = [
        commande(1, 101, 34.034, -5.001, [product_line(1, "Tomates", 2)]),
        commande(2, 102, 34.040, -5.010, [product_line(1, "Tomates", 3)]),
        commande(3, 103, 33.894, -5.548, [product_line(2, "Oignons", 4)]),
        commande(4, 104, 31.630, -8.000, [product_line(3, "Pommes", 1)]),
    ]

    # a. Verrouillage JIT et assignation zone -> fournisseur.
    jit_session = MagicMock()
    zone_dao = MagicMock()
    zone_dao.get_zones_actives.return_value = zones
    jit = JITService(MagicMock(), zone_dao)
    jit._get_commandes_du_jour = MagicMock(return_value=commands)

    def resolve_supplier(_session, command, _zones):
        if command.id in {1, 2}:
            return 10
        if command.id == 3:
            return 20
        return None

    with (
        patch("services.jit_service.resoudre_fournisseur_pour_commande", side_effect=resolve_supplier),
        patch("services.jit_service.changer_statut", side_effect=apply_status),
    ):
        assert jit.verrouiller_commandes(jit_session, actor_id=999) == 3

    assert [command.fournisseur_id for command in commands] == [10, 10, 20, None]
    assert [command.statut for command in commands] == [
        "VERROUILLEE",
        "VERROUILLEE",
        "VERROUILLEE",
        "CONFIRMEE",
    ]

    outbox_session = MagicMock()
    for zone, supplier_commands in ((zones[0], commands[:2]), (zones[1], commands[2:3])):
        result = SimpleNamespace(
            nombre_commandes=len(supplier_commands),
            details_produits=[],
        )
        notifier_fournisseur(outbox_session, zone, result)
    assert outbox_session.add.call_count == 2
    payloads = [call.args[0].payload for call in outbox_session.add.call_args_list]
    assert {payload["fournisseur_id"] for payload in payloads} == {10, 20}
    assert all(payload["event"] == "SUPPLIER_DAILY_BATCH" for payload in payloads)

    # b. Préparation : commandes propres et picking agrégé.
    preparation_results = {}
    for supplier_id, supplier_commands in ((10, commands[:2]), (20, commands[2:3])):
        prep_session = MagicMock()
        query_results = [QueryResult(all_items=supplier_commands)]
        query_results.extend(
            QueryResult(first_item=command.client.user.addresses[0])
            for command in supplier_commands
        )
        prep_session.query.side_effect = query_results
        supplier_service = FournisseurService(MagicMock(), MagicMock(), session=prep_session)
        supplier_service._ensure_supplier_role = MagicMock()
        with patch("services.fournisseur_service.today_morocco", return_value=TODAY):
            preparation_results[supplier_id] = supplier_service.get_supplier_preparation(supplier_id)

    assert [order.id for order in preparation_results[10].commandes] == [1, 2]
    assert preparation_results[10].picking[0].quantite_kg == 5
    assert [order.id for order in preparation_results[20].commandes] == [3]
    assert preparation_results[20].picking[0].quantite_kg == 4

    # c. Dispatch réel : groupement, pickup, allocation et backlog.
    dispatch_session = MagicMock()
    dispatch_session.in_transaction.return_value = False
    dispatch_session.get.side_effect = lambda model, key: {10: supplier_1, 20: supplier_2}.get(key)
    commande_dao = MagicMock()
    commande_dao.get_commandes_non_assignees.return_value = commands
    livreur_dao = MagicMock()
    livreurs = [SimpleNamespace(user_id=501), SimpleNamespace(user_id=502)]
    livreur_dao.get_available_livreurs.return_value = livreurs
    tournee_dao = MagicMock()
    created_tournees = []

    def create_tournee(_session, **kwargs):
        tournee = SimpleNamespace(
            id=1000 + len(created_tournees) + 1,
            commandes=[],
            ramasse_at=None,
            statut="PLANIFIEE",
            **kwargs,
        )
        created_tournees.append(tournee)
        return tournee

    tournee_dao.create_tournee.side_effect = create_tournee
    dispatch = DispatchService(
        commande_dao=commande_dao,
        livreur_dao=livreur_dao,
        tournee_dao=tournee_dao,
        session=dispatch_session,
    )
    with (
        patch("services.dispatch_service.process_end_of_day_returns", return_value=0),
        patch("services.dispatch_service.changer_statut", side_effect=apply_status),
    ):
        dispatch_result = dispatch.generate_daily_routes(TODAY)

    assert dispatch_result["tournees_created"] == 2
    assert dispatch_result["commandes_assigned"] == 3
    assert dispatch_result["commandes_sans_fournisseur"] == 0
    assert {tournee.fournisseur_id for tournee in created_tournees} == {10, 20}
    for tournee in created_tournees:
        supplier = {10: supplier_1, 20: supplier_2}[tournee.fournisseur_id]
        assert (tournee.pickup_lat, tournee.pickup_lng) == (
            supplier.latitude,
            supplier.longitude,
        )
        tournee.commandes = [
            command for command in commands if command.tournee_id == tournee.id
        ]
        for command in tournee.commandes:
            command.tournee = tournee
    assert commands[3].tournee_id is None
    assert commands[3].statut == "CONFIRMEE"

    # d. Livraison bloquée avant ramassage, puis ramassage global.
    selected_tournee = created_tournees[0]
    selected_command = selected_tournee.commandes[0]
    delivery_session = MagicMock()
    delivery_service = LivreurService(
        livreur_dao=MagicMock(),
        client_blacklist_service=MagicMock(),
        session=delivery_session,
        dispatch_service=MagicMock(),
    )
    delivery_service.livreur_dao.get_delivery_event_by_client_event_id.return_value = None
    delivery_service.livreur_dao.get_commande_delivery_context.return_value = {
        "commande": selected_command,
        "client_phone": None,
        "payment_validated": True,
    }
    start_payload = DeliveryEventRequestDTO(
        target_status=DeliveryTargetStatus.EN_ROUTE,
        client_event_id=uuid.uuid4(),
        device_timestamp=datetime.now(timezone.utc),
        expected_version=selected_command.status_version,
    )
    with pytest.raises(HTTPException) as blocked:
        delivery_service.apply_delivery_event(
            selected_tournee.livreur_id,
            selected_command.id,
            start_payload,
        )
    assert blocked.value.status_code == 409

    pickup_session = MagicMock()
    pickup_session.query.return_value = QueryResult(first_item=selected_tournee)
    pickup_service = LivreurService(
        livreur_dao=MagicMock(),
        client_blacklist_service=MagicMock(),
        session=pickup_session,
    )
    with (
        patch("services.livreur_service.today_morocco", return_value=TODAY),
        patch("services.livreur_service.changer_statut", side_effect=apply_status),
    ):
        pickup_result = pickup_service.confirmer_ramassage(
            selected_tournee.livreur_id,
            selected_tournee.id,
        )
    assert pickup_result.commandes_ramassees == len(selected_tournee.commandes)
    assert selected_tournee.ramasse_at is not None
    assert all(command.statut == "A_LIVRER" for command in selected_tournee.commandes)

    # e. A_LIVRER -> EN_ROUTE -> LIVRE via apply_delivery_event.
    events = []

    def delivery_event_lookup(*args, **kwargs):
        client_event_id = kwargs["client_event_id"]
        return next(
            (event for event in events if event.client_event_id == client_event_id),
            None,
        )

    delivery_service.livreur_dao.get_delivery_event_by_client_event_id.side_effect = delivery_event_lookup

    def apply_delivery_status(*args, **kwargs):
        apply_status(*args, **kwargs)
        events.append(
            SimpleNamespace(
                id=uuid.uuid4(),
                client_event_id=kwargs["client_event_id"],
                commande_id=kwargs["commande"].id,
                previous_status="A_LIVRER",
                new_status=kwargs["nouveau_statut"],
                device_timestamp=kwargs["device_timestamp"],
                server_timestamp=kwargs["server_timestamp"],
            )
        )

    for target in (DeliveryTargetStatus.EN_ROUTE, DeliveryTargetStatus.LIVRE):
        payload = DeliveryEventRequestDTO(
            target_status=target,
            client_event_id=uuid.uuid4(),
            device_timestamp=datetime.now(timezone.utc),
            expected_version=selected_command.status_version,
        )
        with patch("services.livreur_service.changer_statut", side_effect=apply_delivery_status):
            response = delivery_service.apply_delivery_event(
                selected_tournee.livreur_id,
                selected_command.id,
                payload,
            )
        assert response.new_status == target.value

    assert selected_command.statut == "LIVRE"
