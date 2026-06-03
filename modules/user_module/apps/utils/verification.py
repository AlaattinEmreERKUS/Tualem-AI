import os
import logging
import secrets
import redis

logger = logging.getLogger("user_module")

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
    try:
        _get_client().setex(_code_key(email), _CODE_TTL, code)
    except redis.RedisError as e:
        logger.error("Redis store_code failed | email=%s | error=%s", email, e)
        raise


def get_code(email: str) -> str | None:
    try:
        val = _get_client().get(_code_key(email))
        return val.decode() if val else None
    except redis.RedisError as e:
        logger.error("Redis get_code failed | email=%s | error=%s", email, e)
        return None


def clear_code(email: str) -> None:
    try:
        _get_client().delete(_code_key(email))
    except redis.RedisError as e:
        logger.warning("Redis clear_code failed | email=%s | error=%s", email, e)


def can_resend(email: str) -> bool:
    try:
        return not _get_client().exists(_cooldown_key(email))
    except redis.RedisError as e:
        logger.warning("Redis can_resend failed, allowing resend | email=%s | error=%s", email, e)
        return True  # Fail open — Redis yoksa cooldown'u engelleme


def mark_resend(email: str) -> None:
    try:
        _get_client().setex(_cooldown_key(email), _RESEND_COOLDOWN, "1")
    except redis.RedisError as e:
        logger.warning("Redis mark_resend failed | email=%s | error=%s", email, e)
