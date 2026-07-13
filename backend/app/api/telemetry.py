from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.db import get_db
from app.schemas.process_schema import ProcessTelemetryRequest
from app.services.telemetry_service import save_processes
from app.schemas.network_schema import NetworkTelemetryRequest
from app.services.telemetry_service import save_connections
from app.schemas.file_schema import FileTelemetryRequest
from app.services.telemetry_service import save_file_events
from app.schemas.persistence_schema import PersistenceTelemetryRequest
from app.services.telemetry_service import save_persistence
from app.schemas.log_schema import LogTelemetryRequest
from app.services.log_service import save_logs

# Extended enterprise telemetry
from app.schemas.dns_schema import DnsTelemetryRequest
from app.schemas.registry_schema import RegistryTelemetryRequest
from app.schemas.usb_schema import UsbTelemetryRequest
from app.schemas.browser_extension_schema import BrowserExtensionRequest
from app.schemas.memory_scan_schema import MemoryScanRequest
from app.schemas.cloud_schema import CloudTelemetryRequest
from app.schemas.k8s_schema import K8sTelemetryRequest
from app.schemas.email_event_schema import EmailTelemetryRequest
from app.services.extended_telemetry_service import (
    save_dns, save_registry, save_usb,
    save_browser_extensions, save_memory_scans,
    save_cloud, save_k8s, save_email,
)

router = APIRouter(prefix="/telemetry", tags=["Telemetry"])


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


@router.post("/dns")
def dns_telemetry(data: DnsTelemetryRequest, db: Session = Depends(get_db)):
    return {"status": "success"} if save_dns(db, data) else {"status": "invalid agent"}


@router.post("/registry")
def registry_telemetry(data: RegistryTelemetryRequest, db: Session = Depends(get_db)):
    return {"status": "success"} if save_registry(db, data) else {"status": "invalid agent"}


@router.post("/usb")
def usb_telemetry(data: UsbTelemetryRequest, db: Session = Depends(get_db)):
    return {"status": "success"} if save_usb(db, data) else {"status": "invalid agent"}


@router.post("/browser-extensions")
def browser_extension_telemetry(data: BrowserExtensionRequest, db: Session = Depends(get_db)):
    return {"status": "success"} if save_browser_extensions(db, data) else {"status": "invalid agent"}


@router.post("/memory-scans")
def memory_scan_telemetry(data: MemoryScanRequest, db: Session = Depends(get_db)):
    return {"status": "success"} if save_memory_scans(db, data) else {"status": "invalid agent"}


@router.post("/cloud")
def cloud_telemetry(data: CloudTelemetryRequest, db: Session = Depends(get_db)):
    return {"status": "success"} if save_cloud(db, data) else {"status": "unauthorized"}


@router.post("/kubernetes")
def k8s_telemetry(data: K8sTelemetryRequest, db: Session = Depends(get_db)):
    return {"status": "success"} if save_k8s(db, data) else {"status": "unauthorized"}


@router.post("/email")
def email_telemetry(data: EmailTelemetryRequest, db: Session = Depends(get_db)):
    return {"status": "success"} if save_email(db, data) else {"status": "unauthorized"}