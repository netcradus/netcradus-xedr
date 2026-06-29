"""Add detection_rules table

Revision ID: 20260629_0012
Revises: 20260629_0011
Create Date: 2026-06-29
"""

from alembic import op
import sqlalchemy as sa

revision = "20260629_0012"
down_revision = "20260629_0011"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "detection_rules",
        sa.Column("id",              sa.Integer,  primary_key=True),
        sa.Column("name",            sa.String,   nullable=False),
        sa.Column("description",     sa.String,   nullable=True),
        sa.Column("rule_type",       sa.String,   nullable=False),
        sa.Column("field",           sa.String,   nullable=False),
        sa.Column("operator",        sa.String,   nullable=False),
        sa.Column("value",           sa.String,   nullable=False),
        sa.Column("severity",        sa.String,   nullable=False, server_default="Medium"),
        sa.Column("mitre_tactic",    sa.String,   nullable=True),
        sa.Column("mitre_technique", sa.String,   nullable=True),
        sa.Column("enabled",         sa.Boolean,  nullable=False, server_default=sa.true()),
        sa.Column("tenant_id",       sa.Integer,  sa.ForeignKey("tenants.id"), nullable=True),
        sa.Column("is_system",       sa.Boolean,  nullable=False, server_default=sa.false()),
        sa.Column("created_at",      sa.DateTime, nullable=True),
        sa.Column("updated_at",      sa.DateTime, nullable=True),
    )
    op.create_index("ix_detection_rules_tenant_id", "detection_rules", ["tenant_id"])
    op.create_index("ix_detection_rules_rule_type",  "detection_rules", ["rule_type"])
    op.create_index("ix_detection_rules_enabled",    "detection_rules", ["enabled"])


def downgrade():
    op.drop_index("ix_detection_rules_enabled",    table_name="detection_rules")
    op.drop_index("ix_detection_rules_rule_type",  table_name="detection_rules")
    op.drop_index("ix_detection_rules_tenant_id",  table_name="detection_rules")
    op.drop_table("detection_rules")
