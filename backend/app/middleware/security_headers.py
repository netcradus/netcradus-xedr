from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

# Applied to every response regardless of environment
_ALWAYS: dict[str, str] = {
    "X-Content-Type-Options":  "nosniff",
    "X-Frame-Options":         "DENY",
    "X-XSS-Protection":        "0",            # disable legacy mode; CSP is the modern control
    "Referrer-Policy":         "strict-origin-when-cross-origin",
    "Cache-Control":           "no-store",      # prevent sensitive API data in browser cache
    "Content-Security-Policy": "default-src 'none'",
    "Permissions-Policy":      "geolocation=(), microphone=(), camera=()",
}

# HSTS is only meaningful over HTTPS — omit in debug/dev so HTTP still works
_HSTS_HEADER = "Strict-Transport-Security"
_HSTS_VALUE  = "max-age=31536000; includeSubDomains; preload"


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Adds OWASP-recommended HTTP security headers to every response.

    Pass debug=True (when settings.debug is True) to suppress the HSTS header
    so local HTTP development isn't broken by the browser's HSTS cache.
    """

    def __init__(self, app, debug: bool = False) -> None:
        super().__init__(app)
        self._debug = debug

    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        for name, value in _ALWAYS.items():
            response.headers[name] = value
        if not self._debug:
            response.headers[_HSTS_HEADER] = _HSTS_VALUE
        return response
