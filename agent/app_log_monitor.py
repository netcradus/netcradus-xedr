"""
Generic application log collector for NetcradXDR agent.

Tails any configured log file, auto-detects severity from common log patterns,
and ships new lines to the backend.

Supported log formats (auto-detected):
  - Python logging: "2024-01-01 12:00:00,123 ERROR module: message"
  - Log4j / Java:   "2024-01-01 12:00:00 ERROR com.example: message"
  - syslog-style:   "[ERROR] 2024-01-01 12:00:00 message"
  - Bracket-style:  "[2024-01-01T12:00:00] [ERROR] message"
  - Generic         (ship raw, severity=info)

Configuration example (in config.json):
  "log_sources": {
    "app_logs": {
      "enabled": true,
      "paths": [
        {"path": "/var/log/myapp/app.log",  "label": "myapp"},
        {"path": "C:/App/Logs/error.log",   "label": "winapp"}
      ]
    }
  }
"""
import os
import re
import requests
from datetime import datetime

# Patterns tried in order — first match wins
_PATTERNS = [
    # Python logging: 2024-01-01 12:00:00,123 LEVEL logger: message
    re.compile(
        r"^(\d{4}-\d{2}-\d{2}[\sT]\d{2}:\d{2}:\d{2})[,.\d]*\s+(DEBUG|INFO|WARNING|WARN|ERROR|CRITICAL|FATAL)\s+\S+:\s*(.*)",
        re.IGNORECASE,
    ),
    # Log4j: 2024-01-01 12:00:00 LEVEL class - message
    re.compile(
        r"^(\d{4}-\d{2}-\d{2}[\sT]\d{2}:\d{2}:\d{2})\s+(DEBUG|INFO|WARN(?:ING)?|ERROR|CRITICAL|FATAL)\s+\S+\s+-\s*(.*)",
        re.IGNORECASE,
    ),
    # Bracket level: [ERROR] 2024-01-01T12:00:00 message
    re.compile(
        r"^\[(DEBUG|INFO|WARN(?:ING)?|ERROR|CRITICAL|FATAL)\]\s+(\d{4}-\d{2}-\d{2}[\sT]\d{2}:\d{2}:\d{2})\s*(.*)",
        re.IGNORECASE,
    ),
    # ISO bracket timestamp: [2024-01-01T12:00:00] [LEVEL] message
    re.compile(
        r"^\[(\d{4}-\d{2}-\d{2}[\sT]\d{2}:\d{2}:\d{2})[^\]]*\]\s+\[(DEBUG|INFO|WARN(?:ING)?|ERROR|CRITICAL|FATAL)\]\s*(.*)",
        re.IGNORECASE,
    ),
]

_LEVEL_MAP = {
    "debug": "info", "info": "info", "notice": "info",
    "warn": "warning", "warning": "warning",
    "error": "error", "err": "error",
    "critical": "critical", "fatal": "critical",
}

_offsets: dict[str, int] = {}


def _normalize_level(raw: str) -> str:
    return _LEVEL_MAP.get(raw.lower(), "info")


def _parse_line(line: str, label: str) -> dict | None:
    line = line.rstrip("\n\r")
    if not line.strip():
        return None

    ts  = None
    sev = "info"
    msg = line

    for pat in _PATTERNS:
        m = pat.match(line)
        if not m:
            continue
        groups = m.groups()
        # group order depends on the pattern — figure out which is ts vs level vs msg
        if len(groups) == 3:
            g0, g1, g2 = groups
            # Determine which group is timestamp vs level
            if re.match(r"\d{4}-\d{2}-\d{2}", g0):
                ts_str, level, msg = g0, g1, g2
            else:
                level, ts_str, msg = g0, g1, g2
            try:
                ts_str_clean = ts_str.replace("T", " ")
                ts = datetime.strptime(ts_str_clean[:19], "%Y-%m-%d %H:%M:%S")
            except ValueError:
                ts = None
            sev = _normalize_level(level)
        break

    if ts is None:
        ts = datetime.utcnow()

    # Infer severity from raw content when pattern didn't find a level
    if sev == "info":
        low = line.lower()
        if any(k in low for k in ("fatal", "panic", "critical")):
            sev = "critical"
        elif "error" in low or "exception" in low or "traceback" in low:
            sev = "error"
        elif "warn" in low:
            sev = "warning"

    return {
        "log_source":   "application",
        "raw_message":  line,
        "severity":     sev,
        "log_message":  msg.strip() or line,
        "process_name": label,
        "timestamp":    ts.isoformat(),
    }


def _read_new_lines(path: str, max_bytes: int = 512 * 1024) -> list[str]:
    try:
        stat = os.stat(path)
    except OSError:
        return []

    last = _offsets.get(path, stat.st_size)
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


def collect_app_logs(server_url: str, agent_token: str, sources: list | None = None) -> None:
    if not sources:
        return

    entries: list[dict] = []

    for src in sources:
        path  = src.get("path", "")
        label = src.get("label", os.path.basename(path))
        if not path or not os.path.exists(path):
            continue

        for line in _read_new_lines(path):
            parsed = _parse_line(line, label)
            if parsed:
                entries.append(parsed)

    if not entries:
        return

    batch_size = 500
    for i in range(0, len(entries), batch_size):
        try:
            requests.post(
                f"{server_url}/telemetry/logs",
                json={"agent_token": agent_token, "entries": entries[i : i + batch_size]},
                timeout=10,
            )
        except Exception:
            pass
