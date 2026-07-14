"""Add vulnerability scanner tables (vuln_scans, vuln_findings)

Revision ID: 20260714_0030
Revises: 20260714_0029
Create Date: 2026-07-14
"""
from alembic import op
import sqlalchemy as sa

revision      = "20260714_0030"
down_revision = "20260714_0029"
branch_labels = None
depends_on    = None


def upgrade() -> None:
    op.create_table(
        "vuln_scans",
        sa.Column("id",             sa.Integer, primary_key=True),
        sa.Column("agent_id",       sa.Integer, sa.ForeignKey("agents.id"),  nullable=False),
        sa.Column("tenant_id",      sa.Integer, sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("critical_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("high_count",     sa.Integer, nullable=False, server_default="0"),
        sa.Column("medium_count",   sa.Integer, nullable=False, server_default="0"),
        sa.Column("low_count",      sa.Integer, nullable=False, server_default="0"),
        sa.Column("info_count",     sa.Integer, nullable=False, server_default="0"),
        sa.Column("total_findings", sa.Integer, nullable=False, server_default="0"),
        sa.Column("started_at",     sa.DateTime, nullable=True),
        sa.Column("completed_at",   sa.DateTime, nullable=True),
    )
    op.create_index("ix_vuln_scans_agent_id",  "vuln_scans", ["agent_id"])
    op.create_index("ix_vuln_scans_tenant_id", "vuln_scans", ["tenant_id"])

    op.create_table(
        "vuln_findings",
        sa.Column("id",                 sa.Integer, primary_key=True),
        sa.Column("scan_id",            sa.Integer, sa.ForeignKey("vuln_scans.id"),  nullable=True),
        sa.Column("agent_id",           sa.Integer, sa.ForeignKey("agents.id"),      nullable=False),
        sa.Column("tenant_id",          sa.Integer, sa.ForeignKey("tenants.id"),     nullable=False),
        sa.Column("check_type",         sa.String,  nullable=False),
        sa.Column("severity",           sa.String,  nullable=False),
        sa.Column("title",              sa.String,  nullable=False),
        sa.Column("description",        sa.Text,    nullable=True),
        sa.Column("remediation",        sa.Text,    nullable=True),
        sa.Column("cve_id",             sa.String,  nullable=True),
        sa.Column("cvss_score",         sa.Float,   nullable=True),
        sa.Column("affected_component", sa.String,  nullable=True),
        sa.Column("package_name",       sa.String,  nullable=True),
        sa.Column("installed_version",  sa.String,  nullable=True),
        sa.Column("fixed_version",      sa.String,  nullable=True),
        sa.Column("status",             sa.String,  nullable=False, server_default="open"),
        sa.Column("first_seen",         sa.DateTime, nullable=True),
        sa.Column("last_seen",          sa.DateTime, nullable=True),
        sa.Column("created_at",         sa.DateTime, nullable=True),
        sa.Column("updated_at",         sa.DateTime, nullable=True),
    )
    op.create_index("ix_vuln_findings_tenant_id",  "vuln_findings", ["tenant_id"])
    op.create_index("ix_vuln_findings_agent_id",   "vuln_findings", ["agent_id"])
    op.create_index("ix_vuln_findings_severity",   "vuln_findings", ["severity"])
    op.create_index("ix_vuln_findings_check_type", "vuln_findings", ["check_type"])
    op.create_index("ix_vuln_findings_status",     "vuln_findings", ["status"])
    op.create_index("ix_vuln_findings_cve_id",     "vuln_findings", ["cve_id"])


def downgrade() -> None:
    op.drop_table("vuln_findings")
    op.drop_table("vuln_scans")
