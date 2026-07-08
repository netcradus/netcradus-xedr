from slowapi import Limiter
from slowapi.util import get_remote_address

# 300 req/min per IP is the default for any route that does not carry its own
# @limiter.limit() decorator.  Auth routes have stricter per-route limits.
# Note: slowapi only enforces default_limits on routes that accept a `request: Request`
# parameter — infrastructure-level rate limiting (nginx / Cloudflare) should be
# layered on top for complete coverage.
limiter = Limiter(key_func=get_remote_address, default_limits=["300/minute"])
