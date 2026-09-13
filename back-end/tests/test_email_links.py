from unittest.mock import patch

from services.email_delivery_service import (
    get_public_base_url,
    render_notification_email_html,
    render_notification_email_text,
)
from services.notification_catalog import get_event


def test_legacy_public_domain_is_replaced_by_souki_io():
    with patch.dict("os.environ", {"SOUKI_PUBLIC_URL": "https://souki.app"}):
        assert get_public_base_url() == "https://souki.io"


def test_notification_links_target_tracking_and_notification_preferences():
    event = get_event("ORDER_CONFIRMED")
    assert event is not None
    content = event.render({"commande_id": 42, "montant_total": 125})

    with patch.dict("os.environ", {"SOUKI_PUBLIC_URL": "https://souki.io"}):
        text = render_notification_email_text(
            title=content.title,
            body=content.body,
            url=content.url,
            cta_label=content.email_cta_label,
        )
        html = render_notification_email_html(
            title=content.title,
            body=content.body,
            url=content.url,
            cta_label=content.email_cta_label,
        )

    for rendered in (text, html):
        assert "https://souki.io/suivi-commande?commande=42" in rendered
        assert "https://souki.io/parametres/notifications" in rendered
        assert "souki.app" not in rendered
