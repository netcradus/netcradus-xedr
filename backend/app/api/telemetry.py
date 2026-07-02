from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.db import get_db

from app.schemas.process_schema import (
    ProcessTelemetryRequest
)

from app.services.telemetry_service import (
    save_processes
)

from app.schemas.network_schema import NetworkTelemetryRequest

from app.services.telemetry_service import (
    save_connections
)

from app.schemas.file_schema import FileTelemetryRequest

from app.services.telemetry_service import (
    save_file_events
)

from app.schemas.persistence_schema import (
    PersistenceTelemetryRequest
)

from app.services.telemetry_service import (
    save_persistence
)

from app.schemas.log_schema import LogTelemetryRequest
from app.services.log_service import save_logs

router = APIRouter(
    prefix="/telemetry",
    tags=["Telemetry"]
)


@router.post("/processes")
def process_telemetry(

        data: ProcessTelemetryRequest,

        db: Session = Depends(
            get_db
        )):

    success = save_processes(
        db,
        data
    )

    if not success:

        return {

            "status": "invalid agent"

        }

    return {

        "status": "success"

    }

@router.post("/network")
def network_telemetry(

        data: NetworkTelemetryRequest,

        db: Session = Depends(
            get_db
        )):

    success = save_connections(
        db,
        data
    )

    if not success:

        return {

            "status": "invalid agent"

        }

    return {

        "status": "success"

    }


@router.post("/files")
def file_telemetry(

        data: FileTelemetryRequest,

        db: Session = Depends(
            get_db
        )):

    success = save_file_events(
        db,
        data
    )

    if not success:

        return {
            "status": "invalid agent"
        }

    return {
        "status": "success"
    }


@router.post("/persistence")
def persistence_telemetry(

        data: PersistenceTelemetryRequest,

        db: Session = Depends(
            get_db
        )):

    success = save_persistence(
        db,
        data
    )

    if not success:

        return {
            "status": "invalid agent"
        }

    return {
        "status": "success"
    }


@router.post("/logs")
def log_telemetry(
    data: LogTelemetryRequest,
    db: Session = Depends(get_db),
):
    """
    Ingest log telemetry from syslog, Windows Event Log, IIS, Apache, Nginx,
    or application log files. Entries are stored and run through threat
    detection and custom rule evaluation.
    """
    success = save_logs(db, data)
    if not success:
        return {"status": "invalid agent"}
    return {"status": "success"}