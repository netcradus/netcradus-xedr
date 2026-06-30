"""Add otx_api_key to threat_feed_configs

Revision ID: 20260629_0013
Revises: 20260629_0012
Create Date: 2026-06-29
"""

from alembic import op
import sqlalchemy as sa

revision = "20260629_0013"
down_revision = "20260629_0012"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "threat_feed_configs",
        sa.Column("otx_api_key", sa.String(512), nullable=True),
    )


def downgrade():
    op.drop_column("threat_feed_configs", "otx_api_key")
