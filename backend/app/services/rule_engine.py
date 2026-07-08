"""
Database-driven detection rule engine with multi-condition AND/OR logic
and 60-second in-process cache per tenant.
"""
import re as _re
import threading
import time
from dataclasses import dataclass, field
from typing import List, Optional

from sqlalchemy.orm import Session

from app.models.detection_rule import DetectionRule
from app.models.detection_rule_condition import DetectionRuleCondition
from app.services.alert_service import create_alert_if_not_exists


# ── Cache ─────────────────────────────────────────────────────────────────────

_CACHE_TTL = 60  # seconds

@dataclass
class _CachedCondition:
    field:    str
    operator: str
    value:    str

@dataclass
class _CachedRule:
    id:              int
    name:            str
    logic:           str          # "AND" | "OR"
    severity:        str
    mitre_technique: Optional[str]
    conditions:      List[_CachedCondition] = field(default_factory=list)

@dataclass
class _CacheEntry:
    rules:      List[_CachedRule]
    expires_at: float

_cache: dict[tuple, _CacheEntry] = {}  # (rule_type, tenant_id) -> entry
_cache_lock = threading.Lock()


def invalidate_rule_cache(tenant_id: int) -> None:
    """Drop all cached rule sets that belong to or overlap with this tenant."""
    with _cache_lock:
        to_drop = [k for k in _cache if k[1] in (tenant_id, None)]
        for k in to_drop:
            del _cache[k]


def _load_rules(db: Session, rule_type: str, tenant_id: int) -> List[_CachedRule]:
    key = (rule_type, tenant_id)
    now = time.monotonic()

    with _cache_lock:
        entry = _cache.get(key)
        if entry and entry.expires_at > now:
            return entry.rules

    rows = (
        db.query(DetectionRule)
        .filter(
            DetectionRule.rule_type == rule_type,
            DetectionRule.enabled.is_(True),
            (DetectionRule.tenant_id == tenant_id) | (DetectionRule.tenant_id.is_(None)),
        )
        .all()
    )

    cached = [
        _CachedRule(
            id=r.id,
            name=r.name,
            logic=r.logic or "OR",
            severity=r.severity,
            mitre_technique=r.mitre_technique,
            conditions=[
                _CachedCondition(c.field, c.operator, c.value)
                for c in r.conditions
            ],
        )
        for r in rows
    ]

    with _cache_lock:
        _cache[key] = _CacheEntry(rules=cached, expires_at=now + _CACHE_TTL)

    return cached


# ── Operator evaluation ───────────────────────────────────────────────────────

def _match(field_value, operator: str, rule_value: str) -> bool:
    fv = str(field_value or "").lower()
    rv = rule_value.lower().strip()

    if operator == "contains":
        return rv in fv
    if operator == "not_contains":
        return rv not in fv
    if operator == "equals":
        return fv == rv
    if operator == "not_equals":
        return fv != rv
    if operator == "starts_with":
        return fv.startswith(rv)
    if operator == "ends_with":
        return fv.endswith(rv)
    if operator == "regex":
        try:
            return bool(_re.search(rv, fv))
        except _re.error:
            return False
    if operator == "in_list":
        items = {x.strip().lower() for x in rv.split(",")}
        return fv in items
    if operator == "greater_than":
        try:
            return float(fv) > float(rv)
        except ValueError:
            return False
    if operator == "less_than":
        try:
            return float(fv) < float(rv)
        except ValueError:
            return False
    return False


# ── Field extractors per telemetry type ──────────────────────────────────────

PROCESS_FIELDS = {
    "process_name":        lambda p: p.process_name,
    "cmdline":             lambda p: p.cmdline,
    "exe_path":            lambda p: p.exe_path,
    "username":            lambda p: p.username,
    "parent_process_name": lambda p: p.parent_process_name,
    "sha256":              lambda p: p.sha256,
}

NETWORK_FIELDS = {
    "remote_ip":   lambda c: c.remote_ip,
    "remote_port": lambda c: str(c.remote_port),
    "local_ip":    lambda c: c.local_ip,
    "protocol":    lambda c: c.protocol,
}

FILE_FIELDS = {
    "file_path":  lambda e: e.file_path,
    "event_type": lambda e: e.event_type,
    "sha256":     lambda e: e.sha256,
    "md5":        lambda e: e.md5,
}

PERSISTENCE_FIELDS = {
    "entry_name":       lambda e: e.entry_name,
    "entry_path":       lambda e: e.entry_path,
    "persistence_type": lambda e: e.persistence_type,
}

LOG_FIELDS = {
    "log_source":   lambda e: e.log_source,
    "log_message":  lambda e: e.log_message,
    "raw_message":  lambda e: e.raw_message,
    "severity":     lambda e: e.severity,
    "username":     lambda e: e.username,
    "source_ip":    lambda e: e.source_ip,
    "hostname":     lambda e: e.hostname,
    "process_name": lambda e: e.process_name,
    "event_id":     lambda e: str(e.event_id) if e.event_id is not None else "",
}


# ── Multi-condition rule evaluation ───────────────────────────────────────────

def _rule_matches(rule: _CachedRule, extractors: dict, telemetry) -> bool:
    if not rule.conditions:
        return False
    results = []
    for cond in rule.conditions:
        extractor = extractors.get(cond.field)
        if extractor is None:
            results.append(False)
            continue
        results.append(_match(extractor(telemetry), cond.operator, cond.value))

    return all(results) if rule.logic == "AND" else any(results)


def _fire_rules(
    db: Session,
    rule_type: str,
    extractors: dict,
    telemetry,
    agent_id: int,
    tenant_id: int,
    context_label: str,
) -> None:
    for rule in _load_rules(db, rule_type, tenant_id):
        if _rule_matches(rule, extractors, telemetry):
            matched = [
                f"{c.field} {c.operator} '{c.value}'"
                for c in rule.conditions
                if extractors.get(c.field) and _match(extractors[c.field](telemetry), c.operator, c.value)
            ]
            desc = f"[Rule: {rule.name}] {rule.logic.join(matched)} — matched on {context_label}"
            create_alert_if_not_exists(
                db, rule.name, desc, rule.severity,
                rule.mitre_technique or "", agent_id,
            )


# ── Public API ────────────────────────────────────────────────────────────────

def evaluate_process_rules(db: Session, process, agent_id: int, tenant_id: int):
    _fire_rules(
        db, "process", PROCESS_FIELDS, process, agent_id, tenant_id,
        f"process '{process.process_name}' (PID {process.pid})",
    )


def evaluate_network_rules(db: Session, conn, agent_id: int, tenant_id: int):
    _fire_rules(
        db, "network", NETWORK_FIELDS, conn, agent_id, tenant_id,
        f"connection {conn.remote_ip}:{conn.remote_port}",
    )


def evaluate_file_rules(db: Session, event, agent_id: int, tenant_id: int):
    _fire_rules(
        db, "file", FILE_FIELDS, event, agent_id, tenant_id,
        f"file '{event.file_path}'",
    )


def evaluate_persistence_rules(db: Session, entry, agent_id: int, tenant_id: int):
    _fire_rules(
        db, "persistence", PERSISTENCE_FIELDS, entry, agent_id, tenant_id,
        f"persistence entry '{entry.entry_name}'",
    )


def evaluate_log_rules(db: Session, entry, agent_id: int, tenant_id: int):
    _fire_rules(
        db, "log", LOG_FIELDS, entry, agent_id, tenant_id,
        f"{entry.log_source} log",
    )
