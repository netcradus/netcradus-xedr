"""
Database-driven detection rule engine.

Rules are fetched from the detection_rules table and evaluated against incoming
telemetry. Matching rules fire alerts through the standard alert pipeline
(deduplication, incident correlation, notifications).
"""
import re as _re
from sqlalchemy.orm import Session

from app.models.detection_rule import DetectionRule
from app.services.alert_service import create_alert_if_not_exists


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


# ── Rule fetching ─────────────────────────────────────────────────────────────

def _get_rules(db: Session, rule_type: str, tenant_id: int):
    """Return enabled rules that apply to this tenant (tenant-specific + global)."""
    return (
        db.query(DetectionRule)
        .filter(
            DetectionRule.rule_type == rule_type,
            DetectionRule.enabled.is_(True),
            (DetectionRule.tenant_id == tenant_id) | (DetectionRule.tenant_id.is_(None)),
        )
        .all()
    )


# ── Per-type evaluators ───────────────────────────────────────────────────────

def evaluate_process_rules(db: Session, process, agent_id: int, tenant_id: int):
    for rule in _get_rules(db, "process", tenant_id):
        extractor = PROCESS_FIELDS.get(rule.field)
        if not extractor:
            continue
        if _match(extractor(process), rule.operator, rule.value):
            desc = (
                f"[Rule: {rule.name}] "
                f"{rule.field} {rule.operator} '{rule.value}' — "
                f"matched on process '{process.process_name}' (PID {process.pid})"
            )
            create_alert_if_not_exists(
                db, rule.name, desc, rule.severity,
                rule.mitre_technique or "", agent_id,
            )


def evaluate_network_rules(db: Session, conn, agent_id: int, tenant_id: int):
    for rule in _get_rules(db, "network", tenant_id):
        extractor = NETWORK_FIELDS.get(rule.field)
        if not extractor:
            continue
        if _match(extractor(conn), rule.operator, rule.value):
            desc = (
                f"[Rule: {rule.name}] "
                f"{rule.field} {rule.operator} '{rule.value}' — "
                f"matched on connection {conn.remote_ip}:{conn.remote_port}"
            )
            create_alert_if_not_exists(
                db, rule.name, desc, rule.severity,
                rule.mitre_technique or "", agent_id,
            )


def evaluate_file_rules(db: Session, event, agent_id: int, tenant_id: int):
    for rule in _get_rules(db, "file", tenant_id):
        extractor = FILE_FIELDS.get(rule.field)
        if not extractor:
            continue
        if _match(extractor(event), rule.operator, rule.value):
            desc = (
                f"[Rule: {rule.name}] "
                f"{rule.field} {rule.operator} '{rule.value}' — "
                f"matched on file '{event.file_path}'"
            )
            create_alert_if_not_exists(
                db, rule.name, desc, rule.severity,
                rule.mitre_technique or "", agent_id,
            )


def evaluate_persistence_rules(db: Session, entry, agent_id: int, tenant_id: int):
    for rule in _get_rules(db, "persistence", tenant_id):
        extractor = PERSISTENCE_FIELDS.get(rule.field)
        if not extractor:
            continue
        if _match(extractor(entry), rule.operator, rule.value):
            desc = (
                f"[Rule: {rule.name}] "
                f"{rule.field} {rule.operator} '{rule.value}' — "
                f"matched on persistence entry '{entry.entry_name}'"
            )
            create_alert_if_not_exists(
                db, rule.name, desc, rule.severity,
                rule.mitre_technique or "", agent_id,
            )


def evaluate_log_rules(db: Session, entry, agent_id: int, tenant_id: int):
    for rule in _get_rules(db, "log", tenant_id):
        extractor = LOG_FIELDS.get(rule.field)
        if not extractor:
            continue
        if _match(extractor(entry), rule.operator, rule.value):
            desc = (
                f"[Rule: {rule.name}] "
                f"{rule.field} {rule.operator} '{rule.value}' — "
                f"matched in {entry.log_source} log"
            )
            create_alert_if_not_exists(
                db, rule.name, desc, rule.severity,
                rule.mitre_technique or "", agent_id,
            )
