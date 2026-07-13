"""
Seed the 5 built-in SOAR playbooks.

These are system-level playbooks (tenant_id=None) and fire for every tenant.
They are only inserted once — idempotency is checked by name.  Tenants can
disable them per-tenant via the toggle endpoint or create custom overrides.

Playbooks
─────────
1. Ransomware Response      — T1486 / T1490 → isolate, create incident, notify
2. Malware Execution        — Critical+High "malware" → kill process, add IOC, incident
3. Phishing Attack          — T1566 family → incident, enrich IOC, notify
4. Crypto Miner Detected    — "miner" pattern → kill process, add IOC, notify Slack
5. Reverse Shell / C2       — "reverse shell" pattern → kill, isolate, incident, notify
6. Credential Dumping       — T1003 family → isolate, incident, notify
"""
import json
import logging

from sqlalchemy.orm import Session

from app.models.playbook import Playbook

_log = logging.getLogger("netcradxdr.playbook_seed")

_SYSTEM_PLAYBOOKS = [
    {
        "name": "Ransomware Response",
        "description": (
            "Fires on Data Encrypted for Impact (T1486) or Inhibit System Recovery (T1490). "
            "Immediately isolates the host and creates a dedicated Critical incident."
        ),
        "trigger_severities": "Critical,High",
        "trigger_mitre": "T1486,T1490",
        "trigger_rule_pattern": None,
        "actions": [
            {
                "type": "create_incident",
                "params": {
                    "title": "[RANSOMWARE] Encrypted files detected",
                    "severity": "Critical",
                },
            },
            {
                "type": "isolate_agent",
                "params": {},
            },
            {
                "type": "notify_slack",
                "params": {
                    "message": "RANSOMWARE DETECTED — host has been auto-isolated. Immediate response required.",
                },
            },
            {
                "type": "send_notification",
                "params": {},
            },
        ],
    },
    {
        "name": "Malware Execution",
        "description": (
            "Fires on any Critical or High alert whose title contains 'malware'. "
            "Kills the offending process, adds its C2 IP as an IOC, and creates an incident."
        ),
        "trigger_severities": "Critical,High",
        "trigger_mitre": None,
        "trigger_rule_pattern": "malware",
        "actions": [
            {
                "type": "kill_process",
                "params": {
                    "process_name": "",   # agent kills by alert context when empty
                },
            },
            {
                "type": "create_incident",
                "params": {
                    "title": "[MALWARE] Malicious execution detected",
                    "severity": "High",
                },
            },
            {
                "type": "add_ioc",
                "params": {},  # analyst fills ip when manually triggering
            },
            {
                "type": "send_notification",
                "params": {},
            },
        ],
    },
    {
        "name": "Phishing Attack",
        "description": (
            "Fires on phishing-related MITRE techniques: T1566 (spearphishing attachment), "
            "T1566.001, T1566.002, T1204.002 (malicious file execution). "
            "Creates an incident, enriches any known IOCs, and notifies the SOC."
        ),
        "trigger_severities": None,
        "trigger_mitre": "T1566,T1566.001,T1566.002,T1204.002",
        "trigger_rule_pattern": None,
        "actions": [
            {
                "type": "create_incident",
                "params": {
                    "title": "[PHISHING] Phishing activity detected",
                    "severity": "High",
                },
            },
            {
                "type": "enrich_ioc",
                "params": {
                    "ioc_type": "Domain",   # analyst fills value when manually triggering
                    "value": "",
                },
            },
            {
                "type": "notify_slack",
                "params": {
                    "message": "Phishing indicator detected — review email and IOC details.",
                },
            },
            {
                "type": "send_notification",
                "params": {},
            },
        ],
    },
    {
        "name": "Crypto Miner Detected",
        "description": (
            "Fires on any alert title containing 'miner' (Crypto Miner, Coin Miner, etc.). "
            "Kills the mining process and blocks the mining pool IP."
        ),
        "trigger_severities": None,
        "trigger_mitre": None,
        "trigger_rule_pattern": "miner",
        "actions": [
            {
                "type": "kill_process",
                "params": {
                    "process_name": "",   # agent resolves from alert context
                },
            },
            {
                "type": "block_ip",
                "params": {
                    "ip": "",             # analyst fills mining pool IP when manually triggering
                    "direction": "outbound",
                },
            },
            {
                "type": "add_ioc",
                "params": {},
            },
            {
                "type": "notify_slack",
                "params": {
                    "message": "Crypto miner detected and process kill command issued.",
                },
            },
        ],
    },
    {
        "name": "Reverse Shell / C2 Callback",
        "description": (
            "Fires on Critical or High alerts whose title contains 'reverse shell'. "
            "Kills the shell process, isolates the host, and creates a dedicated incident."
        ),
        "trigger_severities": "Critical,High",
        "trigger_mitre": None,
        "trigger_rule_pattern": "reverse shell",
        "actions": [
            {
                "type": "kill_process",
                "params": {
                    "process_name": "",
                },
            },
            {
                "type": "isolate_agent",
                "params": {},
            },
            {
                "type": "create_incident",
                "params": {
                    "title": "[C2] Reverse shell / command-and-control callback",
                    "severity": "Critical",
                },
            },
            {
                "type": "notify_slack",
                "params": {
                    "message": "Reverse shell detected — host isolated. Immediate investigation required.",
                },
            },
            {
                "type": "send_notification",
                "params": {},
            },
        ],
    },
    {
        "name": "Credential Dumping",
        "description": (
            "Fires on credential-access MITRE techniques: T1003 (OS Credential Dumping), "
            "T1003.001 (LSASS Memory). Isolates the host and creates a high-priority incident."
        ),
        "trigger_severities": "Critical,High",
        "trigger_mitre": "T1003,T1003.001,T1003.002,T1003.003",
        "trigger_rule_pattern": None,
        "actions": [
            {
                "type": "isolate_agent",
                "params": {},
            },
            {
                "type": "create_incident",
                "params": {
                    "title": "[CRED-DUMP] Credential dumping detected",
                    "severity": "Critical",
                },
            },
            {
                "type": "notify_slack",
                "params": {
                    "message": "Credential dumping detected — host isolated. Check for lateral movement.",
                },
            },
            {
                "type": "send_notification",
                "params": {},
            },
        ],
    },
]


def seed_playbooks(db: Session) -> None:
    """Insert system playbooks that don't already exist (idempotent)."""
    existing_names = {
        name for (name,) in db.query(Playbook.name).filter(Playbook.is_system == True).all()
    }

    added = 0
    for pb_data in _SYSTEM_PLAYBOOKS:
        if pb_data["name"] in existing_names:
            continue
        db.add(Playbook(
            name=pb_data["name"],
            description=pb_data["description"],
            enabled=True,
            is_system=True,
            tenant_id=None,
            trigger_severities=pb_data["trigger_severities"],
            trigger_mitre=pb_data["trigger_mitre"],
            trigger_rule_pattern=pb_data["trigger_rule_pattern"],
            actions=json.dumps(pb_data["actions"]),
        ))
        added += 1

    if added:
        db.commit()
        _log.info("Seeded %d system playbook(s).", added)
