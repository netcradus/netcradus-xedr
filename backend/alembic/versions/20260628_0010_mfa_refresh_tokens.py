"""add refresh token and MFA columns to users

Revision ID: 20260628_0010
Revises: 20260628_0009
Create Date: 2026-06-28
"""
from alembic import op

revision = "20260628_0010"
down_revision = "20260628_0009"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS refresh_token VARCHAR UNIQUE;
    """)
    op.execute("""
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS refresh_token_expires TIMESTAMP;
    """)
    op.execute("""
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS totp_secret VARCHAR;
    """)
    op.execute("""
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN DEFAULT FALSE;
    """)


def downgrade():
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS refresh_token;")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS refresh_token_expires;")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS totp_secret;")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS mfa_enabled;")
