"""Add scheduled report configs and generated reports tables

Revision ID: 20260702_0015
Revises: 20260630_0014
Create Date: 2026-07-02
"""

from alembic import op
import sqlalchemy as sa

revision       = "20260702_0015"
down_revision  = "20260630_0014"
branch_labels  = None
depends_on     = None


def upgrade():
    op.create_table(
        "scheduled_report_configs",
        sa.Column("id",          sa.Integer(),     primary_key=True),
        sa.Column("tenant_id",   sa.Integer(),     nullable=False, index=True),
        sa.Column("report_type", sa.String(50),    nullable=False),
        sa.Column("enabled",     sa.Boolean(),     server_default=sa.true()),
        sa.Column("recipients",  sa.Text(),        nullable=True),
        sa.Column("last_run_at", sa.DateTime(),    nullable=True),
        sa.Column("created_at",  sa.DateTime(),    server_default=sa.func.now()),
        sa.Column("updated_at",  sa.DateTime(),    server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index("ix_sched_report_tenant", "scheduled_report_configs", ["tenant_id"])
    op.create_unique_constraint(
        "uq_sched_report_tenant_type",
        "scheduled_report_configs",
        ["tenant_id", "report_type"],
    )

    op.create_table(
        "generated_reports",
        sa.Column("id",           sa.Integer(),     primary_key=True),
        sa.Column("tenant_id",    sa.Integer(),     nullable=False),
        sa.Column("report_type",  sa.String(50),    nullable=False),
        sa.Column("period_start", sa.DateTime(),    nullable=False),
        sa.Column("period_end",   sa.DateTime(),    nullable=False),
        sa.Column("pdf_data",     sa.LargeBinary(), nullable=True),
        sa.Column("file_size",    sa.Integer(),     nullable=True),
        sa.Column("generated_at", sa.DateTime(),    server_default=sa.func.now()),
        sa.Column("triggered_by", sa.String(50),    server_default="schedule"),
        sa.Column("status",       sa.String(20),    server_default="pending"),
        sa.Column("error",        sa.String(500),   nullable=True),
    )
    op.create_index("ix_gen_report_tenant", "generated_reports", ["tenant_id"])
    op.create_index("ix_gen_report_tenant_type", "generated_reports", ["tenant_id", "report_type"])


def downgrade():
    op.drop_index("ix_gen_report_tenant_type", "generated_reports")
    op.drop_index("ix_gen_report_tenant", "generated_reports")
    op.drop_table("generated_reports")

    op.drop_constraint("uq_sched_report_tenant_type", "scheduled_report_configs")
    op.drop_index("ix_sched_report_tenant", "scheduled_report_configs")
    op.drop_table("scheduled_report_configs")
