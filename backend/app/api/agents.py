import os
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import RedirectResponse, Response
from sqlalchemy.orm import Session
from typing import Optional

from app.database.db import get_db
from app.core.permissions import analyst_required, admin_required, platform_admin_required
from app.schemas.agent_schema import AgentRegister
from app.schemas.command_schema import CommandCompleteRequest
from app.services.agent_service import register_agent, update_heartbeat
from app.services.agent_version_service import (
    get_current_version, list_versions, save_version, set_current,
    get_file_path, get_file_bytes, get_presigned_url,
)
from app.models.command import Command
from app.models.agent import Agent
from app.models.tenant import Tenant
from app.models.user import User
from app.schemas.heartbeat_schema import HeartbeatRequest

router = APIRouter(prefix="/agents", tags=["Agents"])


# ── Agent self-registration ────────────────────────────────────────────────────

@router.post("/register")
def create_agent(agent: AgentRegister, db: Session = Depends(get_db)):
    db_agent = register_agent(db, agent)
    return {"agent_id": db_agent.id, "agent_token": db_agent.agent_token}


# ── Heartbeat (used by agent; returns update signal) ──────────────────────────

@router.post("/heartbeat")
def heartbeat(request: HeartbeatRequest, db: Session = Depends(get_db)):
    success = update_heartbeat(db, request)
    if not success:
        return {"status": "invalid agent"}

    # Check whether an update is available for this agent
    platform  = _infer_platform(request.os_type)
    latest    = get_current_version(db, platform)
    agent_ver = request.agent_version or "0.0.0"

    update_available = (
        latest is not None
        and _version_gt(latest.version, agent_ver)
    )

    resp: dict = {"status": "online", "update_available": update_available}
    if update_available and latest:
        resp["latest_version"] = latest.version
        resp["download_url"]   = f"/agents/download/{latest.version}"
        resp["checksum"]       = latest.checksum_sha256
    return resp


# ── Command pipeline ───────────────────────────────────────────────────────────

@router.get("/{agent_token}/commands")
def get_agent_commands(agent_token: str, db: Session = Depends(get_db)):
    agent = db.query(Agent).filter(Agent.agent_token == agent_token).first()
    if not agent:
        return []
    return db.query(Command).filter(
        Command.agent_id == agent.id,
        Command.status == "Pending"
    ).all()


@router.put("/commands/{command_id}/complete")
def complete_agent_command(
    command_id: int,
    request: CommandCompleteRequest,
    db: Session = Depends(get_db),
):
    agent = db.query(Agent).filter(Agent.agent_token == request.agent_token).first()
    if not agent:
        raise HTTPException(status_code=401, detail="Invalid agent token")

    command = db.query(Command).filter(
        Command.id == command_id, Command.agent_id == agent.id
    ).first()
    if not command:
        raise HTTPException(status_code=404, detail="Command not found")

    command.status       = request.status
    command.result       = request.result
    command.error        = request.error
    command.completed_at = datetime.utcnow()
    db.commit()
    return {"status": command.status}


# ── Agent listing (dashboard) ─────────────────────────────────────────────────

@router.get("/")
def get_agents(current_user: User = Depends(analyst_required), db: Session = Depends(get_db)):
    return db.query(Agent).filter(Agent.tenant_id == current_user.tenant_id).all()


@router.get("/online")
def get_online_agents(current_user: User = Depends(analyst_required), db: Session = Depends(get_db)):
    return db.query(Agent).filter(
        Agent.tenant_id == current_user.tenant_id,
        Agent.status == "Online",
    ).all()


@router.get("/offline")
def get_offline_agents(current_user: User = Depends(analyst_required), db: Session = Depends(get_db)):
    return db.query(Agent).filter(
        Agent.tenant_id == current_user.tenant_id,
        Agent.status == "Offline",
    ).all()


@router.get("/onboarding")
def get_onboarding_info(current_user: User = Depends(admin_required), db: Session = Depends(get_db)):
    tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
    return {
        "tenant_name":    tenant.name    if tenant else "Default",
        "tenant_api_key": tenant.api_key if tenant else None,
    }


@router.get("/{agent_id}")
def get_agent(agent_id: int, current_user: User = Depends(analyst_required), db: Session = Depends(get_db)):
    agent = db.query(Agent).filter(
        Agent.id == agent_id,
        Agent.tenant_id == current_user.tenant_id,
    ).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent


# ── Version management (admin/platform admin) ─────────────────────────────────

@router.get("/versions/all")
def list_agent_versions(
    current_user: User = Depends(admin_required),
    db: Session = Depends(get_db),
):
    """List all uploaded agent versions."""
    return [_version_dict(v) for v in list_versions(db)]


@router.post("/versions/upload", status_code=201)
async def upload_agent_version(
    version:       str            = Form(...),
    platform:      str            = Form("all"),
    release_notes: Optional[str]  = Form(None),
    file:          UploadFile      = File(...),
    current_user:  User           = Depends(platform_admin_required),
    db:            Session        = Depends(get_db),
):
    """
    Upload a new agent package (.zip).
    Requires PlatformAdmin role.
    Set as current with PUT /agents/versions/{version}/current.
    """
    if not file.filename.endswith(".zip"):
        raise HTTPException(400, "Package must be a .zip file")
    content = await file.read()
    if len(content) > 200 * 1024 * 1024:  # 200 MB hard cap
        raise HTTPException(413, "Package exceeds 200 MB limit")

    av = save_version(
        db,
        version=version,
        platform=platform,
        file_bytes=content,
        filename=file.filename,
        release_notes=release_notes,
        uploaded_by=current_user.email,
    )
    return _version_dict(av)


@router.put("/versions/{version}/current")
def activate_version(
    version: str,
    current_user: User = Depends(platform_admin_required),
    db: Session = Depends(get_db),
):
    """Mark a version as the current published release agents should update to."""
    av = set_current(db, version)
    if not av:
        raise HTTPException(404, f"Version {version!r} not found")
    return _version_dict(av)


@router.get("/download/{version}")
def download_agent(
    version: str,
    agent_token: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """
    Serve the agent package zip.
    Accepts ?agent_token=<token> (used by agents) or a valid JWT session (admin download).
    """
    # Allow any valid agent token — no tenant check needed, they're downloading their own update
    if agent_token:
        agent = db.query(Agent).filter(Agent.agent_token == agent_token).first()
        if not agent:
            raise HTTPException(status_code=401, detail="Invalid agent token")
    else:
        raise HTTPException(status_code=401, detail="agent_token query param required")

    # Redirect to presigned URL when on S3 — avoids routing large binaries through the app
    url = get_presigned_url(db, version, expiry=300)
    if url:
        return RedirectResponse(url)

    result = get_file_bytes(db, version)
    if not result:
        raise HTTPException(404, f"Package for version {version!r} not found")
    data, filename = result
    return Response(
        content=data,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ── Helpers ───────────────────────────────────────────────────────────────────

def _infer_platform(os_type: str) -> str:
    s = (os_type or "").lower()
    if "windows" in s:
        return "windows"
    if "darwin" in s or "mac" in s:
        return "macos"
    return "linux"


def _version_gt(a: str, b: str) -> bool:
    def parts(v: str):
        return tuple(int(x) for x in v.split("."))
    try:
        return parts(a) > parts(b)
    except Exception:
        return a > b


def _version_dict(av) -> dict:
    return {
        "id":              av.id,
        "version":         av.version,
        "platform":        av.platform,
        "filename":        av.filename,
        "checksum_sha256": av.checksum_sha256,
        "file_size":       av.file_size,
        "release_notes":   av.release_notes,
        "is_current":      av.is_current,
        "created_at":      av.created_at.isoformat() if av.created_at else None,
        "uploaded_by":     av.uploaded_by,
    }
