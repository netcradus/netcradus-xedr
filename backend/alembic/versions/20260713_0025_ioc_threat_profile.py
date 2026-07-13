"""ioc threat profile columns

Revision ID: 20260713_0025
Revises: 20260713_0024
Create Date: 2026-07-13
"""
from alembic import op
import sqlalchemy as sa

revision = "20260713_0025"
down_revision = "20260713_0024"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("iocs", sa.Column("threat_score",   sa.Integer(),     nullable=True))
    op.add_column("iocs", sa.Column("threat_verdict", sa.String(20),    nullable=True))
    op.add_column("iocs", sa.Column("malware_family", sa.String(100),   nullable=True))
    op.add_column("iocs", sa.Column("first_seen_date", sa.DateTime(),   nullable=True))
    op.add_column("iocs", sa.Column("last_seen_date",  sa.DateTime(),   nullable=True))
    op.create_index("ix_iocs_threat_score", "iocs", ["threat_score"])


def downgrade() -> None:
    op.drop_index("ix_iocs_threat_score", table_name="iocs")
    op.drop_column("iocs", "last_seen_date")
    op.drop_column("iocs", "first_seen_date")
    op.drop_column("iocs", "malware_family")
    op.drop_column("iocs", "threat_verdict")
    op.drop_column("iocs", "threat_score")
