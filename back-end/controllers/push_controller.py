from fastapi import APIRouter, Depends, Header, HTTPException

from auth_dependencies import require_auth
from config import LocalSession
from dao.mobile_push_device_dao import MobilePushDeviceDaoBD
from dao.push_subscription_dao import PushSubscriptionDaoBD
from dto.push_dto import MobilePushDeviceDTO, MobilePushDeviceRemoveDTO, PushSubscriptionDTO, PushUnsubscribeDTO
from services.delivery_outbox_worker import DeliveryOutboxWorker
from services.notification_service import notification_service
from services.rate_limit_service import user_action_quota
from services.web_push_service import web_push_service

push_router = APIRouter(prefix="/api/user/push", tags=["PushNotifications"])
# Apps mobiles (apps/play-store, apps/mobile) : route appelee par lib/notifications.ts.
mobile_push_router = APIRouter(prefix="/api/push", tags=["PushNotifications"])
_push_dao = PushSubscriptionDaoBD()
_mobile_device_dao = MobilePushDeviceDaoBD()

# Le bouton « envoyer un test » des reglages ne doit pas devenir un moyen de
# spammer ses propres appareils (ni de sonder le service de push).
TEST_PUSH_MAX_CALLS = 5
TEST_PUSH_WINDOW_SECONDS = 300


@push_router.get("/public-key")
def get_push_public_key(principal=Depends(require_auth)):
    """Cle publique VAPID a passer en `applicationServerKey` cote navigateur.

    Servie par l'API plutot que dupliquee dans une variable NEXT_PUBLIC_* :
    une seule source de verite, et la rotation de cle ne demande pas de rebuild.
    """
    _ = principal
    return {
        "publicKey": web_push_service.get_public_key(),
        "configured": web_push_service.is_configured(),
    }


@push_router.post("/subscriptions", status_code=201)
def subscribe_push(
    data: PushSubscriptionDTO,
    principal=Depends(require_auth),
    user_agent: str | None = Header(default=None),
):
    session = LocalSession()
    try:
        _push_dao.upsert_subscription(
            session,
            user_id=principal.user_id,
            endpoint=data.endpoint,
            p256dh=data.keys.p256dh,
            auth=data.keys.auth,
            user_agent=(user_agent or "")[:255] or None,
        )
        session.commit()
        return {"success": True}
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


@push_router.delete("/subscriptions")
def unsubscribe_push(data: PushUnsubscribeDTO, principal=Depends(require_auth)):
    session = LocalSession()
    try:
        # Le filtre sur user_id empeche de revoquer l'abonnement d'autrui a
        # partir d'un endpoint devine ou intercepte.
        revoked = _push_dao.revoke_by_endpoint(
            session, endpoint=data.endpoint, user_id=principal.user_id
        )
        session.commit()
        return {"success": True, "revoked": revoked}
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


@push_router.post("/test")
def send_test_push(principal=Depends(require_auth)):
    """Envoie une notification de test sur les appareils de l'appelant."""
    user_action_quota.ensure_within_quota(
        "push-test",
        principal.user_id,
        TEST_PUSH_MAX_CALLS,
        TEST_PUSH_WINDOW_SECONDS,
    )

    session = LocalSession()
    try:
        web_targets = (
            _push_dao.count_active_subscriptions(session, principal.user_id)
            if web_push_service.is_configured()
            else 0
        )
        if web_targets + _mobile_device_dao.count_active_devices(session, principal.user_id) == 0:
            raise HTTPException(
                status_code=409,
                detail="Aucun appareil abonne. Activez les notifications sur cet appareil.",
            )

        entry_written = notification_service.notify(
            session,
            user_id=principal.user_id,
            event_key="PUSH_TEST",
        )
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()

    if not entry_written:
        raise HTTPException(
            status_code=409,
            detail="Aucun canal actif : verifiez vos preferences de notification.",
        )

    # Le test doit arriver tout de suite : on depile sans attendre le tour du
    # scheduler plutot que de faire patienter l'utilisateur jusqu'a 30 s.
    DeliveryOutboxWorker().run_once()
    return {"success": True, "channels": entry_written}


@mobile_push_router.post("/appareils", status_code=201)
def register_mobile_device(data: MobilePushDeviceDTO, principal=Depends(require_auth)):
    """Enregistre (ou rattache au compte connecte) le jeton Expo de l'appareil."""
    session = LocalSession()
    try:
        _mobile_device_dao.upsert_device(
            session,
            user_id=principal.user_id,
            token=data.token,
            platform=data.plateforme,
        )
        session.commit()
        return {"success": True}
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


@mobile_push_router.delete("/appareils")
def unregister_mobile_device(data: MobilePushDeviceRemoveDTO, principal=Depends(require_auth)):
    """Deconnexion de l'app : plus de notifications de ce compte sur cet appareil."""
    session = LocalSession()
    try:
        # Filtre sur user_id : impossible de couper les notifications d'autrui
        # avec un jeton devine ou intercepte.
        revoked = _mobile_device_dao.revoke_by_token(session, token=data.token.strip(), user_id=principal.user_id)
        session.commit()
        return {"success": True, "revoked": revoked}
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
