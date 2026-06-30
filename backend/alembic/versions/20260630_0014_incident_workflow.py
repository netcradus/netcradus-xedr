"""Add investigation notes, evidence, and resolution fields to incidents

Revision ID: 20260630_0014
Revises: 20260629_0013
Create Date: 2026-06-30
"""

from alembic import op
import sqlalchemy as sa

revision = "20260630_0014"
down_revision = "20260629_0013"
branch_labels = None
depends_on = None


def upgrade():
    # ── Resolution columns on incidents ───────────────────────────────────
    op.add_column("incidents", sa.Column("root_cause",          sa.Text(), nullable=True))
    op.add_column("incidents", sa.Column("resolution_summary",  sa.Text(), nullable=True))
    op.add_column("incidents", sa.Column("containment_actions", sa.Text(), nullable=True))
    op.add_column("incidents", sa.Column("lessons_learned",     sa.Text(), nullable=True))

    # ── Investigation notes ───────────────────────────────────────────────
    op.create_table(
        "investigation_notes",
        sa.Column("id",          sa.Integer(), primary_key=True),
        sa.Column("incident_id", sa.Integer(), sa.ForeignKey("incidents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id",     sa.Integer(), sa.ForeignKey("users.id",     ondelete="SET NULL"), nullable=True),
        sa.Column("user_name",   sa.String(255), nullable=True),
        sa.Column("note_type",   sa.String(50),  server_default="note"),
        sa.Column("content",     sa.Text(),      nullable=False),
        sa.Column("created_at",  sa.DateTime(),  server_default=sa.func.now()),
    )
    op.create_index("ix_investigation_notes_incident", "investigation_notes", ["incident_id"])

    # ── Evidence ──────────────────────────────────────────────────────────
    op.create_table(
        "evidence",
        sa.Column("id",            sa.Integer(), primary_key=True),
        sa.Column("incident_id",   sa.Integer(), sa.ForeignKey("incidents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("added_by_id",   sa.Integer(), sa.ForeignKey("users.id",     ondelete="SET NULL"), nullable=True),
        sa.Column("added_by_name", sa.String(255), nullable=True),
        sa.Column("title",         sa.String(500), nullable=False),
        sa.Column("evidence_type", sa.String(50),  server_default="note"),
        sa.Column("content",       sa.Text(),      nullable=True),
        sa.Column("created_at",    sa.DateTime(),  server_default=sa.func.now()),
    )
    op.create_index("ix_evidence_incident", "evidence", ["incident_id"])


def downgrade():
    op.drop_index("ix_evidence_incident", "evidence")
    op.drop_table("evidence")
    op.drop_index("ix_investigation_notes_incident", "investigation_notes")
    op.drop_table("investigation_notes")
    op.drop_column("incidents", "lessons_learned")
    op.drop_column("incidents", "containment_actions")
    op.drop_column("incidents", "resolution_summary")
    op.drop_column("incidents", "root_cause")
