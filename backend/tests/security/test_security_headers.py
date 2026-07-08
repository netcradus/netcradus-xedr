"""
Security regression tests for HTTP response headers.

Every response from the API must include the security headers set by
SecurityHeadersMiddleware and CorrelationIdMiddleware.
"""
import pytest


# Any valid endpoint is fine — use /health (no auth required)
_HEALTH = "/health"
# An authenticated endpoint (to test that headers survive auth flows too)
_API = "/api/v1/alerts/"


@pytest.fixture
def health_resp(client):
    return client.get(_HEALTH)


# ── Headers present on every response ─────────────────────────────────────────

def test_x_content_type_options(health_resp):
    assert health_resp.headers.get("x-content-type-options") == "nosniff"


def test_x_frame_options(health_resp):
    assert health_resp.headers.get("x-frame-options") == "DENY"


def test_x_xss_protection(health_resp):
    assert health_resp.headers.get("x-xss-protection") == "0"


def test_referrer_policy(health_resp):
    assert health_resp.headers.get("referrer-policy") == "strict-origin-when-cross-origin"


def test_cache_control(health_resp):
    assert health_resp.headers.get("cache-control") == "no-store"


def test_content_security_policy_present(health_resp):
    assert "content-security-policy" in health_resp.headers


def test_permissions_policy_present(health_resp):
    assert "permissions-policy" in health_resp.headers


def test_hsts_absent_in_debug_mode(health_resp):
    # DEBUG=true is set in conftest; HSTS must not be injected in debug
    assert "strict-transport-security" not in health_resp.headers


# ── Correlation ID header ──────────────────────────────────────────────────────

def test_correlation_id_echoed_back(client):
    custom_id = "test-correlation-id-12345"
    resp = client.get(_HEALTH, headers={"X-Request-ID": custom_id})
    assert resp.headers.get("x-request-id") == custom_id


def test_correlation_id_generated_when_absent(client):
    resp = client.get(_HEALTH)
    # A UUID-style ID should be auto-generated
    cid = resp.headers.get("x-request-id")
    assert cid is not None
    assert len(cid) > 8


# ── Headers survive error responses ───────────────────────────────────────────

def test_security_headers_on_404(client):
    resp = client.get("/api/v1/alerts/999999")
    assert resp.headers.get("x-content-type-options") == "nosniff"
    assert resp.headers.get("x-frame-options") == "DENY"


def test_security_headers_on_401(client):
    resp = client.get(_API)  # no auth
    assert resp.status_code == 401
    assert resp.headers.get("x-content-type-options") == "nosniff"


def test_security_headers_on_422(client, admin_user):
    from tests.conftest import auth_headers
    resp = client.post(
        "/api/v1/iocs",
        json={"type": "NotAType", "value": "x"},
        headers=auth_headers(admin_user),
    )
    assert resp.status_code == 422
    assert resp.headers.get("x-content-type-options") == "nosniff"


# ── Root and health endpoints ──────────────────────────────────────────────────

def test_root_endpoint_reachable(client):
    resp = client.get("/")
    assert resp.status_code == 200


def test_health_endpoint_reachable(client):
    resp = client.get(_HEALTH)
    assert resp.status_code == 200
