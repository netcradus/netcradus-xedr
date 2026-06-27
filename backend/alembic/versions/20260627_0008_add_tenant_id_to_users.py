"""add tenant_id to users table

Revision ID: 20260627_0008
Revises: 20260627_0007
Create Date: 2026-06-27
"""
from alembic import op

revision = "20260627_0008"
down_revision = "20260627_0007"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
    """)


def downgrade():
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS tenant_id;")
