"""
USB telemetry collector for NetcradXDR agent.

Tracks USB mass-storage devices connecting/disconnecting between polls and
ships `connected` / `disconnected` events (matching the backend's
`usb_telemetry.event_type` values). File-level activity on removable media
(`file_copy` / `file_delete`) is not collected here — that would need a
watchdog-style observer attached per mounted drive, added dynamically as
drives come and go.

Windows: enumerates USB disk drives via WMI (Win32_DiskDrive) and resolves
their drive letter through the partition/logical-disk association chain.
Linux: enumerates /sys/bus/usb/devices — this walks all USB devices, not
just storage, since Linux exposes no cheap "is this a mass-storage device"
flag without extra parsing; drive_letter is left unset there.
"""
import os
import sys

import requests

IS_WINDOWS = sys.platform == "win32"

# device_id -> last-seen entry, so we can detect disconnects across polls
_seen: dict = {}


def _wql_escape(value: str) -> str:
    return value.replace("\\", "\\\\") if value else value


def _current_username() -> str:
    try:
        return os.getlogin()
    except Exception:
        return os.environ.get("USERNAME") or os.environ.get("USER") or ""


def _collect_windows() -> dict:
    devices = {}
    try:
        import win32com.client
        wmi = win32com.client.GetObject("winmgmts:")

        for drive in wmi.ExecQuery(
            "SELECT * FROM Win32_DiskDrive WHERE InterfaceType='USB'"
        ):
            device_id = drive.PNPDeviceID or drive.DeviceID or ""
            vendor_id = product_id = None
            if device_id and "VID_" in device_id and "PID_" in device_id:
                try:
                    vendor_id  = device_id.split("VID_")[1][:4]
                    product_id = device_id.split("PID_")[1][:4]
                except Exception:
                    pass

            drive_letter = None
            try:
                esc = _wql_escape(drive.DeviceID)
                for partition in wmi.ExecQuery(
                    "ASSOCIATORS OF {Win32_DiskDrive.DeviceID='%s'} "
                    "WHERE AssocClass = Win32_DiskDriveToDiskPartition" % esc
                ):
                    part_esc = _wql_escape(partition.DeviceID)
                    for logical in wmi.ExecQuery(
                        "ASSOCIATORS OF {Win32_DiskPartition.DeviceID='%s'} "
                        "WHERE AssocClass = Win32_LogicalDiskToPartition" % part_esc
                    ):
                        drive_letter = logical.DeviceID
            except Exception:
                pass

            key = device_id or drive.Caption or ""
            if not key:
                continue
            devices[key] = {
                "device_id":    device_id,
                "device_name":  drive.Caption or drive.Model or "",
                "vendor_id":    vendor_id,
                "product_id":   product_id,
                "drive_letter": drive_letter,
            }
    except Exception as e:
        print(f"[usb] WMI query failed: {e}")

    return devices


def _collect_linux() -> dict:
    devices = {}
    base = "/sys/bus/usb/devices"

    def _read(path):
        try:
            with open(path) as f:
                return f.read().strip()
        except Exception:
            return None

    try:
        for name in os.listdir(base):
            path = os.path.join(base, name)
            vendor_id = _read(os.path.join(path, "idVendor"))
            if not vendor_id:
                continue  # not a device node (e.g. an interface sub-entry)

            product_id = _read(os.path.join(path, "idProduct"))
            product    = _read(os.path.join(path, "product")) or ""
            serial     = _read(os.path.join(path, "serial")) or ""

            device_id = serial or f"{vendor_id}:{product_id}:{name}"
            devices[device_id] = {
                "device_id":    device_id,
                "device_name":  product,
                "vendor_id":    vendor_id,
                "product_id":   product_id,
                "drive_letter": None,
            }
    except Exception as e:
        print(f"[usb] /sys enumeration failed: {e}")

    return devices


def collect_usb(server_url, agent_token):
    global _seen

    current = _collect_windows() if IS_WINDOWS else _collect_linux()
    username = _current_username()

    entries = []
    for device_id, info in current.items():
        if device_id not in _seen:
            entries.append({**info, "event_type": "connected", "username": username})

    for device_id, info in _seen.items():
        if device_id not in current:
            entries.append({**info, "event_type": "disconnected", "username": username})

    _seen = current

    if not entries:
        return

    try:
        requests.post(
            f"{server_url}/telemetry/usb",
            json={"agent_token": agent_token, "entries": entries},
            timeout=10,
        )
    except Exception as e:
        print(f"[usb] send error: {e}")
