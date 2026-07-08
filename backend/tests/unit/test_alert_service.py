"""
Unit tests for alert_service — deduplication, cooldown, occurrence counting.
"""
from datetime import datetime, timedelta
from unittest.mock import patch

import pytest

from app.models.alert import Alert
from app.services.alert_service import ALERT_COOLDOWN_HOURS, create_alert_if_not_exists
from tests.conftest import uid


def _make_alert(db, agent_id: int, title: str | None = None, status: str = "Open") -> Alert:
    a = Alert(
        title=title or uid("alert_"),
        description="desc",
        severity="High",
        mitre_technique="T1071",
        status=status,
        agent_id=agent_id,
    )
    db.add(a)
    db.commit()
    db.refresh(a)
    return a



def test_create_alert_new(db, agent_a):
    title = uid("new_alert_")
    alert = create_alert_if_not_exists(db, title, "desc", "High", "T1071", agent_a.id)
    assert alert.id is not None
    assert alert.title == title
    assert alert.status == "Open"
    assert alert.occurrence_count == 1


def test_create_alert_dedup_within_cooldown(db, agent_a):
    title = uid("dedup_")
    a1 = create_alert_if_not_exists(db, title, "desc", "High", "T1071", agent_a.id)
    a2 = create_alert_if_not_exists(db, title, "desc", "High", "T1071", agent_a.id)
    assert a1.id == a2.id


def test_create_alert_increments_occurrence_count(db, agent_a):
    title = uid("occ_")
    a1 = create_alert_if_not_exists(db, title, "d", "High", "T1071", agent_a.id)
    a2 = create_alert_if_not_exists(db, title, "d", "High", "T1071", agent_a.id)
    db.refresh(a2)
    assert a2.occurrence_count == 2


def test_create_alert_resolved_not_incremented(db, agent_a):
    title = uid("resolved_")
    alert = _make_alert(db, agent_a.id, title=title, status="Resolved")
    result = create_alert_if_not_exists(db, title, "d", "High", "T1071", agent_a.id)
    db.refresh(alert)
    # Resolved alert within cooldown: returned as-is, count not bumped
    assert result.id == alert.id
    assert result.occurrence_count == 1


def test_create_alert_new_after_cooldown(db, agent_a):
    title = uid("cooldown_")
    # Manually insert an old alert outside the cooldown window
    old_ts = datetime.utcnow() - timedelta(hours=ALERT_COOLDOWN_HOURS + 1)
    old = Alert(
        title=title, description="old", severity="High",
        mitre_technique="T1071", status="Open", agent_id=agent_a.id,
    )
    db.add(old)
    db.commit()
    # Manually backdate it
    db.query(Alert).filter(Alert.id == old.id).update({"timestamp": old_ts})
    db.commit()

    new_alert = create_alert_if_not_exists(db, title, "new", "High", "T1071", agent_a.id)
    assert new_alert.id != old.id


def test_create_alert_different_agents_not_deduped(db, agent_a, agent_b):
    title = uid("multiagent_")
    a1 = create_alert_if_not_exists(db, title, "d", "High", "T1071", agent_a.id)
    a2 = create_alert_if_not_exists(db, title, "d", "High", "T1071", agent_b.id)
    assert a1.id != a2.id
