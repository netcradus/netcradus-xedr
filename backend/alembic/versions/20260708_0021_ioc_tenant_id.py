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
    # Drop old index / constraint with IF EXISTS so migration is safe on both
    # fresh DBs (which may have idx_ioc_value from initial schema) and
    # upgraded DBs that had ix_iocs_value / iocs_value_key.
    op.execute("DROP INDEX IF EXISTS ix_iocs_value")
    op.execute("DROP INDEX IF EXISTS idx_ioc_value")
    op.execute("ALTER TABLE iocs DROP CONSTRAINT IF EXISTS iocs_value_key")

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
    op.execute("DROP INDEX IF EXISTS ix_iocs_value")
    op.drop_column("iocs", "tenant_id")
    op.execute("CREATE UNIQUE INDEX idx_ioc_value ON iocs (value)")
