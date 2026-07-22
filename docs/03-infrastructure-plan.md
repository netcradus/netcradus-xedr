# 03 — Infrastructure Plan

## 1. Services and what happens if each one is missing

| Service | Required? | What breaks without it |
|---|---|---|
| PostgreSQL | **Hard requirement** | Nothing works — the app won't start without a reachable `DATABASE_URL`. |
| Redis | Optional | Celery tasks run synchronously in-process instead (`task_always_eager=not bool(_redis)`, `celery_app.py:25`). Fine for one small instance; under real load this blocks the request thread that triggered the task (e.g. sending a notification) instead of returning immediately. |
| Celery worker + beat | Optional, but see above | Same as Redis — without the worker process running, tasks queued to Redis just sit there unprocessed. `beat` specifically drives the periodic jobs below; without it, none of them ever fire. |
| SMTP | Optional | Email verification is skipped entirely (`_SMTP_ENABLED` flag) — acceptable for internal use, not for public signup. Password reset emails also won't send. |
| S3-compatible object storage | Optional | `backend/app/core/storage.py` falls back to local filesystem (`STORAGE_LOCAL_DIR`, default `./local_storage`) when `STORAGE_BUCKET` is unset. Fine for a single-node deployment; breaks if you ever run multiple backend replicas without a shared volume, since each replica would have its own local storage directory. |
| nginx | Production only | Manual/dev setups use Vite's dev proxy instead (see [02](02-deployment-flow.md)). |
| yara-python (pip package) | Optional | See [13-known-issues-technical-debt.md](13-known-issues-technical-debt.md) — YARA scanning silently no-ops without it, no error surfaced. |

## 2. Ports (as shipped in `docker-compose.yml`)

| Service | Container port | Host port |
|---|---|---|
| postgres | 5432 | 5433 |
| redis | 6379 | 6379 |
| backend | 8000 | 8000 |
| frontend (nginx-served static) | 80 | not exposed directly |
| nginx (the actual entrypoint) | 80 | 80 |

Only `nginx` (port 80) is meant to be internet-facing. `backend` on 8000 and `postgres` on 5433 being host-exposed is convenient for local dev but should be firewalled off in any real deployment — nothing in the compose file itself restricts external access to them.

## 3. Celery queues and periodic schedule

Three named queues (`celery_app.py:52-66`), so worker capacity can eventually be split by workload if one becomes a bottleneck:

- `notifications` — Slack/Teams/email dispatch, agent-offline checks
- `enrichment` — IOC enrichment, async threat-intel lookups
- `default` — everything else (reports)

Periodic jobs (require `celery beat` running — see `celery_app.py:69-100`):

| Job | Schedule |
|---|---|
| Mark stale agents offline | Every 60s |
| Sweep expired cached reports | Every 30 min |
| Daily SOC report | 06:00 UTC daily |
| Weekly executive report | 06:00 UTC Mondays |
| Monthly compliance report | 06:00 UTC on the 1st |

Task hygiene already in place worth knowing about: `task_acks_late=True` (a crashed worker re-queues its in-flight task rather than losing it), `worker_max_tasks_per_child=200` (workers recycle periodically to bound memory growth), and both a soft (120s) and hard (180s) per-task time limit.

## 4. Scaling considerations

- **Backend (`uvicorn`)**: stateless, horizontally scalable behind nginx/a load balancer as-is — no in-memory session state (JWT + DB-backed refresh tokens).
- **Celery workers**: also horizontally scalable; queue routing already exists to let you scale `enrichment` or `notifications` independently if one becomes a bottleneck.
- **`celery beat`**: must run as exactly **one** instance — running two would double-fire every periodic job (duplicate reports, duplicate offline-checks). Nothing in the current setup prevents you from accidentally scaling it >1; that's an operational discipline issue to watch for.
- **PostgreSQL**: not addressed by anything in this repo — no read replica support, no connection pooler (e.g. PgBouncer) configured. `db.py` uses SQLAlchemy's own pool (`pool_size=10, max_overflow=20`); at real scale with multiple backend replicas, plan for a pooler in front of Postgres rather than each replica opening its own 10-30 connections.
- **Object storage**: switch `STORAGE_BUCKET` to a real S3-compatible bucket before scaling past one backend replica (see §1).

## 5. Backup & disaster recovery

**Nothing in this repo automates backups.** This is an operational gap, not a code gap — plan for it separately:

- PostgreSQL: standard `pg_dump`/WAL-archiving strategy, not provided here.
- Object storage (reports, evidence files, agent update packages): if using the local-filesystem fallback, that directory needs to be part of your backup plan too — it is not otherwise redundant.
- No documented restore procedure exists yet. Write one before you need it, not after.

## 6. Observability — what exists vs. what doesn't

- `backend/app/api/monitoring.py` exposes latency/heartbeat/queue/database/worker snapshot endpoints, but **nothing in the frontend calls them** (see [13-known-issues-technical-debt.md](13-known-issues-technical-debt.md)) — Platform Admin's "System Health" tab uses a separate, simpler `/platform/system` endpoint instead. If you want real monitoring dashboards, either wire the frontend to the richer `monitoring.py` data or replace it with a standard tool (Prometheus/Grafana, Datadog, etc.) — nothing here currently exports metrics in a format either would consume natively.
- No centralized logging shipping is configured — container/process stdout only.
- No CI, so no automated build/test gate before deploy. `backend/tests/` (8 files: `api/`, `integration/`, `security/`, `unit/`) exists and should be run manually before any release until CI is added.

## 7. Environment variable reference

See [02-deployment-flow.md](02-deployment-flow.md) and the Setup & User Manual PDF for the full table with explanations. The authoritative source is always `backend/app/core/config.py` — `.env.example` has drifted slightly from it in the past (e.g. it once used `SMTP_PASSWORD` where the code actually reads `SMTP_PASS`), so when in doubt, read `config.py` directly rather than trusting the example file.
