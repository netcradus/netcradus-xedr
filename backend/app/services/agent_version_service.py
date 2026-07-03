import hashlib
import os
from typing import Optional

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.agent_version import AgentVersion


def _updates_dir() -> str:
    d = os.path.abspath(settings.agent_updates_dir)
    os.makedirs(d, exist_ok=True)
    return d


def get_current_version(db: Session, platform: str = "all") -> Optional[AgentVersion]:
    """Return the currently published version, preferring platform-specific over 'all'."""
    rows = (
        db.query(AgentVersion)
        .filter(
            AgentVersion.is_current == True,
            AgentVersion.platform.in_([platform, "all"]),
        )
        .all()
    )
    # prefer exact platform match
    exact = next((r for r in rows if r.platform == platform), None)
    return exact or (rows[0] if rows else None)


def list_versions(db: Session) -> list[AgentVersion]:
    return db.query(AgentVersion).order_by(AgentVersion.created_at.desc()).all()


def save_version(
    db: Session,
    version: str,
    platform: str,
    file_bytes: bytes,
    filename: str,
    release_notes: Optional[str],
    uploaded_by: str,
) -> AgentVersion:
    """Store the package file on disk and register/update the version row."""
    checksum  = hashlib.sha256(file_bytes).hexdigest()
    safe_name = f"{version}-{platform}.zip"
    dest      = os.path.join(_updates_dir(), safe_name)
    with open(dest, "wb") as f:
        f.write(file_bytes)

    av = db.query(AgentVersion).filter(AgentVersion.version == version).first()
    if av:
        av.platform        = platform
        av.filename        = safe_name
        av.checksum_sha256 = checksum
        av.file_size       = len(file_bytes)
        av.release_notes   = release_notes
        av.uploaded_by     = uploaded_by
    else:
        av = AgentVersion(
            version=version,
            platform=platform,
            filename=safe_name,
            checksum_sha256=checksum,
            file_size=len(file_bytes),
            release_notes=release_notes,
            uploaded_by=uploaded_by,
        )
        db.add(av)

    db.commit()
    db.refresh(av)
    return av


def set_current(db: Session, version: str) -> Optional[AgentVersion]:
    """Mark one version as current; clears is_current on all others."""
    target = db.query(AgentVersion).filter(AgentVersion.version == version).first()
    if not target:
        return None
    db.query(AgentVersion).update({"is_current": False})
    target.is_current = True
    db.commit()
    db.refresh(target)
    return target


def get_file_path(db: Session, version: str) -> Optional[str]:
    """Return the filesystem path for a version's package, or None if missing."""
    av = db.query(AgentVersion).filter(AgentVersion.version == version).first()
    if not av:
        return None
    path = os.path.join(_updates_dir(), av.filename)
    return path if os.path.isfile(path) else None
