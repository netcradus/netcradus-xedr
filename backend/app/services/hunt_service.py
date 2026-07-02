"""
Threat hunting service.

All queries are scoped to a tenant (via Agent.tenant_id), support an optional
date window, optional agent_id filter, and a hard result cap.
"""
from datetime import datetime, timedelta

from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.models.agent import Agent
from app.models.process_telemetry import ProcessTelemetry
from app.models.network_telemetry import NetworkTelemetry
from app.models.file_telemetry import FileTelemetry
from app.models.persistence_telemetry import PersistenceTelemetry


# ── Shared helpers ────────────────────────────────────────────────────────────

def _cutoff(days: int) -> datetime:
    return datetime.utcnow() - timedelta(days=days)


def _agent_ids(db: Session, tenant_id: int, agent_id: int | None) -> list[int]:
    q = db.query(Agent.id).filter(Agent.tenant_id == tenant_id)
    if agent_id is not None:
        q = q.filter(Agent.id == agent_id)
    return [r[0] for r in q.all()]


def _ts(dt: datetime | None) -> str | None:
    return dt.isoformat() if dt else None


# ── /hunt/process ─────────────────────────────────────────────────────────────

def hunt_process(
    db: Session,
    tenant_id: int,
    name: str | None,
    cmdline: str | None,
    username: str | None,
    hash_val: str | None,
    parent: str | None,
    agent_id: int | None,
    days: int,
    limit: int,
) -> dict:
    ids = _agent_ids(db, tenant_id, agent_id)
    if not ids:
        return {"query": {}, "total": 0, "hits": []}

    q = (
        db.query(ProcessTelemetry, Agent.hostname)
        .join(Agent, ProcessTelemetry.agent_id == Agent.id)
        .filter(
            ProcessTelemetry.agent_id.in_(ids),
            ProcessTelemetry.timestamp >= _cutoff(days),
        )
    )

    if name:
        q = q.filter(ProcessTelemetry.process_name.ilike(f"%{name}%"))
    if cmdline:
        q = q.filter(ProcessTelemetry.cmdline.ilike(f"%{cmdline}%"))
    if username:
        q = q.filter(ProcessTelemetry.username.ilike(f"%{username}%"))
    if hash_val:
        q = q.filter(ProcessTelemetry.sha256.ilike(f"%{hash_val}%"))
    if parent:
        q = q.filter(ProcessTelemetry.parent_process_name.ilike(f"%{parent}%"))

    total = q.count()
    rows  = q.order_by(ProcessTelemetry.timestamp.desc()).limit(limit).all()

    hits = [
        {
            "id":                  r.id,
            "agent_id":            r.agent_id,
            "agent_hostname":      hostname,
            "pid":                 r.pid,
            "ppid":                r.ppid,
            "process_name":        r.process_name,
            "parent_process_name": r.parent_process_name,
            "cmdline":             r.cmdline,
            "exe_path":            r.exe_path,
            "username":            r.username,
            "sha256":              r.sha256,
            "timestamp":           _ts(r.timestamp),
        }
        for r, hostname in rows
    ]

    return {
        "query": {
            "name": name, "cmdline": cmdline, "username": username,
            "hash": hash_val, "parent": parent,
            "agent_id": agent_id, "days": days,
        },
        "total": total,
        "hits":  hits,
    }


# ── /hunt/hash ────────────────────────────────────────────────────────────────

def hunt_hash(
    db: Session,
    tenant_id: int,
    value: str,
    agent_id: int | None,
    days: int,
    limit: int,
) -> dict:
    ids     = _agent_ids(db, tenant_id, agent_id)
    cutoff  = _cutoff(days)
    pattern = f"%{value.lower()}%"

    # Process telemetry hits
    proc_rows = (
        db.query(ProcessTelemetry, Agent.hostname)
        .join(Agent, ProcessTelemetry.agent_id == Agent.id)
        .filter(
            ProcessTelemetry.agent_id.in_(ids),
            ProcessTelemetry.timestamp >= cutoff,
            ProcessTelemetry.sha256.ilike(pattern),
        )
        .order_by(ProcessTelemetry.timestamp.desc())
        .limit(limit)
        .all()
    )

    # File telemetry hits (sha256 or md5)
    file_rows = (
        db.query(FileTelemetry, Agent.hostname)
        .join(Agent, FileTelemetry.agent_id == Agent.id)
        .filter(
            FileTelemetry.agent_id.in_(ids),
            FileTelemetry.timestamp >= cutoff,
            or_(
                FileTelemetry.sha256.ilike(pattern),
                FileTelemetry.md5.ilike(pattern),
            ),
        )
        .order_by(FileTelemetry.timestamp.desc())
        .limit(limit)
        .all()
    )

    hits: list[dict] = []
    unique_agents: set[int] = set()

    for r, hostname in proc_rows:
        unique_agents.add(r.agent_id)
        hits.append({
            "source":       "process",
            "id":           r.id,
            "agent_id":     r.agent_id,
            "agent_hostname": hostname,
            "process_name": r.process_name,
            "cmdline":      r.cmdline,
            "exe_path":     r.exe_path,
            "sha256":       r.sha256,
            "md5":          None,
            "file_path":    None,
            "event_type":   None,
            "timestamp":    _ts(r.timestamp),
        })

    for r, hostname in file_rows:
        unique_agents.add(r.agent_id)
        hits.append({
            "source":       "file",
            "id":           r.id,
            "agent_id":     r.agent_id,
            "agent_hostname": hostname,
            "process_name": None,
            "cmdline":      None,
            "exe_path":     None,
            "sha256":       r.sha256,
            "md5":          r.md5,
            "file_path":    r.file_path,
            "event_type":   r.event_type,
            "timestamp":    _ts(r.timestamp),
        })

    hits.sort(key=lambda x: x["timestamp"] or "", reverse=True)
    hits = hits[:limit]

    return {
        "query":          {"value": value, "agent_id": agent_id, "days": days},
        "total":          len(hits),
        "unique_agents":  len(unique_agents),
        "hits":           hits,
    }


# ── /hunt/ip ──────────────────────────────────────────────────────────────────

def hunt_ip(
    db: Session,
    tenant_id: int,
    value: str,
    port: int | None,
    agent_id: int | None,
    days: int,
    limit: int,
) -> dict:
    ids    = _agent_ids(db, tenant_id, agent_id)
    cutoff = _cutoff(days)

    q = (
        db.query(NetworkTelemetry, Agent.hostname)
        .join(Agent, NetworkTelemetry.agent_id == Agent.id)
        .filter(
            NetworkTelemetry.agent_id.in_(ids),
            NetworkTelemetry.timestamp >= cutoff,
            NetworkTelemetry.remote_ip.ilike(f"%{value}%"),
        )
    )
    if port is not None:
        q = q.filter(NetworkTelemetry.remote_port == port)

    total = q.count()
    rows  = q.order_by(NetworkTelemetry.timestamp.desc()).limit(limit).all()

    unique_agents:  set[int] = set()
    ports:          set[int] = set()
    timestamps:     list[datetime] = []
    hits: list[dict] = []

    for r, hostname in rows:
        unique_agents.add(r.agent_id)
        if r.remote_port:
            ports.add(r.remote_port)
        if r.timestamp:
            timestamps.append(r.timestamp)
        hits.append({
            "id":             r.id,
            "agent_id":       r.agent_id,
            "agent_hostname": hostname,
            "local_ip":       r.local_ip,
            "remote_ip":      r.remote_ip,
            "remote_port":    r.remote_port,
            "protocol":       r.protocol,
            "timestamp":      _ts(r.timestamp),
        })

    summary = {
        "unique_agents":     len(unique_agents),
        "total_connections": total,
        "unique_ports":      sorted(ports),
        "first_seen":        _ts(min(timestamps)) if timestamps else None,
        "last_seen":         _ts(max(timestamps)) if timestamps else None,
    }

    return {
        "query":   {"value": value, "port": port, "agent_id": agent_id, "days": days},
        "summary": summary,
        "total":   total,
        "hits":    hits,
    }


# ── /hunt/domain ──────────────────────────────────────────────────────────────

def hunt_domain(
    db: Session,
    tenant_id: int,
    value: str,
    agent_id: int | None,
    days: int,
    limit: int,
) -> dict:
    ids     = _agent_ids(db, tenant_id, agent_id)
    cutoff  = _cutoff(days)
    pattern = f"%{value.lower()}%"

    # Search process cmdlines (e.g. curl/wget/powershell with domain in args)
    proc_rows = (
        db.query(ProcessTelemetry, Agent.hostname)
        .join(Agent, ProcessTelemetry.agent_id == Agent.id)
        .filter(
            ProcessTelemetry.agent_id.in_(ids),
            ProcessTelemetry.timestamp >= cutoff,
            ProcessTelemetry.cmdline.ilike(pattern),
        )
        .order_by(ProcessTelemetry.timestamp.desc())
        .limit(limit)
        .all()
    )

    # Search file paths (uncommon but catches e.g. downloaded files with domain)
    file_rows = (
        db.query(FileTelemetry, Agent.hostname)
        .join(Agent, FileTelemetry.agent_id == Agent.id)
        .filter(
            FileTelemetry.agent_id.in_(ids),
            FileTelemetry.timestamp >= cutoff,
            FileTelemetry.file_path.ilike(pattern),
        )
        .order_by(FileTelemetry.timestamp.desc())
        .limit(limit)
        .all()
    )

    hits: list[dict] = []
    unique_agents: set[int] = set()

    for r, hostname in proc_rows:
        unique_agents.add(r.agent_id)
        hits.append({
            "source":       "process_cmdline",
            "id":           r.id,
            "agent_id":     r.agent_id,
            "agent_hostname": hostname,
            "process_name": r.process_name,
            "cmdline":      r.cmdline,
            "username":     r.username,
            "file_path":    None,
            "event_type":   None,
            "timestamp":    _ts(r.timestamp),
        })

    for r, hostname in file_rows:
        unique_agents.add(r.agent_id)
        hits.append({
            "source":       "file_path",
            "id":           r.id,
            "agent_id":     r.agent_id,
            "agent_hostname": hostname,
            "process_name": None,
            "cmdline":      None,
            "username":     None,
            "file_path":    r.file_path,
            "event_type":   r.event_type,
            "timestamp":    _ts(r.timestamp),
        })

    hits.sort(key=lambda x: x["timestamp"] or "", reverse=True)
    hits = hits[:limit]

    return {
        "query":         {"value": value, "agent_id": agent_id, "days": days},
        "total":         len(hits),
        "unique_agents": len(unique_agents),
        "hits":          hits,
    }


# ── /hunt/persistence ────────────────────────────────────────────────────────

def hunt_persistence(
    db: Session,
    tenant_id: int,
    persistence_type: str | None,
    entry_name: str | None,
    entry_path: str | None,
    agent_id: int | None,
    days: int,
    limit: int,
) -> dict:
    ids    = _agent_ids(db, tenant_id, agent_id)
    cutoff = _cutoff(days)

    q = (
        db.query(PersistenceTelemetry, Agent.hostname)
        .join(Agent, PersistenceTelemetry.agent_id == Agent.id)
        .filter(
            PersistenceTelemetry.agent_id.in_(ids),
            PersistenceTelemetry.timestamp >= cutoff,
        )
    )

    if persistence_type:
        q = q.filter(PersistenceTelemetry.persistence_type.ilike(f"%{persistence_type}%"))
    if entry_name:
        q = q.filter(PersistenceTelemetry.entry_name.ilike(f"%{entry_name}%"))
    if entry_path:
        q = q.filter(PersistenceTelemetry.entry_path.ilike(f"%{entry_path}%"))

    total = q.count()
    rows  = q.order_by(PersistenceTelemetry.timestamp.desc()).limit(limit).all()

    hits = [
        {
            "id":               r.id,
            "agent_id":         r.agent_id,
            "agent_hostname":   hostname,
            "persistence_type": r.persistence_type,
            "entry_name":       r.entry_name,
            "entry_path":       r.entry_path,
            "timestamp":        _ts(r.timestamp),
        }
        for r, hostname in rows
    ]

    return {
        "query": {
            "persistence_type": persistence_type,
            "entry_name": entry_name,
            "entry_path": entry_path,
            "agent_id": agent_id, "days": days,
        },
        "total": total,
        "hits":  hits,
    }
