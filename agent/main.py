import json
import os
import platform
import socket
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


# Load configuration
CONFIG_PATH = os.path.join(
    os.path.dirname(__file__),
    "config.json"
)

with open(CONFIG_PATH, "r") as f:
    config = json.load(f)

SERVER_URL = os.getenv(
    "SENTRYXDR_SERVER_URL",
    config["server_url"]
)

AGENT_TOKEN = os.getenv(
    "SENTRYXDR_AGENT_TOKEN",
    config.get("agent_token", "")
)

POLL_INTERVAL = config.get("poll_interval", 10)

# Log source configuration
_LOG_CFG = config.get("log_sources", {})


def register_agent_if_needed():

    global AGENT_TOKEN

    if AGENT_TOKEN:

        return

    hostname = socket.gethostname()

    response = requests.post(
        f"{SERVER_URL}/agents/register",
        json={
            "hostname": hostname,
            "ip_address": socket.gethostbyname(hostname),
            "os_type": platform.system(),
            "agent_version": "1.0.0",
            "registration_token": os.getenv(
                "SENTRYXDR_AGENT_REGISTRATION_TOKEN",
                config.get("registration_token", "")
            )
        },
        timeout=10
    )

    response.raise_for_status()

    data = response.json()

    AGENT_TOKEN = data["agent_token"]

    config["agent_token"] = AGENT_TOKEN

    with open(CONFIG_PATH, "w") as f:

        json.dump(
            config,
            f,
            indent=2
        )


def _collect_logs():
    """Collect from all enabled log sources."""
    syslog_cfg = _LOG_CFG.get("syslog", {})
    if syslog_cfg.get("enabled", True):
        collect_syslog(
            SERVER_URL, AGENT_TOKEN,
            paths=syslog_cfg.get("paths"),
        )

    winevent_cfg = _LOG_CFG.get("windows_event", {})
    if winevent_cfg.get("enabled", True):
        collect_windows_events(
            SERVER_URL, AGENT_TOKEN,
            channels=winevent_cfg.get("channels"),
        )

    web_cfg = _LOG_CFG.get("web_logs", {})
    if web_cfg.get("enabled", False):
        collect_web_logs(
            SERVER_URL, AGENT_TOKEN,
            sources=web_cfg.get("sources", []),
        )

    app_cfg = _LOG_CFG.get("app_logs", {})
    if app_cfg.get("enabled", False):
        collect_app_logs(
            SERVER_URL, AGENT_TOKEN,
            sources=app_cfg.get("paths", []),
        )


def main():

    print("===== SentryXDR Agent Started =====")

    register_agent_if_needed()

    observer = start_file_monitor(
        SERVER_URL,
        AGENT_TOKEN
    )

    try:

        while True:

            # Endpoint telemetry
            collect_processes(SERVER_URL, AGENT_TOKEN)
            collect_network(SERVER_URL, AGENT_TOKEN)
            collect_persistence(SERVER_URL, AGENT_TOKEN)

            # Log ingestion (syslog / Windows Event Log / web logs / app logs)
            _collect_logs()

            # Heartbeat + command polling
            send_heartbeat(SERVER_URL, AGENT_TOKEN)
            execute_command(SERVER_URL, AGENT_TOKEN)

            time.sleep(POLL_INTERVAL)

    except KeyboardInterrupt:

        print("\nStopping SentryXDR Agent...")
        observer.stop()
        observer.join()
        print("Agent stopped successfully.")

    except Exception as e:

        print(f"[ERROR] {e}")

if __name__ == "__main__":
    main()
