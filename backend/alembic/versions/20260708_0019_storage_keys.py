"""Add storage_key to generated_reports and evidence; add file_name to evidence

Revision ID: 20260708_0019
Revises: 20260703_0018
"""
from alembic import op
import sqlalchemy as sa

revision      = "20260708_0019"
down_revision = "20260703_0018"
branch_labels = None
depends_on    = None


def upgrade():
    op.add_column("generated_reports", sa.Column("storage_key", sa.String(500), nullable=True))
    op.add_column("evidence", sa.Column("storage_key", sa.String(500), nullable=True))
    op.add_column("evidence", sa.Column("file_name",   sa.String(500), nullable=True))


def downgrade():
    op.drop_column("generated_reports", "storage_key")
    op.drop_column("evidence", "storage_key")
    op.drop_column("evidence", "file_name")
