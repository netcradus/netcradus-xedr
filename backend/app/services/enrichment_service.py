import json
import threading
from typing import Optional

import requests as http_client
from sqlalchemy.orm import Session

from app.database.db import SessionLocal
from app.models.ioc import IOC
from app.models.threat_feed_config import ThreatFeedConfig


# ── Config helper ─────────────────────────────────────────────────────────────

def get_or_create_config(db: Session, tenant_id: int) -> ThreatFeedConfig:
    config = db.query(ThreatFeedConfig).filter(
        ThreatFeedConfig.tenant_id == tenant_id
    ).first()
    if not config:
        config = ThreatFeedConfig(tenant_id=tenant_id)
        db.add(config)
        db.commit()
        db.refresh(config)
    return config


# ── VirusTotal ────────────────────────────────────────────────────────────────

_VT_BASE = "https://www.virustotal.com/api/v3"
_VT_SUPPORTED = {"SHA256", "MD5", "IPv4", "IPv6", "Domain", "URL"}


def _lookup_virustotal(api_key: str, ioc_type: str, value: str):
    import base64

    headers = {"x-apikey": api_key}

    if ioc_type in ("SHA256", "MD5"):
        url = f"{_VT_BASE}/files/{value}"
    elif ioc_type in ("IPv4", "IPv6"):
        url = f"{_VT_BASE}/ip_addresses/{value}"
    elif ioc_type == "Domain":
        url = f"{_VT_BASE}/domains/{value}"
    elif ioc_type == "URL":
        url_id = base64.urlsafe_b64encode(value.encode()).decode().rstrip("=")
        url = f"{_VT_BASE}/urls/{url_id}"
    else:
        return None, None

    r = http_client.get(url, headers=headers, timeout=10)
    if r.status_code == 404:
        return 0, {"source": "VirusTotal", "status": "not found", "score_pct": 0}
    r.raise_for_status()

    data = r.json()
    attrs = data.get("data", {}).get("attributes", {})
    stats = attrs.get("last_analysis_stats", {})
    malicious = stats.get("malicious", 0)
    total = sum(stats.values()) if stats else 0
    score = round(malicious / total * 100) if total > 0 else 0

    return score, {
        "source": "VirusTotal",
        "score_pct": score,
        "malicious": malicious,
        "total_engines": total,
        "reputation": attrs.get("reputation", 0),
        "tags": attrs.get("tags", [])[:5],
    }


# ── AbuseIPDB ─────────────────────────────────────────────────────────────────

def _lookup_abuseipdb(api_key: str, ip: str):
    r = http_client.get(
        "https://api.abuseipdb.com/api/v2/check",
        params={"ipAddress": ip, "maxAgeInDays": 90},
        headers={"Key": api_key, "Accept": "application/json"},
        timeout=10,
    )
    r.raise_for_status()
    d = r.json().get("data", {})
    score = d.get("abuseConfidenceScore", 0)
    return score, {
        "source": "AbuseIPDB",
        "confidence": score,
        "country": d.get("countryCode"),
        "isp": d.get("isp"),
        "total_reports": d.get("totalReports", 0),
        "is_tor": d.get("isTor", False),
    }


# ── Unified lookup ────────────────────────────────────────────────────────────

def lookup_ioc(db: Session, tenant_id: int, ioc_type: str, value: str) -> dict:
    """Run all configured feeds for the tenant and return combined results."""
    config = db.query(ThreatFeedConfig).filter(
        ThreatFeedConfig.tenant_id == tenant_id
    ).first()

    feeds_results = []
    vt_score: Optional[int] = None

    if config and config.virustotal_api_key and ioc_type in _VT_SUPPORTED:
        try:
            score, info = _lookup_virustotal(config.virustotal_api_key, ioc_type, value)
            if info:
                feeds_results.append(info)
                vt_score = score
        except Exception as exc:
            feeds_results.append({"source": "VirusTotal", "error": str(exc)})

    if config and config.abuseipdb_api_key and ioc_type in ("IPv4", "IPv6"):
        try:
            score, info = _lookup_abuseipdb(config.abuseipdb_api_key, value)
            feeds_results.append(info)
            if vt_score is None:
                vt_score = score
        except Exception as exc:
            feeds_results.append({"source": "AbuseIPDB", "error": str(exc)})

    return {"vt_score": vt_score, "feeds": feeds_results}


# ── Background enrichment ─────────────────────────────────────────────────────

def _enrich_worker(ioc_id: int, tenant_id: int):
    db = SessionLocal()
    try:
        ioc = db.query(IOC).filter(IOC.id == ioc_id).first()
        if not ioc:
            return
        result = lookup_ioc(db, tenant_id, ioc.type, ioc.value)
        ioc.enrichment_status = "done"
        ioc.vt_score = result.get("vt_score")
        ioc.enrichment_data = json.dumps(result.get("feeds", []))
        db.commit()
    except Exception as exc:
        try:
            ioc = db.query(IOC).filter(IOC.id == ioc_id).first()
            if ioc:
                ioc.enrichment_status = "failed"
                db.commit()
        except Exception:
            db.rollback()
        print(f"[enrichment] ioc {ioc_id} failed: {exc}")
    finally:
        db.close()


def enrich_ioc_background(ioc_id: int, tenant_id: int):
    threading.Thread(
        target=_enrich_worker,
        args=(ioc_id, tenant_id),
        daemon=True,
    ).start()
