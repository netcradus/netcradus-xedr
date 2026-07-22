# 06 — Module: Auth, Identity & Tenancy

**Primary files:** `backend/app/api/auth.py`, `backend/app/api/users.py`, `backend/app/api/settings.py` (team CRUD lives here, not `users.py`), `backend/app/core/dependencies.py`, `backend/app/core/security.py`, `backend/app/services/user_service.py`, `backend/app/services/platform_admin_service.py`.

## 1. Registration

`POST /auth/register` (`auth.py:120`) — self-service tenant signup. Creates a `Tenant` + an `Admin`-role `User` in one transaction. Rejects duplicate email and duplicate company name (409 either way). Response includes `tenant_api_key` (the new tenant's `Tenant.api_key`) — the frontend stashes this in `sessionStorage` and shows it on the Onboarding screen (`netcradus-dashboard/src/pages/Onboarding/`), since it's what an endpoint agent needs to enroll under this specific company (see [10-module-agent-telemetry.md](10-module-agent-telemetry.md)).

Email verification: `email_verified = not smtp_enabled` at creation time — if `SMTP_HOST` is unset, accounts are auto-verified. This is deliberate dev/test-friendly behavior, not a bug.

There is also a legacy `POST /auth/signup` (`user_service.create_user`) that assigns users to a shared "Default" tenant. It's marked legacy in its own docstring; the frontend does not use it. It was fixed this engagement to also respect the SMTP auto-verify behavior (previously it always left `email_verified=False` regardless of SMTP config).

## 2. Login

`POST /auth/login` (`auth.py:209`) — standard OAuth2 password-grant shape (form-encoded `username`/`password`, despite `username` actually being an email). Rate-limited to 10/min.

- If the user has `mfa_enabled` + `totp_secret` set: returns `{"mfa_required": true, "mfa_session": "<jwt>"}` instead of a real access token. The `mfa_session` JWT is short-lived (5 min, `type: mfa_pending`) and must be exchanged via the MFA verification endpoint.
- Otherwise: returns a real access token + sets the refresh-token cookie.
- **Timing side-channel fixed this engagement** (see [14-security-fixes-and-notes.md](14-security-fixes-and-notes.md)): `authenticate_user` (`user_service.py`) now always runs a bcrypt verify — against a precomputed dummy hash when the email doesn't exist — so "no such user" and "wrong password" take the same amount of time.

## 3. Token model

| Token | Lifetime | Where it lives | Purpose |
|---|---|---|---|
| Access token | 15 min default (`ACCESS_TOKEN_EXPIRE_MINUTES`) | Returned in response body, held client-side | `Authorization: Bearer` on every API call |
| Refresh token | 30 days default (`REFRESH_TOKEN_EXPIRE_DAYS`) | httpOnly cookie, path `/auth` | `POST /auth/refresh` to silently mint a new access token; rotates on every use |
| MFA session | 5 min, fixed | Returned in login response body | One-time exchange for a real access token via MFA verify |

Access tokens embed `sub` (email) and, if the user has ever changed their password, `pwd_iat` (the change timestamp) — `get_current_user` (`dependencies.py:20`) rejects any token whose `pwd_iat` predates the user's current `password_changed_at`, so changing a password invalidates every access token issued before the change (the refresh-token cookie is also explicitly cleared on password reset — see `reset_password` in `auth.py`).

## 4. The `get_current_user` guard chain

Every protected endpoint depends on this (`dependencies.py:20-84`), in order:

1. Decode JWT, reject if not `type: access` (blocks reusing an MFA-pending token) or malformed.
2. Look up the user; 401 if not found.
3. 403 if `is_active=False`.
4. 403 `EMAIL_NOT_VERIFIED` — **only if `_SMTP_ENABLED`** (module-level flag computed once from `settings.smtp_host` at import time). If SMTP isn't configured, this check is skipped entirely regardless of the user's actual `email_verified` value.
5. Reject if `pwd_iat` predates the last password change.
6. 403 `MFA_REQUIRED` if the user's tenant has `require_mfa=True`, the user hasn't enabled MFA, and the user's role isn't `SuperAdmin`/`PlatformAdmin` (those two roles are exempt from forced enrollment, though they can still opt in).

## 5. Password reset

`POST /auth/forgot-password` always returns the same generic message regardless of whether the email exists (`auth.py:299-316`) — this is deliberate, to prevent using this endpoint to enumerate registered accounts. Reset tokens expire after 1 hour, single-use (cleared on success). Successful reset also invalidates the refresh-token cookie and stamps `password_changed_at`, which cascades into invalidating outstanding access tokens per §3-4.

## 6. Roles

Five roles, seeded by `seed.py` / `platform_admin_service.py`:

| Role | Scope | Notes |
|---|---|---|
| Viewer | Tenant | Read-only |
| Analyst | Tenant | Day-to-day investigation work; several endpoints gate on this specifically (e.g. `analyst_required` dependency used in `hunt.py`) |
| Admin | Tenant | Full tenant control — team, rules, playbooks, billing |
| SuperAdmin | Tenant (senior) | `tenant_id` is still set — this is **not** the cross-tenant role, despite the name being easy to confuse with Platform Admin |
| PlatformAdmin | Cross-tenant | `tenant_id = None`. Manages the SaaS platform itself. Created automatically on backend startup from `.env`'s `PLATFORM_ADMIN_EMAIL`/`PLATFORM_ADMIN_PASSWORD` (`platform_admin_service.py:8`) — only if the `PlatformAdmin` role already exists, which itself depends on `seed_roles()` having run first in `main.py`'s startup sequence. |

## 7. Multi-tenancy enforcement (the part to be paranoid about)

There is no database-level tenant isolation (no row-level security). Every query that touches tenant-scoped data is individually responsible for filtering by `current_user.tenant_id`, either directly (tables with their own `tenant_id` column) or via a join (most telemetry/detection tables scope through `Agent.tenant_id`). **When adding a new endpoint that reads or writes tenant-scoped data, the single most important thing to check in review is "does this filter by tenant_id, and does it do so before or after fetching the row by ID."** A missing filter is a cross-tenant IDOR — exactly the bug found and fixed in `playbooks.py`'s manual trigger endpoint this engagement (see [14-security-fixes-and-notes.md](14-security-fixes-and-notes.md)).

## 8. Company API key vs. registration token — don't confuse these

Two completely different secrets are involved in getting a new agent enrolled, and mixing them up is the most common setup mistake (see [13-known-issues-technical-debt.md](13-known-issues-technical-debt.md)):

- **`AGENT_REGISTRATION_TOKEN`** (backend `.env`) — a single, global anti-abuse secret. Every agent registering against this backend must present it (unless `DEBUG=true`, in which case registration is open with a loud stderr warning).
- **`tenant_api_key`** (per-tenant, shown at registration / in Settings) — determines *which company* a newly-registered agent belongs to. Omitting it silently assigns the device to the shared "Default" tenant rather than rejecting the request.
