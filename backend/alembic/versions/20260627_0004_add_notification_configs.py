"""add notification_configs table

Revision ID: 20260627_0004
Revises: 20260627_0003
Create Date: 2026-06-27
"""

from alembic import op

revision = "20260627_0004"
down_revision = "20260627_0003"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
    CREATE TABLE IF NOT EXISTS notification_configs (
        id                      SERIAL PRIMARY KEY,
        tenant_id               INTEGER NOT NULL UNIQUE REFERENCES tenants(id),
        slack_webhook_url       VARCHAR,
        teams_webhook_url       VARCHAR,
        email_to                VARCHAR,
        email_smtp_host         VARCHAR,
        email_smtp_port         INTEGER DEFAULT 587,
        email_smtp_user         VARCHAR,
        email_smtp_pass         VARCHAR,
        email_smtp_from         VARCHAR,
        email_use_tls           BOOLEAN DEFAULT TRUE,
        notify_on_critical      BOOLEAN DEFAULT TRUE,
        notify_on_high          BOOLEAN DEFAULT FALSE,
        notify_on_new_incident  BOOLEAN DEFAULT TRUE,
        notify_on_agent_offline BOOLEAN DEFAULT FALSE,
        updated_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    op.execute("""
    CREATE INDEX IF NOT EXISTS idx_notification_configs_tenant
    ON notification_configs(tenant_id);
    """)


def downgrade():
    op.execute("DROP TABLE IF EXISTS notification_configs;")
