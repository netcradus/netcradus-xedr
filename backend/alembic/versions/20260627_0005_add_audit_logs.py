"""add audit_logs table

Revision ID: 20260627_0005
Revises: 20260627_0004
Create Date: 2026-06-27
"""

from alembic import op

revision = "20260627_0005"
down_revision = "20260627_0004"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
    CREATE TABLE IF NOT EXISTS audit_logs (
        id            SERIAL PRIMARY KEY,
        tenant_id     INTEGER NOT NULL REFERENCES tenants(id),
        user_id       INTEGER,
        user_name     VARCHAR,
        action        VARCHAR NOT NULL,
        resource_type VARCHAR,
        resource_id   INTEGER,
        details       VARCHAR,
        timestamp     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    op.execute("""
    CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant
    ON audit_logs(tenant_id);
    """)

    op.execute("""
    CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp
    ON audit_logs(timestamp DESC);
    """)


def downgrade():
    op.execute("DROP TABLE IF EXISTS audit_logs;")
