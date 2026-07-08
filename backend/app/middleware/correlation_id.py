import uuid

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

_HEADER = "X-Request-ID"


class CorrelationIdMiddleware(BaseHTTPMiddleware):
    """
    Attaches a correlation / request ID to every request and echoes it in the response.

    Reads X-Request-ID from the incoming request (allowing load balancers / API
    gateways to propagate their own IDs) or generates a UUID4 when none is present.
    The ID is stored on request.state.correlation_id so exception handlers and
    log statements can include it without re-reading the header.
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        cid = request.headers.get(_HEADER) or str(uuid.uuid4())
        request.state.correlation_id = cid
        response = await call_next(request)
        response.headers[_HEADER] = cid
        return response
