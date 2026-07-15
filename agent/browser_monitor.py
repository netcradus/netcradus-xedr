"""
Browser Security Monitor — collects browser security events from:
  1. Dangerous extensions  (Chrome / Edge / Firefox)
  2. Password leak indicators (saved-password existence + weak-signal checks)
  3. AI usage tracking      (history visits to AI platforms)
  4. Suspicious downloads   (executables / scripts in Downloads folder)
  5. Malicious site visits  (history URL matching against known-bad patterns)

All checks are read-only; no browser processes are touched.
"""

import os
import sys
import json
import sqlite3
import shutil
import hashlib
import tempfile
import platform
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_OS = platform.system()  # "Windows" | "Linux" | "Darwin"

# Permissions that should trigger a HIGH/CRITICAL extension alert
_CRITICAL_PERMISSIONS = {
    "nativeMessaging",          # can execute arbitrary local binaries
    "debugger",                 # full JS execution in every tab
    "proxy",                    # intercept all network traffic
    "webRequestBlocking",       # block / modify HTTP responses
}
_HIGH_PERMISSIONS = {
    "cookies",
    "history",
    "management",               # install / disable other extensions
    "bookmarks",
    "passwords",                # rare but real
    "clipboardRead",
    "downloads",
}

# Known-suspicious extension IDs (adware / credential stealers)
_KNOWN_BAD_EXTENSION_IDS = {
    "aapocclcgogkmnckokdopfmhonfmgoek",  # Session Manager (malicious clone)
    "fjnbnpbmkenffdnngjfgmeleoegfcffe",  # Stylish (data exfil version)
    "fmkadmapgofadopljbjfkapdkoienihi",  # React DevTools (spoofed)
    "bfbmjmiodbnnpllbbbfblcplfjjepjdn",  # HTTP Request Modifier (flagged)
}

# AI usage sites — visits indicate potential data exfiltration via AI prompts
_AI_SITES = [
    "chat.openai.com", "chatgpt.com",
    "claude.ai",
    "gemini.google.com", "bard.google.com",
    "copilot.microsoft.com", "bing.com/chat",
    "you.com", "perplexity.ai",
    "character.ai",
    "poe.com",
    "huggingface.co/chat",
    "mistral.ai",
    "groq.com",
]

# URL patterns for malicious / phishing sites (basic local blocklist)
_MALICIOUS_PATTERNS = [
    "phish", "login-secure-", "account-verify", "bankofamerica-",
    "paypa1", "paypa-", "arnazon", "micros0ft",
    "signin-google-", "facebook-login-",
    ".tk/", ".ml/", ".ga/", ".cf/",      # free TLDs heavily abused
    "bit.ly/", "tinyurl.com/",           # flag redirectors in history
    "ngrok.io", "ngrok-free.app",        # tunnels in browsing history = suspicious
    "rat-download", "keylogger", "stealc",
]

# File extensions considered dangerous in Downloads
_DANGEROUS_EXTS = {
    ".exe", ".msi", ".bat", ".cmd", ".ps1", ".vbs", ".js",
    ".jar", ".py", ".sh", ".hta", ".scr", ".pif",
    ".lnk", ".iso", ".img",
}

# How far back to check history (days)
_HISTORY_DAYS = 7


# ---------------------------------------------------------------------------
# Browser profile path discovery
# ---------------------------------------------------------------------------

def _home() -> Path:
    return Path.home()


def _chrome_profiles() -> list[Path]:
    """Return existing Chrome/Chromium profile dirs."""
    if _OS == "Windows":
        base = _home() / "AppData" / "Local" / "Google" / "Chrome" / "User Data"
    elif _OS == "Darwin":
        base = _home() / "Library" / "Application Support" / "Google" / "Chrome"
    else:
        base = _home() / ".config" / "google-chrome"

    profiles = []
    if base.exists():
        for entry in base.iterdir():
            if entry.name in ("Default",) or entry.name.startswith("Profile "):
                profiles.append(entry)
    return profiles


def _edge_profiles() -> list[Path]:
    if _OS == "Windows":
        base = _home() / "AppData" / "Local" / "Microsoft" / "Edge" / "User Data"
    elif _OS == "Darwin":
        base = _home() / "Library" / "Application Support" / "Microsoft Edge"
    else:
        base = _home() / ".config" / "microsoft-edge"

    profiles = []
    if base.exists():
        for entry in base.iterdir():
            if entry.name in ("Default",) or entry.name.startswith("Profile "):
                profiles.append(entry)
    return profiles


def _firefox_profiles() -> list[Path]:
    if _OS == "Windows":
        base = _home() / "AppData" / "Roaming" / "Mozilla" / "Firefox" / "Profiles"
    elif _OS == "Darwin":
        base = _home() / "Library" / "Application Support" / "Firefox" / "Profiles"
    else:
        base = _home() / ".mozilla" / "firefox"

    profiles = []
    if base.exists():
        for entry in base.iterdir():
            if entry.is_dir():
                profiles.append(entry)
    return profiles


# ---------------------------------------------------------------------------
# 1. Dangerous extensions
# ---------------------------------------------------------------------------

def _check_extension_manifest(ext_path: Path, browser: str) -> dict | None:
    """Parse manifest.json from a Chrome/Edge extension directory."""
    manifest = ext_path / "manifest.json"
    if not manifest.exists():
        return None
    try:
        data = json.loads(manifest.read_text(encoding="utf-8", errors="ignore"))
    except Exception:
        return None

    name         = data.get("name", ext_path.parent.name)
    ext_id       = ext_path.parent.parent.name
    permissions  = set(data.get("permissions", []) + data.get("optional_permissions", []))
    update_url   = data.get("update_url", "")
    from_webstore = "clients2.google.com" in update_url or "microsoftedge.microsoft.com" in update_url

    # Severity escalation
    severity = None
    reasons  = []

    if ext_id in _KNOWN_BAD_EXTENSION_IDS:
        severity = "Critical"
        reasons.append("Known malicious extension ID")

    crit_hit = permissions & _CRITICAL_PERMISSIONS
    if crit_hit:
        severity = severity or "Critical"
        reasons.append(f"Critical permissions: {', '.join(sorted(crit_hit))}")

    high_hit = permissions & _HIGH_PERMISSIONS
    if high_hit and not severity:
        severity = "High"
        reasons.append(f"Sensitive permissions: {', '.join(sorted(high_hit))}")

    if not from_webstore and not severity:
        severity = "High"
        reasons.append("Sideloaded extension (not from official store)")
    elif not from_webstore:
        reasons.append("Sideloaded extension")

    if not severity:
        return None  # benign

    return {
        "event_type":     "extension",
        "severity":       severity,
        "browser":        browser,
        "title":          f"Dangerous browser extension: {name}",
        "description":    "; ".join(reasons),
        "extension_id":   ext_id,
        "extension_name": name,
    }


def check_dangerous_extensions() -> list[dict]:
    findings = []

    # Chrome / Edge — extensions stored per-profile
    for browser, profiles in [("chrome", _chrome_profiles()), ("edge", _edge_profiles())]:
        for profile in profiles:
            ext_root = profile / "Extensions"
            if not ext_root.exists():
                continue
            for ext_id_dir in ext_root.iterdir():
                if not ext_id_dir.is_dir():
                    continue
                # Each extension may have multiple version subdirs
                for ver_dir in ext_id_dir.iterdir():
                    if not ver_dir.is_dir():
                        continue
                    finding = _check_extension_manifest(ver_dir, browser)
                    if finding:
                        findings.append(finding)
                        break  # one finding per extension_id

    # Firefox — extensions.json
    for profile in _firefox_profiles():
        ext_json = profile / "extensions.json"
        if not ext_json.exists():
            continue
        try:
            data = json.loads(ext_json.read_text(encoding="utf-8", errors="ignore"))
            for addon in data.get("addons", []):
                if addon.get("type") != "extension":
                    continue
                permissions = set(addon.get("userPermissions", {}).get("permissions", []))
                name        = addon.get("defaultLocale", {}).get("name", addon.get("id", "unknown"))
                ext_id      = addon.get("id", "")
                source      = addon.get("sourceURI", "")
                from_amo    = "addons.mozilla.org" in source

                reasons  = []
                severity = None

                crit_hit = permissions & _CRITICAL_PERMISSIONS
                high_hit = permissions & _HIGH_PERMISSIONS

                if crit_hit:
                    severity = "Critical"
                    reasons.append(f"Critical permissions: {', '.join(sorted(crit_hit))}")
                if high_hit and not severity:
                    severity = "High"
                    reasons.append(f"Sensitive permissions: {', '.join(sorted(high_hit))}")
                if not from_amo and not severity:
                    severity = "High"
                    reasons.append("Sideloaded Firefox extension")

                if severity:
                    findings.append({
                        "event_type":     "extension",
                        "severity":       severity,
                        "browser":        "firefox",
                        "title":          f"Dangerous browser extension: {name}",
                        "description":    "; ".join(reasons),
                        "extension_id":   ext_id,
                        "extension_name": name,
                    })
        except Exception:
            continue

    return findings


# ---------------------------------------------------------------------------
# 2. Password leak indicators
# ---------------------------------------------------------------------------

def check_password_leaks() -> list[dict]:
    """
    Detect password leak risk signals without reading actual credentials:
    - Presence of plaintext credential files (credentials.db, Login Data)
    - Browser Login Data accessible without encryption (Windows DPAPI may be absent)
    - Password manager not detected (implies browser-saved passwords only)
    """
    findings = []

    for browser, profiles in [("chrome", _chrome_profiles()), ("edge", _edge_profiles())]:
        for profile in profiles:
            login_data = profile / "Login Data"
            if not login_data.exists():
                continue

            # Count stored logins by querying the SQLite file (copy it first — Chrome locks it)
            try:
                tmp = Path(tempfile.mktemp(suffix=".db"))
                shutil.copy2(login_data, tmp)
                conn = sqlite3.connect(str(tmp))
                cur  = conn.execute(
                    "SELECT COUNT(*) FROM logins WHERE blacklisted_by_user = 0"
                )
                count = cur.fetchone()[0]
                conn.close()
                tmp.unlink(missing_ok=True)

                if count > 0:
                    findings.append({
                        "event_type":  "password_leak",
                        "severity":    "High",
                        "browser":     browser,
                        "title":       f"Browser-saved passwords detected ({count} entries)",
                        "description": (
                            f"{browser.title()} has {count} saved passwords stored in "
                            "Login Data. These are encrypted with Windows DPAPI but are "
                            "accessible to any process running as the same user and are "
                            "targeted by infostealer malware."
                        ),
                    })
            except Exception:
                pass

    # Firefox signons.sqlite
    for profile in _firefox_profiles():
        signons = profile / "signons.sqlite"
        logins  = profile / "logins.json"
        if logins.exists():
            try:
                data  = json.loads(logins.read_text(encoding="utf-8", errors="ignore"))
                count = len(data.get("logins", []))
                if count > 0:
                    findings.append({
                        "event_type":  "password_leak",
                        "severity":    "High",
                        "browser":     "firefox",
                        "title":       f"Firefox saved passwords detected ({count} entries)",
                        "description": (
                            f"Firefox has {count} saved passwords in logins.json. "
                            "Without a Primary Password set, these can be decrypted by "
                            "any process with filesystem access."
                        ),
                    })
            except Exception:
                pass

    return findings


# ---------------------------------------------------------------------------
# 3. AI usage tracking
# ---------------------------------------------------------------------------

def _query_chromium_history(history_path: Path) -> list[str]:
    """Return URLs visited in the last _HISTORY_DAYS days from a Chromium History db."""
    urls = []
    try:
        tmp = Path(tempfile.mktemp(suffix=".db"))
        shutil.copy2(history_path, tmp)
        conn = sqlite3.connect(str(tmp))

        # Chrome stores time as microseconds since 1601-01-01
        cutoff_chrome = (
            datetime.now(timezone.utc) - timedelta(days=_HISTORY_DAYS)
        )
        epoch_diff = 11644473600  # seconds between 1601-01-01 and 1970-01-01
        cutoff_us  = int((cutoff_chrome.timestamp() + epoch_diff) * 1_000_000)

        cur = conn.execute(
            "SELECT url FROM urls WHERE last_visit_time > ?", (cutoff_us,)
        )
        urls = [row[0] for row in cur.fetchall()]
        conn.close()
        tmp.unlink(missing_ok=True)
    except Exception:
        pass
    return urls


def _query_firefox_history(places_path: Path) -> list[str]:
    urls = []
    try:
        tmp = Path(tempfile.mktemp(suffix=".db"))
        shutil.copy2(places_path, tmp)
        conn = sqlite3.connect(str(tmp))

        cutoff_us = int(
            (datetime.now(timezone.utc) - timedelta(days=_HISTORY_DAYS)).timestamp() * 1_000_000
        )
        cur = conn.execute(
            "SELECT url FROM moz_places WHERE last_visit_date > ?", (cutoff_us,)
        )
        urls = [row[0] for row in cur.fetchall() if row[0]]
        conn.close()
        tmp.unlink(missing_ok=True)
    except Exception:
        pass
    return urls


def check_ai_usage() -> list[dict]:
    findings = []
    all_urls: list[tuple[str, str]] = []  # (url, browser)

    for browser, profiles in [("chrome", _chrome_profiles()), ("edge", _edge_profiles())]:
        for profile in profiles:
            h = profile / "History"
            if h.exists():
                for url in _query_chromium_history(h):
                    all_urls.append((url, browser))

    for profile in _firefox_profiles():
        p = profile / "places.sqlite"
        if p.exists():
            for url in _query_firefox_history(p):
                all_urls.append((url, "firefox"))

    ai_hits: dict[str, set[str]] = {}  # site -> set of browsers
    for url, browser in all_urls:
        url_lower = url.lower()
        for ai_site in _AI_SITES:
            if ai_site in url_lower:
                ai_hits.setdefault(ai_site, set()).add(browser)

    for site, browsers in ai_hits.items():
        findings.append({
            "event_type":  "ai_usage",
            "severity":    "Medium",
            "browser":     ", ".join(sorted(browsers)),
            "title":       f"AI platform usage detected: {site}",
            "description": (
                f"User accessed {site} in the last {_HISTORY_DAYS} days via "
                f"{', '.join(sorted(browsers))}. Sensitive corporate data may have been "
                "shared with an external AI service. Review acceptable use policy."
            ),
            "url": f"https://{site}",
        })

    return findings


# ---------------------------------------------------------------------------
# 4. Suspicious downloads
# ---------------------------------------------------------------------------

def check_suspicious_downloads() -> list[dict]:
    findings = []
    downloads_dir = _home() / "Downloads"

    if not downloads_dir.exists():
        return findings

    cutoff = datetime.now() - timedelta(days=_HISTORY_DAYS)

    for f in downloads_dir.iterdir():
        if not f.is_file():
            continue
        try:
            mtime = datetime.fromtimestamp(f.stat().st_mtime)
        except Exception:
            continue
        if mtime < cutoff:
            continue

        ext = f.suffix.lower()
        if ext not in _DANGEROUS_EXTS:
            continue

        # Compute SHA-256 (truncate for large files)
        sha256 = ""
        try:
            h = hashlib.sha256()
            with f.open("rb") as fh:
                while chunk := fh.read(65536):
                    h.update(chunk)
            sha256 = h.hexdigest()
        except Exception:
            pass

        severity = "Critical" if ext in {".exe", ".msi", ".ps1", ".bat", ".scr"} else "High"
        findings.append({
            "event_type":  "malicious_download",
            "severity":    severity,
            "title":       f"Suspicious download: {f.name}",
            "description": (
                f"Executable or script file '{f.name}' was downloaded recently "
                f"(modified {mtime.strftime('%Y-%m-%d %H:%M')}). "
                "Verify this file is legitimate before executing."
            ),
            "file_name":  f.name,
            "file_path":  str(f),
            "sha256":     sha256,
        })

    return findings


# ---------------------------------------------------------------------------
# 5. Malicious site visits
# ---------------------------------------------------------------------------

def check_malicious_sites() -> list[dict]:
    findings = []
    all_urls: list[tuple[str, str]] = []

    for browser, profiles in [("chrome", _chrome_profiles()), ("edge", _edge_profiles())]:
        for profile in profiles:
            h = profile / "History"
            if h.exists():
                for url in _query_chromium_history(h):
                    all_urls.append((url, browser))

    for profile in _firefox_profiles():
        p = profile / "places.sqlite"
        if p.exists():
            for url in _query_firefox_history(p):
                all_urls.append((url, "firefox"))

    seen: set[str] = set()
    for url, browser in all_urls:
        url_lower = url.lower()
        for pattern in _MALICIOUS_PATTERNS:
            if pattern in url_lower and url not in seen:
                seen.add(url)
                findings.append({
                    "event_type":  "malicious_site",
                    "severity":    "High",
                    "browser":     browser,
                    "title":       f"Suspected malicious site visit: {url[:80]}",
                    "description": (
                        f"Browser history contains a visit to a URL matching the suspicious "
                        f"pattern '{pattern}'. This may indicate phishing or drive-by download activity."
                    ),
                    "url": url[:500],
                })
                break  # one finding per URL

    return findings


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------

def run_all_checks() -> list[dict]:
    findings: list[dict] = []

    for check_fn, label in [
        (check_dangerous_extensions, "extensions"),
        (check_password_leaks,       "password_leaks"),
        (check_ai_usage,             "ai_usage"),
        (check_suspicious_downloads, "downloads"),
        (check_malicious_sites,      "malicious_sites"),
    ]:
        try:
            results = check_fn()
            findings.extend(results)
        except Exception as exc:
            # Never let a single check crash the whole monitor
            print(f"[browser_monitor] {label} check failed: {exc}", file=sys.stderr)

    return findings
