import requests

from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler


class FileHandler(FileSystemEventHandler):

    def __init__(
            self,
            server_url,
            agent_token):

        self.server_url = server_url
        self.agent_token = agent_token


    def send_event(
            self,
            event_type,
            file_path):

        try:

            requests.post(

                f"{self.server_url}/telemetry/files",

                json={

                    "agent_token": self.agent_token,

                    "events": [

                        {

                            "event_type": event_type,

                            "file_path": file_path

                        }

                    ]

                },

                timeout=10

            )

        except Exception as e:

            print(e)


    def on_created(
            self,
            event):

        if not event.is_directory:

            self.send_event(
                "created",
                event.src_path
            )


    def on_deleted(
            self,
            event):

        if not event.is_directory:

            self.send_event(
                "deleted",
                event.src_path
            )


    def on_modified(
            self,
            event):

        if not event.is_directory:

            self.send_event(
                "modified",
                event.src_path
            )


def start_file_monitor(
        server_url,
        agent_token):

    handler = FileHandler(
        server_url,
        agent_token
    )

    observer = Observer()

    observer.schedule(

        handler,

        path="C:\\Users",

        recursive=True

    )

    observer.start()

    print(
        "File monitor started..."
    )

    return observer
