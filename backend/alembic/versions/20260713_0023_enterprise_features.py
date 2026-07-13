"""Enterprise feature tables: DNS, Registry, USB, Browser Extensions, Memory Scans,
Cloud, K8s, Email telemetry; YARA rules; Sigma rules; Live sessions.

Revision ID: 20260713_0023
Revises: 20260708_0022
"""
from alembic import op
import sqlalchemy as sa

revision      = "20260713_0023"
down_revision = "20260708_0022"
branch_labels = None
depends_on    = None


def upgrade():
    # ── DNS telemetry ─────────────────────────────────────────────────────────
    op.create_table(
        "dns_telemetry",
        sa.Column("id",           sa.Integer(), primary_key=True),
        sa.Column("query_name",   sa.String()),
        sa.Column("query_type",   sa.String()),
        sa.Column("response",     sa.String()),
        sa.Column("direction",    sa.String()),
        sa.Column("process_name", sa.String()),
        sa.Column("pid",          sa.Integer()),
        sa.Column("username",     sa.String()),
        sa.Column("timestamp",    sa.DateTime()),
        sa.Column("agent_id",     sa.Integer(), sa.ForeignKey("agents.id")),
    )
    op.create_index("ix_dns_telemetry_agent_id", "dns_telemetry", ["agent_id"])

    # ── Registry telemetry ────────────────────────────────────────────────────
    op.create_table(
        "registry_telemetry",
        sa.Column("id",           sa.Integer(), primary_key=True),
        sa.Column("event_type",   sa.String()),
        sa.Column("registry_key", sa.String()),
        sa.Column("value_name",   sa.String()),
        sa.Column("value_data",   sa.String()),
        sa.Column("value_type",   sa.String()),
        sa.Column("process_name", sa.String()),
        sa.Column("pid",          sa.Integer()),
        sa.Column("username",     sa.String()),
        sa.Column("timestamp",    sa.DateTime()),
        sa.Column("agent_id",     sa.Integer(), sa.ForeignKey("agents.id")),
    )
    op.create_index("ix_registry_telemetry_agent_id", "registry_telemetry", ["agent_id"])

    # ── USB telemetry ─────────────────────────────────────────────────────────
    op.create_table(
        "usb_telemetry",
        sa.Column("id",           sa.Integer(), primary_key=True),
        sa.Column("event_type",   sa.String()),
        sa.Column("device_id",    sa.String()),
        sa.Column("device_name",  sa.String()),
        sa.Column("vendor_id",    sa.String()),
        sa.Column("product_id",   sa.String()),
        sa.Column("drive_letter", sa.String()),
        sa.Column("file_path",    sa.String()),
        sa.Column("username",     sa.String()),
        sa.Column("timestamp",    sa.DateTime()),
        sa.Column("agent_id",     sa.Integer(), sa.ForeignKey("agents.id")),
    )
    op.create_index("ix_usb_telemetry_agent_id", "usb_telemetry", ["agent_id"])

    # ── Browser extension telemetry ───────────────────────────────────────────
    op.create_table(
        "browser_extension_telemetry",
        sa.Column("id",             sa.Integer(), primary_key=True),
        sa.Column("event_type",     sa.String()),
        sa.Column("browser",        sa.String()),
        sa.Column("extension_id",   sa.String()),
        sa.Column("extension_name", sa.String()),
        sa.Column("version",        sa.String()),
        sa.Column("permissions",    sa.String()),
        sa.Column("from_webstore",  sa.Boolean(), server_default="true"),
        sa.Column("update_url",     sa.String()),
        sa.Column("username",       sa.String()),
        sa.Column("timestamp",      sa.DateTime()),
        sa.Column("agent_id",       sa.Integer(), sa.ForeignKey("agents.id")),
    )
    op.create_index("ix_browser_ext_agent_id", "browser_extension_telemetry", ["agent_id"])

    # ── Memory scan results ───────────────────────────────────────────────────
    op.create_table(
        "memory_scan_results",
        sa.Column("id",             sa.Integer(), primary_key=True),
        sa.Column("scan_type",      sa.String()),
        sa.Column("rule_name",      sa.String()),
        sa.Column("process_name",   sa.String()),
        sa.Column("pid",            sa.Integer()),
        sa.Column("memory_region",  sa.String()),
        sa.Column("matched_bytes",  sa.String()),
        sa.Column("severity",       sa.String(), server_default="High"),
        sa.Column("details",        sa.Text()),
        sa.Column("timestamp",      sa.DateTime()),
        sa.Column("agent_id",       sa.Integer(), sa.ForeignKey("agents.id")),
    )
    op.create_index("ix_memory_scan_agent_id", "memory_scan_results", ["agent_id"])

    # ── Cloud workload telemetry ──────────────────────────────────────────────
    op.create_table(
        "cloud_telemetry",
        sa.Column("id",            sa.Integer(), primary_key=True),
        sa.Column("provider",      sa.String()),
        sa.Column("event_type",    sa.String()),
        sa.Column("resource_type", sa.String()),
        sa.Column("resource_id",   sa.String()),
        sa.Column("region",        sa.String()),
        sa.Column("actor",         sa.String()),
        sa.Column("source_ip",     sa.String()),
        sa.Column("action",        sa.String()),
        sa.Column("outcome",       sa.String(), server_default="success"),
        sa.Column("raw_event",     sa.Text()),
        sa.Column("timestamp",     sa.DateTime()),
        sa.Column("agent_id",      sa.Integer(), sa.ForeignKey("agents.id"), nullable=True),
        sa.Column("tenant_id",     sa.Integer(), sa.ForeignKey("tenants.id"), nullable=True),
    )
    op.create_index("ix_cloud_telemetry_tenant_id", "cloud_telemetry", ["tenant_id"])

    # ── Kubernetes telemetry ──────────────────────────────────────────────────
    op.create_table(
        "k8s_telemetry",
        sa.Column("id",            sa.Integer(), primary_key=True),
        sa.Column("event_type",    sa.String()),
        sa.Column("cluster",       sa.String()),
        sa.Column("namespace",     sa.String()),
        sa.Column("resource_kind", sa.String()),
        sa.Column("resource_name", sa.String()),
        sa.Column("actor",         sa.String()),
        sa.Column("container",     sa.String()),
        sa.Column("image",         sa.String()),
        sa.Column("command",       sa.String()),
        sa.Column("outcome",       sa.String(), server_default="success"),
        sa.Column("raw_event",     sa.Text()),
        sa.Column("timestamp",     sa.DateTime()),
        sa.Column("agent_id",      sa.Integer(), sa.ForeignKey("agents.id"), nullable=True),
        sa.Column("tenant_id",     sa.Integer(), sa.ForeignKey("tenants.id"), nullable=True),
    )
    op.create_index("ix_k8s_telemetry_tenant_id", "k8s_telemetry", ["tenant_id"])

    # ── Email event telemetry ─────────────────────────────────────────────────
    op.create_table(
        "email_event_telemetry",
        sa.Column("id",               sa.Integer(), primary_key=True),
        sa.Column("event_type",       sa.String()),
        sa.Column("direction",        sa.String()),
        sa.Column("sender",           sa.String()),
        sa.Column("recipient",        sa.String()),
        sa.Column("subject",          sa.String()),
        sa.Column("message_id",       sa.String()),
        sa.Column("source_ip",        sa.String()),
        sa.Column("has_attachment",   sa.Boolean(), server_default="false"),
        sa.Column("attachment_name",  sa.String()),
        sa.Column("attachment_sha256",sa.String()),
        sa.Column("url_clicked",      sa.String()),
        sa.Column("verdict",          sa.String(), server_default="clean"),
        sa.Column("score",            sa.Integer(), server_default="0"),
        sa.Column("raw_headers",      sa.Text()),
        sa.Column("timestamp",        sa.DateTime()),
        sa.Column("agent_id",         sa.Integer(), sa.ForeignKey("agents.id"), nullable=True),
        sa.Column("tenant_id",        sa.Integer(), sa.ForeignKey("tenants.id"), nullable=True),
    )
    op.create_index("ix_email_telemetry_tenant_id", "email_event_telemetry", ["tenant_id"])

    # ── YARA rules ────────────────────────────────────────────────────────────
    op.create_table(
        "yara_rules",
        sa.Column("id",              sa.Integer(), primary_key=True),
        sa.Column("name",            sa.String(), nullable=False),
        sa.Column("description",     sa.String()),
        sa.Column("tags",            sa.String()),
        sa.Column("content",         sa.Text(), nullable=False),
        sa.Column("severity",        sa.String(), server_default="High"),
        sa.Column("mitre_tactic",    sa.String()),
        sa.Column("mitre_technique", sa.String()),
        sa.Column("enabled",         sa.Boolean(), server_default="true", nullable=False),
        sa.Column("is_system",       sa.Boolean(), server_default="false", nullable=False),
        sa.Column("tenant_id",       sa.Integer(), sa.ForeignKey("tenants.id"), nullable=True),
        sa.Column("created_at",      sa.DateTime()),
        sa.Column("updated_at",      sa.DateTime()),
    )
    op.create_index("ix_yara_rules_tenant_id", "yara_rules", ["tenant_id"])

    # ── Sigma rules ───────────────────────────────────────────────────────────
    op.create_table(
        "sigma_rules",
        sa.Column("id",                sa.Integer(), primary_key=True),
        sa.Column("title",             sa.String(), nullable=False),
        sa.Column("status",            sa.String()),
        sa.Column("description",       sa.String()),
        sa.Column("author",            sa.String()),
        sa.Column("sigma_id",          sa.String()),
        sa.Column("yaml_content",      sa.Text(), nullable=False),
        sa.Column("detection_rule_id", sa.Integer(), sa.ForeignKey("detection_rules.id"), nullable=True),
        sa.Column("conversion_error",  sa.String()),
        sa.Column("enabled",           sa.Boolean(), server_default="true", nullable=False),
        sa.Column("tenant_id",         sa.Integer(), sa.ForeignKey("tenants.id"), nullable=True),
        sa.Column("created_at",        sa.DateTime()),
        sa.Column("updated_at",        sa.DateTime()),
    )
    op.create_index("ix_sigma_rules_tenant_id", "sigma_rules", ["tenant_id"])

    # ── Live response sessions ────────────────────────────────────────────────
    op.create_table(
        "live_sessions",
        sa.Column("id",           sa.Integer(), primary_key=True),
        sa.Column("agent_id",     sa.Integer(), sa.ForeignKey("agents.id"), nullable=False),
        sa.Column("initiator_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("tenant_id",    sa.Integer(), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("status",       sa.String(), server_default="open"),
        sa.Column("shell_type",   sa.String(), server_default="cmd"),
        sa.Column("opened_at",    sa.DateTime()),
        sa.Column("closed_at",    sa.DateTime()),
    )
    op.create_index("ix_live_sessions_agent_id",  "live_sessions", ["agent_id"])
    op.create_index("ix_live_sessions_tenant_id", "live_sessions", ["tenant_id"])

    op.create_table(
        "live_session_entries",
        sa.Column("id",         sa.Integer(), primary_key=True),
        sa.Column("session_id", sa.Integer(), sa.ForeignKey("live_sessions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("direction",  sa.String()),
        sa.Column("content",    sa.Text()),
        sa.Column("timestamp",  sa.DateTime()),
    )
    op.create_index("ix_live_session_entries_session_id", "live_session_entries", ["session_id"])


def downgrade():
    op.drop_table("live_session_entries")
    op.drop_table("live_sessions")
    op.drop_table("sigma_rules")
    op.drop_table("yara_rules")
    op.drop_table("email_event_telemetry")
    op.drop_table("k8s_telemetry")
    op.drop_table("cloud_telemetry")
    op.drop_table("memory_scan_results")
    op.drop_table("browser_extension_telemetry")
    op.drop_table("usb_telemetry")
    op.drop_table("registry_telemetry")
    op.drop_table("dns_telemetry")
