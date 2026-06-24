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

                "pid": info.get("pid", 0),

                "ppid": info.get("ppid", 0),

                "parent_process_name": parent_name or "",

                "process_name": info.get("name") or "",

                "cmdline": " ".join(
                    info.get("cmdline") or []
                ),

                "exe_path": info.get("exe") or "",

                "username": info.get("username") or "",

                "sha256": calculate_sha256(
                    info.get("exe") or ""
                )

            })
        except:

            continue
    
    # print(processes[:3])

    response = requests.post(
        f"{server_url}/telemetry/processes",
        json={
            "agent_token": agent_token,
            "processes": processes
        },
        timeout=10
    )

    print("Status:", response.status_code)

    print("Response:", response.text)
