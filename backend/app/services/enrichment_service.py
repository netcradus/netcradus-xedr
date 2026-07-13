import json
import threading
import time
from datetime import datetime as _dt
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


# ── AlienVault OTX ───────────────────────────────────────────────────────────

_OTX_BASE = "https://otx.alienvault.com/api/v1"
_OTX_SUPPORTED = {"SHA256", "MD5", "IPv4", "IPv6", "Domain", "URL"}

_OTX_SECTION = {
    "SHA256": ("file",   lambda v: v),
    "MD5":    ("file",   lambda v: v),
    "IPv4":   ("IPv4",   lambda v: v),
    "IPv6":   ("IPv6",   lambda v: v),
    "Domain": ("domain", lambda v: v),
    "URL":    ("url",    lambda v: v),
}


def _lookup_otx(api_key: str, ioc_type: str, value: str):
    if ioc_type not in _OTX_SECTION:
        return None, None

    section_name, transform = _OTX_SECTION[ioc_type]
    url = f"{_OTX_BASE}/indicators/{section_name}/{transform(value)}/general"

    r = http_client.get(
        url,
        headers={"X-OTX-API-KEY": api_key},
        timeout=10,
    )
    if r.status_code == 404:
        return 0, {"source": "AlienVault OTX", "pulse_count": 0, "is_malicious": False}
    r.raise_for_status()

    data = r.json()
    pulse_info = data.get("pulse_info", {})
    pulses     = pulse_info.get("pulses", [])
    count      = pulse_info.get("count", len(pulses))

    adversaries      = list({p.get("adversary") for p in pulses if p.get("adversary")})[:5]
    malware_families = list({
        mf.get("display_name", mf.get("id", ""))
        for p in pulses
        for mf in p.get("malware_families", [])
        if mf
    })[:5]
    tags = list({tag for p in pulses for tag in p.get("tags", [])})[:8]
    top_pulses = [p.get("name", "") for p in pulses[:3] if p.get("name")]

    return count, {
        "source":           "AlienVault OTX",
        "pulse_count":      count,
        "is_malicious":     count > 0,
        "adversaries":      adversaries,
        "malware_families": malware_families,
        "tags":             tags,
        "pulses":           top_pulses,
    }


# ── URLHaus ───────────────────────────────────────────────────────────────────
# Free public API — no API key required.
# Covers: IPs/Domains (host lookup), URLs (url lookup), SHA256/MD5 (payload lookup).

_UH_BASE = "https://urlhaus-api.abuse.ch/v1"
_UH_HASH_TYPES = {"SHA256", "MD5"}
_UH_HOST_TYPES = {"IPv4", "IPv6", "Domain"}
_UH_URL_TYPES  = {"URL"}


def _lookup_urlhaus(ioc_type: str, value: str):
    try:
        if ioc_type in _UH_HASH_TYPES:
            field = "sha256_hash" if ioc_type == "SHA256" else "md5_hash"
            r = http_client.post(f"{_UH_BASE}/payload/", data={field: value}, timeout=10)
            r.raise_for_status()
            data = r.json()
            if data.get("query_status") == "no_results":
                return 0, {"source": "URLHaus", "listed": False, "url_count": 0}
            if data.get("query_status") == "ok":
                tags = data.get("tags") or []
                first_seen = data.get("firstseen") or data.get("first_seen")
                return 80, {
                    "source":     "URLHaus",
                    "listed":     True,
                    "url_count":  data.get("url_count", 1),
                    "file_type":  data.get("file_type"),
                    "signature":  data.get("signature"),
                    "first_seen": first_seen,
                    "tags":       tags[:5],
                }
            return None, None

        elif ioc_type in _UH_HOST_TYPES:
            r = http_client.post(f"{_UH_BASE}/host/", data={"host": value}, timeout=10)
            r.raise_for_status()
            data = r.json()
            status = data.get("query_status", "")
            if status in ("no_results", "invalid_host"):
                return 0, {"source": "URLHaus", "listed": False, "url_count": 0}
            url_count = data.get("url_count", 0)
            urls = data.get("urls") or []
            tags = list({t for u in urls for t in (u.get("tags") or [])})[:5]
            score = 80 if url_count > 0 else 0
            return score, {
                "source":    "URLHaus",
                "listed":    url_count > 0,
                "url_count": url_count,
                "tags":      tags,
            }

        elif ioc_type in _UH_URL_TYPES:
            r = http_client.post(f"{_UH_BASE}/url/", data={"url": value}, timeout=10)
            r.raise_for_status()
            data = r.json()
            status = data.get("query_status", "")
            if status in ("no_results", "invalid_url"):
                return 0, {"source": "URLHaus", "listed": False}
            url_status = data.get("url_status", "")
            score = 85 if url_status == "online" else 60
            tags = data.get("tags") or []
            return score, {
                "source":     "URLHaus",
                "listed":     True,
                "url_status": url_status,
                "threat":     data.get("threat", ""),
                "tags":       tags[:5],
            }
    except Exception:
        raise
    return None, None


# ── MalwareBazaar ─────────────────────────────────────────────────────────────
# Free public API — hash lookup requires no API key.

def _lookup_malwarebazaar(ioc_type: str, value: str):
    if ioc_type not in ("SHA256", "MD5"):
        return None, None

    r = http_client.post(
        "https://mb-api.abuse.ch/api/v1/",
        data={"query": "get_info", "hash": value},
        timeout=10,
    )
    r.raise_for_status()
    data = r.json()
    status = data.get("query_status", "")

    if status in ("hash_not_found", "illegal_hash"):
        return 0, {"source": "MalwareBazaar", "found": False}

    if status == "ok":
        entry = (data.get("data") or [{}])[0]
        tags = entry.get("tags") or []
        return 90, {
            "source":         "MalwareBazaar",
            "found":          True,
            "signature":      entry.get("signature"),
            "file_type":      entry.get("file_type"),
            "first_seen":     entry.get("first_seen"),
            "last_seen":      entry.get("last_seen"),
            "origin_country": entry.get("origin_country"),
            "tags":           tags[:5],
        }

    return None, None


# ── OpenPhish ─────────────────────────────────────────────────────────────────
# Free community feed — downloaded once per hour and cached in-process.

_OPENPHISH_FEED_URL = "https://openphish.com/feed.txt"
_OPENPHISH_TTL = 3600
_OPENPHISH_CACHE: dict = {"urls": set(), "expires": 0.0}


def _get_openphish_feed() -> set:
    now = time.time()
    if now < _OPENPHISH_CACHE["expires"] and _OPENPHISH_CACHE["urls"]:
        return _OPENPHISH_CACHE["urls"]
    r = http_client.get(_OPENPHISH_FEED_URL, timeout=15)
    r.raise_for_status()
    urls = {line.strip() for line in r.text.splitlines() if line.strip()}
    _OPENPHISH_CACHE["urls"] = urls
    _OPENPHISH_CACHE["expires"] = now + _OPENPHISH_TTL
    return urls


def _lookup_openphish(ioc_type: str, value: str):
    if ioc_type not in ("URL", "Domain"):
        return None, None
    feed = _get_openphish_feed()
    if ioc_type == "URL":
        listed = value in feed
    else:
        # Check if any phishing URL in the feed uses this domain
        needle = value.lower()
        listed = any(needle in u.lower() for u in feed)
    if listed:
        return 85, {"source": "OpenPhish", "listed": True, "category": "phishing"}
    return 0, {"source": "OpenPhish", "listed": False}


# ── Threat profile aggregation ────────────────────────────────────────────────

def _parse_dt(value: str, fmt: str) -> Optional[_dt]:
    try:
        return _dt.strptime(value.replace(" UTC", "").strip(), fmt)
    except Exception:
        return None


def _calculate_threat_profile(feeds_results: list) -> dict:
    """Aggregate per-feed results into a composite threat score and structured profile."""
    weighted_sum = 0
    weight_total = 0
    malware_family: Optional[str] = None
    first_seen: Optional[_dt] = None
    last_seen: Optional[_dt] = None
    all_tags: list = []

    for feed in feeds_results:
        if "error" in feed:
            continue
        source = feed.get("source", "")

        if source == "VirusTotal":
            score = feed.get("score_pct", 0) or 0
            weighted_sum += score * 3
            weight_total += 3
            all_tags.extend(feed.get("tags") or [])

        elif source == "AbuseIPDB":
            score = feed.get("confidence", 0) or 0
            weighted_sum += score * 2
            weight_total += 2

        elif source == "AlienVault OTX":
            pulse_count = feed.get("pulse_count", 0) or 0
            score = min(pulse_count * 10, 100)
            weighted_sum += score * 1
            weight_total += 1
            families = feed.get("malware_families") or []
            if families and not malware_family:
                malware_family = families[0]
            all_tags.extend(feed.get("tags") or [])

        elif source == "URLHaus":
            listed = feed.get("listed", False)
            url_count = feed.get("url_count", 0) or 0
            score = 80 if (listed or url_count > 0) else 0
            weighted_sum += score * 1
            weight_total += 1
            if feed.get("signature") and not malware_family:
                malware_family = feed["signature"]
            if feed.get("first_seen") and not first_seen:
                first_seen = _parse_dt(feed["first_seen"], "%Y-%m-%d %H:%M:%S")
            all_tags.extend(feed.get("tags") or [])

        elif source == "MalwareBazaar":
            found = feed.get("found", False)
            score = 90 if found else 0
            weighted_sum += score * 2
            weight_total += 2
            if feed.get("signature") and not malware_family:
                malware_family = feed["signature"]
            if feed.get("first_seen") and not first_seen:
                first_seen = _parse_dt(feed["first_seen"], "%Y-%m-%d %H:%M:%S")
            if feed.get("last_seen") and not last_seen:
                last_seen = _parse_dt(feed["last_seen"], "%Y-%m-%d %H:%M:%S")
            all_tags.extend(feed.get("tags") or [])

        elif source == "OpenPhish":
            score = 85 if feed.get("listed") else 0
            weighted_sum += score * 1
            weight_total += 1

    threat_score = round(weighted_sum / weight_total) if weight_total > 0 else 0

    if threat_score >= 70:
        verdict = "Malicious"
    elif threat_score >= 30:
        verdict = "Suspicious"
    elif weight_total > 0:
        verdict = "Clean"
    else:
        verdict = "Unknown"

    unique_tags = list(dict.fromkeys(all_tags))[:10]

    return {
        "threat_score":   threat_score,
        "threat_verdict": verdict,
        "malware_family": malware_family,
        "first_seen_date": first_seen,
        "last_seen_date":  last_seen,
        "tags":            unique_tags,
    }


# ── Unified lookup ────────────────────────────────────────────────────────────

def lookup_ioc(db: Session, tenant_id: int, ioc_type: str, value: str) -> dict:
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

    if config and config.otx_api_key and ioc_type in _OTX_SUPPORTED:
        try:
            pulse_count, info = _lookup_otx(config.otx_api_key, ioc_type, value)
            if info:
                feeds_results.append(info)
                if vt_score is None and pulse_count is not None:
                    vt_score = min(pulse_count * 10, 100)
        except Exception as exc:
            feeds_results.append({"source": "AlienVault OTX", "error": str(exc)})

    # URLHaus — free, no key required
    _uh_all = _UH_HASH_TYPES | _UH_HOST_TYPES | _UH_URL_TYPES
    if ioc_type in _uh_all:
        try:
            uh_score, uh_info = _lookup_urlhaus(ioc_type, value)
            if uh_info is not None:
                feeds_results.append(uh_info)
        except Exception as exc:
            feeds_results.append({"source": "URLHaus", "error": str(exc)})

    # MalwareBazaar — free hash lookup, no key required
    if ioc_type in ("SHA256", "MD5"):
        try:
            mb_score, mb_info = _lookup_malwarebazaar(ioc_type, value)
            if mb_info is not None:
                feeds_results.append(mb_info)
        except Exception as exc:
            feeds_results.append({"source": "MalwareBazaar", "error": str(exc)})

    # OpenPhish — free community feed for URL/Domain checks
    if ioc_type in ("URL", "Domain"):
        try:
            op_score, op_info = _lookup_openphish(ioc_type, value)
            if op_info is not None:
                feeds_results.append(op_info)
        except Exception as exc:
            feeds_results.append({"source": "OpenPhish", "error": str(exc)})

    profile = _calculate_threat_profile(feeds_results)

    return {
        "vt_score":       vt_score,
        "feeds":          feeds_results,
        "threat_score":   profile["threat_score"],
        "threat_verdict": profile["threat_verdict"],
        "malware_family": profile["malware_family"],
        "first_seen_date": profile["first_seen_date"],
        "last_seen_date":  profile["last_seen_date"],
        "tags":            profile["tags"],
    }


# ── Background enrichment ─────────────────────────────────────────────────────

def _enrich_worker(ioc_id: int, tenant_id: int):
    db = SessionLocal()
    try:
        ioc = db.query(IOC).filter(
            IOC.id == ioc_id, IOC.tenant_id == tenant_id
        ).first()
        if not ioc:
            return
        result = lookup_ioc(db, tenant_id, ioc.type, ioc.value)
        ioc.enrichment_status = "done"
        ioc.vt_score          = result.get("vt_score")
        ioc.enrichment_data   = json.dumps(result.get("feeds", []))
        ioc.threat_score      = result.get("threat_score")
        ioc.threat_verdict    = result.get("threat_verdict")
        ioc.malware_family    = result.get("malware_family")
        ioc.first_seen_date   = result.get("first_seen_date")
        ioc.last_seen_date    = result.get("last_seen_date")
        db.commit()
    except Exception as exc:
        try:
            ioc = db.query(IOC).filter(
                IOC.id == ioc_id, IOC.tenant_id == tenant_id
            ).first()
            if ioc:
                ioc.enrichment_status = "failed"
                db.commit()
        except Exception:
            db.rollback()
        print(f"[enrichment] ioc {ioc_id} failed: {exc}")
    finally:
        db.close()


def enrich_ioc_background(ioc_id: int, tenant_id: int):
    """Dispatch to Celery when Redis is available, fall back to a thread."""
    try:
        from app.tasks.enrichment import enrich_ioc_task
        enrich_ioc_task.delay(ioc_id, tenant_id)
    except Exception:
        threading.Thread(
            target=_enrich_worker,
            args=(ioc_id, tenant_id),
            daemon=True,
        ).start()
