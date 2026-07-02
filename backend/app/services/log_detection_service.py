"""
Hardcoded threat detectors for log-based telemetry.

Covers:
  syslog         — SSH brute-force, sudo escalation, root login, PAM failures
  wineventlog    — Failed logon (4625), account lockout (4740), audit log cleared (1102),
                   new service (7045), special privileges (4672), privileged group add (4728/4732)
  web (iis/apache/nginx) — Path traversal, SQL injection, web scanners, web shells
  application    — Credentials in logs, critical errors
"""
from sqlalchemy.orm import Session
from app.services.alert_service import create_alert_if_not_exists


# ── Syslog detectors ──────────────────────────────────────────────────────────

def detect_ssh_bruteforce(db: Session, log_message: str, source_ip: str | None, agent_id: int):
    msg = (log_message or "").lower()
    if "failed password" in msg or "invalid user" in msg or "authentication failure" in msg:
        desc = (
            f"SSH authentication failure detected. "
            f"Source IP: {source_ip or 'unknown'}. "
            f"Message: {log_message[:300]}"
        )
        create_alert_if_not_exists(db, "SSH Authentication Failure", desc, "Medium", "T1110.001", agent_id)


def detect_sudo_escalation(db: Session, process_name: str | None, log_message: str, agent_id: int):
    proc = (process_name or "").lower()
    msg  = (log_message or "").lower()
    if proc == "sudo" or "sudo:" in msg:
        if "command not allowed" in msg or "not in sudoers" in msg:
            desc = f"Unauthorized sudo attempt detected: {log_message[:300]}"
            create_alert_if_not_exists(db, "Unauthorized Sudo Attempt", desc, "High", "T1548.003", agent_id)
        elif "command" in msg:
            desc = f"Sudo privilege escalation: {log_message[:300]}"
            create_alert_if_not_exists(db, "Sudo Command Executed", desc, "Low", "T1548.003", agent_id)


def detect_root_login(db: Session, log_message: str, username: str | None, agent_id: int):
    msg  = (log_message or "").lower()
    user = (username or "").lower()
    if (user == "root" or "user root" in msg) and "session opened" in msg:
        desc = f"Root login session opened. Message: {log_message[:300]}"
        create_alert_if_not_exists(db, "Root Login Detected", desc, "High", "T1078.003", agent_id)


def detect_pam_failure(db: Session, log_message: str, agent_id: int):
    msg = (log_message or "").lower()
    if "pam_unix" in msg and "authentication failure" in msg:
        desc = f"PAM authentication failure: {log_message[:300]}"
        create_alert_if_not_exists(db, "PAM Authentication Failure", desc, "Medium", "T1110", agent_id)


def detect_syslog_cron_abuse(db: Session, log_message: str, agent_id: int):
    msg = (log_message or "").lower()
    if "cron" in msg and ("sh -c" in msg or "/tmp/" in msg or "wget" in msg or "curl" in msg):
        desc = f"Suspicious cron execution detected: {log_message[:300]}"
        create_alert_if_not_exists(db, "Suspicious Cron Execution", desc, "High", "T1053.003", agent_id)


# ── Windows Event Log detectors ───────────────────────────────────────────────

def detect_winevent_failed_logon(db: Session, event_id: int | None, log_message: str, username: str | None, source_ip: str | None, agent_id: int):
    if event_id == 4625:
        desc = (
            f"Windows failed logon event (4625). "
            f"User: {username or 'unknown'}, Source IP: {source_ip or 'unknown'}. "
            f"{log_message[:200] if log_message else ''}"
        )
        create_alert_if_not_exists(db, "Windows Failed Logon", desc, "Medium", "T1110.001", agent_id)


def detect_winevent_account_lockout(db: Session, event_id: int | None, log_message: str, username: str | None, agent_id: int):
    if event_id == 4740:
        desc = (
            f"Account lockout event (4740). "
            f"Locked account: {username or 'unknown'}. "
            f"{log_message[:200] if log_message else ''}"
        )
        create_alert_if_not_exists(db, "Account Lockout Detected", desc, "High", "T1110", agent_id)


def detect_winevent_audit_cleared(db: Session, event_id: int | None, log_message: str, username: str | None, agent_id: int):
    if event_id == 1102:
        desc = (
            f"Windows Security audit log was cleared (Event 1102) — "
            f"possible attacker covering tracks. "
            f"User: {username or 'unknown'}. "
            f"{log_message[:200] if log_message else ''}"
        )
        create_alert_if_not_exists(db, "Windows Audit Log Cleared", desc, "Critical", "T1070.001", agent_id)


def detect_winevent_new_service(db: Session, event_id: int | None, log_message: str, agent_id: int):
    if event_id == 7045:
        desc = (
            f"A new Windows service was installed (Event 7045) — "
            f"potential persistence mechanism. "
            f"{log_message[:300] if log_message else ''}"
        )
        create_alert_if_not_exists(db, "New Windows Service Installed", desc, "High", "T1543.003", agent_id)


def detect_winevent_privilege_escalation(db: Session, event_id: int | None, log_message: str, username: str | None, agent_id: int):
    if event_id == 4672:
        desc = (
            f"Special privileges assigned to new logon (Event 4672). "
            f"User: {username or 'unknown'}. "
            f"{log_message[:200] if log_message else ''}"
        )
        create_alert_if_not_exists(db, "Special Privileges Assigned", desc, "High", "T1078", agent_id)


def detect_winevent_privileged_group_add(db: Session, event_id: int | None, log_message: str, username: str | None, agent_id: int):
    if event_id in (4728, 4732, 4756):  # added to security-enabled group
        desc = (
            f"User added to privileged group (Event {event_id}). "
            f"User: {username or 'unknown'}. "
            f"{log_message[:200] if log_message else ''}"
        )
        create_alert_if_not_exists(db, "User Added to Privileged Group", desc, "High", "T1098", agent_id)


def detect_winevent_pass_the_hash(db: Session, event_id: int | None, extra: dict | None, username: str | None, source_ip: str | None, agent_id: int):
    if event_id == 4624 and extra:
        logon_type = str(extra.get("LogonType", ""))
        auth_pkg   = str(extra.get("AuthenticationPackageName", "")).upper()
        if logon_type == "3" and auth_pkg == "NTLM" and username and username not in ("-", "ANONYMOUS LOGON", ""):
            desc = (
                f"Possible pass-the-hash: NTLM network logon (Type 3) detected. "
                f"User: {username}, Source IP: {source_ip or 'unknown'}."
            )
            create_alert_if_not_exists(db, "Possible Pass-the-Hash Attack", desc, "Critical", "T1550.002", agent_id)


# ── Web log detectors (IIS / Apache / Nginx) ──────────────────────────────────

def detect_path_traversal(db: Session, log_message: str, source_ip: str | None, log_source: str, agent_id: int):
    url = (log_message or "").lower()
    if "../" in url or "%2e%2e%2f" in url or "%2e%2e/" in url or "..%2f" in url or "..%5c" in url:
        desc = (
            f"Path traversal attempt detected in {log_source} log. "
            f"Source IP: {source_ip or 'unknown'}. "
            f"Request: {log_message[:300]}"
        )
        create_alert_if_not_exists(db, "Web Path Traversal Attempt", desc, "High", "T1083", agent_id)


def detect_sql_injection(db: Session, log_message: str, source_ip: str | None, log_source: str, agent_id: int):
    url  = (log_message or "").lower()
    sqli = ["union+select", "union%20select", "' or '1'='1", "or+1=1", "' or 1=1", ";drop", ";select", "exec(", "exec%20", "xp_cmdshell"]
    if any(p in url for p in sqli):
        desc = (
            f"SQL injection attempt detected in {log_source} log. "
            f"Source IP: {source_ip or 'unknown'}. "
            f"Request: {log_message[:300]}"
        )
        create_alert_if_not_exists(db, "Web SQL Injection Attempt", desc, "High", "T1190", agent_id)


def detect_web_scanner(db: Session, extra: dict | None, source_ip: str | None, log_source: str, agent_id: int):
    ua = (extra or {}).get("user_agent", "") or ""
    ua_lower = ua.lower()
    scanners = ["nikto", "sqlmap", "dirbuster", "dirb", "masscan", "nmap", "burpsuite", "zap", "acunetix", "nessus", "openvas", "nuclei", "gobuster"]
    if any(s in ua_lower for s in scanners):
        desc = (
            f"Web vulnerability scanner detected in {log_source} log. "
            f"Source IP: {source_ip or 'unknown'}. "
            f"User-Agent: {ua[:200]}"
        )
        create_alert_if_not_exists(db, "Web Scanner Detected", desc, "Medium", "T1595.002", agent_id)


def detect_web_shell(db: Session, log_message: str, source_ip: str | None, log_source: str, agent_id: int):
    url = (log_message or "").lower()
    shells = [".php?cmd=", ".php?exec=", "/shell.php", "/cmd.php", "/c99.php", "/r57.php",
              ".asp?cmd=", ".aspx?cmd=", ".jsp?cmd=", "eval(base64", "passthru("]
    if any(p in url for p in shells):
        desc = (
            f"Possible web shell access in {log_source} log. "
            f"Source IP: {source_ip or 'unknown'}. "
            f"Request: {log_message[:300]}"
        )
        create_alert_if_not_exists(db, "Web Shell Access Detected", desc, "Critical", "T1505.003", agent_id)


def detect_web_error_spike(db: Session, extra: dict | None, source_ip: str | None, log_source: str, agent_id: int):
    status = str((extra or {}).get("status_code", "") or "")
    if status.startswith("5"):
        desc = (
            f"HTTP 5xx server error in {log_source} log. "
            f"Status: {status}, Source IP: {source_ip or 'unknown'}."
        )
        create_alert_if_not_exists(db, "Web Server 5xx Error", desc, "Low", "T1190", agent_id)


# ── Application log detectors ─────────────────────────────────────────────────

def detect_credential_in_log(db: Session, log_message: str, agent_id: int):
    msg = (log_message or "").lower()
    patterns = ["password=", "passwd=", "secret=", "api_key=", "token=", "apikey=", "auth_token="]
    if any(p in msg for p in patterns):
        desc = f"Possible credential exposed in application log: {log_message[:300]}"
        create_alert_if_not_exists(db, "Credential Exposed in Log", desc, "High", "T1552", agent_id)


def detect_critical_app_error(db: Session, severity: str | None, log_message: str, agent_id: int):
    sev = (severity or "").lower()
    msg = (log_message or "").lower()
    if sev == "critical" or "fatal" in msg or "unhandled exception" in msg or "panic:" in msg:
        desc = f"Critical application error detected: {log_message[:300]}"
        create_alert_if_not_exists(db, "Critical Application Error", desc, "Medium", "T1499", agent_id)
