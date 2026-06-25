"""add file telemetry hashes

Revision ID: 20260625_0002
Revises: 20260625_0001
Create Date: 2026-06-25
"""

from alembic import op


revision = "20260625_0002"
down_revision = "20260625_0001"
branch_labels = None
depends_on = None


def upgrade():

    op.execute("""
    ALTER TABLE file_telemetry
    ADD COLUMN IF NOT EXISTS sha256 VARCHAR;
    """)

    op.execute("""
    ALTER TABLE file_telemetry
    ADD COLUMN IF NOT EXISTS md5 VARCHAR;
    """)


def downgrade():

    op.execute("""
    ALTER TABLE file_telemetry
    DROP COLUMN IF EXISTS md5;
    """)

    op.execute("""
    ALTER TABLE file_telemetry
    DROP COLUMN IF EXISTS sha256;
    """)
