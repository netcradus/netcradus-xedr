"""
API tests for /api/v1/iocs — CRUD, auth enforcement, validation.
"""
import uuid

import pytest

from tests.conftest import auth_headers, uid


def _ioc_payload(**kwargs) -> dict:
    return {
        "type": "IPv4",
        "value": f"10.{uuid.uuid4().int%254}.{uuid.uuid4().int%254}.1",
        "severity": "High",
        "category": "Malware",
        **kwargs,
    }


# ── POST /iocs ─────────────────────────────────────────────────────────────────

class TestCreateIOC:
    URL = "/api/v1/iocs"

    def test_admin_can_create_ioc(self, client, admin_user):
        resp = client.post(self.URL, json=_ioc_payload(), headers=auth_headers(admin_user))
        assert resp.status_code == 201
        data = resp.json()
        assert "id" in data
        assert data["type"] == "IPv4"

    def test_analyst_cannot_create_ioc(self, client, analyst_user):
        resp = client.post(self.URL, json=_ioc_payload(), headers=auth_headers(analyst_user))
        assert resp.status_code == 403

    def test_unauthenticated_returns_401(self, client):
        resp = client.post(self.URL, json=_ioc_payload())
        assert resp.status_code == 401

    def test_duplicate_value_returns_409(self, client, admin_user):
        payload = _ioc_payload()
        client.post(self.URL, json=payload, headers=auth_headers(admin_user))
        resp = client.post(self.URL, json=payload, headers=auth_headers(admin_user))
        assert resp.status_code == 409

    def test_invalid_ioc_type_returns_422(self, client, admin_user):
        resp = client.post(
            self.URL,
            json={**_ioc_payload(), "type": "NotARealType"},
            headers=auth_headers(admin_user),
        )
        assert resp.status_code == 422

    def test_empty_value_returns_422(self, client, admin_user):
        resp = client.post(
            self.URL,
            json={**_ioc_payload(), "value": "   "},
            headers=auth_headers(admin_user),
        )
        assert resp.status_code == 422

    def test_invalid_severity_returns_422(self, client, admin_user):
        resp = client.post(
            self.URL,
            json={**_ioc_payload(), "severity": "Apocalyptic"},
            headers=auth_headers(admin_user),
        )
        assert resp.status_code == 422

    def test_created_ioc_value_is_normalized(self, client, admin_user):
        resp = client.post(
            self.URL,
            json={**_ioc_payload(), "type": "SHA256", "value": "  ABCD1234EFGH  "},
            headers=auth_headers(admin_user),
        )
        assert resp.status_code == 201
        assert resp.json()["value"] == "abcd1234efgh"


# ── GET /iocs ──────────────────────────────────────────────────────────────────

class TestListIOCs:
    URL = "/api/v1/iocs"

    def test_analyst_can_list(self, client, analyst_user):
        resp = client.get(self.URL, headers=auth_headers(analyst_user))
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_unauthenticated_returns_401(self, client):
        resp = client.get(self.URL)
        assert resp.status_code == 401

    def test_filter_by_type(self, client, admin_user):
        # Create an IPv4 IOC and verify type filter works
        client.post(self.URL, json=_ioc_payload(type="IPv4"), headers=auth_headers(admin_user))
        resp = client.get(self.URL, params={"ioc_type": "IPv4"}, headers=auth_headers(admin_user))
        assert resp.status_code == 200
        assert all(i["type"] == "IPv4" for i in resp.json())

    def test_invalid_type_filter_returns_422(self, client, analyst_user):
        resp = client.get(self.URL, params={"ioc_type": "BadType"}, headers=auth_headers(analyst_user))
        assert resp.status_code == 422

    def test_search_returns_matching_iocs(self, client, admin_user):
        unique = uid("searchterm")
        client.post(
            self.URL,
            json={"type": "Domain", "value": unique + ".evil.com"},
            headers=auth_headers(admin_user),
        )
        resp = client.get(self.URL, params={"search": unique}, headers=auth_headers(admin_user))
        assert resp.status_code == 200
        assert len(resp.json()) >= 1


# ── GET /iocs/{id} ─────────────────────────────────────────────────────────────

class TestGetIOC:
    def test_get_existing_ioc(self, client, ioc_a, analyst_user):
        resp = client.get(f"/api/v1/iocs/{ioc_a.id}", headers=auth_headers(analyst_user))
        assert resp.status_code == 200
        assert resp.json()["id"] == ioc_a.id

    def test_get_nonexistent_returns_404(self, client, analyst_user):
        resp = client.get("/api/v1/iocs/999999", headers=auth_headers(analyst_user))
        assert resp.status_code == 404


# ── PUT /iocs/{id} ─────────────────────────────────────────────────────────────

class TestUpdateIOC:
    def test_admin_can_update(self, client, ioc_a, admin_user):
        resp = client.put(
            f"/api/v1/iocs/{ioc_a.id}",
            json={"severity": "Critical"},
            headers=auth_headers(admin_user),
        )
        assert resp.status_code == 200
        assert resp.json()["severity"] == "Critical"

    def test_analyst_cannot_update(self, client, ioc_a, analyst_user):
        resp = client.put(
            f"/api/v1/iocs/{ioc_a.id}",
            json={"severity": "Low"},
            headers=auth_headers(analyst_user),
        )
        assert resp.status_code == 403

    def test_update_nonexistent_returns_404(self, client, admin_user):
        resp = client.put(
            "/api/v1/iocs/999999",
            json={"severity": "Low"},
            headers=auth_headers(admin_user),
        )
        assert resp.status_code == 404


# ── DELETE /iocs/{id} ─────────────────────────────────────────────────────────

class TestDeleteIOC:
    def test_admin_can_delete(self, client, ioc_a, admin_user):
        resp = client.delete(f"/api/v1/iocs/{ioc_a.id}", headers=auth_headers(admin_user))
        assert resp.status_code == 204

    def test_analyst_cannot_delete(self, client, ioc_a, analyst_user):
        resp = client.delete(f"/api/v1/iocs/{ioc_a.id}", headers=auth_headers(analyst_user))
        assert resp.status_code == 403

    def test_delete_nonexistent_returns_404(self, client, admin_user):
        resp = client.delete("/api/v1/iocs/999999", headers=auth_headers(admin_user))
        assert resp.status_code == 404

    def test_double_delete_returns_404(self, client, ioc_a, admin_user):
        client.delete(f"/api/v1/iocs/{ioc_a.id}", headers=auth_headers(admin_user))
        resp = client.delete(f"/api/v1/iocs/{ioc_a.id}", headers=auth_headers(admin_user))
        assert resp.status_code == 404
