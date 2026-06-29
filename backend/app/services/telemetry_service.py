from sqlalchemy.orm import Session

from app.models.agent import Agent

from app.models.process_telemetry import ProcessTelemetry

from app.schemas.process_schema import (
    ProcessTelemetryRequest
)

from app.models.network_telemetry import NetworkTelemetry
from app.schemas.network_schema import NetworkTelemetryRequest
from app.models.file_telemetry import FileTelemetry
from app.schemas.file_schema import FileTelemetryRequest
from app.models.persistence_telemetry import (
    PersistenceTelemetry
)

from app.schemas.persistence_schema import (
    PersistenceTelemetryRequest
)

from app.services.detection_service import (
    detect_encoded_powershell,
    detect_mimikatz,
    detect_lsass_dump,
    detect_psexec,
    detect_reverse_shell,
    detect_port_scan,
    detect_certutil,
    detect_rundll32,
    detect_regsvr32,
    detect_mshta,
    detect_wmic,
    detect_parent_child
)

from app.services.detection_service import (

    detect_malware_drop,

    detect_writable_directory_execution,

    detect_ransomware

)

from app.services.detection_service import (

    detect_registry_persistence,

    detect_service_persistence,

    detect_scheduled_task,

    detect_cron_persistence

)

from app.services.ioc_service import (
    match_file_iocs,
    match_network_iocs,
    match_persistence_iocs,
    match_process_iocs,
    match_text_iocs
)

from app.services.rule_engine import (
    evaluate_process_rules,
    evaluate_network_rules,
    evaluate_file_rules,
    evaluate_persistence_rules,
)


def save_processes(
        db: Session,
        data: ProcessTelemetryRequest):

    agent = db.query(
        Agent
    ).filter(
        Agent.agent_token == data.agent_token
    ).first()

    if not agent:
        return False

    for process in data.processes:

        db_process = ProcessTelemetry(

            pid=process.pid,

            ppid=process.ppid,

            process_name=process.process_name,

            parent_process_name=process.parent_process_name,

            cmdline=process.cmdline,

            exe_path=process.exe_path,

            username=process.username,

            sha256=process.sha256,

            agent_id=agent.id

        )

        db.add(db_process)

        match_process_iocs(
            db,
            process,
            agent.id
        )

        match_text_iocs(
            db,
            process.cmdline,
            "process command line",
            agent.id
        )

        detect_encoded_powershell(

            db,

            process.process_name,

            process.cmdline,

            agent.id

        )


        detect_mimikatz(

            db,

            process.process_name,

            process.cmdline,

            agent.id

        )

        detect_lsass_dump(

            db,

            process.process_name,

            process.cmdline,

            agent.id

        )

        detect_psexec(

            db,

            process.process_name,

            process.cmdline,

            agent.id

        )

        detect_certutil(
            db,
            process.process_name,
            process.cmdline,
            agent.id
        )

        detect_rundll32(
            db,
            process.process_name,
            process.cmdline,
            agent.id
        )

        detect_regsvr32(
            db,
            process.process_name,
            process.cmdline,
            agent.id
        )

        detect_mshta(
            db,
            process.process_name,
            process.cmdline,
            agent.id
        )

        detect_wmic(
            db,
            process.process_name,
            process.cmdline,
            agent.id
        )

        detect_parent_child(

            db,

            process.parent_process_name,

            process.process_name,

            process.cmdline,

            agent.id

        )

        evaluate_process_rules(db, process, agent.id, agent.tenant_id)


    db.commit()

    return True

def save_connections(
        db,
        data: NetworkTelemetryRequest):

    agent = db.query(Agent).filter(
        Agent.agent_token == data.agent_token
    ).first()

    if not agent:
        return False

    for conn in data.connections:

        db_conn = NetworkTelemetry(

            local_ip=conn.local_ip,

            remote_ip=conn.remote_ip,

            remote_port=conn.remote_port,

            protocol=conn.protocol,

            agent_id=agent.id

        )

        db.add(db_conn)

        match_network_iocs(
            db,
            conn,
            agent.id
        )

        detect_reverse_shell(
            db,
            conn.remote_ip,
            conn.remote_port,
            conn.protocol,
            agent.id
        )

        detect_port_scan(
            db,
            conn.remote_ip,
            conn.remote_port,
            agent.id
        )

        evaluate_network_rules(db, conn, agent.id, agent.tenant_id)

    db.commit()

    return True


def save_file_events(
        db,
        data: FileTelemetryRequest):

    agent = db.query(
        Agent
    ).filter(
        Agent.agent_token == data.agent_token
    ).first()

    if not agent:
        return False

    for event in data.events:

        db_event = FileTelemetry(

            event_type=event.event_type,

            file_path=event.file_path,

            sha256=event.sha256,

            md5=event.md5,

            agent_id=agent.id

        )

        db.add(db_event)

        match_file_iocs(
            db,
            event,
            agent.id
        )

        detect_malware_drop(

            db,

            event.file_path,

            agent.id

        )

        detect_writable_directory_execution(

            db,

            event.file_path,

            agent.id

        )

        detect_ransomware(

            db,

            event.event_type,

            event.file_path,

            agent.id

        )

        evaluate_file_rules(db, event, agent.id, agent.tenant_id)

    db.commit()

    return True


def save_persistence(
        db,
        data: PersistenceTelemetryRequest):

    agent = db.query(
        Agent
    ).filter(
        Agent.agent_token == data.agent_token
    ).first()

    if not agent:
        return False

    for entry in data.entries:

        db_entry = PersistenceTelemetry(

            persistence_type=entry.persistence_type,

            entry_name=entry.entry_name,

            entry_path=entry.entry_path,

            agent_id=agent.id

        )

        db.add(db_entry)

        match_persistence_iocs(
            db,
            entry,
            agent.id
        )

        detect_registry_persistence(

            db,

            entry.persistence_type,

            entry.entry_name,

            entry.entry_path,

            agent.id

        )

        detect_service_persistence(

            db,

            entry.persistence_type,

            entry.entry_name,

            entry.entry_path,

            agent.id

        )

        detect_scheduled_task(

            db,

            entry.persistence_type,

            entry.entry_name,

            entry.entry_path,

            agent.id

        )

        detect_cron_persistence(

            db,

            entry.persistence_type,

            entry.entry_name,

            entry.entry_path,

            agent.id

        )

        evaluate_persistence_rules(db, entry, agent.id, agent.tenant_id)

    db.commit()

    return True

