# 13 — Known Issues & Technical Debt

Everything here was verified by reading the actual code (and in most cases, running it) — not inferred from a TODO comment or a guess. There are essentially none of the former in this codebase (a `TODO|FIXME` grep across both `backend/app` and `netcradus-dashboard/src` returns almost nothing) — the gaps below are all things that *look* complete on casual inspection and only reveal themselves when you actually exercise the code path.

Ranked by how much it can hurt someone before you'd notice.

## Priority 1 — Actively shows wrong information (fix before adding features here)

### 1.1 Reports page shows fabricated compliance data
`netcradus-dashboard/src/pages/Reports/Reports.tsx` hardcodes NIST/ISO/PCI/HIPAA percentages in a static `FRAMEWORKS` constant instead of calling `/compliance/dashboard`, while the surrounding UI text claims the numbers are "derived from NET XDR's active monitoring capabilities." The real Compliance page computes this correctly and live. A user who checks both pages sees two different, contradictory scores. **Not yet fixed as of this handoff.** Fix: replace `FRAMEWORKS` with a real API call. See [11-module-compliance-reporting-audit.md](11-module-compliance-reporting-audit.md) §3.

### 1.2 YARA scanning silently reports false negatives
When `yara-python` isn't installed on the server (it isn't, by default — not in `requirements.txt`), `yara_service.py` returns `{"matches": [], "clean": true}` for every file scan and reports every rule as valid, with no error, no warning, nothing in the UI. A security tool silently telling you everything is clean when it isn't scanning at all is worse than it being obviously broken. **Not yet fixed as of this handoff.** Fix: either bundle `yara-python` as a hard dependency, or have the service return an explicit "engine unavailable" state that the UI surfaces. See [07-module-detection-engine.md](07-module-detection-engine.md) §5.

## Priority 2 — Real backend gaps (not just missing UI)

### 2.1 Support tickets can't be answered
No `PUT`/`PATCH` endpoint exists anywhere for an admin to update a support ticket's status or reply to it — the `admin_note`/`status` fields on the `SupportTicket` model are effectively write-only. Customers can create and view tickets; nobody can close one through the product.

### 2.2 Telemetry has no read API
`telemetry.py` is entirely `POST` (ingestion). There is no `GET` to query any of the 12 telemetry types back out. Detection/hunting features work around this by querying the underlying tables directly from their own service code — but if you're ever asked to build a "browse raw telemetry" screen, there's no existing endpoint to build it on; that's new backend work.

### 2.3 Several telemetry types have no collector at all
DNS and USB were fixed this engagement (real agent-side collectors now exist). Registry (general), Cloud, Kubernetes, and Email telemetry still have full backend ingestion support with nothing populating them. See [10-module-agent-telemetry.md](10-module-agent-telemetry.md) §4 for the full table and why each one is missing.

## Priority 3 — Real backend features with zero frontend (highest-leverage follow-up work)

None of these are stubs — every one below is a genuine, working, previously-verified backend capability that nobody built a screen for:

| Feature | Backend | What's missing |
|---|---|---|
| Real Playbook editing/triggering | `playbook_engine.py`, `playbooks.py` — a real condition-matching, multi-action automation engine | The "Playbooks" nav page is actually a different, simpler manual command dispatcher. See [08-module-soar-response-actions.md](08-module-soar-response-actions.md) §3. |
| Live Response (remote terminal) | `live_response.py` — full session open/input/output/poll/close API | Zero frontend anywhere. |
| MITRE ATT&CK coverage heatmap | `mitre.py` — coverage/heatmap/top-techniques, explicitly built to power a frontend view | No frontend caller exists. |
| AI Security Copilot | `ai.py` — explain/root-cause/remediation/attack-chain/chat (5 endpoints) | Only 3 unrelated AI endpoints (incident-summary, nl-query, playbook-recommendation) are wired; none of these 5 are. |
| Scheduled reports (config/trigger/history/download) | `reports.py` — 6 of 7 endpoints, backed by real Celery tasks that already run on schedule | Only the `/summary` endpoint is called from the UI. |
| IOC editing & enrichment detail | `iocs.py` — update, single-fetch, enrichment-detail, re-enrich | List/create/delete work; no edit form exists. |
| Agent version management | `agents.py` — upload/list/activate/download | No admin UI; someone has to call these directly today. |
| Tenant-wide MFA-enforcement toggle | `settings.py` `/security` | Backend complete; `settingsApi.ts` has no function calling it — not reachable from the Settings page despite the toggle existing server-side. |
| Incident file-evidence upload | `incidents.py` multipart upload endpoint | UI only supports pasting text evidence. |

If prioritizing, the phase report ([05-phase-coverage-report.md](05-phase-coverage-report.md)) ranks these by likely user impact.

## Priority 4 — Cosmetic / naming, low urgency

- **"Continue with SSO"** on the login page is fully decorative — no backend at all, not partial wiring. See [12](12-module-admin-platform-billing.md) §7.
- **Billing is metadata only** — `PLAN_LIMITS` gates agent count; there's no real payment processing. Its own API (`billing.py`) is unused; plan changes actually go through `settings.py`.
- **`admin.py`** — one placeholder route, no caller, effectively dead.
- **`monitoring.py`** — real richer monitoring data than what Platform Admin's System Health tab actually uses.
- **"Integrations" page is really notification-channel config** (Slack/Teams/Email), not third-party connectors — works fine, just a naming choice that could mislead someone expecting real integrations (ticketing systems, SIEM forwarders, etc.).
- **`browser_extension_telemetry`** (`/telemetry/browser-extensions`) appears to be an orphaned, superseded pipeline — the real, fully-built browser security feature uses a separate, newer table (`browser_security_events`).
- **Frontend bundle size**: `npm run build` warns the main JS chunk is 1.15 MB (292 KB gzipped) — not broken, but worth code-splitting (`build.rollupOptions.output.manualChunks`) if load time on slow connections becomes a complaint.

## Fixed this engagement (listed here for traceability — don't re-discover these)

- `tsconfig.json` had an invalid `ignoreDeprecations` value that silently prevented `tsc` from ever running, meaning the frontend had **no real type-checking safety net** despite `strict: true` being set. Fixed by removing the (unneeded) option. This one fix surfaced 11 previously-invisible bugs, all fixed in the same pass — see git commit `4577796` for the full list (a `PlatformAdmin.tsx` name-display bug, a `ThreatHunting.tsx`/`huntApi.ts` type mismatch, a dead-code bug in `demoData.ts` that blanked a row on click, and several type-accuracy-only fixes with no runtime effect).
- Frontend API address was hardcoded to a specific dev machine's port (`http://127.0.0.1:8888`) instead of being deployment-portable — fixed to a relative path + Vite dev proxy. See git commit `53d63a2`.
- Agent had no way to specify which tenant it belonged to during registration — fixed. Same commit.
- 3 security issues — see [14-security-fixes-and-notes.md](14-security-fixes-and-notes.md).

## How to find more of these yourself

The pattern that caught most of the above: **cross-reference every backend router's endpoints against every frontend `api/*.ts` file's actual fetch calls** (`grep` each endpoint path across `netcradus-dashboard/src`). Anything with zero matches is either dead code or unbuilt UI. This is a fast, mechanical check worth re-running periodically as the codebase grows — it's how essentially everything in Priority 3 was found.
