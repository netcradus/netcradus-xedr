#!/usr/bin/env python3
"""
Stand-alone updater — launched by the main agent before it exits.

Waits for the old agent process to die, copies files from the staging
directory into the live agent directory, then restarts the agent.

Usage (called by update_manager.py):
  python updater.py --staging-dir /tmp/netcrad_update_xyz
                    --agent-dir   /opt/netcrad_agent
                    --parent-pid  12345
"""
import argparse
import os
import shutil
import subprocess
import sys
import time


def _wait_for_pid(pid: int, timeout: int = 15) -> None:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            os.kill(pid, 0)   # signal 0 = existence check
        except (ProcessLookupError, PermissionError, OSError):
            return            # process is gone
        time.sleep(0.5)


def _copy_files(staging_dir: str, agent_dir: str) -> None:
    """Overwrite agent_dir with files from staging_dir (skip updater.py itself)."""
    for name in os.listdir(staging_dir):
        if name == "updater.py":
            continue  # can't overwrite a running script
        src = os.path.join(staging_dir, name)
        dst = os.path.join(agent_dir, name)
        if os.path.isdir(src):
            if os.path.exists(dst):
                shutil.rmtree(dst)
            shutil.copytree(src, dst)
        else:
            shutil.copy2(src, dst)


def main() -> None:
    parser = argparse.ArgumentParser(description="NetcradXDR agent updater")
    parser.add_argument("--staging-dir", required=True, help="Directory with new agent files")
    parser.add_argument("--agent-dir",   required=True, help="Live agent installation directory")
    parser.add_argument("--parent-pid",  type=int, required=True, help="PID of the old agent process")
    args = parser.parse_args()

    print(f"[updater] Waiting for old agent (PID {args.parent_pid}) to exit...")
    _wait_for_pid(args.parent_pid)
    time.sleep(1)  # brief grace period for file handles

    print(f"[updater] Installing update from {args.staging_dir} ...")
    try:
        _copy_files(args.staging_dir, args.agent_dir)
    except Exception as exc:
        print(f"[updater] Install failed: {exc}")
        sys.exit(1)

    try:
        shutil.rmtree(args.staging_dir)
    except Exception:
        pass

    main_py = os.path.join(args.agent_dir, "main.py")
    print(f"[updater] Restarting agent: {sys.executable} {main_py}")

    if sys.platform == "win32":
        subprocess.Popen([sys.executable, main_py])
    else:
        os.execv(sys.executable, [sys.executable, main_py])


if __name__ == "__main__":
    main()
