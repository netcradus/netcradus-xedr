"""billing columns on tenants

Revision ID: 20260703_0018
Revises: 20260703_0017
"""
from alembic import op
import sqlalchemy as sa

revision      = "20260703_0018"
down_revision = "20260703_0017"
branch_labels = None
depends_on    = None


def upgrade():
    op.add_column("tenants", sa.Column("plan_agent_limit", sa.Integer(), nullable=True))
    op.add_column("tenants", sa.Column("plan_expires_at",  sa.DateTime(), nullable=True))
    # Normalise existing plan values to lowercase
    op.execute("UPDATE tenants SET plan = LOWER(plan) WHERE plan IS NOT NULL")


def downgrade():
    op.drop_column("tenants", "plan_expires_at")
    op.drop_column("tenants", "plan_agent_limit")
