"""
Agent self-update manager.

Called from main.py after each heartbeat that signals update_available=True.
Downloads the package, verifies SHA-256, extracts it to a staging directory,
then launches updater.py (a separate process) before the main agent exits.
"""
from __future__ import annotations

import hashlib
import json
import os
import subprocess
import sys
import tempfile
import zipfile

import requests

_DOWNLOAD_TIMEOUT = 120  # seconds


def _version_gt(a: str, b: str) -> bool:
    """True if semver a > b. Falls back to string comparison on parse error."""
    def parts(v: str):
        return tuple(int(x) for x in v.split("."))
    try:
        return parts(a) > parts(b)
    except Exception:
        return a > b


def check_and_apply(server_url: str, agent_token: str, heartbeat_resp: dict) -> bool:
    """
    If the heartbeat response signals an update, download and apply it.
    Returns True if an update was applied (caller should then exit).
    """
    if not heartbeat_resp.get("update_available"):
        return False

    latest  = heartbeat_resp.get("latest_version", "")
    dl_url  = heartbeat_resp.get("download_url", "")
    chksum  = heartbeat_resp.get("checksum", "")

    if not latest or not dl_url or not chksum:
        return False

    # Read current version from config.json
    cfg_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "config.json")
    try:
        with open(cfg_path) as f:
            current = json.load(f).get("agent_version", "0.0.0")
    except Exception:
        current = "0.0.0"

    if not _version_gt(latest, current):
        return False

    print(f"[update] New version available: {current} → {latest}")
    return _download_and_apply(server_url, agent_token, latest, dl_url, chksum, cfg_path)


def _download_and_apply(
    server_url: str,
    agent_token: str,
    version: str,
    dl_url: str,
    expected_sha256: str,
    cfg_path: str,
) -> bool:
    # Resolve relative URL
    if dl_url.startswith("/"):
        dl_url = server_url.rstrip("/") + dl_url

    print(f"[update] Downloading {dl_url} ...")
    try:
        r = requests.get(
            f"{dl_url}?agent_token={agent_token}",
            timeout=_DOWNLOAD_TIMEOUT,
            stream=True,
        )
        r.raise_for_status()
    except Exception as exc:
        print(f"[update] Download failed: {exc}")
        return False

    # Write to temp file and verify checksum
    tmp = tempfile.NamedTemporaryFile(suffix=".zip", delete=False)
    sha256 = hashlib.sha256()
    try:
        for chunk in r.iter_content(chunk_size=65536):
            tmp.write(chunk)
            sha256.update(chunk)
        tmp.close()
    except Exception as exc:
        tmp.close()
        os.unlink(tmp.name)
        print(f"[update] Write failed: {exc}")
        return False

    actual = sha256.hexdigest()
    if actual != expected_sha256:
        os.unlink(tmp.name)
        print(f"[update] Checksum mismatch — got {actual}, want {expected_sha256}")
        return False

    # Extract to staging directory
    staging_dir = tempfile.mkdtemp(prefix="netcrad_update_")
    try:
        with zipfile.ZipFile(tmp.name, "r") as zf:
            zf.extractall(staging_dir)
        os.unlink(tmp.name)
    except Exception as exc:
        os.unlink(tmp.name)
        print(f"[update] Extract failed: {exc}")
        return False

    # Copy current config into staging so the new agent keeps its token + server_url
    staging_cfg = os.path.join(staging_dir, "config.json")
    if not os.path.exists(staging_cfg) and os.path.exists(cfg_path):
        import shutil
        shutil.copy2(cfg_path, staging_cfg)
    # Write the new version into staging config
    try:
        with open(staging_cfg) as f:
            cfg = json.load(f)
        cfg["agent_version"] = version
        with open(staging_cfg, "w") as f:
            json.dump(cfg, f, indent=2)
    except Exception:
        pass

    # Launch updater.py as a detached process
    agent_dir   = os.path.dirname(os.path.abspath(__file__))
    updater_py  = os.path.join(staging_dir, "updater.py")
    if not os.path.exists(updater_py):
        updater_py = os.path.join(agent_dir, "updater.py")

    try:
        subprocess.Popen(
            [
                sys.executable, updater_py,
                "--staging-dir", staging_dir,
                "--agent-dir",   agent_dir,
                "--parent-pid",  str(os.getpid()),
            ],
            close_fds=True,
            start_new_session=True,
        )
        print(f"[update] Updater launched — agent will restart as {version}.")
        return True
    except Exception as exc:
        print(f"[update] Could not launch updater: {exc}")
        return False
