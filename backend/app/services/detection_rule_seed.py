"""
Seeds built-in (system) detection rules on first startup.
Rules with is_system=True and tenant_id=None apply platform-wide.
"""
from datetime import datetime
from sqlalchemy.orm import Session
from app.models.detection_rule import DetectionRule

SYSTEM_RULES = [
    # ── Process rules ──────────────────────────────────────────────────────
    {
        "name":            "Encoded PowerShell Execution",
        "description":     "Detects PowerShell launched with -EncodedCommand/-enc, commonly used to evade detection.",
        "rule_type":       "process",
        "field":           "cmdline",
        "operator":        "contains",
        "value":           "-enc",
        "severity":        "High",
        "mitre_tactic":    "Execution",
        "mitre_technique": "T1059.001",
    },
    {
        "name":            "Mimikatz Credential Dumping",
        "description":     "Detects mimikatz keywords in process name or command line.",
        "rule_type":       "process",
        "field":           "cmdline",
        "operator":        "contains",
        "value":           "mimikatz",
        "severity":        "Critical",
        "mitre_tactic":    "Credential Access",
        "mitre_technique": "T1003",
    },
    {
        "name":            "LSASS Memory Access (sekurlsa)",
        "description":     "Detects sekurlsa module usage, indicating LSASS credential dumping.",
        "rule_type":       "process",
        "field":           "cmdline",
        "operator":        "contains",
        "value":           "sekurlsa",
        "severity":        "Critical",
        "mitre_tactic":    "Credential Access",
        "mitre_technique": "T1003.001",
    },
    {
        "name":            "PsExec Remote Execution",
        "description":     "Detects PsExec usage, often used for lateral movement.",
        "rule_type":       "process",
        "field":           "process_name",
        "operator":        "contains",
        "value":           "psexec",
        "severity":        "High",
        "mitre_tactic":    "Lateral Movement",
        "mitre_technique": "T1570",
    },
    {
        "name":            "CertUtil Suspicious Download",
        "description":     "Detects certutil -urlcache, a common LOLBin download technique.",
        "rule_type":       "process",
        "field":           "cmdline",
        "operator":        "contains",
        "value":           "certutil",
        "severity":        "High",
        "mitre_tactic":    "Defense Evasion",
        "mitre_technique": "T1218",
    },
    {
        "name":            "MSHTA Script Execution",
        "description":     "Detects mshta.exe execution used to run malicious HTA scripts.",
        "rule_type":       "process",
        "field":           "process_name",
        "operator":        "equals",
        "value":           "mshta.exe",
        "severity":        "High",
        "mitre_tactic":    "Execution",
        "mitre_technique": "T1218.005",
    },
    {
        "name":            "WMIC Remote Code Execution",
        "description":     "Detects WMIC being used for remote command execution.",
        "rule_type":       "process",
        "field":           "process_name",
        "operator":        "equals",
        "value":           "wmic.exe",
        "severity":        "Medium",
        "mitre_tactic":    "Execution",
        "mitre_technique": "T1047",
    },
    {
        "name":            "Net User Account Discovery",
        "description":     "Detects 'net user' commands used for account enumeration.",
        "rule_type":       "process",
        "field":           "cmdline",
        "operator":        "contains",
        "value":           "net user",
        "severity":        "Medium",
        "mitre_tactic":    "Discovery",
        "mitre_technique": "T1087",
    },
    {
        "name":            "Whoami Execution",
        "description":     "Detects whoami execution, often used by attackers after initial access.",
        "rule_type":       "process",
        "field":           "process_name",
        "operator":        "equals",
        "value":           "whoami.exe",
        "severity":        "Low",
        "mitre_tactic":    "Discovery",
        "mitre_technique": "T1033",
    },
    # ── Network rules ──────────────────────────────────────────────────────
    {
        "name":            "Metasploit Default Reverse Shell Port (4444)",
        "description":     "Outbound connection to port 4444 — common Metasploit listener port.",
        "rule_type":       "network",
        "field":           "remote_port",
        "operator":        "equals",
        "value":           "4444",
        "severity":        "Critical",
        "mitre_tactic":    "Command and Control",
        "mitre_technique": "T1571",
    },
    {
        "name":            "Common C2 Port — 1337",
        "description":     "Outbound connection to port 1337, a common C2 beacon port.",
        "rule_type":       "network",
        "field":           "remote_port",
        "operator":        "equals",
        "value":           "1337",
        "severity":        "High",
        "mitre_tactic":    "Command and Control",
        "mitre_technique": "T1571",
    },
    {
        "name":            "IRC / Bot C2 Port (6667)",
        "description":     "Outbound IRC connection — used by botnets for command and control.",
        "rule_type":       "network",
        "field":           "remote_port",
        "operator":        "equals",
        "value":           "6667",
        "severity":        "High",
        "mitre_tactic":    "Command and Control",
        "mitre_technique": "T1071.003",
    },
    # ── File rules ─────────────────────────────────────────────────────────
    {
        "name":            "Executable Dropped in Temp Directory",
        "description":     "Detects .exe files written to Temp directories — common malware staging location.",
        "rule_type":       "file",
        "field":           "file_path",
        "operator":        "contains",
        "value":           "\\temp\\",
        "severity":        "High",
        "mitre_tactic":    "Defense Evasion",
        "mitre_technique": "T1036",
    },
    {
        "name":            "Script File Created in AppData",
        "description":     "Detects script files (.ps1, .bat, .vbs) written to AppData — stealthy execution staging.",
        "rule_type":       "file",
        "field":           "file_path",
        "operator":        "contains",
        "value":           "appdata",
        "severity":        "Medium",
        "mitre_tactic":    "Persistence",
        "mitre_technique": "T1059",
    },
    # ── Persistence rules ──────────────────────────────────────────────────
    {
        "name":            "Registry Run Key Persistence",
        "description":     "Detects entries written to HKCU/HKLM Run registry keys — a classic persistence technique.",
        "rule_type":       "persistence",
        "field":           "persistence_type",
        "operator":        "equals",
        "value":           "registry",
        "severity":        "High",
        "mitre_tactic":    "Persistence",
        "mitre_technique": "T1547.001",
    },
    {
        "name":            "New Service Installation",
        "description":     "Detects a new Windows service being installed — potential persistence mechanism.",
        "rule_type":       "persistence",
        "field":           "persistence_type",
        "operator":        "equals",
        "value":           "service",
        "severity":        "Medium",
        "mitre_tactic":    "Persistence",
        "mitre_technique": "T1543.003",
    },
    {
        "name":            "Cron Job Modification",
        "description":     "Detects changes to cron jobs on Linux systems — potential persistence mechanism.",
        "rule_type":       "persistence",
        "field":           "persistence_type",
        "operator":        "equals",
        "value":           "cron",
        "severity":        "Medium",
        "mitre_tactic":    "Persistence",
        "mitre_technique": "T1053.003",
    },
]


def seed_detection_rules(db: Session) -> None:
    """Insert system rules that don't already exist (by name + is_system).

    Silently skips if the detection_rules table hasn't been created yet
    (migration not yet applied).
    """
    try:
        existing_names = {
            r.name
            for r in db.query(DetectionRule.name).filter(DetectionRule.is_system.is_(True)).all()
        }
        now = datetime.utcnow()
        for rule_data in SYSTEM_RULES:
            if rule_data["name"] in existing_names:
                continue
            rule = DetectionRule(
                **rule_data,
                enabled=True,
                tenant_id=None,
                is_system=True,
                created_at=now,
                updated_at=now,
            )
            db.add(rule)
        db.commit()
    except Exception:
        db.rollback()
