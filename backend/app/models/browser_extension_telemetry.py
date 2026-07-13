from datetime import datetime
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Boolean
from app.database.db import Base


class BrowserExtensionTelemetry(Base):
    __tablename__ = "browser_extension_telemetry"

    id            = Column(Integer, primary_key=True)
    event_type    = Column(String)            # installed | removed | updated | enabled | disabled
    browser       = Column(String)            # chrome | firefox | edge | safari
    extension_id  = Column(String)
    extension_name= Column(String)
    version       = Column(String)
    permissions   = Column(String)            # JSON-encoded list of declared permissions
    from_webstore = Column(Boolean, default=True)
    update_url    = Column(String)            # update manifest URL (detects sideloaded)
    username      = Column(String)
    timestamp     = Column(DateTime, default=datetime.utcnow)
    agent_id      = Column(Integer, ForeignKey("agents.id"))
