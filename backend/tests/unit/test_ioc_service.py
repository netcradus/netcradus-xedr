"""
Unit tests for ioc_service — pure logic + DB-level operations.
All tests use the shared DB session from conftest and unique data so
they never conflict with each other or with other test modules.
"""
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import pytest

from app.models.agent import Agent
from app.models.alert import Alert
from app.models.ioc import IOC
from app.models.tenant import Tenant
from app.schemas.ioc_schema import CreateIOCRequest, UpdateIOCRequest
from app.services.ioc_service import (
    create_ioc,
    delete_ioc,
    find_active_ioc,
    get_ioc,
    list_iocs,
    match_ioc_value,
    normalize_ioc_value,
    search_ioc,
    update_ioc,
)
from tests.conftest import uid


# ── normalize_ioc_value ────────────────────────────────────────────────────────

def test_normalize_lowercases_sha256():
    assert normalize_ioc_value("SHA256", "ABCDEF1234") == "abcdef1234"

def test_normalize_lowercases_ipv4():
    assert normalize_ioc_value("IPv4", "1.2.3.4") == "1.2.3.4"

def test_normalize_strips_whitespace():
    assert normalize_ioc_value("Domain", "  evil.com  ") == "evil.com"

def test_normalize_lowercases_domain():
    assert normalize_ioc_value("Domain", "Evil.COM") == "evil.com"

def test_normalize_lowercases_email():
    assert normalize_ioc_value("Email", "User@Domain.COM") == "user@domain.com"

def test_normalize_unknown_type_strips_only():
    assert normalize_ioc_value("UnknownType", "  SomeValue  ") == "SomeValue"


# ── create_ioc ─────────────────────────────────────────────────────────────────

def test_create_ioc_sets_tenant_id(db, tenant_a):
    req = CreateIOCRequest(type="IPv4", value=f"10.0.{uuid.uuid4().int%254}.1")
    ioc = create_ioc(db, req, "tester@test.local", tenant_a.id)
    assert ioc.tenant_id == tenant_a.id

def test_create_ioc_normalizes_value(db, tenant_a):
    req = CreateIOCRequest(type="SHA256", value="  ABCD1234EF  ")
    ioc = create_ioc(db, req, "tester@test.local", tenant_a.id)
    assert ioc.value == "abcd1234ef"

def test_create_ioc_stores_type(db, tenant_a):
    req = CreateIOCRequest(type="Domain", value=uid("evil") + ".com")
    ioc = create_ioc(db, req, "tester@test.local", tenant_a.id)
    assert ioc.type == "Domain"

def test_create_ioc_duplicate_value_same_tenant_raises(db, tenant_a):
    from sqlalchemy.exc import IntegrityError
    val = uid("dup") + ".com"
    req = CreateIOCRequest(type="Domain", value=val)
    create_ioc(db, req, "tester@test.local", tenant_a.id)
    with pytest.raises(IntegrityError):
        create_ioc(db, CreateIOCRequest(type="Domain", value=val), "tester@test.local", tenant_a.id)

def test_create_ioc_same_value_different_tenants_ok(db, tenant_a, tenant_b):
    val = uid("shared") + ".com"
    ioc1 = create_ioc(db, CreateIOCRequest(type="Domain", value=val), "a@test", tenant_a.id)
    ioc2 = create_ioc(db, CreateIOCRequest(type="Domain", value=val), "b@test", tenant_b.id)
    assert ioc1.id != ioc2.id
    assert ioc1.value == ioc2.value


# ── get_ioc ────────────────────────────────────────────────────────────────────

def test_get_ioc_returns_own(db, ioc_a, tenant_a):
    found = get_ioc(db, ioc_a.id, tenant_a.id)
    assert found is not None
    assert found.id == ioc_a.id

def test_get_ioc_returns_none_for_other_tenant(db, ioc_a, tenant_b):
    assert get_ioc(db, ioc_a.id, tenant_b.id) is None

def test_get_ioc_missing_id_returns_none(db, tenant_a):
    assert get_ioc(db, 999_999, tenant_a.id) is None


# ── update_ioc ─────────────────────────────────────────────────────────────────

def test_update_ioc_changes_severity(db, ioc_a, tenant_a):
    result = update_ioc(db, ioc_a.id, UpdateIOCRequest(severity="Critical"), tenant_a.id)
    assert result.severity == "Critical"

def test_update_ioc_normalizes_value(db, ioc_a, tenant_a):
    result = update_ioc(db, ioc_a.id, UpdateIOCRequest(value="  BAD.COM  "), tenant_a.id)
    assert result.value == "bad.com"

def test_update_ioc_wrong_tenant_returns_none(db, ioc_a, tenant_b):
    result = update_ioc(db, ioc_a.id, UpdateIOCRequest(severity="Low"), tenant_b.id)
    assert result is None

def test_update_ioc_missing_id_returns_none(db, tenant_a):
    result = update_ioc(db, 999_999, UpdateIOCRequest(severity="Low"), tenant_a.id)
    assert result is None


# ── delete_ioc ─────────────────────────────────────────────────────────────────

def test_delete_ioc_returns_true(db, tenant_a):
    req = CreateIOCRequest(type="IPv4", value=f"5.5.{uuid.uuid4().int%254}.5")
    ioc = create_ioc(db, req, "tester", tenant_a.id)
    assert delete_ioc(db, ioc.id, tenant_a.id) is True
    assert get_ioc(db, ioc.id, tenant_a.id) is None

def test_delete_ioc_wrong_tenant_returns_false(db, ioc_a, tenant_b):
    assert delete_ioc(db, ioc_a.id, tenant_b.id) is False

def test_delete_ioc_missing_id_returns_false(db, tenant_a):
    assert delete_ioc(db, 999_999, tenant_a.id) is False


# ── list_iocs ──────────────────────────────────────────────────────────────────

def test_list_iocs_only_own_tenant(db, tenant_a, tenant_b):
    v = uid("listtest") + ".com"
    create_ioc(db, CreateIOCRequest(type="Domain", value=v), "t", tenant_a.id)
    results = list_iocs(db, tenant_b.id)
    assert all(i.tenant_id == tenant_b.id for i in results)

def test_list_iocs_type_filter(db, tenant_a):
    create_ioc(db, CreateIOCRequest(type="IPv4", value=f"9.9.{uuid.uuid4().int%254}.9"), "t", tenant_a.id)
    create_ioc(db, CreateIOCRequest(type="Domain", value=uid("filter")+".com"), "t", tenant_a.id)
    ipv4_results = list_iocs(db, tenant_a.id, ioc_type="IPv4")
    assert all(i.type == "IPv4" for i in ipv4_results)

def test_list_iocs_active_only_excludes_inactive(db, tenant_a):
    active_val = uid("act") + ".com"
    inactive_val = uid("inact") + ".com"
    create_ioc(db, CreateIOCRequest(type="Domain", value=active_val, is_active=True), "t", tenant_a.id)
    create_ioc(db, CreateIOCRequest(type="Domain", value=inactive_val, is_active=False), "t", tenant_a.id)
    results = list_iocs(db, tenant_a.id, active_only=True)
    assert all(i.is_active for i in results)
    values = [i.value for i in results]
    assert active_val in values
    assert inactive_val not in values


# ── search_ioc ─────────────────────────────────────────────────────────────────

def test_search_ioc_finds_by_value(db, tenant_a):
    unique_domain = uid("searchable") + ".evil.com"
    create_ioc(db, CreateIOCRequest(type="Domain", value=unique_domain), "t", tenant_a.id)
    results = search_ioc(db, tenant_a.id, "searchable")
    assert any(i.value == unique_domain for i in results)

def test_search_ioc_scoped_to_tenant(db, tenant_a, tenant_b):
    val = uid("scopedval") + ".com"
    create_ioc(db, CreateIOCRequest(type="Domain", value=val), "t", tenant_a.id)
    results = search_ioc(db, tenant_b.id, "scopedval")
    assert all(i.tenant_id == tenant_b.id for i in results)


# ── find_active_ioc ────────────────────────────────────────────────────────────

def test_find_active_ioc_returns_match(db, tenant_a):
    val = f"3.3.{uuid.uuid4().int%254}.3"
    create_ioc(db, CreateIOCRequest(type="IPv4", value=val, is_active=True), "t", tenant_a.id)
    found = find_active_ioc(db, "IPv4", val, tenant_a.id)
    assert found is not None

def test_find_active_ioc_expired_not_returned(db, tenant_a):
    val = f"7.7.{uuid.uuid4().int%254}.7"
    past = datetime.utcnow() - timedelta(hours=1)
    ioc = IOC(
        tenant_id=tenant_a.id, type="IPv4", value=val,
        is_active=True, expires_at=past,
    )
    db.add(ioc); db.commit()
    assert find_active_ioc(db, "IPv4", val, tenant_a.id) is None

def test_find_active_ioc_inactive_not_returned(db, tenant_a):
    val = uid("inactval")
    create_ioc(db, CreateIOCRequest(type="Filename", value=val, is_active=False), "t", tenant_a.id)
    assert find_active_ioc(db, "Filename", val, tenant_a.id) is None

def test_find_active_ioc_wrong_tenant_not_returned(db, tenant_a, tenant_b):
    val = f"8.8.{uuid.uuid4().int%254}.8"
    create_ioc(db, CreateIOCRequest(type="IPv4", value=val, is_active=True), "t", tenant_a.id)
    assert find_active_ioc(db, "IPv4", val, tenant_b.id) is None


# ── match_ioc_value ────────────────────────────────────────────────────────────

def test_match_ioc_value_creates_alert(db, tenant_a, agent_a):
    val = f"2.2.{uuid.uuid4().int%254}.2"
    create_ioc(db, CreateIOCRequest(type="IPv4", value=val, severity="Critical", is_active=True), "t", tenant_a.id)
    with patch("app.services.ioc_service.create_ioc_match_alert") as mock_alert:
        match_ioc_value(db, "IPv4", val, "network connection", agent_a.id, tenant_a.id)
        mock_alert.assert_called_once()

def test_match_ioc_value_no_match_no_alert(db, tenant_a, agent_a):
    with patch("app.services.ioc_service.create_ioc_match_alert") as mock_alert:
        match_ioc_value(db, "IPv4", "0.0.0.1", "network", agent_a.id, tenant_a.id)
        mock_alert.assert_not_called()

def test_match_ioc_value_empty_value_returns_none(db, tenant_a, agent_a):
    result = match_ioc_value(db, "IPv4", "", "network", agent_a.id, tenant_a.id)
    assert result is None

def test_match_ioc_value_wrong_tenant_no_alert(db, tenant_a, tenant_b, agent_b):
    val = f"6.6.{uuid.uuid4().int%254}.6"
    create_ioc(db, CreateIOCRequest(type="IPv4", value=val, is_active=True), "t", tenant_a.id)
    with patch("app.services.ioc_service.create_ioc_match_alert") as mock_alert:
        match_ioc_value(db, "IPv4", val, "network", agent_b.id, tenant_b.id)
        mock_alert.assert_not_called()
