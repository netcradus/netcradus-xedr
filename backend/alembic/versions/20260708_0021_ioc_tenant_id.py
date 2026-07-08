"""Add tenant_id to iocs; replace global unique on value with per-tenant constraint

Revision ID: 20260708_0021
Revises: 20260708_0020
"""
from alembic import op
import sqlalchemy as sa

revision      = "20260708_0021"
down_revision = "20260708_0020"
branch_labels = None
depends_on    = None


def upgrade():
    # Drop the old global uniqueness constraint on value alone
    op.drop_index("ix_iocs_value", table_name="iocs")
    op.drop_constraint("iocs_value_key", "iocs", type_="unique")

    # Add tenant_id column (nullable so existing rows aren't broken)
    op.add_column("iocs", sa.Column(
        "tenant_id",
        sa.Integer(),
        sa.ForeignKey("tenants.id"),
        nullable=True,
        index=True,
    ))

    # Re-create the value index (non-unique) and add the per-tenant composite unique
    op.create_index("ix_iocs_value", "iocs", ["value"])
    op.create_unique_constraint("uq_ioc_tenant_value", "iocs", ["tenant_id", "value"])


def downgrade():
    op.drop_constraint("uq_ioc_tenant_value", "iocs", type_="unique")
    op.drop_index("ix_iocs_value", table_name="iocs")
    op.drop_column("iocs", "tenant_id")
    op.create_index("ix_iocs_value", "iocs", ["value"], unique=True)
    op.create_unique_constraint("iocs_value_key", "iocs", ["value"])
