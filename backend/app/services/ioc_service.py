from datetime import datetime
import os

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.ioc import IOC
from app.schemas.ioc_schema import CreateIOCRequest, UpdateIOCRequest
from app.services.alert_service import create_alert_if_not_exists


def normalize_ioc_value(
        ioc_type: str,
        value: str):

    value = value.strip()

    if ioc_type in {
        "SHA256",
        "MD5",
        "IPv4",
        "IPv6",
        "Domain",
        "URL",
        "Email",
        "Filename",
        "Registry"
    }:

        return value.lower()

    return value


def create_ioc(
        db: Session,
        request: CreateIOCRequest,
        created_by: str):

    value = normalize_ioc_value(
        request.type,
        request.value
    )

    ioc = IOC(
        type=request.type,
        value=value,
        description=request.description,
        category=request.category,
        severity=request.severity,
        source=request.source,
        created_by=created_by,
        expires_at=request.expires_at,
        is_active=request.is_active
    )

    db.add(ioc)

    db.commit()

    db.refresh(ioc)

    return ioc


def update_ioc(
        db: Session,
        ioc_id: int,
        request: UpdateIOCRequest):

    ioc = get_ioc(
        db,
        ioc_id
    )

    if not ioc:

        return None

    update_data = request.model_dump(
        exclude_unset=True
    )

    if "value" in update_data:

        ioc_type = update_data.get(
            "type",
            ioc.type
        )

        update_data["value"] = normalize_ioc_value(
            ioc_type,
            update_data["value"]
        )

    for field, value in update_data.items():

        setattr(
            ioc,
            field,
            value
        )

    db.commit()

    db.refresh(ioc)

    return ioc


def delete_ioc(
        db: Session,
        ioc_id: int):

    ioc = get_ioc(
        db,
        ioc_id
    )

    if not ioc:

        return False

    db.delete(ioc)

    db.commit()

    return True


def list_iocs(
        db: Session,
        ioc_type: str = None,
        active_only: bool = False):

    query = db.query(IOC)

    if ioc_type:

        query = query.filter(
            IOC.type == ioc_type
        )

    if active_only:

        query = query.filter(
            IOC.is_active == True
        )

    return query.order_by(
        IOC.created_at.desc()
    ).all()


def search_ioc(
        db: Session,
        query_text: str):

    text = f"%{query_text.lower()}%"

    return db.query(IOC).filter(
        or_(
            IOC.value.ilike(text),
            IOC.description.ilike(text),
            IOC.source.ilike(text)
        )
    ).order_by(
        IOC.created_at.desc()
    ).all()


def get_ioc(
        db: Session,
        ioc_id: int):

    return db.query(IOC).filter(
        IOC.id == ioc_id
    ).first()


def find_active_ioc(
        db: Session,
        ioc_type: str,
        value: str):

    normalized = normalize_ioc_value(
        ioc_type,
        value
    )

    now = datetime.utcnow()

    return db.query(IOC).filter(
        IOC.type == ioc_type,
        IOC.value == normalized,
        IOC.is_active == True,
        or_(
            IOC.expires_at == None,
            IOC.expires_at > now
        )
    ).first()


def create_ioc_match_alert(
        db: Session,
        ioc: IOC,
        artifact: str,
        agent_id: int):

    mitre_by_type = {
        "SHA256": "T1204",
        "MD5": "T1204",
        "Filename": "T1204",
        "IPv4": "T1071",
        "IPv6": "T1071",
        "Domain": "T1071",
        "URL": "T1105",
        "Email": "T1566",
        "Registry": "T1547"
    }

    return create_alert_if_not_exists(
        db,
        f"IOC Match: {ioc.type} {ioc.value}",
        f"Matched IOC {ioc.value} against {artifact}",
        ioc.severity or "Critical",
        mitre_by_type.get(
            ioc.type,
            "T1204"
        ),
        agent_id
    )


def match_ioc_value(
        db: Session,
        ioc_type: str,
        value: str,
        artifact: str,
        agent_id: int):

    if not value:

        return None

    ioc = find_active_ioc(
        db,
        ioc_type,
        value
    )

    if not ioc:

        return None

    return create_ioc_match_alert(
        db,
        ioc,
        artifact,
        agent_id
    )


def match_process_iocs(
        db: Session,
        process,
        agent_id: int):

    match_ioc_value(
        db,
        "SHA256",
        process.sha256,
        f"process hash for {process.process_name}",
        agent_id
    )

    match_ioc_value(
        db,
        "Filename",
        process.process_name,
        "process name",
        agent_id
    )

    if process.exe_path:

        match_ioc_value(
            db,
            "Filename",
            os.path.basename(process.exe_path),
            "process executable filename",
            agent_id
        )


def match_network_iocs(
        db: Session,
        connection,
        agent_id: int):

    ioc_type = "IPv6" if ":" in connection.remote_ip else "IPv4"

    match_ioc_value(
        db,
        ioc_type,
        connection.remote_ip,
        "remote network address",
        agent_id
    )


def match_file_iocs(
        db: Session,
        event,
        agent_id: int):

    match_ioc_value(
        db,
        "SHA256",
        getattr(
            event,
            "sha256",
            None
        ),
        "file event sha256",
        agent_id
    )

    match_ioc_value(
        db,
        "MD5",
        getattr(
            event,
            "md5",
            None
        ),
        "file event md5",
        agent_id
    )

    match_ioc_value(
        db,
        "Filename",
        os.path.basename(event.file_path),
        "file event filename",
        agent_id
    )


def match_text_iocs(
        db: Session,
        text: str,
        artifact: str,
        agent_id: int):

    if not text:

        return

    now = datetime.utcnow()
    text = text.lower()

    iocs = db.query(IOC).filter(
        IOC.type.in_(
            [
                "Domain",
                "URL",
                "Email"
            ]
        ),
        IOC.is_active == True,
        or_(
            IOC.expires_at == None,
            IOC.expires_at > now
        )
    ).all()

    for ioc in iocs:

        if ioc.value and ioc.value in text:

            create_ioc_match_alert(
                db,
                ioc,
                artifact,
                agent_id
            )


def match_persistence_iocs(
        db: Session,
        entry,
        agent_id: int):

    match_ioc_value(
        db,
        "Registry",
        entry.entry_path,
        "persistence entry path",
        agent_id
    )

    match_ioc_value(
        db,
        "Filename",
        os.path.basename(entry.entry_path or ""),
        "persistence entry filename",
        agent_id
    )
