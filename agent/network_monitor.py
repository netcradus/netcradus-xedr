import psutil
import requests


def collect_network(
        server_url,
        agent_token):

    connections = []

    for conn in psutil.net_connections():

        try:

            if conn.raddr:

                connections.append({

                    "local_ip": conn.laddr.ip,

                    "remote_ip": conn.raddr.ip,

                    "remote_port": conn.raddr.port,

                    "protocol": "TCP"

                })

        except:

            pass

    requests.post(

        f"{server_url}/telemetry/network",

        json={

            "agent_token": agent_token,

            "connections": connections

        },

        timeout=10

    )
