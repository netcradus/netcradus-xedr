"""
MITRE ATT&CK coverage endpoints.

Returns alert and detection-rule coverage across ATT&CK techniques,
grouped by tactic.  Powers the coverage heatmap on the frontend.

No external ATT&CK library — technique→tactic mapping is inlined for the
~120 most common techniques seen in enterprise environments.
"""
from collections import defaultdict

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.permissions import analyst_required
from app.database.db import get_db
from app.models.alert import Alert
from app.models.agent import Agent
from app.models.detection_rule import DetectionRule
from app.models.user import User

router = APIRouter(prefix="/mitre", tags=["MITRE ATT&CK"])

# Technique ID → primary tactic
_T2TAC: dict[str, str] = {
    # Reconnaissance
    "T1595": "Reconnaissance", "T1595.001": "Reconnaissance", "T1595.002": "Reconnaissance",
    "T1592": "Reconnaissance", "T1589": "Reconnaissance", "T1590": "Reconnaissance",
    "T1591": "Reconnaissance", "T1596": "Reconnaissance", "T1597": "Reconnaissance",
    "T1598": "Reconnaissance",
    # Resource Development
    "T1583": "Resource Development", "T1584": "Resource Development",
    "T1585": "Resource Development", "T1586": "Resource Development",
    "T1587": "Resource Development", "T1588": "Resource Development",
    "T1608": "Resource Development",
    # Initial Access
    "T1189": "Initial Access", "T1190": "Initial Access", "T1133": "Initial Access",
    "T1200": "Initial Access", "T1566": "Initial Access", "T1566.001": "Initial Access",
    "T1566.002": "Initial Access", "T1091": "Initial Access", "T1195": "Initial Access",
    "T1078": "Initial Access", "T1078.001": "Initial Access", "T1078.003": "Initial Access",
    # Execution
    "T1059": "Execution", "T1059.001": "Execution", "T1059.002": "Execution",
    "T1059.003": "Execution", "T1059.004": "Execution", "T1059.005": "Execution",
    "T1059.006": "Execution", "T1059.007": "Execution",
    "T1047": "Execution", "T1053": "Execution", "T1053.002": "Execution",
    "T1053.005": "Execution", "T1569": "Execution", "T1569.001": "Execution",
    "T1569.002": "Execution", "T1204": "Execution", "T1204.001": "Execution",
    "T1204.002": "Execution", "T1106": "Execution", "T1129": "Execution",
    # Persistence
    "T1098": "Persistence", "T1098.001": "Persistence",
    "T1136": "Persistence", "T1136.001": "Persistence", "T1136.002": "Persistence",
    "T1547": "Persistence", "T1547.001": "Persistence", "T1547.004": "Persistence",
    "T1547.009": "Persistence",
    "T1543": "Persistence", "T1543.001": "Persistence", "T1543.003": "Persistence",
    "T1546": "Persistence", "T1546.015": "Persistence",
    "T1197": "Persistence", "T1176": "Persistence", "T1554": "Persistence",
    "T1505": "Persistence", "T1505.003": "Persistence",
    "T1525": "Persistence", "T1556": "Persistence",
    # Privilege Escalation
    "T1548": "Privilege Escalation", "T1548.001": "Privilege Escalation",
    "T1548.002": "Privilege Escalation",
    "T1134": "Privilege Escalation", "T1134.001": "Privilege Escalation",
    "T1134.002": "Privilege Escalation",
    "T1068": "Privilege Escalation", "T1055": "Privilege Escalation",
    "T1055.001": "Privilege Escalation", "T1055.002": "Privilege Escalation",
    "T1055.012": "Privilege Escalation",
    # Defense Evasion
    "T1027": "Defense Evasion", "T1027.001": "Defense Evasion",
    "T1027.002": "Defense Evasion",
    "T1036": "Defense Evasion", "T1036.003": "Defense Evasion",
    "T1036.004": "Defense Evasion", "T1036.005": "Defense Evasion",
    "T1112": "Defense Evasion",
    "T1140": "Defense Evasion",
    "T1218": "Defense Evasion", "T1218.001": "Defense Evasion",
    "T1218.010": "Defense Evasion", "T1218.011": "Defense Evasion",
    "T1562": "Defense Evasion", "T1562.001": "Defense Evasion",
    "T1562.004": "Defense Evasion",
    "T1070": "Defense Evasion", "T1070.001": "Defense Evasion",
    "T1070.004": "Defense Evasion",
    "T1202": "Defense Evasion", "T1220": "Defense Evasion",
    "T1497": "Defense Evasion",
    # Credential Access
    "T1003": "Credential Access", "T1003.001": "Credential Access",
    "T1003.002": "Credential Access", "T1003.003": "Credential Access",
    "T1040": "Credential Access",
    "T1110": "Credential Access", "T1110.001": "Credential Access",
    "T1110.003": "Credential Access",
    "T1187": "Credential Access", "T1212": "Credential Access",
    "T1552": "Credential Access", "T1552.001": "Credential Access",
    "T1557": "Credential Access", "T1558": "Credential Access",
    "T1558.003": "Credential Access",
    # Discovery
    "T1007": "Discovery", "T1010": "Discovery", "T1012": "Discovery",
    "T1016": "Discovery", "T1018": "Discovery", "T1033": "Discovery",
    "T1046": "Discovery", "T1049": "Discovery", "T1057": "Discovery",
    "T1069": "Discovery", "T1082": "Discovery", "T1083": "Discovery",
    "T1087": "Discovery", "T1120": "Discovery", "T1135": "Discovery",
    "T1518": "Discovery", "T1518.001": "Discovery",
    # Lateral Movement
    "T1021": "Lateral Movement", "T1021.001": "Lateral Movement",
    "T1021.002": "Lateral Movement", "T1021.006": "Lateral Movement",
    "T1534": "Lateral Movement", "T1550": "Lateral Movement",
    "T1550.002": "Lateral Movement", "T1563": "Lateral Movement",
    "T1570": "Lateral Movement", "T1210": "Lateral Movement",
    # Collection
    "T1005": "Collection", "T1025": "Collection", "T1039": "Collection",
    "T1056": "Collection", "T1074": "Collection", "T1113": "Collection",
    "T1119": "Collection", "T1123": "Collection", "T1125": "Collection",
    "T1560": "Collection",
    # Command and Control
    "T1071": "Command and Control", "T1071.001": "Command and Control",
    "T1071.004": "Command and Control",
    "T1092": "Command and Control", "T1095": "Command and Control",
    "T1102": "Command and Control", "T1104": "Command and Control",
    "T1105": "Command and Control", "T1132": "Command and Control",
    "T1572": "Command and Control", "T1573": "Command and Control",
    "T1573.001": "Command and Control", "T1573.002": "Command and Control",
    # Exfiltration
    "T1020": "Exfiltration", "T1041": "Exfiltration", "T1048": "Exfiltration",
    "T1052": "Exfiltration", "T1567": "Exfiltration",
    # Impact
    "T1485": "Impact", "T1486": "Impact", "T1489": "Impact",
    "T1490": "Impact", "T1491": "Impact", "T1498": "Impact",
    "T1499": "Impact", "T1529": "Impact", "T1565": "Impact",
}

_TACTIC_ORDER = [
    "Reconnaissance", "Resource Development", "Initial Access",
    "Execution", "Persistence", "Privilege Escalation",
    "Defense Evasion", "Credential Access", "Discovery",
    "Lateral Movement", "Collection", "Command and Control",
    "Exfiltration", "Impact",
]


def _technique_to_tactic(technique: str) -> str:
    return _T2TAC.get(technique) or _T2TAC.get(technique.split(".")[0]) or "Other"


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/coverage")
def mitre_coverage(
    current_user: User = Depends(analyst_required),
    db: Session = Depends(get_db),
):
    """ATT&CK coverage grouped by tactic — alert + rule counts per technique."""
    # Collect agent IDs for this tenant to scope alert queries
    agent_ids = [
        row[0] for row in
        db.query(Agent.id).filter(Agent.tenant_id == current_user.tenant_id).all()
    ]

    alerts_by_tech: dict[str, int] = {}
    if agent_ids:
        rows = (
            db.query(Alert.mitre_technique, func.count(Alert.id).label("c"))
            .filter(
                Alert.agent_id.in_(agent_ids),
                Alert.mitre_technique != None,
                Alert.mitre_technique != "",
            )
            .group_by(Alert.mitre_technique)
            .all()
        )
        alerts_by_tech = {r.mitre_technique: r.c for r in rows}

    rule_rows = (
        db.query(DetectionRule.mitre_technique, func.count(DetectionRule.id).label("c"))
        .filter(
            DetectionRule.mitre_technique != None,
            DetectionRule.mitre_technique != "",
            DetectionRule.enabled == True,
            (DetectionRule.tenant_id == current_user.tenant_id) | (DetectionRule.tenant_id == None),
        )
        .group_by(DetectionRule.mitre_technique)
        .all()
    )
    rules_by_tech: dict[str, int] = {r.mitre_technique: r.c for r in rule_rows}

    all_techniques = sorted(set(alerts_by_tech) | set(rules_by_tech))

    by_tactic: dict[str, list] = defaultdict(list)
    for tech in all_techniques:
        tactic = _technique_to_tactic(tech)
        by_tactic[tactic].append({
            "technique":    tech,
            "alert_count":  alerts_by_tech.get(tech, 0),
            "rule_count":   rules_by_tech.get(tech, 0),
        })

    tactics_list = []
    for tactic in _TACTIC_ORDER:
        if tactic in by_tactic:
            tactics_list.append({
                "tactic": tactic,
                "techniques": sorted(by_tactic[tactic], key=lambda x: -x["alert_count"]),
            })
    if "Other" in by_tactic:
        tactics_list.append({"tactic": "Other", "techniques": by_tactic["Other"]})

    return {
        "tactics":                  tactics_list,
        "total_techniques_covered": len(all_techniques),
        "total_alert_count":        sum(alerts_by_tech.values()),
        "total_rule_count":         sum(rules_by_tech.values()),
    }


@router.get("/heatmap")
def mitre_heatmap(
    current_user: User = Depends(analyst_required),
    db: Session = Depends(get_db),
):
    """Flat list of technique+alert counts suitable for a client-side heatmap."""
    agent_ids = [
        row[0] for row in
        db.query(Agent.id).filter(Agent.tenant_id == current_user.tenant_id).all()
    ]
    if not agent_ids:
        return []

    rows = (
        db.query(Alert.mitre_technique, func.count(Alert.id).label("c"))
        .filter(
            Alert.agent_id.in_(agent_ids),
            Alert.mitre_technique != None,
            Alert.mitre_technique != "",
        )
        .group_by(Alert.mitre_technique)
        .all()
    )
    return [
        {
            "technique": r.mitre_technique,
            "tactic":    _technique_to_tactic(r.mitre_technique),
            "count":     r.c,
        }
        for r in rows
    ]


@router.get("/top-techniques")
def top_techniques(
    limit: int = 10,
    current_user: User = Depends(analyst_required),
    db: Session = Depends(get_db),
):
    """Top N techniques by alert volume — useful for executive dashboards."""
    agent_ids = [
        row[0] for row in
        db.query(Agent.id).filter(Agent.tenant_id == current_user.tenant_id).all()
    ]
    if not agent_ids:
        return []

    rows = (
        db.query(Alert.mitre_technique, func.count(Alert.id).label("c"))
        .filter(
            Alert.agent_id.in_(agent_ids),
            Alert.mitre_technique != None,
            Alert.mitre_technique != "",
        )
        .group_by(Alert.mitre_technique)
        .order_by(func.count(Alert.id).desc())
        .limit(min(limit, 50))
        .all()
    )
    return [
        {"technique": r.mitre_technique, "tactic": _technique_to_tactic(r.mitre_technique), "count": r.c}
        for r in rows
    ]
