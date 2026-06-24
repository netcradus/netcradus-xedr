import psutil
import hashlib
import requests


def calculate_sha256(path):

    try:

        with open(path, "rb") as f:

            return hashlib.sha256(
                f.read()
            ).hexdigest()

    except:

        return ""


def collect_processes(
        server_url,
        agent_token):

    processes = []

    for proc in psutil.process_iter(

            [
                "pid",
                "ppid",
                "name",
                "cmdline",
                "exe",
                "username"

            ]):

        try:

            info = proc.info

            parent_name = ""

            try:

                parent = psutil.Process(
                    info["ppid"]
                )

                parent_name = parent.name()

            except:

                pass

            processes.append({

                "pid": info["pid"],

                "ppid": info["ppid"],

                "parent_process_name": parent_name,

                "process_name": info["name"],

                "cmdline": " ".join(
                    info["cmdline"]
                ),

                "exe_path": info["exe"],

                "username": info["username"],

                "sha256": calculate_sha256(
                    info["exe"]
                )

            })

        except:

            continue

    requests.post(

        f"{server_url}/telemetry/processes",

        json={

            "agent_token": agent_token,

            "processes": processes

        }

    )