import argparse
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
from dns_monitor import collect_dns
from usb_monitor import collect_usb
from command_executor import execute_command
from heartbeat import send_heartbeat
from syslog_monitor import collect_syslog
from windows_event_log_monitor import collect_windows_events
from web_log_monitor import collect_web_logs
from app_log_monitor import collect_app_logs
from update_manager import check_and_apply
from vuln_scanner import run_all_checks
from browser_monitor import run_all_checks as run_browser_checks


# ── Configuration ──────────────────────────────────────────────────────────────

CONFIG_PATH = os.path.join(os.path.dirname(__file__), "config.json")

with open(CONFIG_PATH, "r") as f:
    config = json.load(f)


def _parse_args():
    parser = argparse.ArgumentParser(description="NetcradXDR Agent")
    parser.add_argument("--server", dest="server_url", help="Backend server URL, e.g. http://host:8888/api/v1")
    parser.add_argument("--tenant-api-key", dest="tenant_api_key", help="Tenant API key used for first-time registration")
    parser.add_argument("--registration-token", dest="registration_token", help="Agent registration token")
    parser.add_argument("--agent-token", dest="agent_token", help="Existing agent token (skips registration)")
    return parser.parse_args()


ARGS = _parse_args()

# Precedence: CLI flag > env var > config.json
# server_url already contains /api/v1 — do not append it again
SERVER_URL = (
    ARGS.server_url
    or os.getenv("NETCRADXDR_SERVER_URL")
    or config["server_url"]
).rstrip("/")

AGENT_TOKEN = (
    ARGS.agent_token
    or os.getenv("NETCRADXDR_AGENT_TOKEN")
    or config.get("agent_token", "")
)

POLL_INTERVAL = config.get("poll_interval", 10)

# Update check runs every N poll cycles (default 6 × 10 s = every 60 s)
UPDATE_CHECK_INTERVAL = config.get("update_check_interval", 6)

# Vulnerability scan runs every N cycles (default 360 × 10 s = every 60 min)
VULN_SCAN_INTERVAL = config.get("vuln_scan_interval", 360)

# Browser security scan runs every N cycles (default 720 × 10 s = every 2 hr)
BROWSER_SCAN_INTERVAL = config.get("browser_scan_interval", 720)

_LOG_CFG = config.get("log_sources", {})


# ── Agent registration ─────────────────────────────────────────────────────────

def register_agent_if_needed():
    global AGENT_TOKEN

    if AGENT_TOKEN:
        return

    hostname = socket.gethostname()
    tenant_api_key = (
        ARGS.tenant_api_key
        or os.getenv("NETCRADXDR_TENANT_API_KEY")
        or config.get("tenant_api_key", "")
    )
    payload = {
        "hostname":           hostname,
        "ip_address":         socket.gethostbyname(hostname),
        "os_type":            platform.system(),
        "agent_version":      config.get("agent_version", "1.0.0"),
        "registration_token": (
            ARGS.registration_token
            or os.getenv("NETCRADXDR_AGENT_REGISTRATION_TOKEN")
            or config.get("registration_token", "")
        ),
    }
    # Unset falls back to the shared "Default" tenant server-side; only send
    # this when actually configured.
    if tenant_api_key:
        payload["tenant_api_key"] = tenant_api_key

    response = requests.post(
        f"{SERVER_URL}/agents/register",
        json=payload,
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
            collect_dns(SERVER_URL, AGENT_TOKEN)
            collect_usb(SERVER_URL, AGENT_TOKEN)

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

            # Browser security scan (every BROWSER_SCAN_INTERVAL cycles)
            if cycle % BROWSER_SCAN_INTERVAL == 0:
                try:
                    print("[browser] Running browser security scan...")
                    browser_events = run_browser_checks()
                    if browser_events:
                        import requests as _req
                        _req.post(
                            f"{SERVER_URL}/browser-security/events/ingest",
                            json={"agent_token": AGENT_TOKEN, "events": browser_events},
                            timeout=30,
                        )
                        print(f"[browser] Submitted {len(browser_events)} event(s)")
                    else:
                        print("[browser] No events")
                except Exception as e:
                    print(f"[browser] Scan error: {e}")

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
