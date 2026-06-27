import os
import sys
import subprocess
import requests

IS_WINDOWS = sys.platform == "win32"

if IS_WINDOWS:
    import winreg


# ── Windows ───────────────────────────────────────────────────────────────────

def _collect_windows():
    entries = []

    # Registry Run keys
    locations = [
        (winreg.HKEY_CURRENT_USER,  r"Software\Microsoft\Windows\CurrentVersion\Run"),
        (winreg.HKEY_LOCAL_MACHINE, r"Software\Microsoft\Windows\CurrentVersion\Run"),
    ]
    for hive, path in locations:
        try:
            key = winreg.OpenKey(hive, path)
            index = 0
            while True:
                try:
                    name, value, _ = winreg.EnumValue(key, index)
                    entries.append({
                        "persistence_type": "Registry",
                        "entry_name": name,
                        "entry_path": value,
                    })
                    index += 1
                except OSError:
                    break
        except Exception:
            pass

    # Windows services
    try:
        output = subprocess.check_output("sc query", shell=True, text=True)
        for line in output.splitlines():
            if "SERVICE_NAME:" in line:
                entries.append({
                    "persistence_type": "Service",
                    "entry_name": line.split(":")[1].strip(),
                    "entry_path": "",
                })
    except Exception:
        pass

    # Scheduled tasks
    try:
        output = subprocess.check_output("schtasks /query /fo csv", shell=True, text=True)
        for line in output.splitlines()[1:]:
            parts = line.split(",")
            if parts:
                entries.append({
                    "persistence_type": "ScheduledTask",
                    "entry_name": parts[0].replace('"', ''),
                    "entry_path": "",
                })
    except Exception:
        pass

    return entries


# ── Linux ─────────────────────────────────────────────────────────────────────

def _collect_linux():
    entries = []

    # systemd enabled services
    try:
        output = subprocess.check_output(
            [
                "systemctl", "list-unit-files",
                "--type=service", "--state=enabled",
                "--no-pager", "--plain",
            ],
            text=True,
            stderr=subprocess.DEVNULL,
        )
        for line in output.splitlines():
            parts = line.split()
            if parts and parts[0].endswith(".service"):
                entries.append({
                    "persistence_type": "Service",
                    "entry_name": parts[0],
                    "entry_path": "",
                })
    except Exception:
        pass

    # Current user's crontab
    try:
        output = subprocess.check_output(
            ["crontab", "-l"],
            text=True,
            stderr=subprocess.DEVNULL,
        )
        for line in output.splitlines():
            line = line.strip()
            if line and not line.startswith("#"):
                parts = line.split(None, 5)
                cmd = parts[5] if len(parts) >= 6 else line
                entries.append({
                    "persistence_type": "Crontab",
                    "entry_name": cmd,
                    "entry_path": "",
                })
    except Exception:
        pass

    # System-wide cron files
    for cron_dir in ("/etc/cron.d", "/etc/cron.daily", "/etc/cron.weekly", "/etc/cron.monthly"):
        try:
            for fname in os.listdir(cron_dir):
                fpath = os.path.join(cron_dir, fname)
                if os.path.isfile(fpath):
                    entries.append({
                        "persistence_type": "Crontab",
                        "entry_name": fname,
                        "entry_path": fpath,
                    })
        except Exception:
            pass

    # Startup scripts: /etc/rc.local and /etc/profile.d/*
    candidates = ["/etc/rc.local"]
    try:
        for fname in os.listdir("/etc/profile.d"):
            candidates.append(os.path.join("/etc/profile.d", fname))
    except Exception:
        pass

    for fpath in candidates:
        if os.path.isfile(fpath):
            entries.append({
                "persistence_type": "StartupScript",
                "entry_name": os.path.basename(fpath),
                "entry_path": fpath,
            })

    # ~/.bashrc and ~/.profile (common user persistence points)
    for fname in (".bashrc", ".profile", ".bash_profile"):
        fpath = os.path.expanduser(f"~/{fname}")
        if os.path.isfile(fpath):
            entries.append({
                "persistence_type": "StartupScript",
                "entry_name": fname,
                "entry_path": fpath,
            })

    return entries


# ── Entry point ───────────────────────────────────────────────────────────────

def collect_persistence(server_url, agent_token):
    try:
        entries = _collect_windows() if IS_WINDOWS else _collect_linux()
    except Exception as e:
        print(f"[persistence] collection error: {e}")
        entries = []

    try:
        requests.post(
            f"{server_url}/telemetry/persistence",
            json={"agent_token": agent_token, "entries": entries},
            timeout=10,
        )
    except Exception as e:
        print(f"[persistence] send error: {e}")
