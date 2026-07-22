# 05 — Phase Coverage Report

> **A note on methodology.** No original phase/sprint plan exists anywhere in this repository — not in the README, not in commit history as a formal document, not in either of the pre-existing PDF reports. What follows is **reconstructed** from the 92-commit git history into logical phases, purely for handoff readability. Two commits do reference an internal step/feature numbering (`Implement Steps 3-10: SOAR, Settings, Agent, Notifications, Reports, Threat Intel, AI Layer, SuperAdmin`, and later ad-hoc labels like `Vulnerability Scanner (Feature 0)` / `Browser Security (Feature 13)`), but that numbering isn't consistent or complete across history, so it wasn't used as the basis for the phases below — treat this as an engineering-reconstructed timeline, not a rediscovered official plan.

## Phase 1 — Foundation
Initial backend scaffolding, agent skeleton, dashboard UI shell, first database models, first working login/signup.
**Coverage: Complete.** This is the load-bearing base the rest of the product sits on; still structurally intact.

## Phase 2 — Fleet & Threat Data Basics
Agent inventory (device registration/check-in), IOC tracking, early alert model.
**Coverage: Complete.**

## Phase 3 — Multi-Tenant SaaS Foundation
One large commit (`Implement Steps 3-10`) bringing in SOAR command dispatch, Settings, Agent management, Notifications, Reports, Threat Intel feeds, the AI layer, and SuperAdmin — essentially the jump from "single-tenant demo" to "multi-tenant product."
**Coverage: Complete**, but this is also where some of the "response action" naming confusion started (see [08-module-soar-response-actions.md](08-module-soar-response-actions.md) — the manual command dispatcher built here later got labeled "Playbooks" in the UI, distinct from the real playbook engine built in Phase 6).

## Phase 4 — Auth Hardening & Platform/Tenant Separation
Refresh tokens, MFA/TOTP, tenant self-registration, email verification, rate limiting, Platform Admin split out from Super Admin as a distinct cross-tenant role.
**Coverage: Complete and verified this engagement** — see [06-module-auth-identity-tenancy.md](06-module-auth-identity-tenancy.md) and [14-security-fixes-and-notes.md](14-security-fixes-and-notes.md) for a timing side-channel fix applied to this area.

## Phase 5 — Detection & Incident Response Core
Database-driven detection rule engine, full SOC workflow (Alert → Incident → Investigation → Evidence → Resolution), Sigma rule import/conversion, threat hunting API surface, Attack Graph visualization.
**Coverage: Complete**, with one caveat — incident evidence upload has a working file-upload endpoint server-side with no corresponding UI (text evidence works fine). See [07-module-detection-engine.md](07-module-detection-engine.md).

## Phase 6 — SOAR Actions & AI Copilot
Four new response actions plus six seeded threat playbooks (the *real* playbook engine — condition matching, multi-action workflows), and the AI Security Copilot (explain/root-cause/remediation/attack-chain/chat).
**Coverage: Partial.** The engine and backend are real and functional (verified — `playbook_engine.py` is not a stub); the AI Copilot backend is real too. Neither has a matching frontend: the "Playbooks" nav page is a different, simpler manual dispatcher, and none of the 5 AI Copilot endpoints are called from the UI. This is the single largest "backend built, frontend never followed up" gap in the product — see [08-module-soar-response-actions.md](08-module-soar-response-actions.md).

## Phase 7 — Compliance & Enterprise Telemetry
Compliance Dashboard (ISO 27001, SOC 2, PCI DSS, GDPR, DPDP Act, HIPAA), YARA integration, and what the commit history literally calls the "Enterprise feature set": memory scanning, timeline, live response, and DNS/registry/USB/browser/cloud/K8s/email telemetry tables.
**Coverage: Partial, and this is where most of the "backend-only" features originate.** Compliance is fully real and live-computed. YARA is wired but silently degrades without `yara-python` installed. Live Response and Timeline have zero frontend. Of the telemetry types added here, only DNS and USB now have a real agent-side collector (added this engagement); Registry (general, beyond persistence-specific Run-key monitoring), Cloud, Kubernetes, and Email have ingestion endpoints but no data source at all. See [10-module-agent-telemetry.md](10-module-agent-telemetry.md).

## Phase 8 — Production Hardening & Scale
MITRE ATT&CK coverage endpoints, a 141-test automated suite, security hardening (headers, correlation IDs, MFA enforcement, global exception handler), the Celery/Redis async pipeline maturing into its current queue-routed form, billing/plan-limit awareness, agent auto-update (version management + self-update flow), API versioning (`/api/v1` prefix on everything), and the rename from SentryXDR to NetcradXDR internally.
**Coverage: Complete for what shipped**, except the MITRE coverage heatmap endpoints — real backend, no frontend caller (same pattern as Phase 6/7). Agent auto-update is fully real end-to-end (verified this engagement) but has no admin UI to upload a new version package.

## Phase 9 — Feature Completion Sprint
Vulnerability Scanner, Compliance Dashboard visual redesign, rebrand to "NET XDR" across the frontend, Browser Security.
**Coverage: Complete.** Both Vulnerability Scanner and Browser Security were independently verified this engagement to be fully wired frontend-to-backend with no dead code or mock data.

## Phase 10 — Stabilization & Handoff (this engagement)
Not a feature phase — a full audit and remediation pass, plus this documentation set. Summary:
- Full backend + frontend feature-completeness audit (parallel review across all ~24 feature areas)
- 3 real security vulnerabilities found and fixed: cross-tenant playbook execution (IDOR), webhook SSRF, auth timing side-channel — see [14-security-fixes-and-notes.md](14-security-fixes-and-notes.md)
- A broken `tsconfig.json` setting that had silently disabled TypeScript type-checking was fixed, surfacing and fixing 11 real (previously invisible) frontend bugs
- Two new agent-side telemetry collectors added (DNS, USB) with real, verified end-to-end data flow
- A real deployment blocker fixed: the frontend's API address was hardcoded to a specific dev machine's port instead of being deployment-portable
- A real multi-tenancy gap fixed: agents could enroll without ever specifying which company they belonged to
- This `docs/` handoff set, plus two end-user-facing PDFs (Feature Guide, Setup & User Manual)

**Coverage: Complete for what was scoped.** Everything found is written up in [13-known-issues-technical-debt.md](13-known-issues-technical-debt.md) — nothing discovered during this pass was silently left undocumented.

## Overall verdict

The product is substantially further along on the **backend** than the **frontend** — a recurring pattern across Phases 6, 7, and 8 is a fully real, tested backend capability (playbooks, live response, timeline, MITRE coverage, AI copilot, scheduled reports) that was never connected to a UI. None of these are stubs or fake code — they're genuine, working features waiting for their screen. If prioritizing next work, **frontend wiring for already-built backend capability is higher leverage than new backend features**, in roughly this order of user-visible impact: (1) real Playbook CRUD UI, (2) Live Response terminal, (3) AI Copilot panel on the Alert detail view, (4) scheduled-report configuration UI, (5) MITRE coverage heatmap.
