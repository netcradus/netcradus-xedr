from datetime import datetime
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from app.database.db import Base


class DnsTelemetry(Base):
    __tablename__ = "dns_telemetry"

    id          = Column(Integer, primary_key=True)
    query_name  = Column(String)                  # FQDN queried
    query_type  = Column(String)                  # A | AAAA | MX | TXT | CNAME | PTR | NS | SRV
    response    = Column(String)                  # resolved IP(s) or CNAME chain (CSV)
    direction   = Column(String, default="query") # query | response
    process_name= Column(String)
    pid         = Column(Integer)
    username    = Column(String)
    timestamp   = Column(DateTime, default=datetime.utcnow)
    agent_id    = Column(Integer, ForeignKey("agents.id"))
