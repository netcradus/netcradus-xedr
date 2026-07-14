"""
YARA rule engine.

Key design points:
  • Uses yara-python when available; degrades gracefully to no-op when absent.
  • Per-tenant compiled-rules cache (60s TTL) avoids recompiling on every event.
  • Namespace format "rule_{id}" lets us look up the exact DB row from each match
    to extract malware_family, severity, and MITRE metadata — replaces the previous
    fragile content.contains() heuristic.
  • Every match is persisted as a YaraScanResult for the scan history page.
  • Alerts carry the malware family name when known: "Malware Detected: Emotet".
"""
import base64
import logging
import threading
import time
from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from app.models.yara_rule import YaraRule
from app.models.yara_scan_result import YaraScanResult
from app.services.alert_service import create_alert_if_not_exists

_log = logging.getLogger("netcradxdr.yara")

try:
    import yara as _yara
    _YARA_AVAILABLE = True
except ImportError:
    _YARA_AVAILABLE = False
    _log.warning(
        "yara-python not installed — YARA scanning disabled. "
        "Install with: pip install yara-python"
    )


# ── Compiled rule cache ───────────────────────────────────────────────────────

_compiled_cache: dict[int, tuple] = {}   # tenant_id → (compiled_rules, expires_at)
_cache_lock = threading.Lock()
_CACHE_TTL = 60   # seconds


def invalidate_yara_cache(tenant_id: int) -> None:
    """Evict the compiled cache entry for a tenant (call after any rule change)."""
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

    # Namespace format "rule_<id>" lets _rule_id_from_namespace() look up the DB row.
    sources = {f"rule_{r.id}": r.content for r in rules}
    try:
        compiled = _yara.compile(sources=sources)
    except Exception as exc:
        _log.error("YARA compile error for tenant %s: %s", tenant_id, exc)
        return None

    with _cache_lock:
        _compiled_cache[tenant_id] = (compiled, now + _CACHE_TTL)
    return compiled


def _rule_id_from_namespace(namespace: str) -> Optional[int]:
    """Extract the DB rule id from a yara match namespace (format 'rule_<id>')."""
    try:
        return int(namespace.split("_", 1)[1])
    except (IndexError, ValueError):
        return None


# ── Core scan ─────────────────────────────────────────────────────────────────

def scan_data(
    db: Session,
    tenant_id: int,
    agent_id: Optional[int],
    data: bytes,
    file_path: Optional[str] = None,
    sha256: Optional[str] = None,
    scan_context: str = "auto",
) -> list[dict]:
    """
    Scan `data` against all enabled YARA rules for `tenant_id`.

    Returns a list of match dicts:
      { rule_name, malware_family, severity, mitre_tactic, mitre_technique }

    Side effects:
      • Inserts a YaraScanResult row for every match.
      • Fires an alert via create_alert_if_not_exists when agent_id is provided.
    """
    compiled = _get_compiled(db, tenant_id)
    if compiled is None:
        return []

    try:
        matches = compiled.match(data=data)
    except Exception as exc:
        _log.warning("YARA scan error: %s", exc)
        return []

    results = []
    for m in matches:
        # Resolve the DB rule from the match namespace
        rule_id = _rule_id_from_namespace(m.namespace)
        db_rule = db.query(YaraRule).filter(YaraRule.id == rule_id).first() if rule_id else None

        family    = (db_rule.malware_family  if db_rule else None) or m.rule
        severity  = (db_rule.severity        if db_rule else "High")
        tactic    = (db_rule.mitre_tactic    if db_rule else None)
        technique = (db_rule.mitre_technique if db_rule else None)

        db.add(YaraScanResult(
            file_path=file_path,
            sha256=sha256,
            matched_rule_name=m.rule,
            malware_family=family,
            severity=severity,
            mitre_tactic=tactic,
            mitre_technique=technique,
            scan_context=scan_context,
            agent_id=agent_id,
            tenant_id=tenant_id,
            created_at=datetime.utcnow(),
        ))

        if agent_id:
            title = f"Malware Detected: {family}" if family else f"YARA Match: {m.rule}"
            desc = (
                f"YARA rule '{m.rule}' matched"
                + (f" on '{file_path}'" if file_path else "")
                + (f" [sha256: {sha256[:16]}…]" if sha256 else "")
                + (f" — Family: {family}" if family else "")
            )
            create_alert_if_not_exists(db, title, desc, severity, technique or "", agent_id)

        results.append({
            "rule_name":      m.rule,
            "malware_family": family,
            "severity":       severity,
            "mitre_tactic":   tactic,
            "mitre_technique": technique,
        })

    if results:
        db.commit()

    return results


# ── File telemetry integration ────────────────────────────────────────────────

def scan_file_event(
    db: Session,
    tenant_id: int,
    agent_id: Optional[int],
    file_path: str,
    sha256: Optional[str],
    content_b64: Optional[str],
    event_type: str = "auto",
) -> list[dict]:
    """
    Entry point called from save_file_events() for each file telemetry record.

    When content_b64 is provided (agent sent file bytes as base64), scan the
    actual bytes — this gives full YARA coverage.  When absent, scan the
    file_path string so that path-pattern rules (e.g. matching suspicious
    download locations or extensions) can still fire.
    """
    if content_b64:
        try:
            data = base64.b64decode(content_b64)
        except Exception:
            data = file_path.encode()
    else:
        data = file_path.encode()

    context = "download" if event_type.lower() in {"download", "downloaded"} else "auto"
    return scan_data(
        db, tenant_id, agent_id, data,
        file_path=file_path, sha256=sha256, scan_context=context,
    )


# ── Syntax validation ─────────────────────────────────────────────────────────

def validate_rule_content(content: str) -> Optional[str]:
    """Return None if the YARA rule compiles cleanly, else an error string."""
    if not _YARA_AVAILABLE:
        return None   # accept optimistically when yara-python is absent
    try:
        _yara.compile(source=content)
        return None
    except Exception as exc:
        return str(exc)
