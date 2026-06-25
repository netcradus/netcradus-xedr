"""initial schema

Revision ID: 20260625_0001
Revises:
Create Date: 2026-06-25
"""

from alembic import op


revision = "20260625_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():

    op.execute("""
    CREATE TABLE IF NOT EXISTS roles (
        id SERIAL PRIMARY KEY,
        name VARCHAR UNIQUE
    );
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS tenants (
        id SERIAL PRIMARY KEY,
        name VARCHAR UNIQUE NOT NULL,
        api_key VARCHAR UNIQUE,
        is_active BOOLEAN DEFAULT TRUE
    );
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR,
        email VARCHAR UNIQUE,
        password VARCHAR,
        is_active BOOLEAN DEFAULT TRUE,
        role_id INTEGER REFERENCES roles(id),
        tenant_id INTEGER REFERENCES tenants(id)
    );
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS agents (
        id SERIAL PRIMARY KEY,
        hostname VARCHAR,
        ip_address VARCHAR,
        os_type VARCHAR,
        agent_version VARCHAR,
        last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR DEFAULT 'Online',
        agent_token VARCHAR UNIQUE,
        tenant_id INTEGER REFERENCES tenants(id)
    );
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS alerts (
        id SERIAL PRIMARY KEY,
        title VARCHAR,
        description VARCHAR,
        severity VARCHAR,
        mitre_technique VARCHAR,
        status VARCHAR DEFAULT 'Open',
        occurrence_count INTEGER DEFAULT 1,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        agent_id INTEGER REFERENCES agents(id)
    );
    """)

    op.execute("""
    ALTER TABLE alerts
    ADD COLUMN IF NOT EXISTS occurrence_count INTEGER DEFAULT 1;
    """)

    op.execute("""
    UPDATE alerts
    SET occurrence_count = 1
    WHERE occurrence_count IS NULL;
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS commands (
        id SERIAL PRIMARY KEY,
        command_type VARCHAR,
        argument VARCHAR,
        status VARCHAR DEFAULT 'Pending',
        result VARCHAR,
        error VARCHAR,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP,
        agent_id INTEGER REFERENCES agents(id)
    );
    """)

    op.execute("""
    ALTER TABLE commands
    ADD COLUMN IF NOT EXISTS result VARCHAR;
    """)

    op.execute("""
    ALTER TABLE commands
    ADD COLUMN IF NOT EXISTS error VARCHAR;
    """)

    op.execute("""
    ALTER TABLE commands
    ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS process_telemetry (
        id SERIAL PRIMARY KEY,
        pid INTEGER,
        ppid INTEGER,
        process_name VARCHAR,
        parent_process_name VARCHAR,
        cmdline VARCHAR,
        exe_path VARCHAR,
        username VARCHAR,
        sha256 VARCHAR,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        agent_id INTEGER REFERENCES agents(id)
    );
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS network_telemetry (
        id SERIAL PRIMARY KEY,
        local_ip VARCHAR,
        remote_ip VARCHAR,
        remote_port INTEGER,
        protocol VARCHAR,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        agent_id INTEGER REFERENCES agents(id)
    );
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS file_telemetry (
        id SERIAL PRIMARY KEY,
        event_type VARCHAR,
        file_path VARCHAR,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        agent_id INTEGER REFERENCES agents(id)
    );
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS persistence_telemetry (
        id SERIAL PRIMARY KEY,
        persistence_type VARCHAR,
        entry_name VARCHAR,
        entry_path VARCHAR,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        agent_id INTEGER REFERENCES agents(id)
    );
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS iocs (
        id SERIAL PRIMARY KEY,
        type VARCHAR(50) NOT NULL,
        value VARCHAR(512) UNIQUE NOT NULL,
        description TEXT,
        category VARCHAR(100),
        severity VARCHAR(20),
        source VARCHAR(100),
        created_by VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP,
        is_active BOOLEAN DEFAULT TRUE
    );
    """)

    op.execute("""
    CREATE INDEX IF NOT EXISTS idx_ioc_type ON iocs(type);
    """)

    op.execute("""
    CREATE INDEX IF NOT EXISTS idx_ioc_value ON iocs(value);
    """)


def downgrade():

    op.execute("DROP TABLE IF EXISTS iocs;")
    op.execute("DROP TABLE IF EXISTS persistence_telemetry;")
    op.execute("DROP TABLE IF EXISTS file_telemetry;")
    op.execute("DROP TABLE IF EXISTS network_telemetry;")
    op.execute("DROP TABLE IF EXISTS process_telemetry;")
    op.execute("DROP TABLE IF EXISTS commands;")
    op.execute("DROP TABLE IF EXISTS alerts;")
    op.execute("DROP TABLE IF EXISTS agents;")
    op.execute("DROP TABLE IF EXISTS users;")
    op.execute("DROP TABLE IF EXISTS tenants;")
    op.execute("DROP TABLE IF EXISTS roles;")
