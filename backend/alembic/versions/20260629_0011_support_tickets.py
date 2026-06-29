"""add support_tickets table

Revision ID: 20260629_0011
Revises: 20260628_0010
Create Date: 2026-06-29
"""
from alembic import op
import sqlalchemy as sa

revision = "20260629_0011"
down_revision = "20260628_0010"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "support_tickets",
        sa.Column("id",          sa.Integer(),  primary_key=True),
        sa.Column("tenant_id",   sa.Integer(),  sa.ForeignKey("tenants.id"), nullable=True),
        sa.Column("user_id",     sa.Integer(),  sa.ForeignKey("users.id"),   nullable=True),
        sa.Column("user_name",   sa.String(),   nullable=True),
        sa.Column("user_email",  sa.String(),   nullable=True),
        sa.Column("tenant_name", sa.String(),   nullable=True),
        sa.Column("subject",     sa.String(),   nullable=False),
        sa.Column("message",     sa.Text(),     nullable=False),
        sa.Column("priority",    sa.String(),   nullable=True, server_default="Medium"),
        sa.Column("status",      sa.String(),   nullable=True, server_default="Open"),
        sa.Column("admin_note",  sa.Text(),     nullable=True),
        sa.Column("created_at",  sa.DateTime(), nullable=True),
        sa.Column("updated_at",  sa.DateTime(), nullable=True),
    )


def downgrade():
    op.drop_table("support_tickets")
