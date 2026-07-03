import json
import os
import platform
import socket

import requests

_CFG_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "config.json")


def _current_version() -> str:
    try:
        with open(_CFG_PATH) as f:
            return json.load(f).get("agent_version", "1.0.0")
    except Exception:
        return "1.0.0"


def send_heartbeat(server_url: str, agent_token: str) -> dict:
    """
    Send a heartbeat and return the parsed JSON response.
    The response may include update_available / latest_version / download_url / checksum.
    """
    try:
        hostname   = socket.gethostname()
        ip_address = socket.gethostbyname(hostname)
        os_type    = platform.system()

        r = requests.post(
            f"{server_url}/agents/heartbeat",
            json={
                "agent_token":   agent_token,
                "hostname":      hostname,
                "os_type":       os_type,
                "ip_address":    ip_address,
                "agent_version": _current_version(),
            },
            timeout=5,
        )
        r.raise_for_status()
        return r.json()
    except Exception as e:
        print(f"Heartbeat failed: {e}")
        return {}
