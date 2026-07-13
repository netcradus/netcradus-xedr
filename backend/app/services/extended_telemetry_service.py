"""
Service layer for the extended telemetry types added in the enterprise feature set:
DNS, Registry, USB, Browser Extensions, Memory Scans, Cloud events, Kubernetes events,
Email security events.

Each save_* function:
  1. Resolves the agent / tenant from the token or API key
  2. Persists the raw telemetry records
  3. Runs the DB-driven detection-rule engine for that telemetry type
  4. Fires an alert for any memory scan hit (always a hard signal)
  5. Returns True on success, False on auth failure
"""
import json
from sqlalchemy.orm import Session

from app.models.agent import Agent
from app.models.tenant import Tenant
from app.models.dns_telemetry import DnsTelemetry
from app.models.registry_telemetry import RegistryTelemetry
from app.models.usb_telemetry import UsbTelemetry
from app.models.browser_extension_telemetry import BrowserExtensionTelemetry
from app.models.memory_scan_result import MemoryScanResult
from app.models.cloud_telemetry import CloudTelemetry
from app.models.k8s_telemetry import K8sTelemetry
from app.models.email_event_telemetry import EmailEventTelemetry
from app.services.alert_service import create_alert_if_not_exists
from app.services.rule_engine import (
    evaluate_dns_rules,
    evaluate_registry_rules,
    evaluate_usb_rules,
    evaluate_browser_extension_rules,
    evaluate_cloud_rules,
    evaluate_k8s_rules,
    evaluate_email_rules,
)


def _resolve_agent(db: Session, agent_token: str):
    return db.query(Agent).filter(Agent.agent_token == agent_token).first()


def _resolve_tenant_by_key(db: Session, api_key: str):
    return db.query(Tenant).filter(Tenant.api_key == api_key).first()


# ── DNS ───────────────────────────────────────────────────────────────────────

def save_dns(db: Session, data) -> bool:
    agent = _resolve_agent(db, data.agent_token)
    if not agent:
        return False
    for entry in data.entries:
        db.add(DnsTelemetry(
            query_name=entry.query_name,
            query_type=entry.query_type,
            response=entry.response,
            direction=entry.direction,
            process_name=entry.process_name,
            pid=entry.pid,
            username=entry.username,
            agent_id=agent.id,
        ))
        evaluate_dns_rules(db, entry, agent.id, agent.tenant_id)
    db.commit()
    return True


# ── Registry ──────────────────────────────────────────────────────────────────

def save_registry(db: Session, data) -> bool:
    agent = _resolve_agent(db, data.agent_token)
    if not agent:
        return False
    for entry in data.entries:
        db.add(RegistryTelemetry(
            event_type=entry.event_type,
            registry_key=entry.registry_key,
            value_name=entry.value_name,
            value_data=entry.value_data[:512] if entry.value_data else None,
            value_type=entry.value_type,
            process_name=entry.process_name,
            pid=entry.pid,
            username=entry.username,
            agent_id=agent.id,
        ))
        evaluate_registry_rules(db, entry, agent.id, agent.tenant_id)
    db.commit()
    return True


# ── USB ───────────────────────────────────────────────────────────────────────

def save_usb(db: Session, data) -> bool:
    agent = _resolve_agent(db, data.agent_token)
    if not agent:
        return False
    for entry in data.entries:
        db.add(UsbTelemetry(
            event_type=entry.event_type,
            device_id=entry.device_id,
            device_name=entry.device_name,
            vendor_id=entry.vendor_id,
            product_id=entry.product_id,
            drive_letter=entry.drive_letter,
            file_path=entry.file_path,
            username=entry.username,
            agent_id=agent.id,
        ))
        evaluate_usb_rules(db, entry, agent.id, agent.tenant_id)
    db.commit()
    return True


# ── Browser extensions ────────────────────────────────────────────────────────

def save_browser_extensions(db: Session, data) -> bool:
    agent = _resolve_agent(db, data.agent_token)
    if not agent:
        return False
    for entry in data.entries:
        db.add(BrowserExtensionTelemetry(
            event_type=entry.event_type,
            browser=entry.browser,
            extension_id=entry.extension_id,
            extension_name=entry.extension_name,
            version=entry.version,
            permissions=entry.permissions,
            from_webstore=entry.from_webstore,
            update_url=entry.update_url,
            username=entry.username,
            agent_id=agent.id,
        ))
        evaluate_browser_extension_rules(db, entry, agent.id, agent.tenant_id)
    db.commit()
    return True


# ── Memory scans ──────────────────────────────────────────────────────────────

def save_memory_scans(db: Session, data) -> bool:
    agent = _resolve_agent(db, data.agent_token)
    if not agent:
        return False
    for entry in data.entries:
        db.add(MemoryScanResult(
            scan_type=entry.scan_type,
            rule_name=entry.rule_name,
            process_name=entry.process_name,
            pid=entry.pid,
            memory_region=entry.memory_region,
            matched_bytes=entry.matched_bytes,
            severity=entry.severity,
            details=entry.details,
            agent_id=agent.id,
        ))
        desc = (
            f"Memory scan match: rule '{entry.rule_name}' in process "
            f"'{entry.process_name}' (PID {entry.pid})"
            + (f" at {entry.memory_region}" if entry.memory_region else "")
        )
        create_alert_if_not_exists(
            db, f"Memory Scan: {entry.rule_name}", desc,
            entry.severity, "", agent.id,
        )
    db.commit()
    return True


# ── Cloud workload events ─────────────────────────────────────────────────────

def _resolve_cloud_context(db: Session, data):
    """Return (agent_or_None, tenant_or_None)."""
    agent = _resolve_agent(db, data.agent_token) if data.agent_token else None
    tenant = None
    if agent:
        tenant = db.query(Tenant).filter(Tenant.id == agent.tenant_id).first()
    elif data.tenant_api_key:
        tenant = _resolve_tenant_by_key(db, data.tenant_api_key)
    return agent, tenant


def save_cloud(db: Session, data) -> bool:
    agent, tenant = _resolve_cloud_context(db, data)
    if not (agent or tenant):
        return False
    tenant_id = (agent.tenant_id if agent else tenant.id) if (agent or tenant) else None
    agent_id  = agent.id if agent else None
    for event in data.events:
        db.add(CloudTelemetry(
            provider=event.provider,
            event_type=event.event_type,
            resource_type=event.resource_type,
            resource_id=event.resource_id,
            region=event.region,
            actor=event.actor,
            source_ip=event.source_ip,
            action=event.action,
            outcome=event.outcome,
            raw_event=event.raw_event,
            agent_id=agent_id,
            tenant_id=tenant_id,
        ))
        if tenant_id:
            evaluate_cloud_rules(db, event, agent_id or 0, tenant_id)
    db.commit()
    return True


# ── Kubernetes events ─────────────────────────────────────────────────────────

def save_k8s(db: Session, data) -> bool:
    agent, tenant = _resolve_cloud_context(db, data)
    if not (agent or tenant):
        return False
    tenant_id = (agent.tenant_id if agent else tenant.id) if (agent or tenant) else None
    agent_id  = agent.id if agent else None
    for event in data.events:
        db.add(K8sTelemetry(
            event_type=event.event_type,
            cluster=event.cluster,
            namespace=event.namespace,
            resource_kind=event.resource_kind,
            resource_name=event.resource_name,
            actor=event.actor,
            container=event.container,
            image=event.image,
            command=event.command,
            outcome=event.outcome,
            raw_event=event.raw_event,
            agent_id=agent_id,
            tenant_id=tenant_id,
        ))
        if tenant_id:
            evaluate_k8s_rules(db, event, agent_id or 0, tenant_id)
    db.commit()
    return True


# ── Email security events ─────────────────────────────────────────────────────

def save_email(db: Session, data) -> bool:
    agent, tenant = _resolve_cloud_context(db, data)
    if not (agent or tenant):
        return False
    tenant_id = (agent.tenant_id if agent else tenant.id) if (agent or tenant) else None
    agent_id  = agent.id if agent else None
    for event in data.events:
        db.add(EmailEventTelemetry(
            event_type=event.event_type,
            direction=event.direction,
            sender=event.sender,
            recipient=event.recipient,
            subject=event.subject,
            message_id=event.message_id,
            source_ip=event.source_ip,
            has_attachment=event.has_attachment,
            attachment_name=event.attachment_name,
            attachment_sha256=event.attachment_sha256,
            url_clicked=event.url_clicked,
            verdict=event.verdict,
            score=event.score,
            raw_headers=event.raw_headers,
            agent_id=agent_id,
            tenant_id=tenant_id,
        ))
        if tenant_id:
            evaluate_email_rules(db, event, agent_id or 0, tenant_id)
    db.commit()
    return True
