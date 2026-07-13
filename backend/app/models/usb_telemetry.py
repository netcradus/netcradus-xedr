from datetime import datetime
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from app.database.db import Base


class UsbTelemetry(Base):
    __tablename__ = "usb_telemetry"

    id           = Column(Integer, primary_key=True)
    event_type   = Column(String)   # connected | disconnected | file_copy | file_delete
    device_id    = Column(String)   # USB hardware ID / serial
    device_name  = Column(String)   # friendly name
    vendor_id    = Column(String)
    product_id   = Column(String)
    drive_letter = Column(String)   # mount point (e.g. E:\)
    file_path    = Column(String)   # file involved (for file_copy / file_delete)
    username     = Column(String)
    timestamp    = Column(DateTime, default=datetime.utcnow)
    agent_id     = Column(Integer, ForeignKey("agents.id"))
