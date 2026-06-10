import os
import time
import logging
import httpx

logger = logging.getLogger('graph_module')

CHAT_MODULE_URL = os.getenv("CHAT_MODULE_URL", "http://chat_module:8003")
_CACHE_TTL_SECONDS = 60.0
_CACHE_MAX_SIZE = 1024
_cache: dict[tuple[str, str], tuple[bool, float]] = {}


def _prune_expired(now: float) -> None:
    if len(_cache) < _CACHE_MAX_SIZE:
        return
    for key in [k for k, (_, expires) in _cache.items() if expires <= now]:
        del _cache[key]


def user_can_access_room(user_id, room_id, token: str) -> bool:
    key = (str(user_id), str(room_id))
    now = time.monotonic()

    cached = _cache.get(key)
    if cached and cached[1] > now:
        return cached[0]

    try:
        response = httpx.get(
            f"{CHAT_MODULE_URL}/api/chat/rooms/{room_id}/access/",
            headers={"Authorization": f"Bearer {token}"},
            timeout=5.0,
        )
        allowed = response.status_code == 200
    except httpx.RequestError as e:
        logger.error("room access check unreachable | room=%s | %s", room_id, e)
        return False

    _prune_expired(now)
    _cache[key] = (allowed, now + _CACHE_TTL_SECONDS)
    return allowed
