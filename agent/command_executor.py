import requests
import subprocess
from quarantine_engine import quarantine_file

def execute_command(
        server_url,
        agent_token):

    response = requests.get(

        f"{server_url}/agents/{agent_token}/commands"

    )

    commands = response.json()

    for command in commands:

        command_id = command["id"]

        command_type = command["command_type"]

        argument = command["argument"]

        try:

            if command_type == "kill_process":

                subprocess.run(

                    [
                        "taskkill",
                        "/PID",
                        argument,
                        "/F"

                    ]

                )

            elif command_type == "block_ip":

                subprocess.run(

                    [

                        "netsh",

                        "advfirewall",

                        "firewall",

                        "add",

                        "rule",

                        f"name=Block_{argument}",

                        "dir=out",

                        "action=block",

                        f"remoteip={argument}"

                    ]

                )
            
            elif command_type == "quarantine_file":

                quarantine_file(
                    argument
                )

            elif command_type == "isolate_host":

                subprocess.run(

                    [
                        "netsh",
                        "advfirewall",
                        "set",
                        "allprofiles",
                        "firewallpolicy",
                        "blockinbound,blockoutbound"
                    ]

                )

            elif command_type == "restore_host":
                subprocess.run(

                    [
                        "netsh",
                        "advfirewall",
                        "set",
                        "allprofiles",
                        "firewallpolicy",
                        "blockinbound,allowoutbound"
                    ]

                )

            requests.put(

                f"{server_url}/agents/commands/{command_id}/complete"

            )

        except Exception:

            pass