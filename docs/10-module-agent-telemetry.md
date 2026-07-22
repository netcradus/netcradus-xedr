# 10 — Module: Endpoint Agent & Telemetry

**Primary files:** `agent/*.py` (the actual endpoint agent software, separate codebase from `backend/`), `backend/app/api/{agents,telemetry}.py`.

## 1. The agent is a real, working piece of software — not a demo stub

`agent/main.py` runs a poll loop (default every 10s, `poll_interval` in `config.json`) that: collects process/network/persistence telemetry, ingests logs (syslog/Windows Event Log/web/app logs), sends a heartbeat, polls for pending commands and executes them, and periodically runs vulnerability and browser-security scans. All verified as genuine implementations (real `psutil`/OS-API calls), not placeholders — see [08-module-soar-response-actions.md](08-module-soar-response-actions.md) for the command-execution path specifically.

## 2. Registration & identity

Two separate secrets matter here — see [06-module-auth-identity-tenancy.md](06-module-auth-identity-tenancy.md) §8 for the full explanation:

- `registration_token` in `config.json` must match the backend's `AGENT_REGISTRATION_TOKEN`.
- `tenant_api_key` in `config.json` (added this engagement — previously the agent had no way to send this at all) determines which company the device belongs to. **Omitting it silently assigns the device to the "Default" tenant** — the backend does not reject the registration, so this failure mode is easy to miss.

On first successful registration, the agent persists the returned `agent_token` back into `config.json` and uses it (not the registration token) for every subsequent call.

## 3. Self-update

Fully real end-to-end (verified this engagement, not just read from source):
1. Every heartbeat response can carry `update_available`, `latest_version`, `download_url`, `checksum` (backend compares the agent's reported version against the latest `AgentVersion` row for its OS — `agents.py:37-58`).
2. `agent/update_manager.py` downloads the package, verifies its SHA-256 against the signed checksum, extracts to a staging directory, copies the current `config.json` forward (so the token/server URL survive the update), and launches `agent/updater.py` as a detached process before the old agent exits.

**Gap**: there is no admin UI to upload a new `AgentVersion` package — the upload/list/activate endpoints (`agents.py`) exist and work, but someone has to call them directly (e.g. via `/docs` or curl) today.

## 4. Telemetry — what actually flows end to end vs. ingest-only with no source

This is the most consequential thing to understand about this module. The backend has full ingestion + storage support for **12 telemetry types**, but only some of them have a real collector on the agent side:

| Telemetry type | Backend ingest | Agent collector | Status |
|---|---|---|---|
| Process | ✅ `/telemetry/processes` | ✅ `process_monitor.py` | Real, working |
| Network | ✅ `/telemetry/network` | ✅ `network_monitor.py` | Real, working |
| File | ✅ `/telemetry/files` | ✅ `file_monitor.py` (watchdog-based) | Real, working |
| Persistence | ✅ `/telemetry/persistence` | ✅ `persistence_monitor.py` | Real — Registry Run keys, services, scheduled tasks/cron |
| Logs (syslog/WinEvent/web/app) | ✅ `/telemetry/logs` | ✅ `syslog_monitor.py`, `windows_event_log_monitor.py`, `web_log_monitor.py`, `app_log_monitor.py` | Real, working |
| **DNS** | ✅ `/telemetry/dns` | ✅ `dns_monitor.py` **(added this engagement)** | Real — polls the Windows DNS resolver cache via `ipconfig /displaydns`. Windows-only; no Linux equivalent exists (no reliably-readable OS-level DNS cache without root/pcap). English-locale `ipconfig` output only. |
| **USB** | ✅ `/telemetry/usb` | ✅ `usb_monitor.py` **(added this engagement)** | Real — WMI on Windows, `/sys/bus/usb/devices` on Linux. Emits `connected`/`disconnected` only; `file_copy`/`file_delete` events (also in the schema) aren't collected — would need a `watchdog` observer attached per mounted drive. |
| Registry (general) | ✅ `/telemetry/registry` | ❌ None | Persistence-specific Registry Run-key monitoring exists (above), but general registry-change monitoring does not. Would need either expensive full-hive polling or the native `RegNotifyChangeKeyValue` change-notification API. |
| Browser extensions | ✅ `/telemetry/browser-extensions` | ❌ None (superseded) | This table/endpoint appears orphaned — the real, fully-built browser-security feature (`browser_monitor.py` → `/browser-security/events/ingest` → the Browser Security page) uses a **separate, newer table** (`browser_security_events`). Safe to treat this older pipeline as dead unless you find a reason otherwise. |
| Memory scans | ✅ `/telemetry/memory-scans` | ❌ None | Downstream of YARA, which itself degrades without `yara-python` installed (see [07](07-module-detection-engine.md)) — building an agent-side memory-scan collector without a working scoring engine on the other end wouldn't produce anything actionable. |
| Cloud workloads | ✅ `/telemetry/cloud` | ❌ N/A | Not an endpoint-agent concern — would come from a cloud-API poller connector, which doesn't exist yet. |
| Kubernetes | ✅ `/telemetry/kubernetes` | ❌ N/A | Would come from a K8s DaemonSet/API integration, doesn't exist yet. |
| Email | ✅ `/telemetry/email` | ❌ N/A | Would come from an email-gateway integration, doesn't exist yet. |

**There is also no query/read API for any telemetry type** — `telemetry.py` is POST-only across the board, and no frontend page reads raw telemetry back. Detection and hunting features query the underlying tables directly from their own service code (e.g. `hunt.py`, `rule_engine.py`), which is why detection still works despite there being no generic "browse telemetry" screen — but if you're asked to build one, there's no existing read endpoint to build it on top of; that's new backend work, not just a missing page.

## 5. Vulnerability & browser-security scanning

`agent/vuln_scanner.py` and `agent/browser_monitor.py` run on their own interval (`vuln_scan_interval` / `browser_scan_interval` in `config.json`, default every 60 min / 2 hr respectively) and post real findings to `/vulnerability/scans` and `/browser-security/events/ingest`. Both are genuine implementations, not placeholders, and both features are fully wired end-to-end on the frontend.

## 6. Config reference (`agent/config.json`)

| Field | Purpose |
|---|---|
| `server_url` | Backend base URL, must include `/api/v1` |
| `agent_token` | Set automatically after first registration — don't hand-edit unless re-enrolling |
| `registration_token` | Must match backend's `AGENT_REGISTRATION_TOKEN` |
| `tenant_api_key` | **Added this engagement.** Which company this device belongs to |
| `agent_version` | Reported to the backend; drives the self-update check |
| `poll_interval` | Main loop cadence, seconds |
| `update_check_interval` | Every N cycles, check for a self-update |
| `vuln_scan_interval` / `browser_scan_interval` | Every N cycles, run those scans |
| `log_sources` | Per-source enable flags and paths for syslog/Windows Event/web/app logs |

Environment variable overrides exist for the three most sensitive fields (useful for injecting secrets via a deployment tool instead of a checked-in file): `NETCRADXDR_SERVER_URL`, `NETCRADXDR_AGENT_TOKEN`, `NETCRADXDR_AGENT_REGISTRATION_TOKEN`, `NETCRADXDR_TENANT_API_KEY`.
