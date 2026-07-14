"""
Vulnerability scanner module — runs local checks and returns a list of findings.
Checks: open ports, missing patches, SMB, RDP, password policy, installed software CVEs.
"""
import json
import platform
import re
import socket
import subprocess
from datetime import datetime
from typing import Optional

# ── Severity-ranked dangerous ports ──────────────────────────────────────────
DANGEROUS_PORTS: dict[int, tuple[str, str, str, str]] = {
    # port: (service, severity, description, remediation)
    21:    ("FTP",        "High",     "FTP transmits credentials in plaintext",        "Disable FTP; use SFTP/FTPS instead"),
    23:    ("Telnet",     "Critical", "Telnet transmits all data in plaintext",         "Disable Telnet; use SSH"),
    25:    ("SMTP",       "Medium",   "SMTP may allow open relay",                     "Restrict SMTP relay to authorised hosts"),
    69:    ("TFTP",       "High",     "TFTP has no authentication",                    "Disable TFTP service"),
    135:   ("MSRPC",      "High",     "MSRPC endpoint mapper exposed to network",       "Block port 135 at the host firewall"),
    139:   ("NetBIOS",    "High",     "NetBIOS session service exposed",               "Disable NetBIOS over TCP/IP"),
    161:   ("SNMP",       "Medium",   "SNMP service exposed; may use default community","Use SNMPv3 with strong credentials"),
    389:   ("LDAP",       "Medium",   "LDAP exposed without TLS",                      "Use LDAPS (port 636)"),
    445:   ("SMB",        "High",     "SMB file sharing exposed to the network",        "Block SMB at the perimeter firewall"),
    1433:  ("MSSQL",      "High",     "SQL Server port exposed to the network",         "Restrict database port behind a firewall"),
    3306:  ("MySQL",      "High",     "MySQL port exposed to the network",              "Restrict database port behind a firewall"),
    3389:  ("RDP",        "High",     "Remote Desktop exposed to the network",          "Restrict RDP to VPN/jump host; enable NLA"),
    5432:  ("PostgreSQL", "High",     "PostgreSQL port exposed to the network",         "Restrict database port behind a firewall"),
    5900:  ("VNC",        "High",     "VNC remote access exposed",                     "Disable VNC or restrict to trusted IPs"),
    6379:  ("Redis",      "Critical", "Redis exposed — no auth by default",            "Enable Redis AUTH and bind to localhost"),
    8080:  ("HTTP-Alt",   "Low",      "Alternative HTTP port open",                    "Confirm this is intentional; enforce HTTPS"),
    27017: ("MongoDB",    "Critical", "MongoDB exposed — no auth by default",          "Enable MongoDB auth and bind to localhost"),
}

# ── Known vulnerable software patterns ───────────────────────────────────────
# (name_substring, min_safe_version, cve_id, cvss, severity, description, remediation)
KNOWN_CVES: list[tuple] = [
    ("openssl",   "3.0.7",  "CVE-2022-3786",  9.8,  "Critical", "OpenSSL X.509 buffer overflow (punycode)",           "Upgrade OpenSSL to 3.0.7+"),
    ("openssh",   "9.1",    "CVE-2023-38408", 9.8,  "Critical", "OpenSSH ssh-agent remote code execution",             "Upgrade OpenSSH to 9.1+"),
    ("log4j",     "2.17.1", "CVE-2021-44228", 10.0, "Critical", "Log4Shell — JNDI remote code execution in Log4j",     "Upgrade Log4j to 2.17.1+"),
    ("curl",      "7.88.0", "CVE-2023-23914", 9.4,  "Critical", "curl HSTS check bypass",                             "Upgrade curl to 7.88.0+"),
    ("nginx",     "1.25.3", "CVE-2023-44487", 7.5,  "High",     "HTTP/2 Rapid Reset (NGINX)",                         "Upgrade NGINX to 1.25.3+"),
    ("apache",    "2.4.58", "CVE-2023-31122", 7.5,  "High",     "Apache HTTP Server buffer over-read",                 "Upgrade Apache to 2.4.58+"),
    ("git",       "2.43.0", "CVE-2022-41903", 9.8,  "Critical", "Git heap buffer overflow in commit formatting",       "Upgrade git to 2.43.0+"),
    ("sudo",      "1.9.13", "CVE-2023-22809", 7.8,  "High",     "Sudo privilege escalation via sudoedit",             "Upgrade sudo to 1.9.13+"),
    ("bash",      "5.2.15", "CVE-2014-6271",  10.0, "Critical", "Shellshock — arbitrary command execution in bash",   "Upgrade bash to 5.2.15+"),
    ("python",    "3.11.4", "CVE-2023-27043", 5.3,  "Medium",   "Python email header parsing denial of service",       "Upgrade Python to 3.11.4+"),
    ("postgresql","15.3",   "CVE-2023-2454",  7.2,  "High",     "PostgreSQL privilege escalation via row security",    "Upgrade PostgreSQL to 15.3+"),
    ("libssl",    "3.0.7",  "CVE-2022-3786",  9.8,  "Critical", "libssl buffer overflow (shared library)",             "Upgrade libssl to 3.0.7+"),
    ("zlib",      "1.2.13", "CVE-2022-37434", 9.8,  "Critical", "zlib heap buffer overflow via inflate",              "Upgrade zlib to 1.2.13+"),
    ("expat",     "2.5.0",  "CVE-2022-43680", 7.5,  "High",     "Expat XML parser use-after-free",                    "Upgrade expat to 2.5.0+"),
]


def _version_lt(v1: str, v2: str) -> bool:
    """Return True when v1 < v2. Compares dot-separated numeric segments."""
    def parse(v: str) -> tuple:
        return tuple(int(x) for x in re.sub(r"[^0-9.]", "", v).split(".") if x)
    try:
        return parse(v1) < parse(v2)
    except Exception:
        return False


# ── Checks ────────────────────────────────────────────────────────────────────

def check_open_ports() -> list[dict]:
    findings = []
    for port, (service, severity, desc, remediation) in DANGEROUS_PORTS.items():
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.settimeout(0.4)
            result = s.connect_ex(("127.0.0.1", port))
            s.close()
            if result == 0:
                findings.append({
                    "check_type":         "port",
                    "severity":           severity,
                    "title":              f"Dangerous port open: {port}/{service}",
                    "description":        desc,
                    "remediation":        remediation,
                    "affected_component": f"Port {port} ({service})",
                })
        except Exception:
            pass
    return findings


def check_smb_windows() -> list[dict]:
    findings = []
    try:
        r = subprocess.run(
            ["powershell", "-Command",
             "Get-SmbServerConfiguration | Select-Object EnableSMB1Protocol | ConvertTo-Json"],
            capture_output=True, text=True, timeout=10,
        )
        if r.returncode == 0 and r.stdout.strip():
            data = json.loads(r.stdout)
            if data.get("EnableSMB1Protocol"):
                findings.append({
                    "check_type":         "smb",
                    "severity":           "Critical",
                    "title":              "SMBv1 Protocol Enabled",
                    "description":        (
                        "SMBv1 is obsolete and exploitable via EternalBlue (CVE-2017-0144), "
                        "the vulnerability used in the WannaCry ransomware outbreak."
                    ),
                    "remediation":        "Run: Set-SmbServerConfiguration -EnableSMB1Protocol $false -Force",
                    "affected_component": "SMBv1",
                    "cve_id":             "CVE-2017-0144",
                    "cvss_score":         9.8,
                })
    except Exception:
        pass
    return findings


def check_rdp_windows() -> list[dict]:
    findings = []
    try:
        deny_r = subprocess.run(
            ["powershell", "-Command",
             r'Get-ItemProperty "HKLM:\System\CurrentControlSet\Control\Terminal Server" '
             r'-Name fDenyTSConnections | Select-Object -ExpandProperty fDenyTSConnections'],
            capture_output=True, text=True, timeout=10,
        )
        if deny_r.returncode != 0:
            return findings
        rdp_enabled = deny_r.stdout.strip() == "0"
        if not rdp_enabled:
            return findings

        nla_r = subprocess.run(
            ["powershell", "-Command",
             r'Get-ItemProperty "HKLM:\SYSTEM\CurrentControlSet\Control\Terminal Server\WinStations\RDP-Tcp" '
             r'-Name UserAuthentication | Select-Object -ExpandProperty UserAuthentication'],
            capture_output=True, text=True, timeout=10,
        )
        nla_on = nla_r.returncode == 0 and nla_r.stdout.strip() == "1"

        if not nla_on:
            findings.append({
                "check_type":         "rdp",
                "severity":           "High",
                "title":              "RDP Enabled Without Network Level Authentication",
                "description":        (
                    "Remote Desktop is reachable but NLA is not enforced. "
                    "This exposes the login prompt to unauthenticated attackers "
                    "and increases the risk of credential brute-force attacks."
                ),
                "remediation":        (
                    "Enable NLA: System Properties → Remote → "
                    "'Allow connections only from computers running Remote Desktop with NLA'."
                ),
                "affected_component": "RDP (Port 3389)",
            })
        else:
            findings.append({
                "check_type":         "rdp",
                "severity":           "Medium",
                "title":              "RDP Service Exposed",
                "description":        "Remote Desktop Protocol is enabled. Restrict access to trusted networks.",
                "remediation":        "Add a Windows Firewall rule to limit RDP to specific IP ranges or a VPN.",
                "affected_component": "RDP (Port 3389)",
            })
    except Exception:
        pass
    return findings


def check_patches_windows() -> list[dict]:
    findings = []
    try:
        r = subprocess.run(
            ["powershell", "-Command",
             "Get-HotFix | Sort-Object InstalledOn -Descending | "
             "Select-Object -First 1 | Select-Object -ExpandProperty InstalledOn"],
            capture_output=True, text=True, timeout=20,
        )
        if r.returncode != 0 or not r.stdout.strip():
            return findings

        date_str = r.stdout.strip().split()[0]
        last_patch = datetime.strptime(date_str, "%m/%d/%Y")
        days = (datetime.now() - last_patch).days

        if days > 180:
            sev, title = "Critical", f"Windows Not Patched for {days} Days"
        elif days > 90:
            sev, title = "High",     f"Windows Patches Overdue ({days} days)"
        elif days > 30:
            sev, title = "Medium",   f"Windows Patch Lag: {days} Days"
        else:
            return findings

        findings.append({
            "check_type":         "patch",
            "severity":           sev,
            "title":              title,
            "description":        (
                f"Last Windows update was applied {days} days ago "
                f"(last patch: {date_str}). Unpatched systems are vulnerable to "
                "publicly disclosed exploits."
            ),
            "remediation":        "Run Windows Update and enable automatic security updates.",
            "affected_component": "Windows Update",
        })
    except Exception:
        pass
    return findings


def check_patches_linux() -> list[dict]:
    findings = []
    try:
        r = subprocess.run(
            ["apt", "list", "--upgradable"],
            capture_output=True, text=True, timeout=30,
        )
        if r.returncode != 0:
            return findings

        security = [l for l in r.stdout.splitlines() if "security" in l.lower()]
        n = len(security)
        if n == 0:
            return findings

        sev = "High" if n > 5 else "Medium"
        findings.append({
            "check_type":         "patch",
            "severity":           sev,
            "title":              f"{n} Security Packages Need Updating",
            "description":        f"{n} security-related package updates are available but not installed.",
            "remediation":        "Run: apt-get update && apt-get upgrade -y",
            "affected_component": "apt packages",
        })
    except Exception:
        pass
    return findings


def check_password_policy_windows() -> list[dict]:
    findings = []
    try:
        r = subprocess.run(["net", "accounts"], capture_output=True, text=True, timeout=10)
        if r.returncode == 0:
            for line in r.stdout.splitlines():
                if "Minimum password length" in line:
                    val = line.split(":")[-1].strip()
                    if val in ("None", "0") or (val.isdigit() and int(val) < 8):
                        findings.append({
                            "check_type":         "password",
                            "severity":           "High",
                            "title":              "Weak Password Policy: Minimum Length Too Short",
                            "description":        (
                                f"The minimum password length is set to '{val}'. "
                                "NIST SP 800-63B recommends at least 12 characters."
                            ),
                            "remediation":        (
                                "Set minimum password length to 12+ via Group Policy: "
                                "Computer Configuration → Windows Settings → "
                                "Security Settings → Account Policies → Password Policy."
                            ),
                            "affected_component": "Password Policy",
                        })

        # Check whether the Guest account is active
        guest_r = subprocess.run(
            ["net", "user", "Guest"], capture_output=True, text=True, timeout=10
        )
        if guest_r.returncode == 0:
            for line in guest_r.stdout.splitlines():
                if "Account active" in line and "Yes" in line:
                    findings.append({
                        "check_type":         "password",
                        "severity":           "High",
                        "title":              "Guest Account Enabled",
                        "description":        (
                            "The Windows Guest account is active. "
                            "It allows limited unauthenticated access to system resources."
                        ),
                        "remediation":        "Run: net user Guest /active:no",
                        "affected_component": "Local Users",
                    })
    except Exception:
        pass
    return findings


def get_installed_software() -> list[dict]:
    os_type = platform.system().lower()

    if os_type == "windows":
        try:
            r = subprocess.run(
                ["powershell", "-Command",
                 "Get-ItemProperty HKLM:\\Software\\Wow6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\* "
                 "| Select-Object DisplayName, DisplayVersion | ConvertTo-Json -Depth 1"],
                capture_output=True, text=True, timeout=20,
            )
            if r.returncode == 0 and r.stdout.strip():
                items = json.loads(r.stdout)
                if isinstance(items, dict):
                    items = [items]
                return [
                    {"name": i["DisplayName"], "version": i["DisplayVersion"]}
                    for i in items
                    if i.get("DisplayName") and i.get("DisplayVersion")
                ]
        except Exception:
            pass

    # Linux — try dpkg first, fall back to rpm
    for cmd, parse in [
        (["dpkg", "-l"], lambda line: (line.split()[1], line.split()[2])
         if len(line.split()) >= 3 and line.startswith("ii") else None),
        (["rpm", "-qa", "--queryformat", "%{NAME} %{VERSION}\n"],
         lambda line: tuple(line.strip().split()[:2])
         if len(line.strip().split()) >= 2 else None),
    ]:
        try:
            r = subprocess.run(cmd, capture_output=True, text=True, timeout=20)
            if r.returncode == 0:
                sw = []
                for line in r.stdout.splitlines()[5:]:
                    parsed = parse(line)
                    if parsed:
                        sw.append({"name": parsed[0], "version": parsed[1]})
                if sw:
                    return sw
        except Exception:
            pass
    return []


def check_software_cves(software: list[dict]) -> list[dict]:
    findings = []
    seen: set[str] = set()

    for sw in software:
        name    = sw.get("name", "").lower()
        version = sw.get("version", "")
        if not name or not version:
            continue

        for pkg, safe_ver, cve_id, cvss, severity, desc, remediation in KNOWN_CVES:
            if pkg not in name:
                continue
            key = f"{cve_id}:{name}"
            if key in seen:
                continue
            try:
                if _version_lt(version, safe_ver):
                    seen.add(key)
                    findings.append({
                        "check_type":         "cve",
                        "severity":           severity,
                        "title":              f"{cve_id}: {sw['name']} {version} is vulnerable",
                        "description":        desc,
                        "remediation":        remediation,
                        "cve_id":             cve_id,
                        "cvss_score":         cvss,
                        "affected_component": f"{sw['name']} {version}",
                        "package_name":       sw["name"],
                        "installed_version":  version,
                        "fixed_version":      safe_ver,
                    })
            except Exception:
                pass
    return findings


# ── Main entry-point ──────────────────────────────────────────────────────────

def run_all_checks() -> list[dict]:
    """Run all vulnerability checks and return a deduplicated list of findings."""
    os_type = platform.system().lower()
    findings: list[dict] = []

    findings.extend(check_open_ports())

    if os_type == "windows":
        findings.extend(check_smb_windows())
        findings.extend(check_rdp_windows())
        findings.extend(check_patches_windows())
        findings.extend(check_password_policy_windows())
    else:
        findings.extend(check_patches_linux())

    software = get_installed_software()
    findings.extend(check_software_cves(software))

    return findings
