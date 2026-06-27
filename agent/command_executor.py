import os
import sys
import signal
import subprocess
import requests

from quarantine_engine import quarantine_file

IS_WINDOWS = sys.platform == "win32"
REQUEST_TIMEOUT = 10


# ── Status reporter ────────────────────────────────────────────────────────────

def report_command_status(server_url, agent_token, command_id, status, result=None, error=None):
    try:
        requests.put(
            f"{server_url}/agents/commands/{command_id}/complete",
            json={
                "agent_token": agent_token,
                "status": status,
                "result": result,
                "error": error,
            },
            timeout=REQUEST_TIMEOUT,
        )
    except Exception as e:
        print(f"[commands] report failed: {e}")


# ── Platform implementations ───────────────────────────────────────────────────

def _kill_process(pid_str):
    """Terminate a process by PID. Returns (result, error)."""
    if IS_WINDOWS:
        proc = subprocess.run(
            ["taskkill", "/PID", pid_str, "/F"],
            capture_output=True, text=True,
        )
        return proc.stdout.strip() or f"PID {pid_str} terminated", proc.stderr.strip() or None
    else:
        try:
            os.kill(int(pid_str), signal.SIGKILL)
            return f"Process {pid_str} killed (SIGKILL)", None
        except ProcessLookupError:
            return None, f"No process with PID {pid_str}"
        except PermissionError:
            return None, f"Permission denied killing PID {pid_str} — run agent as root"


def _block_ip(ip):
    """Block all traffic to/from an IP. Returns (result, error)."""
    if IS_WINDOWS:
        proc = subprocess.run(
            [
                "netsh", "advfirewall", "firewall", "add", "rule",
                f"name=SentryXDR_Block_{ip}",
                "dir=out", "action=block", f"remoteip={ip}",
            ],
            capture_output=True, text=True,
        )
        return proc.stdout.strip() or f"Firewall rule added for {ip}", proc.stderr.strip() or None
    else:
        # Drop both directions; requires root / CAP_NET_ADMIN
        errors = []
        for cmd in (
            ["iptables", "-A", "INPUT",  "-s", ip, "-j", "DROP"],
            ["iptables", "-A", "OUTPUT", "-d", ip, "-j", "DROP"],
        ):
            proc = subprocess.run(cmd, capture_output=True, text=True)
            if proc.returncode != 0:
                errors.append(proc.stderr.strip())
        if errors:
            return None, "; ".join(errors)
        return f"Blocked {ip} (iptables INPUT + OUTPUT)", None


def _isolate_host():
    """Cut all network traffic except loopback. Returns (result, error)."""
    if IS_WINDOWS:
        proc = subprocess.run(
            ["netsh", "advfirewall", "set", "allprofiles", "firewallpolicy",
             "blockinbound,blockoutbound"],
            capture_output=True, text=True,
        )
        return proc.stdout.strip() or "Host isolated", proc.stderr.strip() or None
    else:
        # Flush existing rules, set default DROP, keep loopback open
        cmds = [
            ["iptables", "-F"],
            ["iptables", "-P", "INPUT",   "DROP"],
            ["iptables", "-P", "OUTPUT",  "DROP"],
            ["iptables", "-P", "FORWARD", "DROP"],
            ["iptables", "-A", "INPUT",  "-i", "lo", "-j", "ACCEPT"],
            ["iptables", "-A", "OUTPUT", "-o", "lo", "-j", "ACCEPT"],
        ]
        errors = []
        for cmd in cmds:
            proc = subprocess.run(cmd, capture_output=True, text=True)
            if proc.returncode != 0:
                errors.append(proc.stderr.strip())
        if errors:
            return None, "; ".join(errors)
        return "Host isolated (iptables default DROP)", None


def _restore_host():
    """Restore full network connectivity. Returns (result, error)."""
    if IS_WINDOWS:
        proc = subprocess.run(
            ["netsh", "advfirewall", "set", "allprofiles", "firewallpolicy",
             "blockinbound,allowoutbound"],
            capture_output=True, text=True,
        )
        return proc.stdout.strip() or "Host restored", proc.stderr.strip() or None
    else:
        cmds = [
            ["iptables", "-F"],
            ["iptables", "-X"],
            ["iptables", "-P", "INPUT",   "ACCEPT"],
            ["iptables", "-P", "OUTPUT",  "ACCEPT"],
            ["iptables", "-P", "FORWARD", "ACCEPT"],
        ]
        errors = []
        for cmd in cmds:
            proc = subprocess.run(cmd, capture_output=True, text=True)
            if proc.returncode != 0:
                errors.append(proc.stderr.strip())
        if errors:
            return None, "; ".join(errors)
        return "Host restored (iptables flushed, default ACCEPT)", None


# ── Main poll loop ─────────────────────────────────────────────────────────────

def execute_command(server_url, agent_token):
    try:
        response = requests.get(
            f"{server_url}/agents/{agent_token}/commands",
            timeout=REQUEST_TIMEOUT,
        )
        response.raise_for_status()
        commands = response.json()
    except Exception as exc:
        print(f"[commands] poll failed: {exc}")
        return

    for command in commands:
        command_id   = command["id"]
        command_type = command["command_type"]
        argument     = command["argument"]
        result       = None
        error        = None

        try:
            if command_type == "kill_process":
                result, error = _kill_process(argument)

            elif command_type == "block_ip":
                result, error = _block_ip(argument)

            elif command_type == "isolate_host":
                result, error = _isolate_host()

            elif command_type == "restore_host":
                result, error = _restore_host()

            elif command_type == "quarantine_file":
                if quarantine_file(argument):
                    result = f"Quarantined: {argument}"
                else:
                    error = f"Could not quarantine: {argument}"

            else:
                error = f"Unknown command type: {command_type}"

            status = "Failed" if error else "Completed"
            report_command_status(server_url, agent_token, command_id, status, result, error)

        except Exception as exc:
            report_command_status(server_url, agent_token, command_id, "Failed", error=str(exc))
