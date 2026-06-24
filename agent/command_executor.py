import requests
import subprocess
from quarantine_engine import quarantine_file


REQUEST_TIMEOUT = 10


def report_command_status(
        server_url,
        agent_token,
        command_id,
        status,
        result=None,
        error=None):

    requests.put(
        f"{server_url}/agents/commands/{command_id}/complete",
        json={
            "agent_token": agent_token,
            "status": status,
            "result": result,
            "error": error
        },
        timeout=REQUEST_TIMEOUT
    )


def execute_command(
        server_url,
        agent_token):

    try:

        response = requests.get(

            f"{server_url}/agents/{agent_token}/commands",

            timeout=REQUEST_TIMEOUT

        )

        response.raise_for_status()

        commands = response.json()

    except Exception as exc:

        print(f"Command polling failed: {exc}")

        return

    for command in commands:

        command_id = command["id"]

        command_type = command["command_type"]

        argument = command["argument"]

        result = ""
        error = None
        return_code = 0

        try:

            if command_type == "kill_process":

                completed = subprocess.run(

                    [
                        "taskkill",
                        "/PID",
                        argument,
                        "/F"

                    ],

                    capture_output=True,

                    text=True

                )

                result = completed.stdout
                return_code = completed.returncode
                error = completed.stderr or None

            elif command_type == "block_ip":

                completed = subprocess.run(

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

                    ],

                    capture_output=True,

                    text=True

                )

                result = completed.stdout
                return_code = completed.returncode
                error = completed.stderr or None
            
            elif command_type == "quarantine_file":

                success = quarantine_file(
                    argument
                )

                if success:

                    result = "File quarantined"

                else:

                    error = "File not quarantined"

            elif command_type == "isolate_host":

                completed = subprocess.run(

                    [
                        "netsh",
                        "advfirewall",
                        "set",
                        "allprofiles",
                        "firewallpolicy",
                        "blockinbound,blockoutbound"
                    ],

                    capture_output=True,

                    text=True

                )

                result = completed.stdout
                return_code = completed.returncode
                error = completed.stderr or None

            elif command_type == "restore_host":
                completed = subprocess.run(

                    [
                        "netsh",
                        "advfirewall",
                        "set",
                        "allprofiles",
                        "firewallpolicy",
                        "blockinbound,allowoutbound"
                    ],

                    capture_output=True,

                    text=True

                )

                result = completed.stdout
                return_code = completed.returncode
                error = completed.stderr or None

            else:

                error = f"Unknown command type: {command_type}"

            if return_code != 0 and not error:

                error = f"Command exited with code {return_code}"

            status = "Failed" if error else "Completed"

            report_command_status(
                server_url,
                agent_token,
                command_id,
                status,
                result,
                error
            )

        except Exception as exc:

            try:

                report_command_status(
                    server_url,
                    agent_token,
                    command_id,
                    "Failed",
                    error=str(exc)
                )

            except Exception:

                pass
