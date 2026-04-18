import os
import smtplib
from email.message import EmailMessage


class EmailDeliveryService:
    def __init__(self):
        self.smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
        self.smtp_port = int(os.getenv("SMTP_PORT", "587"))
        self.smtp_username = os.getenv("SMTP_USERNAME", "")
        self.smtp_password = os.getenv("SMTP_PASSWORD", "")
        self.smtp_from = os.getenv("SMTP_FROM", self.smtp_username or "no-reply@souki.local")

    def is_configured(self) -> bool:
        return bool(self.smtp_username and self.smtp_password)

    def send_otp_email(self, recipient: str, code: str):
        if not self.is_configured():
            raise RuntimeError("SMTP Gmail non configuré")

        message = EmailMessage()
        message["Subject"] = "Code de verification SOUKI"
        message["From"] = self.smtp_from
        message["To"] = recipient
        message.set_content(
            "\n".join(
                [
                    "Bonjour,",
                    "",
                    "Voici votre code de verification SOUKI :",
                    f"{code}",
                    "",
                    "Ce code expire dans 15 minutes.",
                    "Si vous n'etes pas a l'origine de cette demande, ignorez cet email.",
                ]
            )
        )

        with smtplib.SMTP(self.smtp_host, self.smtp_port, timeout=20) as server:
            server.starttls()
            server.login(self.smtp_username, self.smtp_password)
            server.send_message(message)
