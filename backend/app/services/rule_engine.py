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

DNS_FIELDS = {
    "query_name":  lambda e: e.query_name,
    "query_type":  lambda e: e.query_type,
    "response":    lambda e: e.response or "",
    "direction":   lambda e: e.direction,
    "process_name":lambda e: e.process_name or "",
    "username":    lambda e: e.username or "",
}

REGISTRY_FIELDS = {
    "event_type":   lambda e: e.event_type,
    "registry_key": lambda e: e.registry_key,
    "value_name":   lambda e: e.value_name or "",
    "value_data":   lambda e: e.value_data or "",
    "value_type":   lambda e: e.value_type or "",
    "process_name": lambda e: e.process_name or "",
    "username":     lambda e: e.username or "",
}

USB_FIELDS = {
    "event_type":  lambda e: e.event_type,
    "device_id":   lambda e: e.device_id or "",
    "device_name": lambda e: e.device_name or "",
    "vendor_id":   lambda e: e.vendor_id or "",
    "product_id":  lambda e: e.product_id or "",
    "file_path":   lambda e: e.file_path or "",
    "username":    lambda e: e.username or "",
}

BROWSER_EXT_FIELDS = {
    "event_type":     lambda e: e.event_type,
    "browser":        lambda e: e.browser,
    "extension_id":   lambda e: e.extension_id,
    "extension_name": lambda e: e.extension_name or "",
    "permissions":    lambda e: e.permissions or "",
    "from_webstore":  lambda e: str(e.from_webstore).lower(),
    "update_url":     lambda e: e.update_url or "",
    "username":       lambda e: e.username or "",
}

CLOUD_FIELDS = {
    "provider":      lambda e: e.provider,
    "event_type":    lambda e: e.event_type,
    "resource_type": lambda e: e.resource_type or "",
    "resource_id":   lambda e: e.resource_id or "",
    "region":        lambda e: e.region or "",
    "actor":         lambda e: e.actor or "",
    "source_ip":     lambda e: e.source_ip or "",
    "action":        lambda e: e.action or "",
    "outcome":       lambda e: e.outcome or "",
}

K8S_FIELDS = {
    "event_type":    lambda e: e.event_type,
    "cluster":       lambda e: e.cluster or "",
    "namespace":     lambda e: e.namespace or "",
    "resource_kind": lambda e: e.resource_kind or "",
    "resource_name": lambda e: e.resource_name or "",
    "actor":         lambda e: e.actor or "",
    "container":     lambda e: e.container or "",
    "image":         lambda e: e.image or "",
    "command":       lambda e: e.command or "",
    "outcome":       lambda e: e.outcome or "",
}

EMAIL_FIELDS = {
    "event_type":    lambda e: e.event_type,
    "direction":     lambda e: e.direction,
    "sender":        lambda e: e.sender or "",
    "recipient":     lambda e: e.recipient or "",
    "subject":       lambda e: e.subject or "",
    "source_ip":     lambda e: e.source_ip or "",
    "verdict":       lambda e: e.verdict or "",
    "score":         lambda e: str(e.score),
    "attachment_sha256": lambda e: e.attachment_sha256 or "",
    "url_clicked":   lambda e: e.url_clicked or "",
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


def evaluate_dns_rules(db: Session, entry, agent_id: int, tenant_id: int):
    _fire_rules(
        db, "dns", DNS_FIELDS, entry, agent_id, tenant_id,
        f"DNS query {entry.query_name}",
    )


def evaluate_registry_rules(db: Session, entry, agent_id: int, tenant_id: int):
    _fire_rules(
        db, "registry", REGISTRY_FIELDS, entry, agent_id, tenant_id,
        f"registry {entry.event_type} {entry.registry_key}",
    )


def evaluate_usb_rules(db: Session, entry, agent_id: int, tenant_id: int):
    _fire_rules(
        db, "usb", USB_FIELDS, entry, agent_id, tenant_id,
        f"USB {entry.event_type} {entry.device_name or entry.device_id or ''}",
    )


def evaluate_browser_extension_rules(db: Session, entry, agent_id: int, tenant_id: int):
    _fire_rules(
        db, "browser_extension", BROWSER_EXT_FIELDS, entry, agent_id, tenant_id,
        f"browser extension {entry.event_type} {entry.extension_name or entry.extension_id}",
    )


def evaluate_cloud_rules(db: Session, entry, agent_id: int, tenant_id: int):
    _fire_rules(
        db, "cloud", CLOUD_FIELDS, entry, agent_id, tenant_id,
        f"cloud {entry.provider} {entry.event_type}",
    )


def evaluate_k8s_rules(db: Session, entry, agent_id: int, tenant_id: int):
    _fire_rules(
        db, "k8s", K8S_FIELDS, entry, agent_id, tenant_id,
        f"k8s {entry.event_type} {entry.resource_kind or ''}/{entry.resource_name or ''}",
    )


def evaluate_email_rules(db: Session, entry, agent_id: int, tenant_id: int):
    _fire_rules(
        db, "email", EMAIL_FIELDS, entry, agent_id, tenant_id,
        f"email {entry.event_type} from {entry.sender or 'unknown'}",
    )
