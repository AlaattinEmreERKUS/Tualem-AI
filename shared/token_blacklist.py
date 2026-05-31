import os
import redis

_client = None


def _get_client():
    global _client
    if _client is None:
        _client = redis.from_url(os.getenv('REDIS_URL', 'redis://localhost:6379/0'))
    return _client


def blacklist_token(jti: str, ttl_seconds: int) -> None:
    _get_client().setex(f"blacklist:{jti}", ttl_seconds, "1")


def is_blacklisted(jti: str) -> bool:
    return bool(_get_client().exists(f"blacklist:{jti}"))
