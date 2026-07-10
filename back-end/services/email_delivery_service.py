import hashlib
import logging
import os
import smtplib
from email.message import EmailMessage

import resend

logger = logging.getLogger("souki.email")

OTP_EMAIL_SUBJECT = "Votre code de verification SOUKI"
RESEND_TIMEOUT_SECONDS = 15


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
