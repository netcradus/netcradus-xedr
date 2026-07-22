# NET XDR — Engineering Handoff Documentation

This folder is a complete technical handoff for the NET XDR platform (backend package name: `NetcradXDR`). It was written for the next engineer(s) taking over the project, with no assumption of prior context beyond general full-stack development experience.

**How this doc set is organized:** files `01`–`05` are cross-cutting (architecture, deployment, infra, product scope, build history). Files `06`–`12` are per-module deep dives. Files `13`–`14` are the two documents you should read most carefully before making changes — they list what's actually broken, missing, or security-sensitive, verified against the running code rather than assumed from reading source alone.

| File | Covers |
|---|---|
| [01-system-architecture.md](01-system-architecture.md) | Components, request flow, auth model, multi-tenancy, directory layout |
| [02-deployment-flow.md](02-deployment-flow.md) | How to actually get the system running, Docker and manual |
| [03-infrastructure-plan.md](03-infrastructure-plan.md) | Services, ports, scaling, backups, what's missing operationally |
| [04-product-scope.md](04-product-scope.md) | What NET XDR is, who it's for, plans/billing, feature inventory |
| [05-phase-coverage-report.md](05-phase-coverage-report.md) | Build history reconstructed into phases, with a completeness verdict per phase |
| [06-module-auth-identity-tenancy.md](06-module-auth-identity-tenancy.md) | Login, registration, MFA, roles, multi-tenant isolation |
| [07-module-detection-engine.md](07-module-detection-engine.md) | Alerts, Incidents, Detection Rules, Sigma, YARA |
| [08-module-soar-response-actions.md](08-module-soar-response-actions.md) | Playbooks, Commands, Live Response — the endpoints that can actually act on a live endpoint (isolate/kill/block/quarantine). Read this before pointing any security testing at a deployed instance. |
| [09-module-threat-intel-hunting.md](09-module-threat-intel-hunting.md) | IOCs, Threat Feeds, Threat Hunting, Attack Graph, MITRE mapping |
| [10-module-agent-telemetry.md](10-module-agent-telemetry.md) | The endpoint agent (`agent/`) and what telemetry actually flows end to end vs. what's ingest-only |
| [11-module-compliance-reporting-audit.md](11-module-compliance-reporting-audit.md) | Compliance Dashboard, Reports, Audit Logs |
| [12-module-admin-platform-billing.md](12-module-admin-platform-billing.md) | Users/Settings, Super Admin, Platform Admin, Billing, Monitoring |
| [13-known-issues-technical-debt.md](13-known-issues-technical-debt.md) | Every verified gap, dead code path, and silent-failure mode found in this codebase, with file:line references |
| [14-security-fixes-and-notes.md](14-security-fixes-and-notes.md) | Security issues found and fixed during this engagement, and what to watch for next |

## Where else to look

- **`README.md`** (repo root) — the original, very detailed feature/API reference. This doc set doesn't try to replace it; treat it as the exhaustive endpoint catalog and these docs as the "how it actually works and what to watch out for" layer on top.
- **`NET_XDR_Feature_Guide.pdf`** and **`NET_XDR_Setup_and_User_Manual.pdf`** (repo root, not version-controlled — `*.pdf` is gitignored) — end-user-facing documentation, useful if you need to explain a feature to a non-engineer.
- **`backend/tests/`** — 8 test files across `api/`, `integration/`, `security/`, and `unit/`. Run before and after any change to auth, tenancy, or the response-action endpoints.

## A note on how these docs were produced

This handoff was written by an AI coding agent (Claude) working alongside the outgoing engineer, based on direct inspection of the running code — not from memory or assumption. Where a claim could be verified by actually running something (a query, an endpoint call, a build), it was. Where something is a judgment call or an inference rather than a directly-observed fact, it's labeled as such. Section 13 in particular exists because several things in this codebase *look* correct by inspection but silently misbehave at runtime — those were only caught by actually exercising them.
