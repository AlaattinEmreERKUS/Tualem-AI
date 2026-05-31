import os
import secrets
import redis

_client = None
_CODE_TTL = 600  # 10 dakika
_RESEND_COOLDOWN = 30  # saniye


def _get_client():
    global _client
    if _client is None:
        _client = redis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379/0"))
    return _client


def _code_key(email: str) -> str:
    return f"emailverify:code:{email.lower()}"


def _cooldown_key(email: str) -> str:
    return f"emailverify:cooldown:{email.lower()}"


def generate_code() -> str:
    return f"{secrets.randbelow(1000000):06d}"


def store_code(email: str, code: str) -> None:
    _get_client().setex(_code_key(email), _CODE_TTL, code)


def get_code(email: str) -> str | None:
    val = _get_client().get(_code_key(email))
    return val.decode() if val else None


def clear_code(email: str) -> None:
    _get_client().delete(_code_key(email))


def can_resend(email: str) -> bool:
    return not _get_client().exists(_cooldown_key(email))


def mark_resend(email: str) -> None:
    _get_client().setex(_cooldown_key(email), _RESEND_COOLDOWN, "1")
