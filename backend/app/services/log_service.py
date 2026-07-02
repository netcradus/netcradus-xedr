"""
Save log telemetry entries, run hardcoded detectors, and evaluate custom rules.
"""
import json
from datetime import datetime

from sqlalchemy.orm import Session

from app.models.agent import Agent
from app.models.log_telemetry import LogTelemetry
from app.schemas.log_schema import LogTelemetryRequest
from app.services.log_detection_service import (
    # syslog
    detect_ssh_bruteforce,
    detect_sudo_escalation,
    detect_root_login,
    detect_pam_failure,
    detect_syslog_cron_abuse,
    # windows event log
    detect_winevent_failed_logon,
    detect_winevent_account_lockout,
    detect_winevent_audit_cleared,
    detect_winevent_new_service,
    detect_winevent_privilege_escalation,
    detect_winevent_privileged_group_add,
    detect_winevent_pass_the_hash,
    # web logs
    detect_path_traversal,
    detect_sql_injection,
    detect_web_scanner,
    detect_web_shell,
    detect_web_error_spike,
    # application logs
    detect_credential_in_log,
    detect_critical_app_error,
)
from app.services.rule_engine import evaluate_log_rules

_WEB_SOURCES = {"iis", "apache", "nginx"}


def save_logs(db: Session, data: LogTelemetryRequest) -> bool:
    agent = db.query(Agent).filter(Agent.agent_token == data.agent_token).first()
    if not agent:
        return False

    for entry in data.entries:
        # Parse timestamp — agent sends ISO 8601
        try:
            ts = datetime.fromisoformat(entry.timestamp)
        except (ValueError, TypeError):
            ts = datetime.utcnow()

        db_log = LogTelemetry(
            agent_id=agent.id,
            log_source=entry.log_source,
            raw_message=entry.raw_message,
            severity=entry.severity,
            event_id=entry.event_id,
            facility=entry.facility,
            hostname=entry.hostname,
            process_name=entry.process_name,
            username=entry.username,
            source_ip=entry.source_ip,
            log_message=entry.log_message,
            extra=json.dumps(entry.extra) if entry.extra else None,
            timestamp=ts,
        )
        db.add(db_log)

        src = (entry.log_source or "").lower()

        if src == "syslog":
            detect_ssh_bruteforce(db, entry.log_message or "", entry.source_ip, agent.id)
            detect_sudo_escalation(db, entry.process_name, entry.log_message or "", agent.id)
            detect_root_login(db, entry.log_message or "", entry.username, agent.id)
            detect_pam_failure(db, entry.log_message or "", agent.id)
            detect_syslog_cron_abuse(db, entry.log_message or "", agent.id)

        elif src == "wineventlog":
            extra = entry.extra or {}
            detect_winevent_failed_logon(db, entry.event_id, entry.log_message or "", entry.username, entry.source_ip, agent.id)
            detect_winevent_account_lockout(db, entry.event_id, entry.log_message or "", entry.username, agent.id)
            detect_winevent_audit_cleared(db, entry.event_id, entry.log_message or "", entry.username, agent.id)
            detect_winevent_new_service(db, entry.event_id, entry.log_message or "", agent.id)
            detect_winevent_privilege_escalation(db, entry.event_id, entry.log_message or "", entry.username, agent.id)
            detect_winevent_privileged_group_add(db, entry.event_id, entry.log_message or "", entry.username, agent.id)
            detect_winevent_pass_the_hash(db, entry.event_id, extra, entry.username, entry.source_ip, agent.id)

        elif src in _WEB_SOURCES:
            detect_path_traversal(db, entry.log_message or "", entry.source_ip, src, agent.id)
            detect_sql_injection(db, entry.log_message or "", entry.source_ip, src, agent.id)
            detect_web_scanner(db, entry.extra, entry.source_ip, src, agent.id)
            detect_web_shell(db, entry.log_message or "", entry.source_ip, src, agent.id)
            detect_web_error_spike(db, entry.extra, entry.source_ip, src, agent.id)

        elif src == "application":
            detect_credential_in_log(db, entry.log_message or "", agent.id)
            detect_critical_app_error(db, entry.severity, entry.log_message or "", agent.id)

        evaluate_log_rules(db, entry, agent.id, agent.tenant_id)

    db.commit()
    return True
