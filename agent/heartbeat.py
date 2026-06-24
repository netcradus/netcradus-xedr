import socket
import platform
import requests


def send_heartbeat(
        server_url,
        agent_token):

    try:

        hostname = socket.gethostname()

        ip_address = socket.gethostbyname(
            hostname
        )

        os_type = platform.system()

        requests.post(

            f"{server_url}/agents/heartbeat",

            json={

                "agent_token":
                agent_token,

                "hostname":
                hostname,

                "os_type":
                os_type,

                "ip_address":
                ip_address

            },

            timeout=5

        )

    except Exception as e:

        print(
            f"Heartbeat failed: {e}"
        )