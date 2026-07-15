"""Add password_changed_at to users table

Revision ID: 20260714_0027
Revises: 20260714_0026
Create Date: 2026-07-14
"""
from alembic import op
import sqlalchemy as sa

revision = "20260714_0027"
down_revision = "20260714_0026"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    existing_cols = {c['name'] for c in insp.get_columns('users')}
    if 'password_changed_at' not in existing_cols:
        op.add_column(
            "users",
            sa.Column("password_changed_at", sa.DateTime(), nullable=True),
        )


def downgrade() -> None:
    op.drop_column("users", "password_changed_at")
