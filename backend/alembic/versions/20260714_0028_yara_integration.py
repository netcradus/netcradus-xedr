"""Add yara_scan_results table and malware_family column to yara_rules

Revision ID: 20260714_0028
Revises: 20260714_0027
Create Date: 2026-07-14
"""
from alembic import op
import sqlalchemy as sa

revision = "20260714_0028"
down_revision = "20260714_0027"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("yara_rules", sa.Column("malware_family", sa.String(), nullable=True))

    op.create_table(
        "yara_scan_results",
        sa.Column("id",                sa.Integer(),  primary_key=True),
        sa.Column("file_path",         sa.String(),   nullable=True),
        sa.Column("sha256",            sa.String(),   nullable=True),
        sa.Column("matched_rule_name", sa.String(),   nullable=False),
        sa.Column("malware_family",    sa.String(),   nullable=True),
        sa.Column("severity",          sa.String(),   nullable=False),
        sa.Column("mitre_tactic",      sa.String(),   nullable=True),
        sa.Column("mitre_technique",   sa.String(),   nullable=True),
        sa.Column("scan_context",      sa.String(),   nullable=True),
        sa.Column("agent_id",   sa.Integer(), sa.ForeignKey("agents.id"),  nullable=True),
        sa.Column("tenant_id",  sa.Integer(), sa.ForeignKey("tenants.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_yara_scan_results_tenant_id",  "yara_scan_results", ["tenant_id"])
    op.create_index("ix_yara_scan_results_created_at", "yara_scan_results", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_yara_scan_results_created_at", table_name="yara_scan_results")
    op.drop_index("ix_yara_scan_results_tenant_id",  table_name="yara_scan_results")
    op.drop_table("yara_scan_results")
    op.drop_column("yara_rules", "malware_family")
