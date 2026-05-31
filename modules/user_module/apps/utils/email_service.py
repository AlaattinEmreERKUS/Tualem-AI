import logging
from django.core.mail import send_mail
from django.conf import settings

logger = logging.getLogger("user_module")


def send_verification_email(email: str, code: str) -> None:
    subject = "Tualem AI — E-posta Doğrulama Kodu"
    message = (
        f"Tualem AI hesabınızı doğrulamak için kodunuz: {code}\n\n"
        f"Bu kod 10 dakika geçerlidir. Talebi siz yapmadıysanız bu e-postayı yok sayın."
    )
    from_email = getattr(settings, "DEFAULT_FROM_EMAIL", "noreply@tualem.ai")
    try:
        send_mail(subject, message, from_email, [email], fail_silently=False)
        logger.info("Doğrulama e-postası gönderildi | email=%s", email)
    except Exception as e:
        # Console backend / SMTP hatası — kodu log'a yaz (dev fallback)
        logger.warning("E-posta gönderilemedi (%s). Kod (dev): %s | email=%s", e, code, email)
