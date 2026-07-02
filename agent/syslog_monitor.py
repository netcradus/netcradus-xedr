"""
Syslog collector for SentryXDR agent.

Tails standard syslog files on Linux/macOS and ships new lines to the backend.
Supports RFC 3164 syslog format and common multi-line journal formats.
Tracks byte offsets across polls so only new lines are shipped.
"""
import os
import platform
import re
import time
import requests
from datetime import datetime

# RFC 3164: "MMM  d HH:MM:SS hostname process[pid]: message"
_SYSLOG_RE = re.compile(
    r"^(?:<\d+>)?(\w{3}\s+\d+\s+\d{2}:\d{2}:\d{2})\s+"
    r"(\S+)\s+([^\[\s:]+)(?:\[(\d+)\])?:?\s*(.*)"
)

# Default log paths to tail (skipped if they don't exist)
_DEFAULT_PATHS = [
    "/var/log/syslog",
    "/var/log/auth.log",
    "/var/log/secure",
    "/var/log/messages",
    "/var/log/kern.log",
]

# Module-level offset state — persists across poll cycles
_offsets: dict[str, int] = {}


def _infer_severity(message: str) -> str:
    m = message.lower()
    if any(k in m for k in ("crit", "emerg", "panic", "fatal")):
        return "critical"
    if any(k in m for k in ("error", "err ", "failed", "failure")):
        return "error"
    if any(k in m for k in ("warn", "warning")):
        return "warning"
    return "info"


def _parse_line(line: str) -> dict | None:
    line = line.rstrip("\n\r")
    if not line.strip():
        return None

    m = _SYSLOG_RE.match(line)
    if m:
        ts_str, hostname, process, pid, message = m.groups()
        try:
            ts = datetime.strptime(
                f"{datetime.utcnow().year} {ts_str.strip()}",
                "%Y %b %d %H:%M:%S",
            )
        except ValueError:
            ts = datetime.utcnow()
    else:
        # Unrecognised format — ship the raw line
        hostname = None
        process  = None
        message  = line
        ts       = datetime.utcnow()

    return {
        "log_source":   "syslog",
        "raw_message":  line,
        "severity":     _infer_severity(message),
        "hostname":     hostname,
        "process_name": process,
        "log_message":  message,
        "timestamp":    ts.isoformat(),
    }


def _read_new_lines(path: str, max_bytes: int = 512 * 1024) -> list[str]:
    """Return lines added since the last poll, up to max_bytes."""
    try:
        stat = os.stat(path)
    except OSError:
        return []

    last = _offsets.get(path, stat.st_size)  # initialise to EOF on first run

    # Log rotation: file is shorter than our saved offset
    if stat.st_size < last:
        last = 0

    if stat.st_size == last:
        return []

    try:
        with open(path, "r", errors="replace") as f:
            f.seek(last)
            chunk = f.read(max_bytes)
            _offsets[path] = f.tell()
        return chunk.splitlines()
    except OSError:
        return []


def collect_syslog(server_url: str, agent_token: str, paths: list | None = None) -> None:
    if platform.system() == "Windows":
        return

    targets = paths or _DEFAULT_PATHS
    entries: list[dict] = []

    for path in targets:
        for line in _read_new_lines(path):
            parsed = _parse_line(line)
            if parsed:
                entries.append(parsed)

    if not entries:
        return

    try:
        requests.post(
            f"{server_url}/telemetry/logs",
            json={"agent_token": agent_token, "entries": entries},
            timeout=10,
        )
    except Exception:
        pass
