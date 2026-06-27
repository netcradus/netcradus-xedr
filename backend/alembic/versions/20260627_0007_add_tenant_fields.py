"""add plan and created_at to tenants; add tenant_api_key to agent registration

Revision ID: 20260627_0007
Revises: 20260627_0006
Create Date: 2026-06-27
"""

from alembic import op

revision = "20260627_0007"
down_revision = "20260627_0006"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
    ALTER TABLE tenants
    ADD COLUMN IF NOT EXISTS plan       VARCHAR(50)  DEFAULT 'Free',
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP;
    """)


def downgrade():
    op.execute("ALTER TABLE tenants DROP COLUMN IF EXISTS plan;")
    op.execute("ALTER TABLE tenants DROP COLUMN IF EXISTS created_at;")
