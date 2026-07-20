"""Allow null tenant_id on audit_logs (cross-tenant PlatformAdmin/SuperAdmin actions)

Revision ID: 20260720_0032
Revises: 20260715_0031
Create Date: 2026-07-20
"""
from alembic import op
import sqlalchemy as sa

revision      = "20260720_0032"
down_revision = "20260715_0031"
branch_labels = None
depends_on    = None


def upgrade():
    op.alter_column("audit_logs", "tenant_id", existing_type=sa.Integer(), nullable=True)


def downgrade():
    op.alter_column("audit_logs", "tenant_id", existing_type=sa.Integer(), nullable=False)
