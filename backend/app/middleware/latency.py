import time

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.core import latency_store

# Skip internal probes from latency tracking
_SKIP_PREFIXES = ("/health", "/metrics", "/docs", "/redoc", "/openapi")


class LatencyMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        path = request.url.path
        if any(path.startswith(p) for p in _SKIP_PREFIXES):
            return await call_next(request)

        start    = time.perf_counter()
        response = await call_next(request)
        elapsed  = (time.perf_counter() - start) * 1000  # ms

        # Prefer the matched route template (/api/v1/agents/{agent_id}) over
        # the raw path so metrics aren't fragmented by each ID value.
        route = request.scope.get("route")
        label = route.path if route else path

        latency_store.record(label, round(elapsed, 1))
        response.headers["X-Response-Time-Ms"] = str(round(elapsed, 1))
        return response
