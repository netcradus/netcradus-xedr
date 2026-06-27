"""add incidents tables

Revision ID: 20260627_0003
Revises: 20260625_0002
Create Date: 2026-06-27
"""

from alembic import op

revision = "20260627_0003"
down_revision = "20260625_0002"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
    CREATE TABLE IF NOT EXISTS incidents (
        id SERIAL PRIMARY KEY,
        title VARCHAR NOT NULL,
        description TEXT,
        severity VARCHAR NOT NULL DEFAULT 'Low',
        status VARCHAR NOT NULL DEFAULT 'Open',
        tenant_id INTEGER NOT NULL REFERENCES tenants(id),
        assigned_to INTEGER REFERENCES users(id),
        mitre_tactics VARCHAR,
        alert_count INTEGER DEFAULT 1,
        affected_endpoints INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        resolved_at TIMESTAMP
    );
    """)

    op.execute("""
    CREATE INDEX IF NOT EXISTS idx_incidents_tenant ON incidents(tenant_id);
    """)

    op.execute("""
    CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS incident_alerts (
        id SERIAL PRIMARY KEY,
        incident_id INTEGER NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
        alert_id INTEGER NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
        added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uq_incident_alert UNIQUE (incident_id, alert_id)
    );
    """)

    op.execute("""
    CREATE INDEX IF NOT EXISTS idx_incident_alerts_incident ON incident_alerts(incident_id);
    """)


def downgrade():
    op.execute("DROP TABLE IF EXISTS incident_alerts;")
    op.execute("DROP TABLE IF EXISTS incidents;")
