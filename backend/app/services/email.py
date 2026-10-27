import logging
import smtplib
import ssl
from email.message import EmailMessage

from app.core.config import settings

log = logging.getLogger(__name__)


def email_enabled() -> bool:
    return bool(settings.SMTP_HOST)


def send_email(to: str, subject: str, body: str) -> None:
    """Blocking SMTP send; call from a background task / thread."""
    if not email_enabled():
        if settings.APP_ENV == "production":
            log.error("SMTP not configured; could not send %r to %s", subject, to)
        else:
            log.warning("SMTP not configured; email to %s:\nSubject: %s\n\n%s", to, subject, body)
        return
    msg = EmailMessage()
    msg["From"] = settings.SMTP_FROM or settings.SMTP_USER
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body)
    context = ssl.create_default_context()
    try:
        if settings.SMTP_PORT == 465:
            with smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, context=context, timeout=20) as smtp:
                smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                smtp.send_message(msg)
        else:
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=20) as smtp:
                smtp.starttls(context=context)
                smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                smtp.send_message(msg)
        log.info("Sent %r to %s", subject, to)
    except Exception:
        log.exception("Failed to send %r to %s", subject, to)
