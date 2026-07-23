import hashlib
import logging
import os
import smtplib
from email.message import EmailMessage

import resend

logger = logging.getLogger("souki.email")

OTP_EMAIL_SUBJECT = "Votre code de verification SOUKI"
RESEND_TIMEOUT_SECONDS = 15


def get_public_base_url() -> str:
    """Racine publique du front, utilisee pour les liens des emails."""
    return os.getenv("SOUKI_PUBLIC_URL", "https://souki.app").rstrip("/")


def _absolute_url(url: str) -> str:
    if url.startswith("http://") or url.startswith("https://"):
        return url
    return f"{get_public_base_url()}/{url.lstrip('/')}"


class EmailDeliveryException(Exception):
    """Echec d'envoi d'un email transactionnel (couche transport uniquement)."""


def render_otp_email_text(otp_code: str) -> str:
    """Version texte de l'email OTP (alternative envoyée avec le HTML)."""
    return "\n".join(
        [
            "Bonjour,",
            "",
            "Voici votre code de verification SOUKI :",
            f"{otp_code}",
            "",
            "Ce code expire dans 15 minutes.",
            "Si vous n'etes pas a l'origine de cette demande, ignorez cet email.",
        ]
    )


def render_otp_email_html(otp_code: str) -> str:
    """Version HTML de l'email OTP (une alternative texte est toujours envoyée avec)."""
    return f"""\
<!DOCTYPE html>
<html lang="fr">
  <body style="margin:0; padding:0; background-color:#f6f6f4; font-family:Arial, Helvetica, sans-serif;">
    <div style="max-width:480px; margin:0 auto; padding:32px 24px;">
      <div style="background:#ffffff; border-radius:12px; padding:32px; border:1px solid #e8e8e4;">
        <h1 style="margin:0 0 16px; font-size:20px; color:#1a1a1a;">SOUKI</h1>
        <p style="margin:0 0 8px; font-size:15px; color:#333333;">Bonjour,</p>
        <p style="margin:0 0 24px; font-size:15px; color:#333333;">
          Voici votre code de v&eacute;rification&nbsp;:
        </p>
        <p style="margin:0 0 24px; text-align:center; font-size:32px; letter-spacing:8px;
                  font-weight:bold; color:#1a1a1a;">{otp_code}</p>
        <p style="margin:0 0 8px; font-size:13px; color:#666666;">
          Ce code expire dans 15 minutes.
        </p>
        <p style="margin:0; font-size:13px; color:#666666;">
          Si vous n'&ecirc;tes pas &agrave; l'origine de cette demande, ignorez cet email.
        </p>
      </div>
    </div>
  </body>
</html>
"""


def render_notification_email_text(*, title: str, body: str, url: str, cta_label: str | None) -> str:
    """Version texte d'une notification (alternative envoyée avec le HTML)."""
    lines = ["Bonjour,", "", title, "", body, "", f"{cta_label or 'Ouvrir SOUKI'} : {_absolute_url(url)}"]
    lines += ["", "Vous recevez cet email selon vos preferences de notification.", "Pour les modifier : " + _absolute_url("/parametres")]
    return "\n".join(lines)


def render_notification_email_html(*, title: str, body: str, url: str, cta_label: str | None) -> str:
    """Version HTML d'une notification (une alternative texte est toujours envoyée avec).

    Styles en ligne et tableau-free : les clients mail (Gmail, Outlook) ignorent
    les feuilles de style externes et une partie des selecteurs modernes.
    """
    link = _absolute_url(url)
    label = cta_label or "Ouvrir SOUKI"
    settings_link = _absolute_url("/parametres")
    return f"""\
<!DOCTYPE html>
<html lang="fr">
  <body style="margin:0; padding:0; background-color:#f6f6f4; font-family:Arial, Helvetica, sans-serif;">
    <div style="max-width:480px; margin:0 auto; padding:32px 24px;">
      <div style="background:#ffffff; border-radius:12px; padding:32px; border:1px solid #e8e8e4;">
        <h1 style="margin:0 0 24px; font-size:20px; color:#1E8A3C;">SOUKI</h1>
        <p style="margin:0 0 12px; font-size:18px; font-weight:bold; color:#1a1a1a;">{title}</p>
        <p style="margin:0 0 24px; font-size:15px; line-height:1.5; color:#333333;">{body}</p>
        <p style="margin:0 0 24px;">
          <a href="{link}" style="display:inline-block; background:#1E8A3C; color:#ffffff;
             text-decoration:none; padding:12px 24px; border-radius:8px; font-size:15px;
             font-weight:bold;">{label}</a>
        </p>
        <p style="margin:0; font-size:12px; color:#8A8A8A;">
          Vous recevez cet email selon vos pr&eacute;f&eacute;rences de notification.
          <a href="{settings_link}" style="color:#1E8A3C;">Les modifier</a>.
        </p>
      </div>
    </div>
  </body>
</html>
"""


class EmailDeliveryService:
    def __init__(self):
        self.smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
        self.smtp_port = int(os.getenv("SMTP_PORT", "587"))
        self.smtp_username = os.getenv("SMTP_USERNAME", "")
        self.smtp_password = os.getenv("SMTP_PASSWORD", "")
        self.smtp_from = os.getenv("SMTP_FROM", self.smtp_username or "no-reply@souki.local")
        self.resend_api_key = os.getenv("RESEND_API_KEY", "")
        self.resend_from = os.getenv("RESEND_FROM_EMAIL", "")

    def is_configured(self) -> bool:
        return bool(self.smtp_username and self.smtp_password)

    def is_resend_configured(self) -> bool:
        return bool(self.resend_api_key and self.resend_from)

    def send_otp_email(self, recipient: str, code: str):
        """Envoie le code OTP par email via Resend (domaine souki.app verifie).

        Regles de securite (VULN-002) : ni le code ni le destinataire ne sont
        journalises ; toute erreur remonte en EmailDeliveryException avec un
        message statique, convertie en 503 par AuthService._send_otp.
        """
        if not self.is_resend_configured():
            raise EmailDeliveryException(
                "RESEND_API_KEY ou RESEND_FROM_EMAIL manquant dans back-end/.env"
            )

        resend.api_key = self.resend_api_key
        resend.default_http_client = resend.RequestsClient(timeout=RESEND_TIMEOUT_SECONDS)

        # Meme destinataire + meme code => meme cle : Resend ignore les doublons
        # (retry HTTP, double clic) pendant 24 h sans renvoyer d'email.
        idempotency_key = hashlib.sha256(f"otp:{recipient}:{code}".encode()).hexdigest()

        params: resend.Emails.SendParams = {
            "from": self.resend_from,
            "to": [recipient],
            "subject": OTP_EMAIL_SUBJECT,
            "text": render_otp_email_text(code),
            "html": render_otp_email_html(code),
        }

        try:
            resend.Emails.send(params, options={"idempotency_key": idempotency_key})
        except Exception as exc:
            logger.error("[EMAIL] Echec d'envoi OTP via Resend (%s)", type(exc).__name__)
            raise EmailDeliveryException("Echec d'envoi de l'email OTP via Resend") from exc

    def send_notification_email(
        self,
        *,
        recipient: str,
        subject: str,
        title: str,
        body: str,
        url: str,
        cta_label: str | None = None,
        idempotency_key: str | None = None,
    ) -> None:
        """Envoie une notification transactionnelle via Resend.

        `idempotency_key` (la cle de deduplication de l'outbox) protege des
        doublons quand une reponse HTTP se perd et que le worker reessaie.
        """
        if not self.is_resend_configured():
            raise EmailDeliveryException(
                "RESEND_API_KEY ou RESEND_FROM_EMAIL manquant dans back-end/.env"
            )

        resend.api_key = self.resend_api_key
        resend.default_http_client = resend.RequestsClient(timeout=RESEND_TIMEOUT_SECONDS)

        params: resend.Emails.SendParams = {
            "from": self.resend_from,
            "to": [recipient],
            "subject": subject,
            "text": render_notification_email_text(title=title, body=body, url=url, cta_label=cta_label),
            "html": render_notification_email_html(title=title, body=body, url=url, cta_label=cta_label),
        }

        options = {}
        if idempotency_key:
            options["idempotency_key"] = hashlib.sha256(idempotency_key.encode()).hexdigest()

        try:
            resend.Emails.send(params, options=options or None)
        except Exception as exc:
            # Ni le destinataire ni le contenu ne sont journalises.
            logger.error("[EMAIL] Echec d'envoi notification via Resend (%s)", type(exc).__name__)
            raise EmailDeliveryException("Echec d'envoi de l'email de notification") from exc

    def send_jit_alert(self, recipient: str, sujet: str, contenu: str):
        """Envoie la liste d'achats JIT ou une alerte au fondateur"""
        if not self.is_configured():
            raise RuntimeError("SMTP Gmail non configuré")

        message = EmailMessage()
        message["Subject"] = sujet
        message["From"] = self.smtp_from
        message["To"] = recipient
        message.set_content(contenu)

        with smtplib.SMTP(self.smtp_host, self.smtp_port, timeout=20) as server:
            server.starttls()
            server.login(self.smtp_username, self.smtp_password)
            server.send_message(message)
