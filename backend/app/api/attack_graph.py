"""
Attack Graph API — Premium feature (Professional / Enterprise plans only).

Builds a directed graph (nodes + edges) representing the full kill chain for
an alert: attacker → initial access → execution → lateral movement → C2 → exfil.

Graph data is derived from real process/network/DNS/file telemetry when
available, with a MITRE-aware synthetic fallback for sparse telemetry.
"""
from datetime import timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.permissions import analyst_required
from app.database.db import get_db
from app.models.alert import Alert
from app.models.agent import Agent
from app.models.tenant import Tenant
from app.models.user import User

router = APIRouter(prefix="/attack-graph", tags=["Attack Graph"])

_PREMIUM_PLANS = {"professional", "enterprise"}

_SYSTEM_PROCS = {
    "svchost.exe", "services.exe", "lsass.exe", "winlogon.exe", "explorer.exe",
    "dwm.exe", "wininit.exe", "smss.exe", "csrss.exe", "system", "registry",
    "taskhost.exe", "taskhostw.exe", "sihost.exe", "fontdrvhost.exe",
}

_C2_PORTS = {4444, 4445, 1337, 8080, 8443, 9999, 443, 80, 8888, 31337}


# ── Premium gate ──────────────────────────────────────────────────────────────

def _require_premium(db: Session, tenant_id: int) -> Tenant:
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    plan = (tenant.plan or "free").lower()
    if plan not in _PREMIUM_PLANS:
        raise HTTPException(
            status_code=403,
            detail=(
                f"Attack Graph requires a Professional or Enterprise plan. "
                f"Current plan: {plan.capitalize()}. Upgrade to unlock this feature."
            ),
        )
    return tenant


# ── Edge label helper ─────────────────────────────────────────────────────────

def _edge_label(from_type: str, to_type: str) -> str:
    return {
        ("attacker", "email"):         "sent",
        ("attacker", "process"):       "deployed",
        ("email", "process"):          "executed",
        ("process", "process"):        "spawned",
        ("process", "file"):           "wrote",
        ("process", "c2"):             "connected",
        ("process", "network"):        "connected",
        ("process", "dns"):            "resolved",
        ("process", "exfiltration"):   "exfiltrated",
        ("c2", "exfiltration"):        "staged",
        ("file", "process"):           "loaded",
        ("network", "exfiltration"):   "transferred",
    }.get((from_type, to_type), "led to")


# ── Real-telemetry graph builder ──────────────────────────────────────────────

def _build_process_graph(
    db: Session, alert: Alert, agent: Agent, window_start, window_end
) -> tuple[list, list]:
    from app.models.process_telemetry import ProcessTelemetry
    from app.models.network_telemetry import NetworkTelemetry
    from app.models.dns_telemetry import DnsTelemetry

    nodes: list = []
    edges: list = []
    seen_ids: set = set()

    # Fetch process telemetry in window
    procs = (
        db.query(ProcessTelemetry)
        .filter(
            ProcessTelemetry.agent_id == agent.id,
            ProcessTelemetry.timestamp >= window_start,
            ProcessTelemetry.timestamp <= window_end,
        )
        .order_by(ProcessTelemetry.timestamp)
        .limit(60)
        .all()
    )

    if not procs:
        return [], []

    pid_map: dict = {p.pid: p for p in procs if p.pid}

    # Identify the malicious "leaf" process — one whose name matches the alert title
    alert_lower = alert.title.lower()
    target = None
    for p in reversed(procs):
        name = (p.process_name or "").lower()
        if name and len(name) > 3 and name.replace(".exe", "") in alert_lower:
            target = p
            break
    if target is None:
        target = procs[-1]

    # Walk parent chain from target up to root
    chain: list = []
    visited: set = set()
    cur = target
    while cur and len(chain) < 10:
        chain.insert(0, cur)
        if cur.pid in visited:
            break
        visited.add(cur.pid)
        cur = pid_map.get(cur.ppid)

    def _add_proc(proc, is_malicious: bool) -> str:
        nid = f"proc_{proc.pid or proc.id}"
        if nid in seen_ids:
            return nid
        seen_ids.add(nid)
        name_lower = (proc.process_name or "").lower()
        risk = 90 if is_malicious else (5 if name_lower in _SYSTEM_PROCS else 40)
        nodes.append({
            "id": nid,
            "type": "process",
            "label": proc.process_name or f"PID {proc.pid}",
            "detail": proc.cmdline or proc.exe_path or proc.process_name or "",
            "timestamp": proc.timestamp.isoformat() if proc.timestamp else None,
            "risk_score": risk,
            "is_malicious": is_malicious,
            "metadata": {
                "pid": proc.pid,
                "user": proc.username or "",
                "path": proc.exe_path or "",
            },
        })
        return nid

    for i, proc in enumerate(chain):
        _add_proc(proc, is_malicious=i >= max(1, len(chain) - 2))

    for i in range(1, len(chain)):
        p_nid = f"proc_{chain[i-1].pid or chain[i-1].id}"
        c_nid = f"proc_{chain[i].pid or chain[i].id}"
        edges.append({"from": p_nid, "to": c_nid, "label": "spawned", "type": "process_spawn"})

    target_nid = f"proc_{target.pid or target.id}"

    # Network / C2 nodes
    net_rows = (
        db.query(NetworkTelemetry)
        .filter(
            NetworkTelemetry.agent_id == agent.id,
            NetworkTelemetry.timestamp >= window_start,
            NetworkTelemetry.timestamp <= window_end,
        )
        .limit(20)
        .all()
    )

    seen_ips: set = set()
    for conn in net_rows:
        ip = (conn.remote_ip or "").strip()
        if not ip or ip in seen_ips:
            continue
        # Skip RFC-1918 / loopback
        if ip.startswith(("10.", "192.168.", "172.16.", "172.17.", "172.18.",
                           "172.19.", "172.20.", "172.21.", "172.22.", "172.23.",
                           "172.24.", "172.25.", "172.26.", "172.27.", "172.28.",
                           "172.29.", "172.30.", "172.31.", "127.", "::1")):
            continue
        seen_ips.add(ip)
        if len(seen_ips) > 3:
            break

        port = conn.remote_port or 0
        is_c2 = port in _C2_PORTS
        ntype = "c2" if is_c2 else "network"
        nid = f"net_{ip.replace('.', '_').replace(':', '_')}"
        if nid not in seen_ids:
            seen_ids.add(nid)
            nodes.append({
                "id": nid,
                "type": ntype,
                "label": ip,
                "detail": f"{conn.protocol or 'TCP'}:{port}" if port else ip,
                "timestamp": conn.timestamp.isoformat() if conn.timestamp else None,
                "risk_score": 90 if is_c2 else 60,
                "is_malicious": is_c2,
                "metadata": {"port": port, "protocol": conn.protocol or "TCP"},
            })
            if target_nid in seen_ids:
                edges.append({
                    "from": target_nid,
                    "to": nid,
                    "label": _edge_label("process", ntype),
                    "type": "network_connection",
                })

    # DNS nodes (unique external FQDNs)
    dns_rows = (
        db.query(DnsTelemetry)
        .filter(
            DnsTelemetry.agent_id == agent.id,
            DnsTelemetry.timestamp >= window_start,
            DnsTelemetry.timestamp <= window_end,
            DnsTelemetry.direction == "query",
        )
        .limit(10)
        .all()
    )
    seen_fqdns: set = set()
    for d in dns_rows:
        fqdn = (d.query_name or "").strip().lower()
        if not fqdn or fqdn in seen_fqdns:
            continue
        if any(fqdn.endswith(suf) for suf in (".local", ".internal", ".corp", "localhost")):
            continue
        seen_fqdns.add(fqdn)
        if len(seen_fqdns) > 2:
            break
        nid = f"dns_{fqdn.replace('.', '_')[:30]}"
        if nid not in seen_ids:
            seen_ids.add(nid)
            nodes.append({
                "id": nid,
                "type": "dns",
                "label": fqdn,
                "detail": f"DNS {d.query_type or 'A'} query",
                "timestamp": d.timestamp.isoformat() if d.timestamp else None,
                "risk_score": 55,
                "is_malicious": False,
                "metadata": {"query_type": d.query_type or "A", "response": d.response or ""},
            })
            if target_nid in seen_ids:
                edges.append({
                    "from": target_nid,
                    "to": nid,
                    "label": "resolved",
                    "type": "dns_query",
                })

    return nodes, edges


# ── Synthetic fallback graph ──────────────────────────────────────────────────

_TECHNIQUE_CHAINS: dict = {
    "T1566": [
        ("attacker",      "Threat Actor",    "Phishing campaign operator"),
        ("email",         "Phishing Email",  "Malicious attachment / link"),
        ("process",       "WINWORD.EXE",     "Macro-enabled Office document"),
        ("process",       "cmd.exe",         "Shell spawned via macro"),
        ("process",       "PowerShell",      "Encoded payload execution"),
        ("c2",            "C2 Server",       "Beaconing callback"),
        ("exfiltration",  "Exfiltration",    "Data staged and sent"),
    ],
    "T1059": [
        ("process",       "WINWORD.EXE",     "Macro-enabled document"),
        ("process",       "cmd.exe",         "Shell interpreter"),
        ("process",       "PowerShell",      "Script execution"),
        ("c2",            "C2 Server",       "Remote callback"),
        ("exfiltration",  "Exfiltration",    "Lateral data transfer"),
    ],
    "T1486": [
        ("attacker",      "Threat Actor",    "Ransomware operator"),
        ("process",       "dropper.exe",     "Initial dropper"),
        ("process",       "tasksche.exe",    "Ransomware payload"),
        ("file",          "*.encrypted",     "Files encrypted on disk"),
        ("exfiltration",  "Exfil Channel",   "Data exfiltrated before encryption"),
    ],
    "T1055": [
        ("process",       "explorer.exe",    "Legitimate host process"),
        ("process",       "injected.dll",    "Injected malicious payload"),
        ("c2",            "C2 Server",       "Callback via injected context"),
    ],
    "T1003": [
        ("attacker",      "Attacker",        "Post-exploitation shell"),
        ("process",       "cmd.exe",         "Attacker command interface"),
        ("process",       "lsass.exe",       "LSASS memory access"),
        ("file",          "credentials.dmp", "Credential dump written"),
        ("network",       "Exfil Target",    "Credentials exfiltrated"),
    ],
    "T1071": [
        ("process",       "PowerShell",      "C2 beacon script"),
        ("dns",           "c2-domain.com",   "DNS beacon / resolution"),
        ("c2",            "C2 Server",       "HTTP/HTTPS C2 channel"),
        ("exfiltration",  "Data Exfil",      "Encrypted data transfer"),
    ],
    "T1078": [
        ("attacker",      "Attacker",        "Valid credentials obtained"),
        ("process",       "wscript.exe",     "Script execution"),
        ("process",       "PowerShell",      "Payload via valid account"),
        ("c2",            "C2 Server",       "Persistent C2 channel"),
    ],
}


def _build_synthetic_graph(alert: Alert, mitre: Optional[str]) -> tuple[list, list]:
    chain = None
    if mitre:
        for key, template in _TECHNIQUE_CHAINS.items():
            if mitre.startswith(key):
                chain = template
                break

    if chain is None:
        chain = [
            ("attacker",     "Attacker",           "Initial access vector"),
            ("process",      "dropper.exe",         "Malware loader"),
            ("process",      alert.title or "malware.exe", f"Malicious execution ({alert.severity})"),
            ("c2",           "C2 Server",           "Command & Control callback"),
            ("exfiltration", "Data Exfiltration",   "Sensitive data sent externally"),
        ]

    nodes, edges = [], []
    for i, (ntype, label, detail) in enumerate(chain):
        nid = f"syn_{i}"
        is_malicious = ntype in ("c2", "exfiltration", "attacker") or i >= len(chain) - 2
        nodes.append({
            "id": nid,
            "type": ntype,
            "label": label,
            "detail": detail,
            "timestamp": None,
            "risk_score": 95 if is_malicious else (70 if i > 0 else 50),
            "is_malicious": is_malicious,
            "metadata": {"synthetic": True},
        })
        if i > 0:
            edges.append({
                "from": f"syn_{i-1}",
                "to": nid,
                "label": _edge_label(chain[i-1][0], ntype),
                "type": "attack_step",
            })

    return nodes, edges


# ── Route ─────────────────────────────────────────────────────────────────────

@router.get("/alerts/{alert_id}")
def get_attack_graph(
    alert_id: int,
    current_user: User = Depends(analyst_required),
    db: Session = Depends(get_db),
):
    """
    Return the attack graph for an alert (Professional / Enterprise plans only).

    Builds the kill chain from real telemetry (process parent chain, network
    connections, DNS lookups) with a MITRE-technique synthetic fallback when
    telemetry is sparse.
    """
    _require_premium(db, current_user.tenant_id)

    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    agent = db.query(Agent).filter(
        Agent.id == alert.agent_id,
        Agent.tenant_id == current_user.tenant_id,
    ).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Alert not accessible")

    # Build telemetry window ±30 min around the alert
    alert_ts = alert.timestamp
    nodes, edges, synthetic = [], [], False

    if alert_ts:
        window_start = alert_ts - timedelta(minutes=30)
        window_end   = alert_ts + timedelta(minutes=30)
        try:
            nodes, edges = _build_process_graph(db, alert, agent, window_start, window_end)
        except Exception:
            nodes, edges = [], []

    if len(nodes) < 2:
        nodes, edges = _build_synthetic_graph(alert, alert.mitre_technique)
        synthetic = True

    return {
        "alert_id":        alert.id,
        "alert_title":     alert.title,
        "alert_severity":  alert.severity,
        "mitre_technique": alert.mitre_technique,
        "hostname":        agent.hostname,
        "is_synthetic":    synthetic,
        "nodes":           nodes,
        "edges":           edges,
    }
