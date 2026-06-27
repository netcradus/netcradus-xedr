"""add threat_feed_configs and ioc enrichment columns

Revision ID: 20260627_0006
Revises: 20260627_0005
Create Date: 2026-06-27
"""

from alembic import op

revision = "20260627_0006"
down_revision = "20260627_0005"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
    CREATE TABLE IF NOT EXISTS threat_feed_configs (
        id                  SERIAL PRIMARY KEY,
        tenant_id           INTEGER NOT NULL UNIQUE REFERENCES tenants(id),
        virustotal_api_key  VARCHAR(512),
        abuseipdb_api_key   VARCHAR(512),
        updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    op.execute("""
    ALTER TABLE iocs
    ADD COLUMN IF NOT EXISTS enrichment_status VARCHAR(20) DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS vt_score          INTEGER,
    ADD COLUMN IF NOT EXISTS enrichment_data   TEXT;
    """)


def downgrade():
    op.execute("ALTER TABLE iocs DROP COLUMN IF EXISTS enrichment_data;")
    op.execute("ALTER TABLE iocs DROP COLUMN IF EXISTS vt_score;")
    op.execute("ALTER TABLE iocs DROP COLUMN IF EXISTS enrichment_status;")
    op.execute("DROP TABLE IF EXISTS threat_feed_configs;")
