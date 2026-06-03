import logging
import resend
from django.conf import settings

logger = logging.getLogger("user_module")


def send_verification_email(email: str, code: str) -> None:
    api_key = getattr(settings, "RESEND_API_KEY", "")
    if not api_key:
        logger.warning("RESEND_API_KEY eksik. Kod (dev): %s | email=%s", code, email)
        return

    resend.api_key = api_key
    from_email = getattr(settings, "DEFAULT_FROM_EMAIL", "Tualem AI <noreply@tualem.ai>")
    try:
        resend.Emails.send({
            "from": from_email,
            "to": [email],
            "subject": "Tualem AI — E-posta Doğrulama Kodu",
            "text": (
                f"Tualem AI hesabınızı doğrulamak için kodunuz: {code}\n\n"
                f"Bu kod 10 dakika geçerlidir. Talebi siz yapmadıysanız bu e-postayı yok sayın."
            ),
        })
        logger.info("Doğrulama e-postası gönderildi | email=%s", email)
    except Exception as e:
        logger.warning("E-posta gönderilemedi (%s). Kod (dev): %s | email=%s", e, code, email)
