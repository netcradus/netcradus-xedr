"""
Windows Event Log collector for SentryXDR agent.

Reads Security, System, and Application channels and ships new events to the
backend. Uses the pywin32 EvtLog API when available; falls back silently on
non-Windows platforms or when pywin32 is not installed.

Tracks the last seen EventRecordID per channel so only new events are shipped
on subsequent polls.
"""
import platform
import requests
from datetime import datetime, timezone

# Win32 EVTLOG constants
_EVTLOG_BACKWARDS = 0x00000008
_EVTLOG_SEQUENTIAL = 0x00000001

# Channels to monitor
_CHANNELS = ["Security", "System", "Application"]

# Per-channel last record ID (0 = start from most-recent batch only)
_last_record: dict[str, int] = {}

# Windows Event ID → (alert_worthy, severity_hint)
_HIGH_INTEREST = {
    1102: "critical",  # Audit log cleared
    4625: "medium",    # Failed logon
    4624: "info",      # Successful logon (pass-the-hash check)
    4634: "info",      # Logoff
    4648: "high",      # Logon with explicit credentials
    4672: "high",      # Special privileges assigned
    4698: "high",      # Scheduled task created
    4702: "medium",    # Scheduled task modified
    4720: "high",      # User account created
    4728: "high",      # Member added to security-enabled global group
    4732: "high",      # Member added to security-enabled local group
    4740: "high",      # Account locked out
    4756: "high",      # Member added to security-enabled universal group
    7045: "high",      # New service installed
}


def _win_ts(ts) -> str:
    """Convert a win32 LARGE_INTEGER time to ISO 8601 string."""
    try:
        # pywin32 returns a pywintypes.datetime which supports .isoformat()
        return ts.isoformat()
    except Exception:
        return datetime.now(timezone.utc).isoformat()


def _collect_channel(handle, channel: str, max_events: int = 200) -> list[dict]:
    try:
        import win32evtlog
    except ImportError:
        return []

    entries = []
    last_id = _last_record.get(channel, 0)
    new_last = last_id

    flags = win32evtlog.EVENTLOG_BACKWARDS_READ | win32evtlog.EVENTLOG_SEQUENTIAL_READ

    while True:
        try:
            events = win32evtlog.ReadEventLog(handle, flags, 0)
        except Exception:
            break
        if not events:
            break

        for ev in events:
            rec_id = ev.RecordNumber
            if rec_id <= last_id:
                # We've reached events we already processed
                break
            new_last = max(new_last, rec_id)

            event_id = ev.EventID & 0xFFFF
            # Only ship events of interest or all events (configurable)
            severity = _HIGH_INTEREST.get(event_id, "info")

            # Build extra fields from StringInserts
            inserts = list(ev.StringInserts or [])
            extra: dict = {}

            # For well-known event IDs, map inserts to named fields
            if event_id in (4624, 4625, 4648) and len(inserts) >= 9:
                extra["TargetUserName"]            = inserts[5] if len(inserts) > 5 else ""
                extra["LogonType"]                 = inserts[8] if len(inserts) > 8 else ""
                extra["IpAddress"]                 = inserts[18] if len(inserts) > 18 else ""
                extra["AuthenticationPackageName"] = inserts[10] if len(inserts) > 10 else ""
            elif event_id == 4740 and len(inserts) >= 2:
                extra["TargetUserName"] = inserts[0]
                extra["CallerComputer"] = inserts[1] if len(inserts) > 1 else ""
            elif event_id in (4728, 4732, 4756) and len(inserts) >= 1:
                extra["MemberName"]  = inserts[0]
                extra["GroupName"]   = inserts[2] if len(inserts) > 2 else ""
            elif event_id == 7045 and len(inserts) >= 2:
                extra["ServiceName"] = inserts[0]
                extra["ImagePath"]   = inserts[1] if len(inserts) > 1 else ""
            elif event_id == 4698 and len(inserts) >= 2:
                extra["TaskName"]    = inserts[0]
                extra["TaskContent"] = inserts[1][:500] if len(inserts) > 1 else ""

            # Derive username and source_ip from extra where available
            username  = extra.get("TargetUserName") or (inserts[0] if inserts else None)
            source_ip = extra.get("IpAddress") or None
            if source_ip in ("-", "::1", "127.0.0.1", ""):
                source_ip = None

            # Build a human-readable log_message summary
            msg_parts = [f"EventID={event_id}", f"Source={ev.SourceName}"]
            if username:
                msg_parts.append(f"User={username}")
            if source_ip:
                msg_parts.append(f"IP={source_ip}")
            if inserts:
                msg_parts.append("Params=" + "|".join(str(s)[:100] for s in inserts[:6]))

            entries.append({
                "log_source":   "wineventlog",
                "raw_message":  f"{channel}:{event_id}:" + "|".join(str(s) for s in inserts[:10]),
                "severity":     severity,
                "event_id":     event_id,
                "hostname":     ev.ComputerName,
                "process_name": ev.SourceName,
                "username":     username,
                "source_ip":    source_ip,
                "log_message":  " | ".join(msg_parts),
                "extra":        extra,
                "timestamp":    _win_ts(ev.TimeGenerated),
            })

            if len(entries) >= max_events:
                break

        if len(entries) >= max_events:
            break

    _last_record[channel] = new_last
    return entries


def collect_windows_events(
    server_url: str,
    agent_token: str,
    channels: list | None = None,
) -> None:
    if platform.system() != "Windows":
        return

    try:
        import win32evtlog
    except ImportError:
        return

    targets = channels or _CHANNELS
    all_entries: list[dict] = []

    for ch in targets:
        try:
            handle = win32evtlog.OpenEventLog(None, ch)
            all_entries.extend(_collect_channel(handle, ch))
            win32evtlog.CloseEventLog(handle)
        except Exception:
            pass

    if not all_entries:
        return

    # Ship in batches of 500 to stay within request size limits
    batch_size = 500
    for i in range(0, len(all_entries), batch_size):
        batch = all_entries[i : i + batch_size]
        try:
            requests.post(
                f"{server_url}/telemetry/logs",
                json={"agent_token": agent_token, "entries": batch},
                timeout=15,
            )
        except Exception:
            pass
