# 02 — Deployment Flow

There is **no CI/CD pipeline** in this repo (no `.github/workflows`, no other CI config found). All deployment described below is manual. If you set up CI/CD, wire it around the steps in this document — don't skip the manual verification the first time.

## 1. Docker Compose (recommended path)

`docker-compose.yml` (repo root) defines 7 services: `postgres`, `redis`, `backend`, `celery`, `celery-beat`, `frontend`, `nginx`.

```bash
cp backend/.env.example backend/.env
# edit backend/.env — see 03-infrastructure-plan.md for what each service needs
docker compose up -d --build
```

- `postgres` maps container port 5432 → host port **5433** (avoids clashing with a locally-installed Postgres).
- `backend` maps to host port **8000**.
- `nginx` is the only thing exposed on host port **80** — it proxies `/api/` to `backend:8000` and everything else to `frontend:80` (see `nginx/nginx.conf`). Visit `http://localhost` (not `:8000` or `:5173`) once Compose is up.
- The frontend's Dockerfile (`netcradus-dashboard/Dockerfile`) does a plain `npm run build` with no build args — this works because the frontend calls the backend via a relative `/api/v1` path (see [01-system-architecture.md](01-system-architecture.md) §2), so it doesn't need to know the backend's address at build time.

Health check before declaring it working:
```bash
curl http://localhost/health
curl -X POST http://localhost/api/v1/auth/login -d "username=<platform-admin-email>&password=<...>"
```

## 2. Manual setup (no Docker)

Useful for active backend/frontend development, where hot-reload and direct debugger access matter more than parity with prod.

### Backend
```bash
cd backend
python -m venv venv && venv\Scripts\activate   # or: source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env      # then edit — see 03-infrastructure-plan.md
alembic upgrade head
python seed.py            # creates roles, a "Default" tenant, admin@netcradus.com / Admin@1234
uvicorn main:app --host 0.0.0.0 --port 8000
```

`seed.py` is idempotent — safe to re-run, it checks for existing rows before inserting.

**Background workers** — scheduled reports, Slack/Teams/email notification dispatch, and IOC enrichment run as Celery tasks, not inside the `uvicorn` process. If `REDIS_URL` is unset, the app degrades to running these synchronously in-process (fine for a single dev instance); if it's set, you must also run:
```bash
celery -A app.core.celery_app worker --loglevel=info
celery -A app.core.celery_app beat --loglevel=info
```
Forgetting this is the single most common "why isn't X happening" support question for a manual deployment — the app looks fully functional otherwise.

### Frontend
```bash
cd netcradus-dashboard
npm install
npm run dev                                          # backend expected on :8000
# or, if your backend is elsewhere:
VITE_BACKEND_URL=http://localhost:8000 npm run dev
```
`npm run build` produces `dist/` for static hosting behind any reverse proxy that forwards `/api/` to the backend the same way `nginx/nginx.conf` does.

### Optional: YARA scanning
`yara-python` is **not** in `requirements.txt` and is not installed by default in this environment. Without it, `backend/app/services/yara_service.py` degrades silently — `scan-file` always returns `clean: true` and `validate` always reports rules as valid, with no error surfaced anywhere. Install with `pip install yara-python` if the team needs real YARA scanning. See [13-known-issues-technical-debt.md](13-known-issues-technical-debt.md) for the full detail on this failure mode.

## 3. Database migrations

Alembic, `backend/alembic/`. 32 migrations as of this handoff, sequentially chained via `down_revision`.

```bash
alembic upgrade head       # apply all pending migrations
alembic current            # what's currently applied
alembic history            # full chain
```

When adding a migration, follow the existing naming convention: `YYYYMMDD_NNNN_short_description.py` (see any file in `alembic/versions/` for the pattern), and set `down_revision` to whatever the current head actually is — check with `alembic heads` first, don't assume the highest-numbered file is the head if two people branched migrations in parallel.

## 4. Deploying an endpoint agent

```bash
# on the target device, inside a copy of agent/
pip install -r requirements.txt
# edit config.json:
#   server_url        -> https://your-backend/api/v1
#   registration_token -> must match AGENT_REGISTRATION_TOKEN in the backend's .env
#   tenant_api_key     -> the target company's API key (Settings page, or the
#                          Onboarding screen shown right after that company registered)
python main.py
```

If `tenant_api_key` is omitted, the backend's fallback behavior (`agent_service.py:39-48`) silently assigns the device to the shared "Default" tenant instead of rejecting the registration — there is no error to catch this mistake. Always double-check the device shows up under the right company in Assets after first check-in.

The agent self-updates: on each heartbeat, the backend compares the agent's reported version against the latest `AgentVersion` row for its OS and, if newer, returns a signed download URL + SHA-256 checksum (`agents.py:37-58`). The agent downloads, verifies, and relaunches itself via `agent/updater.py`. There is currently **no UI** to upload a new `AgentVersion` — see [13-known-issues-technical-debt.md](13-known-issues-technical-debt.md).

## 5. First login after any fresh deployment

Two separate account types are created independently — see [06-module-auth-identity-tenancy.md](06-module-auth-identity-tenancy.md) for the full distinction:

1. **Platform Admin** — auto-created on backend startup from `PLATFORM_ADMIN_EMAIL` / `PLATFORM_ADMIN_PASSWORD` in `.env`. Manages the platform, not any customer's data.
2. **Your first company account** — created by visiting the dashboard and registering a company ("Create one free"), or via `seed.py`'s `admin@netcradus.com` / `Admin@1234` for local testing only.

## 6. Production checklist

Carried over and expanded from the Setup Guide PDF — re-verify all of these before any real deployment:

- [ ] Real, random `SECRET_KEY` (the server refuses to boot with the placeholder unless `DEBUG=true` — see `backend/app/core/config.py:44-52`)
- [ ] Non-default database password
- [ ] `DEBUG=false`
- [ ] `ALLOWED_ORIGINS` set to the real dashboard domain
- [ ] Strong `AGENT_REGISTRATION_TOKEN` set (blank + `DEBUG=false` disables new agent registration entirely, which is safe-by-default but means someone will ask why agents can't enroll)
- [ ] Real SMTP configured (email verification is silently skipped otherwise — acceptable for internal/dev use, not for a real multi-tenant SaaS deployment)
- [ ] Strong, unique `PLATFORM_ADMIN_PASSWORD`
- [ ] Celery worker + beat running (or confirmed via Docker Compose) if any tenant relies on scheduled reports / notifications / IOC enrichment
- [ ] Default `seed.py` account deactivated or password-changed if it was ever used
- [ ] HTTPS terminated somewhere in front of nginx (nginx config here doesn't do TLS itself)
- [ ] PostgreSQL backup schedule in place — see [03-infrastructure-plan.md](03-infrastructure-plan.md)
