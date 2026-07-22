# 14 — Security Fixes & Notes

Three real, exploitable security issues were found and fixed during this engagement, plus one data-integrity bug with security-adjacent implications (audit logging silently failing for certain roles). This document exists so the next engineer doesn't have to rediscover any of these, and knows what pattern to watch for going forward.

## Fixed issues

### 1. Cross-tenant playbook execution (IDOR) — CRITICAL
**File:** `backend/app/api/playbooks.py`, `manual_trigger` endpoint (`POST /playbooks/{id}/trigger`)
**Was:** Fetched the target `Alert` by ID with no tenant scoping. Any authenticated tenant Admin could trigger a playbook's response actions — including `isolate_agent` and `kill_process` (see [08-module-soar-response-actions.md](08-module-soar-response-actions.md)) — against another tenant's alert, and therefore another company's live endpoint.
**Fix:** Query now joins through `Agent` and filters `Agent.tenant_id == current_user.tenant_id` (`playbooks.py:228`), matching the pattern every other alert-scoped endpoint already used.
**Why it matters beyond this one endpoint:** this is the general shape of bug to watch for across the whole codebase — see [01-system-architecture.md](01-system-architecture.md) §4 and [06-module-auth-identity-tenancy.md](06-module-auth-identity-tenancy.md) §7 for the broader tenant-isolation model this violated.

### 2. Webhook SSRF — HIGH
**Files:** `backend/app/services/notification_service.py` (`validate_webhook_url`, line 40), `backend/app/api/notifications.py`
**Was:** Slack/Teams webhook URLs were fetched server-side with no host validation. A tenant admin could point a webhook at internal infrastructure or a cloud metadata endpoint (e.g. `169.254.169.254`) and read the response back via the synchronous `/notifications/test` call — a classic SSRF-to-data-exfiltration chain.
**Fix:** `validate_webhook_url()` resolves the hostname and rejects anything not a plain `http`/`https` URL resolving to a public IP (rejects private, loopback, link-local, reserved, multicast, and unspecified address ranges). Enforced **twice**: once at save time (fast feedback to the user) and again immediately before every send (defends against DNS rebinding — the hostname could resolve differently between when it was saved and when it's actually used).
**Watch for:** any *new* feature that fetches a user-supplied URL server-side (a future "custom webhook," "fetch from URL" import feature, etc.) needs the same treatment. Consider extracting `validate_webhook_url` into a shared utility if a second URL-fetching feature is ever added, rather than reimplementing the check.

### 3. Auth timing side-channel — MEDIUM
**File:** `backend/app/services/user_service.py`, `authenticate_user`
**Was:** Returned immediately (near-zero latency) when the email didn't exist, but ran a full bcrypt verification (deliberately slow, ~100ms+) when it did. This latency difference is measurable and lets an attacker enumerate which emails have registered accounts against `/auth/login`, without needing a password.
**Fix:** A precomputed dummy bcrypt hash (`_DUMMY_HASH`, `user_service.py:15`) is verified against on the "no such user" path too, so both cases take approximately the same time regardless of whether the email exists.
**Note:** this is a mitigation, not a perfect fix — network jitter and other timing factors mean this kind of side-channel is never fully eliminated, only made impractical to exploit remotely. Don't reintroduce an early-return before the dummy-hash check in any future refactor of this function.

### 4. Audit logs silently failing for cross-tenant actors — data integrity, security-adjacent
**File:** `backend/app/models/audit_log.py`
**Was:** `AuditLog.tenant_id` was `NOT NULL`, but PlatformAdmin/SuperAdmin actions are inherently cross-tenant (`User.tenant_id = None` for PlatformAdmin). Every login or action by those roles silently failed to write an audit-log row — the write was wrapped in a try/except that swallowed the error with no visible failure anywhere.
**Fix:** Column made nullable (migration `20260720_0032_audit_log_nullable_tenant.py`).
**Why this belongs in a security doc:** an incomplete audit trail is itself a security gap — if a Platform Admin account is ever compromised, this bug would have meant their actions left no trace. Verify audit logging end-to-end (not just "the endpoint returns 200") any time a new cross-tenant actor type is introduced.

## Standing security posture — what's already good

Worth knowing so you don't duplicate existing protections:
- Rate limiting exists on auth endpoints specifically (`/auth/login` 10/min, `/auth/register` 5/min, `/auth/forgot-password` 3/min — see `limiter.py` usage in `auth.py`).
- Refresh tokens are httpOnly, path-scoped to `/auth`, rotated on every use.
- Password-change invalidates all outstanding access tokens via the `pwd_iat` claim check (see [06](06-module-auth-identity-tenancy.md) §3-4).
- Forgot-password always returns an identical response regardless of whether the email exists (prevents account enumeration via that specific endpoint).
- Security headers applied at the nginx layer for every response in production (`X-Content-Type-Options`, `X-Frame-Options: DENY`, `X-XSS-Protection`, `Referrer-Policy`, `Permissions-Policy` — see `nginx/nginx.conf`).
- `SECRET_KEY` placeholder values are rejected at startup unless `DEBUG=true` (`backend/app/core/config.py:44-52`).

## Recommended next security work (not yet done)

- **Systematic tenant-isolation review**: the bug in §1 was found by manual audit of one specific endpoint. A full pass across every `api/*.py` file, specifically checking "does every query filter by `tenant_id` (directly or via join) before returning or acting on a row," would likely find more of the same class if any exist. This is mechanical, tedious work — a good candidate for a dedicated review session rather than something to half-do alongside feature work.
- **YARA and Reports fake-data issues** ([13-known-issues-technical-debt.md](13-known-issues-technical-debt.md) Priority 1) aren't security vulnerabilities in the traditional sense, but "security tool reports false negatives silently" and "compliance dashboard shows fabricated numbers" both have real trust/liability implications if a customer relies on either for an actual security or compliance decision.
- **SSO** is currently decorative (see [12-module-admin-platform-billing.md](12-module-admin-platform-billing.md) §7) — if/when real SSO is built, it's new attack surface and deserves its own security review, not an assumption that it inherits the existing auth model's protections automatically.
- Re-run `backend/tests/security/` after any change touching auth, tenancy, or the response-action endpoints in [08-module-soar-response-actions.md](08-module-soar-response-actions.md).
