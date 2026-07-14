from sqlalchemy.orm import Session

from app.models.agent import Agent
from app.models.process_telemetry import ProcessTelemetry
from app.schemas.process_schema import ProcessTelemetryRequest
from app.models.network_telemetry import NetworkTelemetry
from app.schemas.network_schema import NetworkTelemetryRequest
from app.models.file_telemetry import FileTelemetry
from app.schemas.file_schema import FileTelemetryRequest
from app.models.persistence_telemetry import PersistenceTelemetry
from app.schemas.persistence_schema import PersistenceTelemetryRequest

# Stateful heuristics that cannot be expressed as simple DB rules
from app.services.detection_service import detect_port_scan, detect_ransomware

from app.services.ioc_service import (
    match_file_iocs,
    match_network_iocs,
    match_persistence_iocs,
    match_process_iocs,
    match_text_iocs,
)
from app.services.rule_engine import (
    evaluate_file_rules,
    evaluate_network_rules,
    evaluate_persistence_rules,
    evaluate_process_rules,
)
from app.services.yara_service import scan_file_event as yara_scan_file_event


def save_processes(db: Session, data: ProcessTelemetryRequest):
    agent = db.query(Agent).filter(Agent.agent_token == data.agent_token).first()
    if not agent:
        return False

    for process in data.processes:
        db.add(ProcessTelemetry(
            pid=process.pid,
            ppid=process.ppid,
            process_name=process.process_name,
            parent_process_name=process.parent_process_name,
            cmdline=process.cmdline,
            exe_path=process.exe_path,
            username=process.username,
            sha256=process.sha256,
            agent_id=agent.id,
        ))
        match_process_iocs(db, process, agent.id, agent.tenant_id)
        match_text_iocs(db, process.cmdline, "process command line", agent.id, agent.tenant_id)
        evaluate_process_rules(db, process, agent.id, agent.tenant_id)

    db.commit()
    return True


def save_connections(db: Session, data: NetworkTelemetryRequest):
    agent = db.query(Agent).filter(Agent.agent_token == data.agent_token).first()
    if not agent:
        return False

    for conn in data.connections:
        db.add(NetworkTelemetry(
            local_ip=conn.local_ip,
            remote_ip=conn.remote_ip,
            remote_port=conn.remote_port,
            protocol=conn.protocol,
            agent_id=agent.id,
        ))
        match_network_iocs(db, conn, agent.id, agent.tenant_id)
        detect_port_scan(db, conn.remote_ip, conn.remote_port, agent.id)
        evaluate_network_rules(db, conn, agent.id, agent.tenant_id)

    db.commit()
    return True


def save_file_events(db: Session, data: FileTelemetryRequest):
    agent = db.query(Agent).filter(Agent.agent_token == data.agent_token).first()
    if not agent:
        return False

    for event in data.events:
        db.add(FileTelemetry(
            event_type=event.event_type,
            file_path=event.file_path,
            sha256=event.sha256,
            md5=event.md5,
            agent_id=agent.id,
        ))
        match_file_iocs(db, event, agent.id, agent.tenant_id)
        detect_ransomware(db, event.event_type, event.file_path, agent.id)
        evaluate_file_rules(db, event, agent.id, agent.tenant_id)
        yara_scan_file_event(
            db,
            tenant_id=agent.tenant_id,
            agent_id=agent.id,
            file_path=event.file_path,
            sha256=event.sha256,
            content_b64=getattr(event, "content_b64", None),
            event_type=event.event_type,
        )

    db.commit()
    return True


def save_persistence(db: Session, data: PersistenceTelemetryRequest):
    agent = db.query(Agent).filter(Agent.agent_token == data.agent_token).first()
    if not agent:
        return False

    for entry in data.entries:
        db.add(PersistenceTelemetry(
            persistence_type=entry.persistence_type,
            entry_name=entry.entry_name,
            entry_path=entry.entry_path,
            agent_id=agent.id,
        ))
        match_persistence_iocs(db, entry, agent.id, agent.tenant_id)
        evaluate_persistence_rules(db, entry, agent.id, agent.tenant_id)

    db.commit()
    return True
