"""
Web log collector for SentryXDR agent.

Tails IIS (W3C Extended Log Format), Apache, and Nginx (Combined/Common Log
Format) log files and ships new lines to the backend.

Configuration example (in config.json):
  "log_sources": {
    "web_logs": {
      "enabled": true,
      "sources": [
        {"type": "apache", "path": "/var/log/apache2/access.log"},
        {"type": "nginx",  "path": "/var/log/nginx/access.log"},
        {"type": "iis",    "path": "C:/inetpub/logs/LogFiles/W3SVC1/u_ex*.log"}
      ]
    }
  }
"""
import os
import re
import glob
import requests
from datetime import datetime, timezone

# Combined/Common Log Format
# 127.0.0.1 - frank [10/Oct/2000:13:55:36 -0700] "GET /apache_pb.gif HTTP/1.0" 200 2326 "referer" "UA"
_CLF_RE = re.compile(
    r'(\S+)\s+\S+\s+(\S+)\s+\[([^\]]+)\]\s+"(\w+)\s+(\S+)\s+\S+"\s+(\d+)\s+(\S+)'
    r'(?:\s+"([^"]*)"\s+"([^"]*)")?'
)

# IIS W3C Extended Log Format fields line starts with #Fields:
_IIS_FIELD_HEADER = "#Fields:"
_IIS_COMMENT_RE   = re.compile(r"^#")

# Byte offset tracking per file path
_offsets: dict[str, int] = {}

# IIS field order is declared in #Fields header — cached per file
_iis_fields: dict[str, list[str]] = {}


def _read_new_lines(path: str, max_bytes: int = 1024 * 1024) -> list[str]:
    try:
        stat = os.stat(path)
    except OSError:
        return []

    last = _offsets.get(path, stat.st_size)  # skip to EOF on first run
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


def _parse_clf(line: str, log_source: str) -> dict | None:
    m = _CLF_RE.match(line)
    if not m:
        return None
    client_ip, user, ts_str, method, path, status, size, referer, ua = (
        m.group(1), m.group(2), m.group(3), m.group(4),
        m.group(5), m.group(6), m.group(7), m.group(8) or "", m.group(9) or "",
    )
    try:
        ts = datetime.strptime(ts_str.split()[0], "%d/%b/%Y:%H:%M:%S")
    except ValueError:
        ts = datetime.utcnow()

    severity = "info"
    if status.startswith("5"):
        severity = "error"
    elif status.startswith("4") and status != "404":
        severity = "warning"

    return {
        "log_source":  log_source,
        "raw_message": line,
        "severity":    severity,
        "source_ip":   client_ip if client_ip != "-" else None,
        "username":    user if user != "-" else None,
        "log_message": f"{method} {path}",
        "extra":       {
            "method":      method,
            "path":        path,
            "status_code": int(status),
            "bytes":       int(size) if size.isdigit() else 0,
            "user_agent":  ua,
            "referer":     referer,
        },
        "timestamp": ts.isoformat(),
    }


def _parse_iis_line(line: str, fields: list[str], path: str) -> dict | None:
    if _IIS_COMMENT_RE.match(line):
        if line.startswith(_IIS_FIELD_HEADER):
            _iis_fields[path] = line[len(_IIS_FIELD_HEADER):].strip().split()
        return None

    cols = line.split()
    if not cols or not fields:
        return None

    row = dict(zip(fields, cols))

    date_str = row.get("date", "")
    time_str = row.get("time", "")
    try:
        ts = datetime.strptime(f"{date_str} {time_str}", "%Y-%m-%d %H:%M:%S")
    except ValueError:
        ts = datetime.utcnow()

    method  = row.get("cs-method", "")
    uri     = row.get("cs-uri-stem", "")
    query   = row.get("cs-uri-query", "")
    full    = f"{uri}?{query}" if query and query != "-" else uri
    status  = row.get("sc-status", "")
    ua      = row.get("cs(User-Agent)", "")
    client  = row.get("c-ip", None)
    bytes_s = row.get("sc-bytes", "0")

    severity = "info"
    if status.startswith("5"):
        severity = "error"
    elif status.startswith("4") and status not in ("400", "404"):
        severity = "warning"

    return {
        "log_source":  "iis",
        "raw_message": line,
        "severity":    severity,
        "source_ip":   client if client not in (None, "-", "") else None,
        "log_message": f"{method} {full}",
        "extra":       {
            "method":      method,
            "path":        full,
            "status_code": int(status) if status.isdigit() else 0,
            "bytes":       int(bytes_s) if bytes_s.isdigit() else 0,
            "user_agent":  ua,
        },
        "timestamp": ts.isoformat(),
    }


def collect_web_logs(server_url: str, agent_token: str, sources: list | None = None) -> None:
    if not sources:
        return

    entries: list[dict] = []

    for src in sources:
        log_type = src.get("type", "apache").lower()
        pattern  = src.get("path", "")

        # Expand glob patterns (common for IIS rotating logs)
        paths = sorted(glob.glob(pattern)) if "*" in pattern else [pattern]

        for path in paths:
            lines = _read_new_lines(path)
            for line in lines:
                if not line.strip():
                    continue
                if log_type == "iis":
                    fields = _iis_fields.get(path, [])
                    parsed = _parse_iis_line(line, fields, path)
                else:
                    # apache or nginx — both use CLF/Combined
                    parsed = _parse_clf(line, log_type)

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
