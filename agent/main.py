import json
import time

from process_monitor import collect_processes
from network_monitor import collect_network
from file_monitor import start_file_monitor
from persistence_monitor import collect_persistence
from command_executor import execute_command


# Load configuration
with open("config.json", "r") as f:
    config = json.load(f)

SERVER_URL = config["server_url"]
AGENT_TOKEN = config["agent_token"]
POLL_INTERVAL = config.get("poll_interval", 10)


def main():

    print("===== SentryXDR Agent Started =====")

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