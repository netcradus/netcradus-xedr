"""Singleton Redis client shared across the FastAPI process."""
import redis as _redis
from app.core.config import settings

_client: _redis.Redis | None = None


def get_redis() -> _redis.Redis | None:
    """Return a connected Redis client, or None if Redis is unreachable."""
    global _client
    if _client is not None:
        return _client
    try:
        client = _redis.from_url(
            settings.redis_url,
            decode_responses=True,
            socket_connect_timeout=2,
            socket_timeout=2,
        )
        client.ping()
        _client = client
    except Exception:
        pass
    return _client
