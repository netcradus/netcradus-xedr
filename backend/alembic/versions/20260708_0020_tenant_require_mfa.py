"""Add require_mfa to tenants

Revision ID: 20260708_0020
Revises: 20260708_0019
"""
from alembic import op
import sqlalchemy as sa

revision      = "20260708_0020"
down_revision = "20260708_0019"
branch_labels = None
depends_on    = None


def upgrade():
    op.add_column(
        "tenants",
        sa.Column("require_mfa", sa.Boolean(), nullable=False, server_default="false"),
    )


def downgrade():
    op.drop_column("tenants", "require_mfa")
