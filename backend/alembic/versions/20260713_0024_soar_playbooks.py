"""SOAR playbook tables.

Revision ID: 20260713_0024
Revises: 20260713_0023
"""
from alembic import op
import sqlalchemy as sa

revision      = "20260713_0024"
down_revision = "20260713_0023"
branch_labels = None
depends_on    = None


def upgrade():
    op.create_table(
        "playbooks",
        sa.Column("id",                   sa.Integer(), primary_key=True),
        sa.Column("name",                 sa.String(), nullable=False),
        sa.Column("description",          sa.String()),
        sa.Column("enabled",              sa.Boolean(), server_default="true",  nullable=False),
        sa.Column("is_system",            sa.Boolean(), server_default="false", nullable=False),
        sa.Column("tenant_id",            sa.Integer(), sa.ForeignKey("tenants.id"), nullable=True),
        sa.Column("trigger_severities",   sa.String()),   # "Critical,High"
        sa.Column("trigger_mitre",        sa.String()),   # "T1059,T1055"
        sa.Column("trigger_rule_pattern", sa.String()),   # alert title substring
        sa.Column("actions",              sa.Text()),     # JSON
        sa.Column("created_at",           sa.DateTime()),
        sa.Column("updated_at",           sa.DateTime()),
    )
    op.create_index("ix_playbooks_tenant_id", "playbooks", ["tenant_id"])

    op.create_table(
        "playbook_runs",
        sa.Column("id",           sa.Integer(), primary_key=True),
        sa.Column("playbook_id",  sa.Integer(),
                  sa.ForeignKey("playbooks.id", ondelete="CASCADE"), nullable=False),
        sa.Column("alert_id",     sa.Integer(),
                  sa.ForeignKey("alerts.id", ondelete="SET NULL"), nullable=True),
        sa.Column("status",       sa.String(), server_default="success"),
        sa.Column("results",      sa.Text()),   # JSON
        sa.Column("triggered_at", sa.DateTime()),
    )
    op.create_index("ix_playbook_runs_playbook_id", "playbook_runs", ["playbook_id"])
    op.create_index("ix_playbook_runs_alert_id",    "playbook_runs", ["alert_id"])


def downgrade():
    op.drop_table("playbook_runs")
    op.drop_table("playbooks")
