"""Add browser_security_events table

Revision ID: 20260715_0031
Revises: 20260714_0030
Create Date: 2026-07-15
"""
from alembic import op
import sqlalchemy as sa

revision      = "20260715_0031"
down_revision = "20260714_0030"
branch_labels = None
depends_on    = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)

    if not insp.has_table("browser_security_events"):
        op.create_table(
            "browser_security_events",
            sa.Column("id",             sa.Integer, primary_key=True),
            sa.Column("agent_id",       sa.Integer, sa.ForeignKey("agents.id"),  nullable=False),
            sa.Column("tenant_id",      sa.Integer, sa.ForeignKey("tenants.id"), nullable=False),
            sa.Column("event_type",     sa.String,  nullable=False),
            sa.Column("severity",       sa.String,  nullable=False),
            sa.Column("browser",        sa.String,  nullable=True),
            sa.Column("title",          sa.String,  nullable=False),
            sa.Column("description",    sa.Text,    nullable=True),
            sa.Column("url",            sa.String,  nullable=True),
            sa.Column("extension_id",   sa.String,  nullable=True),
            sa.Column("extension_name", sa.String,  nullable=True),
            sa.Column("file_name",      sa.String,  nullable=True),
            sa.Column("file_path",      sa.String,  nullable=True),
            sa.Column("sha256",         sa.String,  nullable=True),
            sa.Column("username",       sa.String,  nullable=True),
            sa.Column("status",         sa.String,  nullable=False, server_default="open"),
            sa.Column("detected_at",    sa.DateTime, nullable=True),
            sa.Column("created_at",     sa.DateTime, nullable=True),
            sa.Column("updated_at",     sa.DateTime, nullable=True),
        )
        op.create_index("ix_browser_security_events_tenant_id",   "browser_security_events", ["tenant_id"])
        op.create_index("ix_browser_security_events_agent_id",    "browser_security_events", ["agent_id"])
        op.create_index("ix_browser_security_events_event_type",  "browser_security_events", ["event_type"])
        op.create_index("ix_browser_security_events_severity",    "browser_security_events", ["severity"])
        op.create_index("ix_browser_security_events_status",      "browser_security_events", ["status"])
        op.create_index("ix_browser_security_events_detected_at", "browser_security_events", ["detected_at"])
    else:
        existing_idx = {i['name'] for i in insp.get_indexes("browser_security_events")}
        for name, col in [
            ("ix_browser_security_events_tenant_id",   ["tenant_id"]),
            ("ix_browser_security_events_agent_id",    ["agent_id"]),
            ("ix_browser_security_events_event_type",  ["event_type"]),
            ("ix_browser_security_events_severity",    ["severity"]),
            ("ix_browser_security_events_status",      ["status"]),
            ("ix_browser_security_events_detected_at", ["detected_at"]),
        ]:
            if name not in existing_idx:
                op.create_index(name, "browser_security_events", col)


def downgrade() -> None:
    op.drop_table("browser_security_events")
