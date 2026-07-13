"""
Timeline view — unified chronological event stream for an agent or incident.

GET /timeline/agent/{agent_id}?limit=500&before=<iso>&after=<iso>&types=process,network,...
GET /timeline/incident/{incident_id}?...

Returns events of all telemetry types merged and sorted by timestamp (newest first).
Each event has: type, timestamp, summary, severity (if applicable), raw fields.
"""
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.permissions import analyst_required
from app.database.db import get_db
from app.models.agent import Agent
from app.models.alert import Alert
from app.models.browser_extension_telemetry import BrowserExtensionTelemetry
from app.models.dns_telemetry import DnsTelemetry
from app.models.email_event_telemetry import EmailEventTelemetry
from app.models.file_telemetry import FileTelemetry
from app.models.incident import Incident
from app.models.incident_alert import IncidentAlert
from app.models.k8s_telemetry import K8sTelemetry
from app.models.log_telemetry import LogTelemetry
from app.models.memory_scan_result import MemoryScanResult
from app.models.network_telemetry import NetworkTelemetry
from app.models.persistence_telemetry import PersistenceTelemetry
from app.models.process_telemetry import ProcessTelemetry
from app.models.registry_telemetry import RegistryTelemetry
from app.models.usb_telemetry import UsbTelemetry
from app.models.user import User

router = APIRouter(prefix="/timeline", tags=["Timeline"])

ALL_TYPES = {
    "process", "network", "file", "persistence", "log",
    "dns", "registry", "usb", "browser_extension",
    "memory_scan", "alert",
}


def _parse_types(types_param: Optional[str]) -> set:
    if not types_param:
        return ALL_TYPES
    return {t.strip() for t in types_param.split(",") if t.strip()}


def _dt(ts) -> Optional[str]:
    if ts is None:
        return None
    if isinstance(ts, datetime):
        return ts.isoformat()
    return str(ts)


# ── Per-type row serializers ──────────────────────────────────────────────────

def _serialize_process(r) -> dict:
    return {
        "type": "process", "timestamp": _dt(r.timestamp),
        "summary": f"{r.process_name} (PID {r.pid})",
        "fields": {
            "pid": r.pid, "ppid": r.ppid,
            "process_name": r.process_name,
            "parent_process_name": r.parent_process_name,
            "cmdline": r.cmdline,
            "exe_path": r.exe_path,
            "username": r.username,
            "sha256": r.sha256,
        },
    }

def _serialize_network(r) -> dict:
    return {
        "type": "network", "timestamp": _dt(r.timestamp),
        "summary": f"{r.local_ip} → {r.remote_ip}:{r.remote_port} ({r.protocol})",
        "fields": {
            "local_ip": r.local_ip,
            "remote_ip": r.remote_ip,
            "remote_port": r.remote_port,
            "protocol": r.protocol,
        },
    }

def _serialize_file(r) -> dict:
    return {
        "type": "file", "timestamp": _dt(r.timestamp),
        "summary": f"{r.event_type}: {r.file_path}",
        "fields": {
            "event_type": r.event_type, "file_path": r.file_path,
            "sha256": r.sha256, "md5": r.md5,
        },
    }

def _serialize_persistence(r) -> dict:
    return {
        "type": "persistence", "timestamp": _dt(r.timestamp),
        "summary": f"{r.persistence_type}: {r.entry_name}",
        "fields": {
            "persistence_type": r.persistence_type,
            "entry_name": r.entry_name,
            "entry_path": r.entry_path,
        },
    }

def _serialize_log(r) -> dict:
    return {
        "type": "log", "timestamp": _dt(r.timestamp),
        "summary": f"[{r.log_source}] {(r.log_message or r.raw_message or '')[:120]}",
        "fields": {
            "log_source": r.log_source,
            "severity": r.severity,
            "event_id": r.event_id,
            "hostname": r.hostname,
            "log_message": r.log_message,
        },
    }

def _serialize_dns(r) -> dict:
    return {
        "type": "dns", "timestamp": _dt(r.timestamp),
        "summary": f"DNS {r.query_type} {r.query_name} → {r.response or '(no answer)'}",
        "fields": {
            "query_name": r.query_name, "query_type": r.query_type,
            "response": r.response, "direction": r.direction,
            "process_name": r.process_name,
        },
    }

def _serialize_registry(r) -> dict:
    return {
        "type": "registry", "timestamp": _dt(r.timestamp),
        "summary": f"Registry {r.event_type}: {r.registry_key}",
        "fields": {
            "event_type": r.event_type, "registry_key": r.registry_key,
            "value_name": r.value_name, "value_data": r.value_data,
            "process_name": r.process_name,
        },
    }

def _serialize_usb(r) -> dict:
    return {
        "type": "usb", "timestamp": _dt(r.timestamp),
        "summary": f"USB {r.event_type}: {r.device_name or r.device_id}",
        "fields": {
            "event_type": r.event_type, "device_name": r.device_name,
            "device_id": r.device_id, "drive_letter": r.drive_letter,
            "file_path": r.file_path,
        },
    }

def _serialize_browser_ext(r) -> dict:
    return {
        "type": "browser_extension", "timestamp": _dt(r.timestamp),
        "summary": f"{r.browser} extension {r.event_type}: {r.extension_name or r.extension_id}",
        "fields": {
            "browser": r.browser, "event_type": r.event_type,
            "extension_id": r.extension_id, "extension_name": r.extension_name,
            "from_webstore": r.from_webstore,
        },
    }

def _serialize_memory_scan(r) -> dict:
    return {
        "type": "memory_scan", "timestamp": _dt(r.timestamp),
        "summary": f"Memory scan hit '{r.rule_name}' in {r.process_name} (PID {r.pid})",
        "severity": r.severity,
        "fields": {
            "scan_type": r.scan_type, "rule_name": r.rule_name,
            "process_name": r.process_name, "pid": r.pid,
            "memory_region": r.memory_region,
        },
    }

def _serialize_alert(r) -> dict:
    return {
        "type": "alert", "timestamp": _dt(r.timestamp),
        "summary": f"[{r.severity}] {r.title}",
        "severity": r.severity,
        "fields": {
            "title": r.title, "status": r.status,
            "mitre_technique": r.mitre_technique,
            "occurrence_count": r.occurrence_count,
        },
    }


# ── Query helpers ─────────────────────────────────────────────────────────────

def _collect_for_agent(
    db: Session,
    agent_id: int,
    types: set,
    limit: int,
    before: Optional[datetime],
    after: Optional[datetime],
) -> List[dict]:
    events = []

    def _add(model, serializer, ts_col="timestamp"):
        q = db.query(model).filter(model.agent_id == agent_id)
        if before:
            q = q.filter(getattr(model, ts_col) < before)
        if after:
            q = q.filter(getattr(model, ts_col) > after)
        for row in q.order_by(getattr(model, ts_col).desc()).limit(limit).all():
            events.append(serializer(row))

    if "process" in types:          _add(ProcessTelemetry, _serialize_process)
    if "network" in types:          _add(NetworkTelemetry, _serialize_network)
    if "file" in types:             _add(FileTelemetry, _serialize_file)
    if "persistence" in types:      _add(PersistenceTelemetry, _serialize_persistence)
    if "log" in types:              _add(LogTelemetry, _serialize_log)
    if "dns" in types:              _add(DnsTelemetry, _serialize_dns)
    if "registry" in types:         _add(RegistryTelemetry, _serialize_registry)
    if "usb" in types:              _add(UsbTelemetry, _serialize_usb)
    if "browser_extension" in types:_add(BrowserExtensionTelemetry, _serialize_browser_ext)
    if "memory_scan" in types:      _add(MemoryScanResult, _serialize_memory_scan)
    if "alert" in types:
        q = db.query(Alert).filter(Alert.agent_id == agent_id)
        if before:
            q = q.filter(Alert.timestamp < before)
        if after:
            q = q.filter(Alert.timestamp > after)
        for row in q.order_by(Alert.timestamp.desc()).limit(limit).all():
            events.append(_serialize_alert(row))

    events.sort(key=lambda e: e.get("timestamp") or "", reverse=True)
    return events[:limit]


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/agent/{agent_id}")
def agent_timeline(
    agent_id: int,
    limit: int = Query(500, le=2000),
    before: Optional[str] = Query(None, description="ISO 8601 upper bound"),
    after:  Optional[str] = Query(None, description="ISO 8601 lower bound"),
    types:  Optional[str] = Query(None, description="Comma-separated event types to include"),
    current_user: User = Depends(analyst_required),
    db: Session = Depends(get_db),
):
    agent = db.query(Agent).filter(
        Agent.id == agent_id,
        Agent.tenant_id == current_user.tenant_id,
    ).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    before_dt = datetime.fromisoformat(before) if before else None
    after_dt  = datetime.fromisoformat(after) if after else None
    type_set  = _parse_types(types)

    events = _collect_for_agent(db, agent_id, type_set, limit, before_dt, after_dt)
    return {
        "agent_id": agent_id,
        "hostname": agent.hostname,
        "count": len(events),
        "events": events,
    }


@router.get("/incident/{incident_id}")
def incident_timeline(
    incident_id: int,
    limit: int = Query(500, le=2000),
    types: Optional[str] = Query(None),
    current_user: User = Depends(analyst_required),
    db: Session = Depends(get_db),
):
    incident = db.query(Incident).filter(
        Incident.id == incident_id,
        Incident.tenant_id == current_user.tenant_id,
    ).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    # Gather all agents associated with this incident's alerts
    alert_ids = [
        ia.alert_id for ia in db.query(IncidentAlert).filter(
            IncidentAlert.incident_id == incident_id
        ).all()
    ]
    agent_ids = list({
        a.agent_id for a in db.query(Alert).filter(
            Alert.id.in_(alert_ids)
        ).all() if a.agent_id
    })

    type_set = _parse_types(types)
    all_events = []
    for aid in agent_ids:
        all_events.extend(_collect_for_agent(db, aid, type_set, limit, None, None))

    all_events.sort(key=lambda e: e.get("timestamp") or "", reverse=True)
    return {
        "incident_id": incident_id,
        "title": incident.title,
        "agent_count": len(agent_ids),
        "count": len(all_events[:limit]),
        "events": all_events[:limit],
    }
