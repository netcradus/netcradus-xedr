from sqlalchemy.orm import Session

from app.services.alert_service import create_alert_if_not_exists
from collections import defaultdict
from datetime import datetime, timedelta

PORT_SCAN_WINDOW = timedelta(minutes=5)
RANSOMWARE_WINDOW = timedelta(minutes=5)

port_scan_cache = {}
ransomware_cache = {}


def detect_encoded_powershell(
        db: Session,
        process_name: str,
        cmdline: str,
        agent_id: int):

    process_name = process_name.lower()
    cmdline = cmdline.lower()

    if (
        process_name == "powershell.exe"
        and (
            "-enc" in cmdline
            or "-encodedcommand" in cmdline
        )
    ):

        create_alert_if_not_exists(
            db,
            "Encoded PowerShell Execution",
            cmdline,
            "High",
            "T1059.001",
            agent_id
        )

def detect_mimikatz(
        db,
        process_name: str,
        cmdline: str,
        agent_id: int):

    process_name = process_name.lower()
    cmdline = cmdline.lower()

    patterns = [

        "mimikatz",

        "sekurlsa",

        "lsadump"

    ]

    if any(
            pattern in process_name
            or pattern in cmdline

            for pattern in patterns):

        create_alert_if_not_exists(
            db,
            "Mimikatz Credential Dumping",
            cmdline,
            "Critical",
            "T1003",
            agent_id
        )

def detect_lsass_dump(
        db,
        process_name: str,
        cmdline: str,
        agent_id: int):

    cmdline = cmdline.lower()

    patterns = [

        "procdump",

        "lsass",

        "comsvcs.dll"

    ]

    if all(
            pattern in cmdline

            for pattern in ["procdump", "lsass"]):

        create_alert_if_not_exists(
            db,
            "LSASS Dump Attempt",
            cmdline,
            "Critical",
            "T1003.001",
            agent_id
        )

def detect_psexec(
        db,
        process_name: str,
        cmdline: str,
        agent_id: int):

    cmdline = cmdline.lower()

    patterns = [

        "psexec",

        "paexec"

    ]

    if any(
            p in cmdline

            for p in patterns):

        create_alert_if_not_exists(
            db,
            "PsExec Remote Execution",
            cmdline,
            "High",
            "T1021",
            agent_id
        )

def detect_reverse_shell(
        db,
        remote_ip: str,
        remote_port: int,
        protocol: str,
        agent_id: int):

    suspicious_ports = [

        4444,
        1337,
        31337,
        6666,
        6667

    ]

    if remote_port in suspicious_ports:

        create_alert_if_not_exists(
            db,
            "Possible Reverse Shell",
            f"{remote_ip}:{remote_port}",
            "Critical",
            "T1059",
            agent_id
        )

def detect_port_scan(
        db,
        remote_ip: str,
        remote_port: int,
        agent_id: int):

    now = datetime.utcnow()

    cache_key = (
        agent_id,
        remote_ip
    )

    entry = port_scan_cache.get(cache_key)

    if (
        not entry
        or now - entry["started_at"] > PORT_SCAN_WINDOW
    ):

        entry = {
            "started_at": now,
            "ports": set()
        }

        port_scan_cache[cache_key] = entry

    entry["ports"].add(
        remote_port
    )

    if len(
            entry["ports"]
    ) >= 20:

        create_alert_if_not_exists(
            db,
            "Port Scanning Activity",
            f"{remote_ip}",
            "High",
            "T1046",
            agent_id
        )

def detect_malware_drop(
        db,
        file_path: str,
        agent_id: int):

    file_path = file_path.lower()

    suspicious_files = [

        "payload.exe",

        "evil.exe",

        "backdoor.exe",

        "malware.exe"

    ]

    if any(

            name in file_path

            for name in suspicious_files):

        create_alert_if_not_exists(
            db,
            "Possible Malware Drop",
            file_path,
            "High",
            "T1105",
            agent_id
        )

def detect_writable_directory_execution(
        db,
        file_path: str,
        agent_id: int):

    file_path = file_path.lower()

    suspicious_paths = [

        "c:\\temp",

        "c:\\users\\public",

        "c:\\programdata",

        "/tmp",

        "/dev/shm"

    ]

    if any(

            path in file_path

            for path in suspicious_paths):

        create_alert_if_not_exists(
            db,
            "Writable Directory Execution",
            file_path,
            "High",
            "T1204",
            agent_id
        )

def detect_ransomware(
        db,
        event_type: str,
        file_path: str,
        agent_id: int):

    if event_type == "modified":

        now = datetime.utcnow()

        entry = ransomware_cache.get(agent_id)

        if (
            not entry
            or now - entry["started_at"] > RANSOMWARE_WINDOW
        ):

            entry = {
                "started_at": now,
                "count": 0
            }

            ransomware_cache[agent_id] = entry

        entry["count"] += 1

        if entry["count"] >= 100:

            create_alert_if_not_exists(
                db,
                "Possible Ransomware Activity",
                "Mass file modifications",
                "Critical",
                "T1486",
                agent_id
            )

def detect_certutil(
        db,
        process_name: str,
        cmdline: str,
        agent_id: int):

    process_name = process_name.lower()
    cmdline = cmdline.lower()

    if (
            process_name == "certutil.exe"
            and (
                "-urlcache" in cmdline
                or "-decode" in cmdline
            )
    ):

        create_alert_if_not_exists(
            db,
            "Certutil Abuse",
            cmdline,
            "High",
            "T1105",
            agent_id
        )

def detect_rundll32(
        db,
        process_name: str,
        cmdline: str,
        agent_id: int):

    process_name = process_name.lower()

    if process_name == "rundll32.exe":

        create_alert_if_not_exists(
            db,
            "Rundll32 Execution",
            cmdline,
            "Medium",
            "T1218.011",
            agent_id
        )

def detect_regsvr32(
        db,
        process_name: str,
        cmdline: str,
        agent_id: int):

    process_name = process_name.lower()

    if process_name == "regsvr32.exe":

        create_alert_if_not_exists(
            db,
            "Regsvr32 Execution",
            cmdline,
            "High",
            "T1218.010",
            agent_id
        )

def detect_mshta(
        db,
        process_name: str,
        cmdline: str,
        agent_id: int):

    process_name = process_name.lower()

    if process_name == "mshta.exe":

        create_alert_if_not_exists(
            db,
            "Mshta Execution",
            cmdline,
            "High",
            "T1218.005",
            agent_id
        )

def detect_wmic(
        db,
        process_name: str,
        cmdline: str,
        agent_id: int):

    process_name = process_name.lower()

    if process_name == "wmic.exe":

        create_alert_if_not_exists(
            db,
            "WMIC Execution",
            cmdline,
            "Medium",
            "T1047",
            agent_id
        )

def detect_parent_child(
        db,
        parent_process: str,
        child_process: str,
        cmdline: str,
        agent_id: int):

    parent_process = parent_process.lower()

    child_process = child_process.lower()

    suspicious_pairs = [

        ("winword.exe", "powershell.exe"),

        ("winword.exe", "cmd.exe"),

        ("excel.exe", "powershell.exe"),

        ("excel.exe", "cmd.exe"),

        ("outlook.exe", "wscript.exe"),

        ("acrord32.exe", "powershell.exe")

    ]

    if (
            parent_process,
            child_process
    ) in suspicious_pairs:

        create_alert_if_not_exists(
            db,
            "Suspicious Parent-Child Process",
            f"{parent_process} -> {child_process}",
            "High",
            "T1204",
            agent_id
        )

def detect_registry_persistence(
        db,
        persistence_type: str,
        entry_name: str,
        entry_path: str,
        agent_id: int):

    persistence_type = persistence_type.lower()

    if persistence_type == "registry":

        create_alert_if_not_exists(
            db,
            "Registry Persistence",
            entry_path,
            "High",
            "T1547",
            agent_id
        )

def detect_service_persistence(
        db,
        persistence_type: str,
        entry_name: str,
        entry_path: str,
        agent_id: int):

    if persistence_type.lower() == "service":

        create_alert_if_not_exists(
            db,
            "Service Persistence",
            entry_name,
            "High",
            "T1547",
            agent_id
        )

def detect_scheduled_task(
        db,
        persistence_type: str,
        entry_name: str,
        entry_path: str,
        agent_id: int):

    if persistence_type.lower() == "scheduledtask":

        create_alert_if_not_exists(
            db,
            "Scheduled Task Persistence",
            entry_name,
            "High",
            "T1547",
            agent_id
        )

def detect_cron_persistence(
        db,
        persistence_type: str,
        entry_name: str,
        entry_path: str,
        agent_id: int):

    if persistence_type.lower() == "cron":

        create_alert_if_not_exists(
            db,
            "Cron Persistence",
            entry_name,
            "High",
            "T1547",
            agent_id
        )



