# 08 — Module: SOAR & Response Actions

**This is the module to read before pointing any security testing (red-team, pentest, or automated scanning) at a deployed instance.** Everything documented here can take real, disruptive action against a live protected endpoint — killing a process, cutting network access, blocking traffic, deleting/moving a file. Treat every endpoint in this document as high-blast-radius by default.

**Primary files:** `backend/app/api/{commands,playbooks,live_response}.py`, `backend/app/services/playbook_engine.py`, `agent/command_executor.py`, `agent/quarantine_engine.py`.

## 1. Commands — the actual action-execution path

`commands.py` (backend) → agent polls `GET /agents/{agent_token}/commands` → `agent/command_executor.py` executes → reports back via `PUT /agents/commands/{id}/complete`.

Five real command types, each with genuine platform-specific implementations (verified — not stubs):

| Command | Windows implementation | Linux implementation |
|---|---|---|
| `kill_process` | `taskkill /PID <pid> /F` | `os.kill(pid, SIGKILL)` |
| `block_ip` | `netsh advfirewall firewall add rule ... action=block` | `iptables -A INPUT/OUTPUT ... -j DROP` |
| `isolate_host` | `netsh advfirewall set allprofiles firewallpolicy blockinbound,blockoutbound` | `iptables` default-DROP on all chains, loopback excepted |
| `restore_host` | `netsh advfirewall set allprofiles firewallpolicy blockinbound,allowoutbound` | `iptables -F` + default ACCEPT |
| `quarantine_file` | Moves file to a local `quarantine/` folder (`agent/quarantine_engine.py`) — not deleted, just relocated and timestamped | Same, cross-platform via `shutil.move` |

These can be triggered three ways: directly from the UI (an Alert or Asset detail page), by a playbook (§3), or via direct API call by anyone holding a valid access token with sufficient role. **Command endpoints must verify the target agent belongs to the caller's tenant** — this is exactly the class of bug found in Playbooks this engagement (§4) and is the first thing to check if extending this surface.

## 2. Live Response — real backend, zero UI

`live_response.py` (282 lines) implements a full remote-terminal-style session: open a session against a specific agent, push input, poll for output, close. This is a **fully built, unexercised** capability — no page, no API client file, no menu entry anywhere in `netcradus-dashboard/src`. If this is ever wired up, treat it with the same caution as §1 — it's arguably a more powerful primitive than the fixed command set, since it can run arbitrary input on the target device.

## 3. Playbooks — real engine, decoupled from what the UI calls "Playbooks"

`playbook_engine.py` is a genuine automation engine, not a stub — it matches conditions against incoming alerts and executes multi-action workflows. Ten real action types exist today:

`close_alert`, `escalate_incident`, `isolate_agent`, `kill_process`, `block_ip`, `add_ioc`, `notify_slack`, `send_notification`, `create_incident`, `enrich_ioc`

Six system playbooks ship seeded on startup (`playbook_seed.py`) and evaluate automatically against every new alert (`evaluate_playbooks`).

**Naming trap**: the "SOAR Playbooks" item in the dashboard's nav menu (`Playbooks.tsx`, route `/playbooks`) is **not** this engine — it's a manual single-command dispatcher built on top of the Commands API (§1), unrelated to the `Playbook`/`PlaybookRun` database models or `playbook_engine.py`. There is currently no UI to view, create, edit, enable/disable, or manually trigger an actual `Playbook` record — only the seeded system playbooks ever run, and only automatically. If asked to "add playbook editing," the correct target is a new UI against `playbooks.py`'s existing CRUD endpoints, not the current `Playbooks.tsx` page.

## 4. The cross-tenant bug fixed this engagement (read before touching this file)

`playbooks.py`'s manual-trigger endpoint (`POST /playbooks/{id}/trigger`) originally fetched the target alert by ID with **no tenant scoping** — any tenant Admin could run a playbook's actions (including `isolate_agent`, `kill_process`) against another tenant's alert and, by extension, another company's endpoint. Fixed by joining through `Agent.tenant_id`, matching the pattern every other alert-scoped endpoint already used. Full detail in [14-security-fixes-and-notes.md](14-security-fixes-and-notes.md).

**The lesson for this module specifically**: any endpoint here that accepts an `agent_id`, `alert_id`, or `incident_id` and then acts on it must verify tenant ownership *before* acting, not just before returning data. A read-only IDOR leaks information; an IDOR in this module can isolate or kill a process on the wrong company's production server.

## 5. If you're red-teaming this yourself

Realistic test cases worth running against a non-production instance before trusting this module:
- Attempt to trigger a command/playbook action against an `agent_id` belonging to a different tenant, using a valid token for tenant A.
- Attempt to open a Live Response session (if ever wired to a UI) against another tenant's agent.
- Confirm `AGENT_REGISTRATION_TOKEN` is actually enforced in your deployment (`DEBUG=false` + a real token set) — an attacker who can register a rogue "agent" gets a valid `agent_token` and can poll for commands meant for someone else's device if the tenant scoping above is ever weakened.
- Confirm command results (`PUT /agents/commands/{id}/complete`) can only be posted by the agent that owns that command, not any authenticated agent.
