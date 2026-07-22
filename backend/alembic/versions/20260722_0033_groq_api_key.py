"""Add per-tenant groq_api_key override to threat_feed_configs

Revision ID: 20260722_0033
Revises: 20260720_0032
Create Date: 2026-07-22
"""
from alembic import op
import sqlalchemy as sa

revision      = "20260722_0033"
down_revision = "20260720_0032"
branch_labels = None
depends_on    = None


def upgrade():
    op.add_column(
        "threat_feed_configs",
        sa.Column("groq_api_key", sa.String(length=512), nullable=True),
    )


def downgrade():
    op.drop_column("threat_feed_configs", "groq_api_key")
