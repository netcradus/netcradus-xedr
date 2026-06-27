import hashlib
import sys
import requests

from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

# Watched path differs by OS:
#   Windows → C:\Users  (all user home directories)
#   Linux   → /home     (same concept)
#   macOS   → /Users
_WATCH_PATHS = {
    "win32":  "C:\\Users",
    "darwin": "/Users",
}
WATCH_PATH = _WATCH_PATHS.get(sys.platform, "/home")


def calculate_hashes(file_path):

    hashes = {
        "sha256": None,
        "md5": None
    }

    try:

        sha256 = hashlib.sha256()
        md5 = hashlib.md5()

        with open(file_path, "rb") as file:

            for chunk in iter(
                    lambda: file.read(1024 * 1024),
                    b""):

                sha256.update(chunk)
                md5.update(chunk)

        hashes["sha256"] = sha256.hexdigest()
        hashes["md5"] = md5.hexdigest()

    except Exception:

        pass

    return hashes


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

            hashes = calculate_hashes(file_path)

            requests.post(

                f"{self.server_url}/telemetry/files",

                json={

                    "agent_token": self.agent_token,

                    "events": [

                        {

                            "event_type": event_type,

                            "file_path": file_path,

                            "sha256": hashes["sha256"],

                            "md5": hashes["md5"]

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

    observer.schedule(handler, path=WATCH_PATH, recursive=True)

    observer.start()

    print(
        "File monitor started..."
    )

    return observer
