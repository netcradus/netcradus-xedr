# 12 — Module: Admin, Platform & Billing

**Primary files:** `backend/app/api/{users,admin,super_admin,platform_admin,settings,billing,monitoring}.py`.

## 1. Users & team management

`users.py` only exposes `GET /users/me`. Actual team CRUD (invite, role-change, deactivate) correctly lives in `settings.py:126-229`, not `users.py` — this split is intentional, not a misfile, but worth knowing when you go looking for "where's the invite-user endpoint."

## 2. Settings

`settings.py` covers: team management (above), tenant-wide security policy (`GET/PUT /settings/security` — the `require_mfa` toggle, see [06](06-module-auth-identity-tenancy.md) §4), and per-tenant threat-intel API keys (VirusTotal/AbuseIPDB/OTX, overriding the platform-wide `.env` defaults). Fully wired to `Settings.tsx` / `settingsApi.ts`.

## 3. `admin.py` — effectively dead

The only route, `GET /admin/dashboard`, returns a placeholder message and has no frontend caller anywhere. Either build something real here or remove it; don't assume it does anything today.

## 4. Super Admin & Platform Admin — verified fully wired

Every backend route in both `super_admin.py` and `platform_admin.py` (tenant management, tenant users, tenant agents, support ticket handling) has a matching call in `superAdminApi.ts`/`platformApi.ts`. No dead code found here. See [06-module-auth-identity-tenancy.md](06-module-auth-identity-tenancy.md) §6 for the role distinction — Super Admin is still tenant-scoped; Platform Admin is the cross-tenant one.

Platform Admin's "System Health" tab uses a simpler `/platform/system` endpoint rather than the richer `monitoring.py` API (§6) — that's a deliberate-looking simplification, not obviously a bug, but worth knowing if System Health ever needs more detail.

## 5. Billing — metadata only, not real payment processing

`billing.py`: `GET /billing/plan`, `GET /billing/plans`, `PUT /billing/plan/{tenant_id}`. All three exist server-side with **no frontend caller** — `billingApi.ts` doesn't exist, and plan changes actually go through `settings.py`/`settingsApi.ts` instead. `PLAN_LIMITS` (`billing.py` / `core/billing.py`) only gates agent count per plan:

```python
{"free": 10, "professional": 250, "enterprise": None}
```

There is no Stripe (or equivalent) integration, no checkout flow, no invoicing. If real billing is ever required, this is new integration work, not a bug fix.

## 6. Monitoring — real data, no consumer

`monitoring.py` exposes snapshot/latency/heartbeat/queue/database/worker-health endpoints. Nothing in the frontend calls any `/monitoring/*` path (see §4 — Platform Admin uses a different, simpler endpoint instead). If you're setting up real operational monitoring, decide deliberately between wiring the frontend to this existing richer API vs. adopting a standard external tool (Prometheus/Grafana etc., neither of which this exports to today) — see [03-infrastructure-plan.md](03-infrastructure-plan.md) §6.

## 7. "Continue with SSO" — decorative, not a partial feature

Worth stating plainly here since it's easy to assume otherwise: the SSO button on the login page (`Login.tsx`) has no backend behind it at all — clicking it just sets a client-side error message ("SSO is not configured for this demo"). No SAML/OAuth/OIDC route exists anywhere in `backend/app/api/`. This isn't unfinished wiring to a real feature; it's a placeholder UI element with zero backend investment behind it.
