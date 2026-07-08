"""
Seeds built-in (system) detection rules on first startup.
Rules with is_system=True and tenant_id=None apply platform-wide.

Each entry in SYSTEM_RULES has:
  - rule metadata (name, description, rule_type, severity, mitre_*)
  - logic: "AND" | "OR"
  - conditions: list of {field, operator, value}
"""
from datetime import datetime
from sqlalchemy.orm import Session
from app.models.detection_rule import DetectionRule
from app.models.detection_rule_condition import DetectionRuleCondition

SYSTEM_RULES = [
    # ── Process rules ──────────────────────────────────────────────────────
    {
        "name":            "Encoded PowerShell Execution",
        "description":     "Detects PowerShell launched with -EncodedCommand/-enc, commonly used to evade detection.",
        "rule_type":       "process",
        "logic":           "AND",
        "severity":        "High",
        "mitre_tactic":    "Execution",
        "mitre_technique": "T1059.001",
        "conditions": [
            {"field": "process_name", "operator": "equals",   "value": "powershell.exe"},
            {"field": "cmdline",      "operator": "contains", "value": "-enc"},
        ],
    },
    {
        "name":            "Mimikatz Credential Dumping",
        "description":     "Detects mimikatz keywords in process name or command line.",
        "rule_type":       "process",
        "logic":           "OR",
        "severity":        "Critical",
        "mitre_tactic":    "Credential Access",
        "mitre_technique": "T1003",
        "conditions": [
            {"field": "process_name", "operator": "contains", "value": "mimikatz"},
            {"field": "cmdline",      "operator": "contains", "value": "mimikatz"},
            {"field": "cmdline",      "operator": "contains", "value": "lsadump"},
        ],
    },
    {
        "name":            "LSASS Memory Access (sekurlsa)",
        "description":     "Detects sekurlsa module usage, indicating LSASS credential dumping.",
        "rule_type":       "process",
        "logic":           "OR",
        "severity":        "Critical",
        "mitre_tactic":    "Credential Access",
        "mitre_technique": "T1003.001",
        "conditions": [
            {"field": "cmdline", "operator": "contains", "value": "sekurlsa"},
        ],
    },
    {
        "name":            "LSASS Dump via ProcDump",
        "description":     "Detects procdump targeting lsass — a classic credential dump technique.",
        "rule_type":       "process",
        "logic":           "AND",
        "severity":        "Critical",
        "mitre_tactic":    "Credential Access",
        "mitre_technique": "T1003.001",
        "conditions": [
            {"field": "cmdline", "operator": "contains", "value": "procdump"},
            {"field": "cmdline", "operator": "contains", "value": "lsass"},
        ],
    },
    {
        "name":            "PsExec Remote Execution",
        "description":     "Detects PsExec usage, often used for lateral movement.",
        "rule_type":       "process",
        "logic":           "OR",
        "severity":        "High",
        "mitre_tactic":    "Lateral Movement",
        "mitre_technique": "T1570",
        "conditions": [
            {"field": "process_name", "operator": "contains", "value": "psexec"},
            {"field": "cmdline",      "operator": "contains", "value": "psexec"},
        ],
    },
    {
        "name":            "CertUtil Suspicious Download",
        "description":     "Detects certutil -urlcache, a common LOLBin download technique.",
        "rule_type":       "process",
        "logic":           "AND",
        "severity":        "High",
        "mitre_tactic":    "Defense Evasion",
        "mitre_technique": "T1218",
        "conditions": [
            {"field": "process_name", "operator": "equals",   "value": "certutil.exe"},
            {"field": "cmdline",      "operator": "contains", "value": "urlcache"},
        ],
    },
    {
        "name":            "MSHTA Script Execution",
        "description":     "Detects mshta.exe execution used to run malicious HTA scripts.",
        "rule_type":       "process",
        "logic":           "OR",
        "severity":        "High",
        "mitre_tactic":    "Execution",
        "mitre_technique": "T1218.005",
        "conditions": [
            {"field": "process_name", "operator": "equals", "value": "mshta.exe"},
        ],
    },
    {
        "name":            "WMIC Remote Code Execution",
        "description":     "Detects WMIC being used for remote command execution.",
        "rule_type":       "process",
        "logic":           "OR",
        "severity":        "Medium",
        "mitre_tactic":    "Execution",
        "mitre_technique": "T1047",
        "conditions": [
            {"field": "process_name", "operator": "equals", "value": "wmic.exe"},
        ],
    },
    {
        "name":            "Rundll32 Suspicious Execution",
        "description":     "Detects rundll32 executing unusual DLL paths — common LOLBin technique.",
        "rule_type":       "process",
        "logic":           "AND",
        "severity":        "High",
        "mitre_tactic":    "Defense Evasion",
        "mitre_technique": "T1218.011",
        "conditions": [
            {"field": "process_name", "operator": "equals",   "value": "rundll32.exe"},
            {"field": "cmdline",      "operator": "contains", "value": ".dll"},
        ],
    },
    {
        "name":            "Regsvr32 COM Scriptlet Execution",
        "description":     "Detects regsvr32 /s /u /n /i: — a living-off-the-land scriptlet technique.",
        "rule_type":       "process",
        "logic":           "AND",
        "severity":        "High",
        "mitre_tactic":    "Defense Evasion",
        "mitre_technique": "T1218.010",
        "conditions": [
            {"field": "process_name", "operator": "equals",   "value": "regsvr32.exe"},
            {"field": "cmdline",      "operator": "contains", "value": "/i:"},
        ],
    },
    {
        "name":            "Suspicious Parent-Child Process",
        "description":     "Detects office or browser spawning cmd/powershell — common macro/exploit pattern.",
        "rule_type":       "process",
        "logic":           "AND",
        "severity":        "High",
        "mitre_tactic":    "Execution",
        "mitre_technique": "T1059",
        "conditions": [
            {"field": "parent_process_name", "operator": "in_list", "value": "winword.exe,excel.exe,powerpnt.exe,outlook.exe,chrome.exe,firefox.exe,iexplore.exe,msedge.exe"},
            {"field": "process_name",        "operator": "in_list", "value": "cmd.exe,powershell.exe,wscript.exe,cscript.exe,mshta.exe"},
        ],
    },
    {
        "name":            "Net User Account Discovery",
        "description":     "Detects 'net user' commands used for account enumeration.",
        "rule_type":       "process",
        "logic":           "OR",
        "severity":        "Medium",
        "mitre_tactic":    "Discovery",
        "mitre_technique": "T1087",
        "conditions": [
            {"field": "cmdline", "operator": "contains", "value": "net user"},
        ],
    },
    {
        "name":            "Whoami Execution",
        "description":     "Detects whoami execution, often used by attackers after initial access.",
        "rule_type":       "process",
        "logic":           "OR",
        "severity":        "Low",
        "mitre_tactic":    "Discovery",
        "mitre_technique": "T1033",
        "conditions": [
            {"field": "process_name", "operator": "equals", "value": "whoami.exe"},
        ],
    },
    # ── Network rules ──────────────────────────────────────────────────────
    {
        "name":            "Metasploit Default Reverse Shell Port (4444)",
        "description":     "Outbound connection to port 4444 — common Metasploit listener port.",
        "rule_type":       "network",
        "logic":           "OR",
        "severity":        "Critical",
        "mitre_tactic":    "Command and Control",
        "mitre_technique": "T1571",
        "conditions": [
            {"field": "remote_port", "operator": "equals", "value": "4444"},
        ],
    },
    {
        "name":            "Common C2 Port — 1337",
        "description":     "Outbound connection to port 1337, a common C2 beacon port.",
        "rule_type":       "network",
        "logic":           "OR",
        "severity":        "High",
        "mitre_tactic":    "Command and Control",
        "mitre_technique": "T1571",
        "conditions": [
            {"field": "remote_port", "operator": "equals", "value": "1337"},
        ],
    },
    {
        "name":            "IRC / Bot C2 Port (6667)",
        "description":     "Outbound IRC connection — used by botnets for command and control.",
        "rule_type":       "network",
        "logic":           "OR",
        "severity":        "High",
        "mitre_tactic":    "Command and Control",
        "mitre_technique": "T1071.003",
        "conditions": [
            {"field": "remote_port", "operator": "equals", "value": "6667"},
        ],
    },
    # ── File rules ─────────────────────────────────────────────────────────
    {
        "name":            "Executable Dropped in Temp Directory",
        "description":     "Detects .exe files written to Temp directories — common malware staging location.",
        "rule_type":       "file",
        "logic":           "AND",
        "severity":        "High",
        "mitre_tactic":    "Defense Evasion",
        "mitre_technique": "T1036",
        "conditions": [
            {"field": "file_path",  "operator": "contains", "value": "\\temp\\"},
            {"field": "file_path",  "operator": "ends_with","value": ".exe"},
        ],
    },
    {
        "name":            "Script File Created in AppData",
        "description":     "Detects script files (.ps1, .bat, .vbs) written to AppData — stealthy execution staging.",
        "rule_type":       "file",
        "logic":           "AND",
        "severity":        "Medium",
        "mitre_tactic":    "Persistence",
        "mitre_technique": "T1059",
        "conditions": [
            {"field": "file_path", "operator": "contains", "value": "appdata"},
            {"field": "file_path", "operator": "regex",    "value": r"\.(ps1|bat|vbs|js)$"},
        ],
    },
    {
        "name":            "Malware Dropped in System Directory",
        "description":     "Detects executables written to System32 or SysWOW64 by non-system processes.",
        "rule_type":       "file",
        "logic":           "AND",
        "severity":        "Critical",
        "mitre_tactic":    "Defense Evasion",
        "mitre_technique": "T1036.005",
        "conditions": [
            {"field": "file_path",  "operator": "regex",    "value": r"(system32|syswow64)"},
            {"field": "file_path",  "operator": "ends_with","value": ".exe"},
            {"field": "event_type", "operator": "in_list",  "value": "created,modified"},
        ],
    },
    {
        "name":            "Executable in Writable Directory",
        "description":     "Detects execution from world-writable directories — common malware staging pattern.",
        "rule_type":       "file",
        "logic":           "AND",
        "severity":        "High",
        "mitre_tactic":    "Defense Evasion",
        "mitre_technique": "T1574",
        "conditions": [
            {"field": "file_path",  "operator": "regex",   "value": r"(\\users\\public|\\programdata|\\windows\\temp)"},
            {"field": "file_path",  "operator": "ends_with","value": ".exe"},
            {"field": "event_type", "operator": "equals",  "value": "created"},
        ],
    },
    # ── Persistence rules ──────────────────────────────────────────────────
    {
        "name":            "Registry Run Key Persistence",
        "description":     "Detects entries written to HKCU/HKLM Run registry keys — a classic persistence technique.",
        "rule_type":       "persistence",
        "logic":           "OR",
        "severity":        "High",
        "mitre_tactic":    "Persistence",
        "mitre_technique": "T1547.001",
        "conditions": [
            {"field": "persistence_type", "operator": "equals", "value": "registry"},
        ],
    },
    {
        "name":            "New Service Installation",
        "description":     "Detects a new Windows service being installed — potential persistence mechanism.",
        "rule_type":       "persistence",
        "logic":           "OR",
        "severity":        "Medium",
        "mitre_tactic":    "Persistence",
        "mitre_technique": "T1543.003",
        "conditions": [
            {"field": "persistence_type", "operator": "equals", "value": "service"},
        ],
    },
    {
        "name":            "Cron Job Modification",
        "description":     "Detects changes to cron jobs on Linux systems — potential persistence mechanism.",
        "rule_type":       "persistence",
        "logic":           "OR",
        "severity":        "Medium",
        "mitre_tactic":    "Persistence",
        "mitre_technique": "T1053.003",
        "conditions": [
            {"field": "persistence_type", "operator": "equals", "value": "cron"},
        ],
    },
    {
        "name":            "Scheduled Task Created",
        "description":     "Detects scheduled task creation — used for persistence and lateral movement.",
        "rule_type":       "persistence",
        "logic":           "OR",
        "severity":        "Medium",
        "mitre_tactic":    "Persistence",
        "mitre_technique": "T1053.005",
        "conditions": [
            {"field": "persistence_type", "operator": "equals", "value": "scheduled_task"},
        ],
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
            conditions = rule_data.pop("conditions", [])
            rule = DetectionRule(
                **rule_data,
                enabled=True,
                tenant_id=None,
                is_system=True,
                created_at=now,
                updated_at=now,
            )
            db.add(rule)
            db.flush()  # get rule.id
            for i, cond in enumerate(conditions):
                db.add(DetectionRuleCondition(
                    rule_id=rule.id,
                    field=cond["field"],
                    operator=cond["operator"],
                    value=cond["value"],
                    sort_order=i,
                ))
        db.commit()
    except Exception:
        db.rollback()
