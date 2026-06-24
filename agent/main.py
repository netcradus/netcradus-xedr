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


def main():

    print("===== SentryXDR Agent Started =====")

    register_agent_if_needed()

    observer = start_file_monitor(
        SERVER_URL,
        AGENT_TOKEN
    )

    try:

        while True:

            # Process telemetry
            collect_processes(
                SERVER_URL,
                AGENT_TOKEN
            )

            # Network telemetry
            collect_network(
                SERVER_URL,
                AGENT_TOKEN
            )

            # Persistence telemetry
            collect_persistence(
                SERVER_URL,
                AGENT_TOKEN
            )

            # Heartbeat
            send_heartbeat(
                SERVER_URL,
                AGENT_TOKEN
            )

            # Execute commands
            execute_command(
                SERVER_URL,
                AGENT_TOKEN
            )


            time.sleep(
                POLL_INTERVAL
            )

    except KeyboardInterrupt:

        print("\nStopping SentryXDR Agent...")

        observer.stop()

        observer.join()

        print("Agent stopped successfully.")

    except Exception as e:

        print(
            f"[ERROR] {e}"
        )

if __name__ == "__main__":
    main()
