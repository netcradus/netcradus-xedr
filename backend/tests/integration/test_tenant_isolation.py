"""
Integration tests for multi-tenant data isolation.

Every test verifies that Tenant B cannot read, modify, or delete
data that belongs to Tenant A — at both the service layer and API layer.
"""
import uuid

import pytest

from app.models.alert import Alert
from app.models.ioc import IOC
from app.schemas.ioc_schema import CreateIOCRequest, UpdateIOCRequest
from app.services.ioc_service import (
    create_ioc,
    delete_ioc,
    get_ioc,
    list_iocs,
    search_ioc,
    update_ioc,
)
from tests.conftest import auth_headers, uid


# ── Service-layer isolation ────────────────────────────────────────────────────

class TestIOCServiceIsolation:
    """All IOC service calls must be scoped to the calling tenant."""

    def test_get_own_ioc(self, db, ioc_a, tenant_a):
        assert get_ioc(db, ioc_a.id, tenant_a.id) is not None

    def test_cannot_get_other_tenants_ioc(self, db, ioc_a, tenant_b):
        assert get_ioc(db, ioc_a.id, tenant_b.id) is None

    def test_list_only_returns_own_iocs(self, db, ioc_a, tenant_a, tenant_b):
        results = list_iocs(db, tenant_b.id)
        ids = [i.id for i in results]
        assert ioc_a.id not in ids

    def test_search_does_not_leak_other_tenant_data(self, db, tenant_a, tenant_b):
        val = uid("leak") + ".com"
        create_ioc(db, CreateIOCRequest(type="Domain", value=val), "t", tenant_a.id)
        results = search_ioc(db, tenant_b.id, "leak")
        assert all(i.tenant_id == tenant_b.id for i in results)

    def test_cannot_update_other_tenants_ioc(self, db, ioc_a, tenant_b):
        result = update_ioc(db, ioc_a.id, UpdateIOCRequest(severity="Low"), tenant_b.id)
        assert result is None
        # Verify the original ioc is unchanged
        db.refresh(ioc_a)
        assert ioc_a.severity != "Low"

    def test_cannot_delete_other_tenants_ioc(self, db, ioc_a, tenant_b):
        assert delete_ioc(db, ioc_a.id, tenant_b.id) is False
        db.refresh(ioc_a)
        assert ioc_a.id is not None


# ── API-layer isolation ────────────────────────────────────────────────────────

class TestIOCAPIIsolation:
    """HTTP endpoints must return 404 when accessing another tenant's resource."""

    def test_get_other_tenant_ioc_returns_404(self, client, ioc_a, admin_b):
        resp = client.get(f"/api/v1/iocs/{ioc_a.id}", headers=auth_headers(admin_b))
        assert resp.status_code == 404

    def test_update_other_tenant_ioc_returns_404(self, client, ioc_a, admin_b):
        resp = client.put(
            f"/api/v1/iocs/{ioc_a.id}",
            json={"severity": "Low"},
            headers=auth_headers(admin_b),
        )
        assert resp.status_code == 404

    def test_delete_other_tenant_ioc_returns_404(self, client, ioc_a, admin_b):
        resp = client.delete(
            f"/api/v1/iocs/{ioc_a.id}",
            headers=auth_headers(admin_b),
        )
        assert resp.status_code == 404

    def test_list_iocs_does_not_include_other_tenant(self, client, ioc_a, admin_b):
        resp = client.get("/api/v1/iocs", headers=auth_headers(admin_b))
        assert resp.status_code == 200
        ids = [i["id"] for i in resp.json()]
        assert ioc_a.id not in ids


class TestAlertAPIIsolation:
    """Alert endpoints scope results by agent.tenant_id."""

    def test_get_other_tenant_alert_returns_404(self, client, alert_a, admin_b):
        resp = client.get(f"/api/v1/alerts/{alert_a.id}", headers=auth_headers(admin_b))
        assert resp.status_code == 404

    def test_resolve_other_tenant_alert_returns_404(self, client, alert_a, admin_b):
        resp = client.put(
            f"/api/v1/alerts/{alert_a.id}/resolve",
            headers=auth_headers(admin_b),
        )
        assert resp.status_code == 404

    def test_list_alerts_does_not_include_other_tenant(self, client, alert_a, admin_b):
        resp = client.get("/api/v1/alerts/", headers=auth_headers(admin_b))
        assert resp.status_code == 200
        ids = [a["id"] for a in resp.json()["items"]]
        assert alert_a.id not in ids
