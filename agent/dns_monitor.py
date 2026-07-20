"""
DNS telemetry collector for NetcradXDR agent.

Windows: polls the local DNS resolver cache (`ipconfig /displaydns`) each
cycle and ships resolved records as DNS telemetry. This surfaces successful
resolutions cached by the OS stub resolver — it is not a live packet-level
query capture (that would need a raw-socket/npcap driver plus admin rights),
but it needs no elevated privileges and no extra dependencies.

Linux: there is no standard, reliably readable OS-level DNS cache (systemd-
resolved does not expose cache contents via a stable CLI across distros), so
collection is a no-op on Linux for now.

Note: relies on English-language `ipconfig` output labels; non-English
Windows locales will yield no records.
"""
import re
import subprocess
import sys

import requests

IS_WINDOWS = sys.platform == "win32"

_TYPE_MAP = {
    "1": "A", "28": "AAAA", "5": "CNAME", "15": "MX",
    "16": "TXT", "33": "SRV", "12": "PTR", "2": "NS", "6": "SOA",
}

_NAME_RE = re.compile(r"^Record Name[.\s]*:\s*(.+)$", re.IGNORECASE)
_TYPE_RE = re.compile(r"^Record Type[.\s]*:\s*(\d+)$", re.IGNORECASE)
_DATA_RE = re.compile(
    r"^(A|AAAA|CNAME|MX|TXT|SRV|PTR|NS)\s*(?:\(Host\))?\s*Record[.\s]*:\s*(.+)$",
    re.IGNORECASE,
)


def _collect_windows():
    try:
        output = subprocess.check_output(
            ["ipconfig", "/displaydns"], text=True, stderr=subprocess.DEVNULL,
        )
    except Exception as e:
        print(f"[dns] ipconfig failed: {e}")
        return []

    entries = []
    record_name = None
    record_type = "A"

    for line in output.splitlines():
        line = line.strip()
        if not line:
            continue

        m = _NAME_RE.match(line)
        if m:
            record_name = m.group(1).strip()
            continue

        m = _TYPE_RE.match(line)
        if m:
            record_type = _TYPE_MAP.get(m.group(1), m.group(1))
            continue

        m = _DATA_RE.match(line)
        if m and record_name:
            entries.append({
                "query_name": record_name,
                "query_type": record_type,
                "response":   m.group(2).strip(),
                "direction":  "response",
            })

    return entries


def collect_dns(server_url, agent_token):
    entries = _collect_windows() if IS_WINDOWS else []
    if not entries:
        return

    try:
        requests.post(
            f"{server_url}/telemetry/dns",
            json={"agent_token": agent_token, "entries": entries},
            timeout=10,
        )
    except Exception as e:
        print(f"[dns] send error: {e}")
