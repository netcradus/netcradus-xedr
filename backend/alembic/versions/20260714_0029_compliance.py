"""Add compliance tables (frameworks, controls, assessments, evidence)

Revision ID: 20260714_0029
Revises: 20260714_0028
Create Date: 2026-07-14
"""
from alembic import op
import sqlalchemy as sa

revision      = "20260714_0029"
down_revision = "20260714_0028"
branch_labels = None
depends_on    = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)

    if not insp.has_table("compliance_frameworks"):
        op.create_table(
            "compliance_frameworks",
            sa.Column("id",          sa.Integer,  primary_key=True),
            sa.Column("name",        sa.String,   nullable=False),
            sa.Column("version",     sa.String,   nullable=True),
            sa.Column("description", sa.String,   nullable=True),
            sa.Column("category",    sa.String,   nullable=True),
            sa.Column("color",       sa.String,   nullable=True),
            sa.Column("created_at",  sa.DateTime, nullable=True),
            sa.UniqueConstraint("name", name="uq_compliance_frameworks_name"),
        )

    if not insp.has_table("compliance_controls"):
        op.create_table(
            "compliance_controls",
            sa.Column("id",             sa.Integer, primary_key=True),
            sa.Column("framework_id",   sa.Integer, sa.ForeignKey("compliance_frameworks.id"), nullable=False),
            sa.Column("control_ref",    sa.String,  nullable=False),
            sa.Column("title",          sa.String,  nullable=False),
            sa.Column("description",    sa.String,  nullable=True),
            sa.Column("category",       sa.String,  nullable=True),
            sa.Column("priority",       sa.String,  nullable=False, server_default="High"),
            sa.Column("xdr_auto_check", sa.Boolean, nullable=False, server_default="false"),
            sa.Column("check_type",     sa.String,  nullable=True),
            sa.Column("created_at",     sa.DateTime, nullable=True),
        )
        op.create_index("ix_compliance_controls_framework_id", "compliance_controls", ["framework_id"])
    else:
        existing_idx = {i['name'] for i in insp.get_indexes("compliance_controls")}
        if "ix_compliance_controls_framework_id" not in existing_idx:
            op.create_index("ix_compliance_controls_framework_id", "compliance_controls", ["framework_id"])

    if not insp.has_table("compliance_assessments"):
        op.create_table(
            "compliance_assessments",
            sa.Column("id",              sa.Integer, primary_key=True),
            sa.Column("control_id",      sa.Integer, sa.ForeignKey("compliance_controls.id"), nullable=False),
            sa.Column("tenant_id",       sa.Integer, sa.ForeignKey("tenants.id"),             nullable=False),
            sa.Column("status",          sa.String,  nullable=False, server_default="non_compliant"),
            sa.Column("notes",           sa.Text,    nullable=True),
            sa.Column("auto_derived",    sa.Boolean, nullable=False, server_default="false"),
            sa.Column("evidence_count",  sa.Integer, nullable=False, server_default="0"),
            sa.Column("last_checked_at", sa.DateTime, nullable=True),
            sa.Column("updated_at",      sa.DateTime, nullable=True),
        )
        op.create_index("ix_compliance_assessments_control_tenant",
                        "compliance_assessments", ["control_id", "tenant_id"])
        op.create_index("ix_compliance_assessments_tenant_id",
                        "compliance_assessments", ["tenant_id"])
    else:
        existing_idx = {i['name'] for i in insp.get_indexes("compliance_assessments")}
        if "ix_compliance_assessments_control_tenant" not in existing_idx:
            op.create_index("ix_compliance_assessments_control_tenant",
                            "compliance_assessments", ["control_id", "tenant_id"])
        if "ix_compliance_assessments_tenant_id" not in existing_idx:
            op.create_index("ix_compliance_assessments_tenant_id",
                            "compliance_assessments", ["tenant_id"])

    if not insp.has_table("compliance_evidence"):
        op.create_table(
            "compliance_evidence",
            sa.Column("id",              sa.Integer, primary_key=True),
            sa.Column("control_id",      sa.Integer, sa.ForeignKey("compliance_controls.id"), nullable=False),
            sa.Column("tenant_id",       sa.Integer, sa.ForeignKey("tenants.id"),             nullable=False),
            sa.Column("title",           sa.String,  nullable=False),
            sa.Column("description",     sa.Text,    nullable=True),
            sa.Column("evidence_type",   sa.String,  nullable=False, server_default="document"),
            sa.Column("storage_key",     sa.String,  nullable=True),
            sa.Column("uploaded_by_id",  sa.Integer, sa.ForeignKey("users.id"), nullable=True),
            sa.Column("created_at",      sa.DateTime, nullable=True),
        )
        op.create_index("ix_compliance_evidence_control_tenant",
                        "compliance_evidence", ["control_id", "tenant_id"])
    else:
        existing_idx = {i['name'] for i in insp.get_indexes("compliance_evidence")}
        if "ix_compliance_evidence_control_tenant" not in existing_idx:
            op.create_index("ix_compliance_evidence_control_tenant",
                            "compliance_evidence", ["control_id", "tenant_id"])


def downgrade() -> None:
    op.drop_table("compliance_evidence")
    op.drop_table("compliance_assessments")
    op.drop_table("compliance_controls")
    op.drop_table("compliance_frameworks")
