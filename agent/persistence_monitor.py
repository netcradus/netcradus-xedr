import requests
import winreg
import subprocess


def collect_persistence(
        server_url,
        agent_token):

    entries = []

    #
    # Registry Run Keys
    #

    locations = [

        (
            winreg.HKEY_CURRENT_USER,
            r"Software\Microsoft\Windows\CurrentVersion\Run"
        ),

        (
            winreg.HKEY_LOCAL_MACHINE,
            r"Software\Microsoft\Windows\CurrentVersion\Run"
        )

    ]

    for hive, path in locations:

        try:

            key = winreg.OpenKey(
                hive,
                path
            )

            index = 0

            while True:

                try:

                    name, value, _ = winreg.EnumValue(
                        key,
                        index
                    )

                    entries.append(

                        {

                            "persistence_type":
                            "Registry",

                            "entry_name":
                            name,

                            "entry_path":
                            value

                        }

                    )

                    index += 1

                except OSError:

                    break

        except:

            pass

    #
    # Services
    #

    try:

        output = subprocess.check_output(

            "sc query",

            shell=True,

            text=True

        )

        for line in output.splitlines():

            if "SERVICE_NAME:" in line:

                service_name = line.split(":")[1].strip()

                entries.append(

                    {

                        "persistence_type":
                        "Service",

                        "entry_name":
                        service_name,

                        "entry_path":
                        ""

                    }

                )

    except:

        pass

    #
    # Scheduled Tasks
    #

    try:

        output = subprocess.check_output(

            "schtasks /query /fo csv",

            shell=True,

            text=True

        )

        lines = output.splitlines()

        for line in lines[1:]:

            task = line.split(",")

            if task:

                entries.append(

                    {

                        "persistence_type":
                        "ScheduledTask",

                        "entry_name":
                        task[0].replace('"', ''),

                        "entry_path":
                        ""

                    }

                )

    except:

        pass

    #
    # Send to backend
    #

    try:

        requests.post(

            f"{server_url}/telemetry/persistence",

            json={

                "agent_token":
                agent_token,

                "entries":
                entries

            }

        )

    except Exception as e:

        print(e)