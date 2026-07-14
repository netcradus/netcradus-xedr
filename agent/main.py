import json
import os
import platform
import socket
import sys
import time
import requests

from process_monitor import collect_processes
from network_monitor import collect_network
from file_monitor import start_file_monitor
from persistence_monitor import collect_persistence
from command_executor import execute_command
from heartbeat import send_heartbeat
from syslog_monitor import collect_syslog
from windows_event_log_monitor import collect_windows_events
from web_log_monitor import collect_web_logs
from app_log_monitor import collect_app_logs
from update_manager import check_and_apply
from vuln_scanner import run_all_checks


# ── Configuration ──────────────────────────────────────────────────────────────

CONFIG_PATH = os.path.join(os.path.dirname(__file__), "config.json")

with open(CONFIG_PATH, "r") as f:
    config = json.load(f)

# server_url already contains /api/v1 — do not append it again
SERVER_URL = os.getenv(
    "NETCRADXDR_SERVER_URL",
    config["server_url"],
).rstrip("/")

AGENT_TOKEN = os.getenv(
    "NETCRADXDR_AGENT_TOKEN",
    config.get("agent_token", ""),
)

POLL_INTERVAL = config.get("poll_interval", 10)

# Update check runs every N poll cycles (default 6 × 10 s = every 60 s)
UPDATE_CHECK_INTERVAL = config.get("update_check_interval", 6)

# Vulnerability scan runs every N cycles (default 360 × 10 s = every 60 min)
VULN_SCAN_INTERVAL = config.get("vuln_scan_interval", 360)

_LOG_CFG = config.get("log_sources", {})


# ── Agent registration ─────────────────────────────────────────────────────────

def register_agent_if_needed():
    global AGENT_TOKEN

    if AGENT_TOKEN:
        return

    hostname = socket.gethostname()
    response = requests.post(
        f"{SERVER_URL}/agents/register",
        json={
            "hostname":           hostname,
            "ip_address":         socket.gethostbyname(hostname),
            "os_type":            platform.system(),
            "agent_version":      config.get("agent_version", "1.0.0"),
            "registration_token": os.getenv(
                "NETCRADXDR_AGENT_REGISTRATION_TOKEN",
                config.get("registration_token", ""),
            ),
        },
        timeout=10,
    )
    response.raise_for_status()
    data = response.json()

    AGENT_TOKEN = data["agent_token"]
    config["agent_token"] = AGENT_TOKEN
    with open(CONFIG_PATH, "w") as f:
        json.dump(config, f, indent=2)


# ── Log collection ─────────────────────────────────────────────────────────────

def _collect_logs():
    syslog_cfg = _LOG_CFG.get("syslog", {})
    if syslog_cfg.get("enabled", True):
        collect_syslog(SERVER_URL, AGENT_TOKEN, paths=syslog_cfg.get("paths"))

    winevent_cfg = _LOG_CFG.get("windows_event", {})
    if winevent_cfg.get("enabled", True):
        collect_windows_events(SERVER_URL, AGENT_TOKEN, channels=winevent_cfg.get("channels"))

    web_cfg = _LOG_CFG.get("web_logs", {})
    if web_cfg.get("enabled", False):
        collect_web_logs(SERVER_URL, AGENT_TOKEN, sources=web_cfg.get("sources", []))

    app_cfg = _LOG_CFG.get("app_logs", {})
    if app_cfg.get("enabled", False):
        collect_app_logs(SERVER_URL, AGENT_TOKEN, sources=app_cfg.get("paths", []))


# ── Main loop ──────────────────────────────────────────────────────────────────

def main():
    print("===== NetcradXDR Agent Started =====")
    register_agent_if_needed()

    observer = start_file_monitor(SERVER_URL, AGENT_TOKEN)
    cycle = 0

    try:
        while True:
            # Endpoint telemetry
            collect_processes(SERVER_URL, AGENT_TOKEN)
            collect_network(SERVER_URL, AGENT_TOKEN)
            collect_persistence(SERVER_URL, AGENT_TOKEN)

            # Log ingestion
            _collect_logs()

            # Heartbeat — response may carry an update signal
            hb_resp = send_heartbeat(SERVER_URL, AGENT_TOKEN)

            # Command polling
            execute_command(SERVER_URL, AGENT_TOKEN)

            # Vulnerability scan (every VULN_SCAN_INTERVAL cycles)
            if cycle % VULN_SCAN_INTERVAL == 0:
                try:
                    print("[vuln] Running vulnerability scan...")
                    findings = run_all_checks()
                    if findings:
                        import requests as _req
                        _req.post(
                            f"{SERVER_URL}/vulnerability/scans",
                            json={"agent_token": AGENT_TOKEN, "findings": findings},
                            timeout=30,
                        )
                        print(f"[vuln] Submitted {len(findings)} finding(s)")
                    else:
                        print("[vuln] No findings")
                except Exception as e:
                    print(f"[vuln] Scan error: {e}")

            # Update check (every UPDATE_CHECK_INTERVAL cycles)
            cycle += 1
            if cycle % UPDATE_CHECK_INTERVAL == 0:
                if check_and_apply(SERVER_URL, AGENT_TOKEN, hb_resp):
                    print("[agent] Exiting for self-update...")
                    observer.stop()
                    observer.join()
                    sys.exit(0)

            time.sleep(POLL_INTERVAL)

    except KeyboardInterrupt:
        print("\nStopping NetcradXDR Agent...")
        observer.stop()
        observer.join()
        print("Agent stopped.")

    except Exception as e:
        print(f"[ERROR] {e}")


if __name__ == "__main__":
    main()
