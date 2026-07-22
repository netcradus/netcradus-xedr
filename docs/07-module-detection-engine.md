# 07 — Module: Detection Engine (Alerts, Incidents, Rules)

**Primary files:** `backend/app/api/{alerts,incidents,detection_rules,sigma_rules,yara_rules}.py`, `backend/app/services/{rule_engine,detection_service,log_detection_service,incident_service,sigma_converter,yara_service}.py`.

## 1. Alerts

The atomic unit of detection output. Created by the rule engine when incoming telemetry matches a `DetectionRule`. Frontend: fully wired (`Alerts.tsx` ↔ `alertsApi.ts`) — list/open/stats/detail/resolve all real, no dead code found. No delete endpoint exists (by design — alerts are an audit trail, not meant to be removable).

## 2. Incidents

Groups related alerts into one investigable case. Status lifecycle: `Open → Investigating → Resolved` (`incident.py:13`). Full workflow implemented (`incident_service.py`): notes, evidence attachment, resolution.

**Known gap**: `POST /incidents/{id}/evidence/upload` (multipart file upload) exists server-side but `incidentsApi.ts` only implements the text-based `addEvidence` — no `FormData`/file-upload code exists in `Incidents.tsx`. If asked to add file-evidence upload to the UI, the backend endpoint is already there; this is frontend-only work.

## 3. Detection Rules

`detection_rules.py` + `rule_engine.py`/`detection_service.py`/`log_detection_service.py`. Real, database-driven multi-condition engine — supports AND/OR condition grouping, not a toy single-field matcher. Rules can be system-wide (`tenant_id = None`, visible to everyone) or tenant-specific. `detection_rule_seed.py` seeds the built-in library on startup.

Rule matching runs against telemetry as it's ingested (see `log_detection_service.py` specifically for the log-telemetry path, which is a separate code path from process/network/file telemetry matching — worth knowing if a new detection type needs wiring in, since it's not a single unified dispatcher).

## 4. Sigma Rules

`sigma_rules.py` + `sigma_converter.py`. Genuinely parses and converts real Sigma YAML into a working `DetectionRule` — verified this engagement to not be a stub. Fully wired frontend-to-backend, no gaps found.

## 5. YARA Rules

`yara_rules.py` + `yara_service.py`. UI and CRUD are real and fully wired. **The scan engine itself silently degrades** if the `yara-python` package isn't installed on the server (it is not in `requirements.txt` and not installed by default — see [13-known-issues-technical-debt.md](13-known-issues-technical-debt.md)):

- `yara_service.py`'s `_get_compiled()` returns `None` when the engine is unavailable
- `POST /yara-rules/scan-file` then returns `{"matches": [], "clean": true}` for **every** file
- `POST /yara-rules/validate` reports **every** rule as syntactically valid

No endpoint exposes engine availability, and the frontend has no banner for this state — a user has no way to know scanning isn't actually happening. If you're asked to fix this properly: (1) install `yara-python`, and/or (2) have `yara_service.py` return an explicit "engine unavailable" error instead of a false-positive "clean" result, and surface it in `YaraRules.tsx`.

## 6. Testing

`backend/tests/` has dedicated coverage for at least the detection/incident path — check `tests/api/` and `tests/integration/` before changing rule-matching logic; a regression here silently stops threats from being detected, which is the worst possible failure mode for this module specifically.
