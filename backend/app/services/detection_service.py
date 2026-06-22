from sqlalchemy.orm import Session

from app.models.alert import Alert
from app.models.agent import Agent
from collections import defaultdict
port_scan_cache = defaultdict(set)
ransomware_cache = defaultdict(int)


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

        alert = Alert(

            title="Encoded PowerShell Execution",

            description=cmdline,

            severity="High",

            mitre_technique="T1059.001",

            agent_id=agent_id

        )

        db.add(alert)

        db.commit()

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

        alert = Alert(

            title="Mimikatz Credential Dumping",

            description=cmdline,

            severity="Critical",

            mitre_technique="T1003",

            agent_id=agent_id

        )

        db.add(alert)

        db.commit()

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

        alert = Alert(

            title="LSASS Dump Attempt",

            description=cmdline,

            severity="Critical",

            mitre_technique="T1003.001",

            agent_id=agent_id

        )

        db.add(alert)

        db.commit()

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

        alert = Alert(

            title="PsExec Remote Execution",

            description=cmdline,

            severity="High",

            mitre_technique="T1021",

            agent_id=agent_id

        )

        db.add(alert)

        db.commit()

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

        alert = Alert(

            title="Possible Reverse Shell",

            description=f"{remote_ip}:{remote_port}",

            severity="Critical",

            mitre_technique="T1059",

            agent_id=agent_id

        )

        db.add(alert)

        db.commit()

def detect_port_scan(
        db,
        remote_ip: str,
        remote_port: int,
        agent_id: int):

    port_scan_cache[remote_ip].add(
        remote_port
    )

    if len(
            port_scan_cache[remote_ip]
    ) >= 20:

        alert = Alert(

            title="Port Scanning Activity",

            description=f"{remote_ip}",

            severity="High",

            mitre_technique="T1046",

            agent_id=agent_id

        )

        db.add(alert)

        db.commit()

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

        alert = Alert(

            title="Possible Malware Drop",

            description=file_path,

            severity="High",

            mitre_technique="T1105",

            agent_id=agent_id

        )

        db.add(alert)

        db.commit()

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

        alert = Alert(

            title="Writable Directory Execution",

            description=file_path,

            severity="High",

            mitre_technique="T1204",

            agent_id=agent_id

        )

        db.add(alert)

        db.commit()

def detect_ransomware(
        db,
        event_type: str,
        file_path: str,
        agent_id: int):

    if event_type == "modified":

        ransomware_cache[agent_id] += 1

        if ransomware_cache[agent_id] >= 100:

            alert = Alert(

                title="Possible Ransomware Activity",

                description="Mass file modifications",

                severity="Critical",

                mitre_technique="T1486",

                agent_id=agent_id

            )

            db.add(alert)

            db.commit()

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

        alert = Alert(

            title="Certutil Abuse",

            description=cmdline,

            severity="High",

            mitre_technique="T1105",

            agent_id=agent_id

        )

        db.add(alert)

        db.commit()

def detect_rundll32(
        db,
        process_name: str,
        cmdline: str,
        agent_id: int):

    process_name = process_name.lower()

    if process_name == "rundll32.exe":

        alert = Alert(

            title="Rundll32 Execution",

            description=cmdline,

            severity="Medium",

            mitre_technique="T1218.011",

            agent_id=agent_id

        )

        db.add(alert)

        db.commit()

def detect_regsvr32(
        db,
        process_name: str,
        cmdline: str,
        agent_id: int):

    process_name = process_name.lower()

    if process_name == "regsvr32.exe":

        alert = Alert(

            title="Regsvr32 Execution",

            description=cmdline,

            severity="High",

            mitre_technique="T1218.010",

            agent_id=agent_id

        )

        db.add(alert)

        db.commit()

def detect_mshta(
        db,
        process_name: str,
        cmdline: str,
        agent_id: int):

    process_name = process_name.lower()

    if process_name == "mshta.exe":

        alert = Alert(

            title="Mshta Execution",

            description=cmdline,

            severity="High",

            mitre_technique="T1218.005",

            agent_id=agent_id

        )

        db.add(alert)

        db.commit()

def detect_wmic(
        db,
        process_name: str,
        cmdline: str,
        agent_id: int):

    process_name = process_name.lower()

    if process_name == "wmic.exe":

        alert = Alert(

            title="WMIC Execution",

            description=cmdline,

            severity="Medium",

            mitre_technique="T1047",

            agent_id=agent_id

        )

        db.add(alert)

        db.commit()

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

        alert = Alert(

            title="Suspicious Parent-Child Process",

            description=f"{parent_process} -> {child_process}",

            severity="High",

            mitre_technique="T1204",

            agent_id=agent_id

        )

        db.add(alert)

        db.commit()

def detect_registry_persistence(
        db,
        persistence_type: str,
        entry_name: str,
        entry_path: str,
        agent_id: int):

    persistence_type = persistence_type.lower()

    if persistence_type == "registry":

        alert = Alert(

            title="Registry Persistence",

            description=entry_path,

            severity="High",

            mitre_technique="T1547",

            agent_id=agent_id

        )

        db.add(alert)

        db.commit()

def detect_service_persistence(
        db,
        persistence_type: str,
        entry_name: str,
        entry_path: str,
        agent_id: int):

    if persistence_type.lower() == "service":

        alert = Alert(

            title="Service Persistence",

            description=entry_name,

            severity="High",

            mitre_technique="T1547",

            agent_id=agent_id

        )

        db.add(alert)

        db.commit()

def detect_scheduled_task(
        db,
        persistence_type: str,
        entry_name: str,
        entry_path: str,
        agent_id: int):

    if persistence_type.lower() == "scheduledtask":

        alert = Alert(

            title="Scheduled Task Persistence",

            description=entry_name,

            severity="High",

            mitre_technique="T1547",

            agent_id=agent_id

        )

        db.add(alert)

        db.commit()

def detect_cron_persistence(
        db,
        persistence_type: str,
        entry_name: str,
        entry_path: str,
        agent_id: int):

    if persistence_type.lower() == "cron":

        alert = Alert(

            title="Cron Persistence",

            description=entry_name,

            severity="High",

            mitre_technique="T1547",

            agent_id=agent_id

        )

        db.add(alert)

        db.commit()



