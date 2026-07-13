"""
YARA rule engine.

Uses the `yara-python` library when available.  When it is not installed the
service degrades gracefully: rules are stored and managed through the API but
scanning always returns no matches (a warning is logged at startup).

Thread-safety: each `scan()` call compiles a private yara.Rules object from
the tenant's enabled rules.  We keep a per-tenant compiled-rules cache with a
60-second TTL so we do not recompile on every telemetry event.
"""
import logging
import threading
import time
from typing import List, Optional

from sqlalchemy.orm import Session

from app.models.yara_rule import YaraRule
from app.services.alert_service import create_alert_if_not_exists

_log = logging.getLogger("netcradxdr.yara")

try:
    import yara as _yara
    _YARA_AVAILABLE = True
except ImportError:
    _YARA_AVAILABLE = False
    _log.warning("yara-python not installed — YARA scanning disabled. Run: pip install yara-python")


# ── Compiled rule cache ───────────────────────────────────────────────────────

_compiled_cache: dict[int, tuple] = {}  # tenant_id -> (compiled_rules, expires_at)
_cache_lock = threading.Lock()
_CACHE_TTL = 60


def invalidate_yara_cache(tenant_id: int) -> None:
    with _cache_lock:
        _compiled_cache.pop(tenant_id, None)


def _get_compiled(db: Session, tenant_id: int):
    if not _YARA_AVAILABLE:
        return None
    now = time.monotonic()
    with _cache_lock:
        hit = _compiled_cache.get(tenant_id)
        if hit and hit[1] > now:
            return hit[0]

    rules = (
        db.query(YaraRule)
        .filter(
            YaraRule.enabled.is_(True),
            (YaraRule.tenant_id == tenant_id) | (YaraRule.tenant_id.is_(None)),
        )
        .all()
    )
    if not rules:
        return None

    sources = {}
    for r in rules:
        namespace = f"rule_{r.id}"
        sources[namespace] = r.content

    try:
        compiled = _yara.compile(sources=sources)
    except Exception as exc:
        _log.error("YARA compile error for tenant %s: %s", tenant_id, exc)
        return None

    with _cache_lock:
        _compiled_cache[tenant_id] = (compiled, now + _CACHE_TTL)
    return compiled


# ── Scanning ──────────────────────────────────────────────────────────────────

def scan_data(
    db: Session,
    tenant_id: int,
    agent_id: int,
    data: bytes,
    context_label: str,
) -> List[str]:
    """Scan `data` against tenant YARA rules. Returns list of matched rule names."""
    compiled = _get_compiled(db, tenant_id)
    if compiled is None:
        return []

    try:
        matches = compiled.match(data=data)
    except Exception as exc:
        _log.warning("YARA scan error: %s", exc)
        return []

    matched_names = []
    for m in matches:
        matched_names.append(m.rule)
        # Look up severity / mitre from the DB rule
        rule_row = db.query(YaraRule).filter(
            YaraRule.content.contains(m.rule),
            YaraRule.enabled.is_(True),
        ).first()
        severity = (rule_row.severity if rule_row else "High")
        technique = (rule_row.mitre_technique if rule_row else "")
        create_alert_if_not_exists(
            db,
            f"YARA Match: {m.rule}",
            f"YARA rule '{m.rule}' matched on {context_label}",
            severity, technique, agent_id,
        )
    return matched_names


def validate_rule_content(content: str) -> Optional[str]:
    """Return None if valid, else an error string."""
    if not _YARA_AVAILABLE:
        return None  # can't validate — accept optimistically
    try:
        _yara.compile(source=content)
        return None
    except Exception as exc:
        return str(exc)
