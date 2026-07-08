"""Multi-condition detection rules: add conditions table, logic column, compound index

Revision ID: 20260708_0022
Revises: 20260708_0021
"""
from alembic import op
import sqlalchemy as sa

revision      = "20260708_0022"
down_revision = "20260708_0021"
branch_labels = None
depends_on    = None


def upgrade():
    # 1. Add logic column to detection_rules (default OR keeps existing behaviour)
    op.add_column(
        "detection_rules",
        sa.Column("logic", sa.String(), nullable=False, server_default="OR"),
    )

    # 2. Create the conditions table
    op.create_table(
        "detection_rule_conditions",
        sa.Column("id",         sa.Integer(), primary_key=True),
        sa.Column("rule_id",    sa.Integer(), sa.ForeignKey("detection_rules.id", ondelete="CASCADE"), nullable=False),
        sa.Column("field",      sa.String(),  nullable=False),
        sa.Column("operator",   sa.String(),  nullable=False),
        sa.Column("value",      sa.String(),  nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_index("ix_rule_conditions_rule_id", "detection_rule_conditions", ["rule_id"])

    # 3. Migrate existing single-condition rows into the conditions table
    op.execute("""
        INSERT INTO detection_rule_conditions (rule_id, field, operator, value, sort_order)
        SELECT id, field, operator, value, 0
        FROM detection_rules
        WHERE field IS NOT NULL AND operator IS NOT NULL AND value IS NOT NULL
    """)

    # 4. Drop the now-redundant columns from detection_rules
    op.drop_column("detection_rules", "field")
    op.drop_column("detection_rules", "operator")
    op.drop_column("detection_rules", "value")

    # 5. Add compound index for fast rule lookup
    op.create_index(
        "ix_detection_rules_type_enabled_tenant",
        "detection_rules",
        ["rule_type", "enabled", "tenant_id"],
    )


def downgrade():
    op.drop_index("ix_detection_rules_type_enabled_tenant", table_name="detection_rules")

    op.add_column("detection_rules", sa.Column("field",    sa.String(), nullable=True))
    op.add_column("detection_rules", sa.Column("operator", sa.String(), nullable=True))
    op.add_column("detection_rules", sa.Column("value",    sa.String(), nullable=True))

    # Restore first condition per rule as the single-condition columns
    op.execute("""
        UPDATE detection_rules dr
        SET field    = c.field,
            operator = c.operator,
            value    = c.value
        FROM (
            SELECT DISTINCT ON (rule_id) rule_id, field, operator, value
            FROM detection_rule_conditions
            ORDER BY rule_id, sort_order
        ) c
        WHERE dr.id = c.rule_id
    """)

    op.drop_table("detection_rule_conditions")
    op.drop_column("detection_rules", "logic")
