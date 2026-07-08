from sqlalchemy import Column, Integer, String, ForeignKey
from app.database.db import Base


class DetectionRuleCondition(Base):
    __tablename__ = "detection_rule_conditions"

    id         = Column(Integer, primary_key=True)
    rule_id    = Column(Integer, ForeignKey("detection_rules.id", ondelete="CASCADE"), nullable=False, index=True)
    field      = Column(String, nullable=False)
    operator   = Column(String, nullable=False)
    value      = Column(String, nullable=False)
    sort_order = Column(Integer, nullable=False, default=0)
