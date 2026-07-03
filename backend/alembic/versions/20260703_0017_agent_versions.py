"""agent_versions table

Revision ID: 20260703_0017
Revises: 20260702_0016
"""
from alembic import op
import sqlalchemy as sa

revision      = "20260703_0017"
down_revision = "20260702_0016"
branch_labels = None
depends_on    = None


def upgrade():
    op.create_table(
        "agent_versions",
        sa.Column("id",              sa.Integer,      primary_key=True),
        sa.Column("version",         sa.String(32),   nullable=False, unique=True),
        sa.Column("platform",        sa.String(20),   nullable=False, server_default="all"),
        sa.Column("filename",        sa.String(255),  nullable=False),
        sa.Column("checksum_sha256", sa.String(64),   nullable=False),
        sa.Column("file_size",       sa.Integer),
        sa.Column("release_notes",   sa.Text),
        sa.Column("is_current",      sa.Boolean,      nullable=False, server_default="false"),
        sa.Column("created_at",      sa.DateTime,     server_default=sa.func.now()),
        sa.Column("uploaded_by",     sa.String(255)),
    )
    op.create_index("ix_agent_versions_is_current", "agent_versions", ["is_current"])


def downgrade():
    op.drop_index("ix_agent_versions_is_current", table_name="agent_versions")
    op.drop_table("agent_versions")
