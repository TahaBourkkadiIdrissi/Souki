"""Onboarding porte par le compte et non par l'appareil.

L'onboarding s'affichait a chaque fois car son marqueur vivait dans le
localStorage du navigateur. Il est desormais adosse a
t_users.onboarding_completed_at : NULL = compte jamais onboarde. Ces tests
verrouillent les deux bouts de la chaine — la lecture (exposition du drapeau
dans le principal, donc dans /auth/login et /auth/me) et l'ecriture.
"""

from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from services.authorization_service import AuthorizationService
from services.onboarding_service import OnboardingService

USER_ID = 42


def _user(onboarding_completed_at):
    return SimpleNamespace(
        id=USER_ID,
        email="nouveau@souki.app",
        phone=None,
        role="CLIENT",
        is_verified=True,
        is_active=True,
        onboarding_completed_at=onboarding_completed_at,
    )


def _build_principal(user):
    service = AuthorizationService(db=MagicMock())
    with patch.object(
        AuthorizationService,
        "_load_roles_and_permissions",
        return_value=({"CLIENT"}, {"profile.manage_self"}),
    ):
        return service.build_principal_from_user(user)


def test_compte_jamais_onboarde_expose_onboarding_completed_false():
    assert _build_principal(_user(None)).onboarding_completed is False


def test_compte_deja_onboarde_expose_onboarding_completed_true():
    principal = _build_principal(_user(datetime(2026, 7, 1, tzinfo=timezone.utc)))
    assert principal.onboarding_completed is True


def test_complete_date_le_compte_et_committe():
    user = _user(None)
    db = MagicMock()
    user_dao = MagicMock()
    user_dao.read.return_value = user

    with patch("services.onboarding_service.LocalSession", return_value=db):
        assert OnboardingService(user_dao=user_dao).complete(USER_ID) is True

    assert user.onboarding_completed_at is not None
    db.commit.assert_called_once()
    db.close.assert_called_once()


def test_complete_est_idempotent_et_conserve_la_premiere_date():
    premiere_date = datetime(2026, 7, 1, tzinfo=timezone.utc)
    user = _user(premiere_date)
    db = MagicMock()
    user_dao = MagicMock()
    user_dao.read.return_value = user

    with patch("services.onboarding_service.LocalSession", return_value=db):
        assert OnboardingService(user_dao=user_dao).complete(USER_ID) is True

    assert user.onboarding_completed_at == premiere_date
    db.commit.assert_not_called()


def test_complete_signale_un_utilisateur_introuvable():
    db = MagicMock()
    user_dao = MagicMock()
    user_dao.read.return_value = None

    with patch("services.onboarding_service.LocalSession", return_value=db):
        assert OnboardingService(user_dao=user_dao).complete(USER_ID) is False

    db.commit.assert_not_called()
    db.close.assert_called_once()
