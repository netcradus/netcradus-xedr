"""sigma_rules table

Revision ID: 20260714_0026
Revises: 20260713_0025
Create Date: 2026-07-14
"""
from alembic import op
import sqlalchemy as sa

revision = "20260714_0026"
down_revision = "20260713_0025"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)

    if not insp.has_table("sigma_rules"):
        op.create_table(
            "sigma_rules",
            sa.Column("id",                 sa.Integer(),     primary_key=True),
            sa.Column("title",              sa.String(),      nullable=False),
            sa.Column("status",             sa.String(),      nullable=True),
            sa.Column("description",        sa.String(),      nullable=True),
            sa.Column("author",             sa.String(),      nullable=True),
            sa.Column("sigma_id",           sa.String(),      nullable=True),
            sa.Column("yaml_content",       sa.Text(),        nullable=False),
            sa.Column("detection_rule_id",  sa.Integer(),     sa.ForeignKey("detection_rules.id"), nullable=True),
            sa.Column("conversion_error",   sa.String(),      nullable=True),
            sa.Column("enabled",            sa.Boolean(),     nullable=False, server_default="true"),
            sa.Column("tenant_id",          sa.Integer(),     sa.ForeignKey("tenants.id"), nullable=True),
            sa.Column("created_at",         sa.DateTime(),    nullable=True),
            sa.Column("updated_at",         sa.DateTime(),    nullable=True),
        )
        op.create_index("ix_sigma_rules_tenant_id", "sigma_rules", ["tenant_id"])
        op.create_index("ix_sigma_rules_sigma_id",  "sigma_rules", ["sigma_id"])
    else:
        # Table already exists — ensure indexes are present
        existing_idx = {i['name'] for i in insp.get_indexes("sigma_rules")}
        if "ix_sigma_rules_tenant_id" not in existing_idx:
            op.create_index("ix_sigma_rules_tenant_id", "sigma_rules", ["tenant_id"])
        if "ix_sigma_rules_sigma_id" not in existing_idx:
            op.create_index("ix_sigma_rules_sigma_id", "sigma_rules", ["sigma_id"])


def downgrade() -> None:
    op.drop_index("ix_sigma_rules_sigma_id",  table_name="sigma_rules")
    op.drop_index("ix_sigma_rules_tenant_id", table_name="sigma_rules")
    op.drop_table("sigma_rules")
