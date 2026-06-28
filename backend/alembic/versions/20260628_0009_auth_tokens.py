"""add email verification and password reset columns to users

Revision ID: 20260628_0009
Revises: 20260627_0008
Create Date: 2026-06-28
"""
from alembic import op

revision = "20260628_0009"
down_revision = "20260627_0008"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;
    """)
    op.execute("""
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS email_verification_token VARCHAR UNIQUE;
    """)
    op.execute("""
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS password_reset_token VARCHAR UNIQUE;
    """)
    op.execute("""
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMP;
    """)


def downgrade():
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS email_verified;")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS email_verification_token;")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS password_reset_token;")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS password_reset_expires;")
