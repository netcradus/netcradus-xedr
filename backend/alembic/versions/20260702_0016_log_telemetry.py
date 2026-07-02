"""Add log_telemetry table for SIEM log ingestion

Revision ID: 20260702_0016
Revises: 20260702_0015
Create Date: 2026-07-02
"""

from alembic import op
import sqlalchemy as sa

revision      = "20260702_0016"
down_revision = "20260702_0015"
branch_labels = None
depends_on    = None


def upgrade():
    op.create_table(
        "log_telemetry",
        sa.Column("id",           sa.Integer(),     primary_key=True),
        sa.Column("agent_id",     sa.Integer(),     sa.ForeignKey("agents.id"), nullable=False),
        sa.Column("log_source",   sa.String(50),    nullable=False),
        sa.Column("raw_message",  sa.Text(),        nullable=True),
        sa.Column("severity",     sa.String(20),    nullable=True),
        sa.Column("event_id",     sa.Integer(),     nullable=True),
        sa.Column("facility",     sa.Integer(),     nullable=True),
        sa.Column("hostname",     sa.String(255),   nullable=True),
        sa.Column("process_name", sa.String(255),   nullable=True),
        sa.Column("username",     sa.String(255),   nullable=True),
        sa.Column("source_ip",    sa.String(45),    nullable=True),
        sa.Column("log_message",  sa.Text(),        nullable=True),
        sa.Column("extra",        sa.Text(),        nullable=True),
        sa.Column("timestamp",    sa.DateTime(),    nullable=False),
        sa.Column("created_at",   sa.DateTime(),    server_default=sa.func.now()),
    )
    op.create_index("ix_log_telemetry_agent_id",   "log_telemetry", ["agent_id"])
    op.create_index("ix_log_telemetry_log_source",  "log_telemetry", ["log_source"])
    op.create_index("ix_log_telemetry_timestamp",   "log_telemetry", ["timestamp"])
    op.create_index("ix_log_telemetry_agent_ts",    "log_telemetry", ["agent_id", "timestamp"])


def downgrade():
    op.drop_index("ix_log_telemetry_agent_ts",   "log_telemetry")
    op.drop_index("ix_log_telemetry_timestamp",  "log_telemetry")
    op.drop_index("ix_log_telemetry_log_source", "log_telemetry")
    op.drop_index("ix_log_telemetry_agent_id",   "log_telemetry")
    op.drop_table("log_telemetry")
