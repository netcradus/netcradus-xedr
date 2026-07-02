"""
Threat Hunting API
==================
All endpoints are scoped to the authenticated user's tenant and require
at least Analyst role. At least one search parameter must be supplied per
endpoint — a bare call with no filters is rejected with 422.

Endpoints
---------
GET /hunt/process     — Search process telemetry by name, cmdline, username, hash, parent
GET /hunt/hash        — Cross-search SHA256/MD5 in process and file telemetry
GET /hunt/ip          — Search network telemetry by remote IP (with optional port filter)
GET /hunt/domain      — Search cmdlines and file paths for a domain/URL fragment
GET /hunt/persistence — Search persistence entries by type, name, or path
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.permissions import analyst_required
from app.database.db import get_db
from app.models.user import User
from app.services import hunt_service

router = APIRouter(prefix="/hunt", tags=["Threat Hunting"])

_MAX_DAYS  = 90
_MAX_LIMIT = 1000
_DEF_LIMIT = 200


def _clamp(days: int, limit: int) -> tuple[int, int]:
    return min(days, _MAX_DAYS), min(limit, _MAX_LIMIT)


# ── GET /hunt/process ─────────────────────────────────────────────────────────

@router.get("/process")
def hunt_process(
    name:     str | None = Query(default=None, description="Process name substring (ILIKE)"),
    cmdline:  str | None = Query(default=None, description="Command-line substring (ILIKE)"),
    username: str | None = Query(default=None, description="Executing user (ILIKE)"),
    hash:     str | None = Query(default=None, description="SHA-256 prefix/full value"),
    parent:   str | None = Query(default=None, description="Parent process name substring"),
    agent_id: int | None = Query(default=None, description="Restrict search to a single agent"),
    days:     int        = Query(default=7,    description="Look-back window in days (max 90)"),
    limit:    int        = Query(default=_DEF_LIMIT, description="Max hits returned (max 1000)"),
    current_user: User   = Depends(analyst_required),
    db: Session          = Depends(get_db),
):
    """
    Hunt across process telemetry.

    **At least one** of `name`, `cmdline`, `username`, `hash`, or `parent` is required.

    **Example queries**
    - `?name=mimikatz` — find every execution of mimikatz across all endpoints
    - `?cmdline=-enc` — find all encoded PowerShell invocations
    - `?parent=cmd.exe&cmdline=powershell` — suspicious parent→child spawn
    - `?hash=e3b0c44298fc1c149afbf4c` — IOC hash present in process list
    """
    if not any([name, cmdline, username, hash, parent]):
        raise HTTPException(
            status_code=422,
            detail="Provide at least one filter: name, cmdline, username, hash, or parent",
        )
    days, limit = _clamp(days, limit)
    return hunt_service.hunt_process(
        db, current_user.tenant_id,
        name=name, cmdline=cmdline, username=username,
        hash_val=hash, parent=parent,
        agent_id=agent_id, days=days, limit=limit,
    )


# ── GET /hunt/hash ────────────────────────────────────────────────────────────

@router.get("/hash")
def hunt_hash(
    value:    str        = Query(..., min_length=4, description="SHA-256 or MD5 value (full or prefix)"),
    agent_id: int | None = Query(default=None),
    days:     int        = Query(default=30),
    limit:    int        = Query(default=_DEF_LIMIT),
    current_user: User   = Depends(analyst_required),
    db: Session          = Depends(get_db),
):
    """
    Hunt for a file hash (SHA-256 or MD5) across both process telemetry and
    file-event telemetry.

    Returns hits with a `source` field of `"process"` or `"file"`.

    **Example**
    - `?value=e3b0c44298fc1c149afbf4c8996fb924` — full SHA-256
    - `?value=e3b0c44` — prefix match (returns all hashes beginning with that string)
    """
    days, limit = _clamp(days, limit)
    return hunt_service.hunt_hash(
        db, current_user.tenant_id,
        value=value, agent_id=agent_id, days=days, limit=limit,
    )


# ── GET /hunt/ip ──────────────────────────────────────────────────────────────

@router.get("/ip")
def hunt_ip(
    value:    str        = Query(..., min_length=4, description="Remote IP address (full or prefix)"),
    port:     int | None = Query(default=None, description="Filter by remote port"),
    agent_id: int | None = Query(default=None),
    days:     int        = Query(default=7),
    limit:    int        = Query(default=_DEF_LIMIT),
    current_user: User   = Depends(analyst_required),
    db: Session          = Depends(get_db),
):
    """
    Hunt across network telemetry for connections to/from a specific IP.

    The response includes a **summary** block (unique agents that connected,
    total connection count, unique ports used, first/last seen times) in
    addition to raw hit rows.

    **Example queries**
    - `?value=185.220.101.42` — all connections to this Tor exit node
    - `?value=185.220.101.42&port=4444` — C2 beaconing check
    - `?value=10.0.0` — sweep the entire 10.0.0.0/24 subnet
    """
    days, limit = _clamp(days, limit)
    return hunt_service.hunt_ip(
        db, current_user.tenant_id,
        value=value, port=port, agent_id=agent_id, days=days, limit=limit,
    )


# ── GET /hunt/domain ──────────────────────────────────────────────────────────

@router.get("/domain")
def hunt_domain(
    value:    str        = Query(..., min_length=3, description="Domain or URL fragment to search for"),
    agent_id: int | None = Query(default=None),
    days:     int        = Query(default=7),
    limit:    int        = Query(default=_DEF_LIMIT),
    current_user: User   = Depends(analyst_required),
    db: Session          = Depends(get_db),
):
    """
    Hunt for a domain name fragment across process command lines and file paths.

    Useful for finding:
    - Processes that contacted a known-malicious domain (via curl, wget, PowerShell IWR, etc.)
    - Files downloaded from or referencing a suspicious domain

    **Note:** Network telemetry stores IPs, not hostnames. Use `/hunt/ip` for IP-based hunting.

    **Example queries**
    - `?value=malicious-c2.com` — detect any cmdline invoking this domain
    - `?value=pastebin.com` — living-off-the-land payload staging
    - `?value=.onion` — Tor hidden-service contact attempts
    """
    days, limit = _clamp(days, limit)
    return hunt_service.hunt_domain(
        db, current_user.tenant_id,
        value=value, agent_id=agent_id, days=days, limit=limit,
    )


# ── GET /hunt/persistence ─────────────────────────────────────────────────────

@router.get("/persistence")
def hunt_persistence(
    type:       str | None = Query(default=None, alias="type", description="Persistence mechanism type (e.g. registry, service, cron)"),
    entry_name: str | None = Query(default=None, description="Entry name substring"),
    entry_path: str | None = Query(default=None, description="Entry path substring"),
    agent_id:   int | None = Query(default=None),
    days:       int        = Query(default=7),
    limit:      int        = Query(default=_DEF_LIMIT),
    current_user: User     = Depends(analyst_required),
    db: Session            = Depends(get_db),
):
    """
    Hunt across persistence telemetry (registry Run keys, services, scheduled
    tasks, cron jobs).

    **At least one** of `type`, `entry_name`, or `entry_path` is required.

    **Example queries**
    - `?type=registry` — all registry persistence entries
    - `?entry_path=CurrentVersion\\Run` — classic Windows persistence location
    - `?entry_name=svchost` — suspicious service masquerading as svchost
    """
    if not any([type, entry_name, entry_path]):
        raise HTTPException(
            status_code=422,
            detail="Provide at least one filter: type, entry_name, or entry_path",
        )
    days, limit = _clamp(days, limit)
    return hunt_service.hunt_persistence(
        db, current_user.tenant_id,
        persistence_type=type, entry_name=entry_name, entry_path=entry_path,
        agent_id=agent_id, days=days, limit=limit,
    )
