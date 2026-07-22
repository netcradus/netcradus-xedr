# 04 — Product Scope

## 1. What NET XDR is

A multi-tenant, hybrid **SIEM** (Security Information & Event Management) + **SOAR** (Security Orchestration, Automation & Response) platform. Endpoint agents installed on protected devices collect telemetry and stream it to a central backend, which detects threats (via built-in, community-sourced, and custom rules), lets analysts investigate, and can automatically or manually respond (isolate a host, kill a process, block an IP, quarantine a file).

Backend package/internal name: **NetcradXDR**. Customer-facing brand: **NET XDR**. Do not use "SentryXDR" in any new user-facing text or documentation — it's the old project name, still present in a couple of legacy filenames (`SentryXDR_*.pdf` reports) but not the current brand.

## 2. Target users

- **Security analysts / SOC teams** — day-to-day alert triage, incident investigation, threat hunting.
- **Security/IT administrators** (customer-side) — team management, detection rule authoring, integration setup, compliance reporting.
- **Company leadership / auditors** — consumption of reports and compliance dashboards, not day-to-day tool usage.
- **NET XDR's own operating team** — Platform Admin role, manages the SaaS platform itself across all customer tenants without visibility into any individual customer's security data.

## 3. Plans / billing model

`backend/app/core/billing.py`:

```python
PLAN_LIMITS = {"free": 10, "professional": 250, "enterprise": None}  # None = unlimited agents
```

Billing is **metadata only** — there is no real payment processing (no Stripe or equivalent integration). A tenant's `plan` field is a string set at registration or by an admin; it only gates the number of agents a tenant can enroll. There is no checkout flow, no invoicing, no usage-based billing. If real payment collection is ever needed, that's new work, not a bug to fix — see [12-module-admin-platform-billing.md](12-module-admin-platform-billing.md).

## 4. Full feature inventory

Organized by what a user actually navigates to. "Status" reflects verified end-to-end functionality as of this handoff, not just presence of the code — see [13-known-issues-technical-debt.md](13-known-issues-technical-debt.md) for the detail behind any "Partial" entry.

| Area | Status | Notes |
|---|---|---|
| Auth (login/register/MFA/password reset) | ✅ Working | See [06](06-module-auth-identity-tenancy.md) |
| Dashboard | ✅ Working | |
| Alerts | ✅ Working | |
| Incidents | ✅ Working (text evidence only) | File-upload evidence endpoint exists server-side, no UI for it |
| Assets (device inventory, isolate/restore) | ✅ Working | |
| Detection Rules | ✅ Working | |
| Sigma Rules | ✅ Working | Real conversion, not a stub |
| YARA Rules | ⚠️ Partial | UI and API work; underlying scan engine silently degrades without `yara-python` installed — see [13](13-known-issues-technical-debt.md) |
| Threat Hunting | ✅ Working | |
| Attack Graph | ✅ Working | |
| Threat Intelligence (IOCs) | ⚠️ Partial | List/create/delete work; no UI to edit an existing IOC or view enrichment detail despite the backend supporting both |
| Threat Feeds | ✅ Working | |
| SOAR Playbooks | ⚠️ Partial (branding mismatch) | The "Playbooks" nav page is actually a manual single-command dispatcher — the real Playbook CRUD/trigger engine (`playbook_engine.py`) has no UI. See [08](08-module-soar-response-actions.md) |
| Response actions (isolate/kill/block/quarantine/restore) | ✅ Working | Real platform-specific implementations on the agent side |
| Live Response (remote session) | ❌ Backend only | Full session API exists (`live_response.py`), zero frontend |
| Vulnerability Scanner | ✅ Working | Agent-driven, no manual "run scan" button by design |
| Browser Security | ✅ Working | |
| Compliance Dashboard | ✅ Working | Live-computed, not a static checklist |
| Reports | ⚠️ Partial | Summary view works; scheduled-report config, manual trigger, history, and PDF download all have working backends with no UI |
| Audit Logs | ✅ Working | |
| Notifications / Integrations | ✅ Working | Real SMTP/webhook dispatch, SSRF-guarded (see [14](14-security-fixes-and-notes.md)) |
| AI Query Assistant | ⚠️ Partial | Natural-language search works; 5 more advanced AI Copilot endpoints (explain/root-cause/remediation/attack-chain/chat) exist server-side with no UI |
| Support tickets | ⚠️ Partial | Customers can create/view; **no admin reply/close endpoint exists at all** — this is a backend gap, not just missing UI |
| Settings (team, security policy, TI keys) | ✅ Working | |
| Super Admin | ✅ Working | |
| Platform Admin | ✅ Working | Uses a simpler `/platform/system` endpoint; the richer `monitoring.py` API is unused |
| Billing | ⚠️ Metadata only | See §3 |
| Timeline (per-agent/incident activity feed) | ❌ Backend only | `timeline.py` endpoints exist, no frontend caller |
| MITRE ATT&CK coverage heatmap | ❌ Backend only | `mitre.py` endpoints exist, no frontend caller |
| DNS / Registry / USB telemetry | ⚠️ Partial | Backend fully supports all three; DNS and USB now have real agent-side collectors (added this engagement — see [10](10-module-agent-telemetry.md)); general Registry telemetry (beyond the persistence-specific Run-key monitoring that already exists) still has no collector |
| Cloud / Kubernetes / Email telemetry | ❌ No collector | Ingestion endpoints exist for future connectors (not an endpoint-agent concern — these would come from cloud API polling / a K8s DaemonSet / an email gateway integration, none of which exist yet) |

## 5. Explicitly out of scope (don't assume these are bugs)

- Third-party SSO / SAML / OIDC — the "Continue with SSO" button on the login page is decorative; no backend support exists. Either build it or remove the button; don't assume it's half-implemented.
- Real payment processing — see §3.
- CI/CD — see [03-infrastructure-plan.md](03-infrastructure-plan.md).
- Row-level tenant isolation at the database layer — enforcement is per-endpoint (see [01-system-architecture.md](01-system-architecture.md) §4).

## 6. Where the exhaustive endpoint-by-endpoint catalog lives

`README.md` at the repo root is a very long, detailed reference of every API route, request/response shape, and rule-engine syntax. This doc set doesn't duplicate that — treat the README as the API reference and this `docs/` folder as the "what's actually true when you run it" layer.
