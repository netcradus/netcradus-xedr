"""
API tests for /api/v1/alerts — listing, filtering, resolving, stats.
"""
import pytest

from app.models.alert import Alert
from tests.conftest import auth_headers, uid


# ── GET /alerts/ ──────────────────────────────────────────────────────────────

class TestListAlerts:
    URL = "/api/v1/alerts/"

    def test_returns_paginated_response(self, client, alert_a, analyst_user):
        resp = client.get(self.URL, headers=auth_headers(analyst_user))
        assert resp.status_code == 200
        data = resp.json()
        assert "total" in data
        assert "items" in data
        assert isinstance(data["items"], list)

    def test_unauthenticated_returns_401(self, client):
        resp = client.get(self.URL)
        assert resp.status_code == 401

    def test_filter_by_severity(self, client, agent_a, db, analyst_user):
        a = Alert(
            title=uid("crit_"), description="d", severity="Critical",
            mitre_technique="T1071", status="Open", agent_id=agent_a.id,
        )
        db.add(a); db.commit()
        resp = client.get(self.URL, params={"severity": "Critical"}, headers=auth_headers(analyst_user))
        assert resp.status_code == 200
        assert all(i["severity"] == "Critical" for i in resp.json()["items"])

    def test_filter_by_status_open(self, client, alert_a, analyst_user):
        resp = client.get(self.URL, params={"status": "Open"}, headers=auth_headers(analyst_user))
        assert resp.status_code == 200
        assert all(i["status"] == "Open" for i in resp.json()["items"])

    def test_filter_by_status_resolved(self, client, agent_a, db, analyst_user):
        a = Alert(
            title=uid("res_"), description="d", severity="Low",
            mitre_technique="T1071", status="Resolved", agent_id=agent_a.id,
        )
        db.add(a); db.commit()
        resp = client.get(self.URL, params={"status": "Resolved"}, headers=auth_headers(analyst_user))
        assert resp.status_code == 200
        assert all(i["status"] == "Resolved" for i in resp.json()["items"])

    def test_search_finds_by_title(self, client, agent_a, db, analyst_user):
        unique = uid("findme_")
        a = Alert(
            title=unique + "_alert", description="d", severity="High",
            mitre_technique="T1071", status="Open", agent_id=agent_a.id,
        )
        db.add(a); db.commit()
        resp = client.get(self.URL, params={"search": unique}, headers=auth_headers(analyst_user))
        assert resp.status_code == 200
        assert len(resp.json()["items"]) >= 1

    def test_pagination_limit(self, client, analyst_user):
        resp = client.get(self.URL, params={"limit": 5}, headers=auth_headers(analyst_user))
        assert resp.status_code == 200
        assert len(resp.json()["items"]) <= 5

    def test_sort_by_severity(self, client, analyst_user):
        resp = client.get(self.URL, params={"sort_by": "severity", "sort_dir": "asc"},
                          headers=auth_headers(analyst_user))
        assert resp.status_code == 200

    def test_filter_by_agent_id(self, client, alert_a, agent_a, analyst_user):
        resp = client.get(self.URL, params={"agent_id": agent_a.id},
                          headers=auth_headers(analyst_user))
        assert resp.status_code == 200
        items = resp.json()["items"]
        assert all(i["agent_id"] == agent_a.id for i in items)


# ── GET /alerts/open ──────────────────────────────────────────────────────────

class TestOpenAlerts:
    def test_returns_only_open(self, client, alert_a, analyst_user):
        resp = client.get("/api/v1/alerts/open", headers=auth_headers(analyst_user))
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)
        assert all(a["status"] == "Open" for a in resp.json())


# ── GET /alerts/stats ─────────────────────────────────────────────────────────

class TestAlertStats:
    def test_stats_returns_counts(self, client, alert_a, analyst_user):
        resp = client.get("/api/v1/alerts/stats", headers=auth_headers(analyst_user))
        assert resp.status_code == 200
        data = resp.json()
        for key in ("critical", "high", "medium", "low", "open", "resolved"):
            assert key in data
            assert isinstance(data[key], int)

    def test_stats_unauthenticated_returns_401(self, client):
        resp = client.get("/api/v1/alerts/stats")
        assert resp.status_code == 401


# ── GET /alerts/{id} ──────────────────────────────────────────────────────────

class TestGetAlert:
    def test_get_existing_alert(self, client, alert_a, analyst_user):
        resp = client.get(f"/api/v1/alerts/{alert_a.id}", headers=auth_headers(analyst_user))
        assert resp.status_code == 200
        assert resp.json()["id"] == alert_a.id

    def test_get_nonexistent_returns_404(self, client, analyst_user):
        resp = client.get("/api/v1/alerts/999999", headers=auth_headers(analyst_user))
        assert resp.status_code == 404

    def test_response_includes_hostname(self, client, alert_a, analyst_user):
        resp = client.get(f"/api/v1/alerts/{alert_a.id}", headers=auth_headers(analyst_user))
        assert "agent_hostname" in resp.json()


# ── PUT /alerts/{id}/resolve ──────────────────────────────────────────────────

class TestResolveAlert:
    def test_resolve_sets_status_resolved(self, client, alert_a, analyst_user, db):
        resp = client.put(
            f"/api/v1/alerts/{alert_a.id}/resolve",
            headers=auth_headers(analyst_user),
        )
        assert resp.status_code == 200
        db.refresh(alert_a)
        assert alert_a.status == "Resolved"

    def test_resolve_nonexistent_returns_404(self, client, analyst_user):
        resp = client.put("/api/v1/alerts/999999/resolve", headers=auth_headers(analyst_user))
        assert resp.status_code == 404

    def test_resolve_unauthenticated_returns_401(self, client, alert_a):
        resp = client.put(f"/api/v1/alerts/{alert_a.id}/resolve")
        assert resp.status_code == 401
