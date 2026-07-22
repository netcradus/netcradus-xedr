# 11 — Module: Compliance, Reporting & Audit

**Primary files:** `backend/app/api/{compliance,reports,audit_logs}.py`, `backend/app/services/compliance_service.py`.

## 1. Compliance Dashboard — real and live-computed

Frameworks covered per the codebase/README: NIST, ISO 27001, SOC 2, PCI DSS, GDPR, DPDP Act, HIPAA. `compliance_service.py` computes coverage **dynamically from actual live database state** — it's not a static checklist someone fills in manually. Fully wired frontend-to-backend (`Compliance.tsx` ↔ `complianceApi.ts`), no gaps found in this engagement's audit.

## 2. Reports — the summary view works; the rest doesn't have a UI yet

`reports.py` has 7 endpoints:

| Endpoint | Frontend caller? |
|---|---|
| `GET /reports/summary` | ✅ Yes — this is the only one the UI actually calls |
| `POST /reports/generate` | ❌ No |
| `GET /reports/scheduled`, `PUT /reports/scheduled/{type}` | ❌ No |
| `POST /reports/trigger/{type}` | ❌ No |
| `GET /reports/history`, `GET /reports/history/{id}/download` | ❌ No |

All of the unused endpoints are backed by real Celery tasks and produce real PDFs (`reportlab` is in `requirements.txt`) — scheduled daily SOC / weekly executive / monthly compliance reports genuinely run on the beat schedule (see [03-infrastructure-plan.md](03-infrastructure-plan.md)) even though there's no UI to configure or download them. This is pure frontend work if picked up.

## 3. The Reports page's Compliance tab shows fabricated data — fix this before adding anything else here

`netcradus-dashboard/src/pages/Reports/Reports.tsx` (a `FRAMEWORKS` constant, originally around line 18) **hardcodes** NIST/ISO/PCI/HIPAA coverage percentages and hand-written notes as static mock data — it never calls the real `/compliance/dashboard` API that the actual Compliance page (§1) uses. The UI text even claims "Coverage is derived from NET XDR's active monitoring capabilities," which is false for this specific tab. A user comparing the Reports page to the Compliance page would see two different, contradictory scores for the same frameworks. **This was flagged, not yet fixed, as of this handoff** — see [13-known-issues-technical-debt.md](13-known-issues-technical-debt.md) for priority. Fixing it is a matter of replacing the hardcoded `FRAMEWORKS` constant with a real `fetchComplianceDashboard()` call.

## 4. Audit Logs

`audit_logs.py` — simple, read-only, fully wired, matches the frontend (`AuditLogs.tsx`) exactly. Every meaningful action across the platform writes an `AuditLog` row via `log_event()` (called from most `api/` handlers).

**Fixed this engagement**: `AuditLog.tenant_id` was `NOT NULL`, but PlatformAdmin/SuperAdmin actions are cross-tenant (`tenant_id = None` on the user), so every action by those roles was silently failing to write an audit entry — the write was wrapped in a try/except that swallowed the failure, so nothing ever surfaced it. Column is now nullable (migration `20260720_0032`). If you ever see audit-log writes silently failing again, check first whether a new cross-tenant actor type was introduced without accounting for this.
