"""
AI Security Copilot service — Groq (OpenAI-compatible) backend.

Public functions
────────────────
explain_alert(alert_data, context)         → plain-English alert explanation
analyze_root_cause(alert_data, context)    → root cause + process chain
generate_alert_remediation(alert, context) → prioritised remediation steps
build_attack_chain(alert_data, events)     → annotated chronological chain
chat_with_copilot(message, ctx, history)   → multi-turn conversational Q&A
generate_incident_summary(incident, alerts)
generate_playbook_recommendation(techniques, context)
parse_nl_query(query)
"""

import json
import os
from typing import Optional

import requests as http_client

_API_URL = "https://api.groq.com/openai/v1/chat/completions"
_MODEL   = "llama-3.3-70b-versatile"

# Human-readable names for the most common MITRE techniques
_TECHNIQUE_NAMES: dict[str, str] = {
    "T1059":     "Command and Scripting Interpreter",
    "T1059.001": "PowerShell execution",
    "T1059.003": "Windows Command Shell (cmd.exe)",
    "T1059.005": "Visual Basic Script",
    "T1059.007": "JavaScript",
    "T1055":     "Process Injection",
    "T1055.001": "DLL Injection",
    "T1055.012": "Process Hollowing",
    "T1003":     "OS Credential Dumping",
    "T1003.001": "LSASS Memory Dump",
    "T1566":     "Phishing",
    "T1566.001": "Spearphishing Attachment",
    "T1078":     "Valid Accounts",
    "T1190":     "Exploit Public-Facing Application",
    "T1105":     "Ingress Tool Transfer",
    "T1071":     "Application Layer Protocol (C2)",
    "T1071.001": "Web C2 Traffic",
    "T1046":     "Network Service Scanning",
    "T1057":     "Process Discovery",
    "T1082":     "System Information Discovery",
    "T1021":     "Remote Services",
    "T1021.001": "Remote Desktop Protocol (RDP)",
    "T1047":     "Windows Management Instrumentation (WMI)",
    "T1053":     "Scheduled Task/Job",
    "T1053.005": "Windows Scheduled Task",
    "T1547":     "Boot/Logon Autostart Execution",
    "T1547.001": "Registry Run Keys / Startup Folder",
    "T1543":     "Create or Modify System Process",
    "T1543.003": "Windows Service",
    "T1112":     "Modify Registry",
    "T1218":     "Signed Binary Proxy Execution",
    "T1218.010": "Regsvr32",
    "T1218.011": "Rundll32",
    "T1027":     "Obfuscated Files or Information",
    "T1562":     "Impair Defenses",
    "T1562.001": "Disable or Modify Tools",
    "T1140":     "Deobfuscate/Decode Files or Information",
    "T1485":     "Data Destruction",
    "T1486":     "Data Encrypted for Impact (Ransomware)",
    "T1490":     "Inhibit System Recovery",
    "T1573":     "Encrypted Channel",
    "T1041":     "Exfiltration Over C2 Channel",
    "T1048":     "Exfiltration Over Alternative Protocol",
    "T1560":     "Archive Collected Data",
    "T1098":     "Account Manipulation",
    "T1136":     "Create Account",
    "T1068":     "Exploitation for Privilege Escalation",
    "T1134":     "Access Token Manipulation",
    "T1548":     "Abuse Elevation Control Mechanism",
    "T1204":     "User Execution",
    "T1204.002": "Malicious File Execution",
}


# ── Core Groq calls ───────────────────────────────────────────────────────────

def _groq_key() -> str:
    key = os.environ.get("GROQ_API_KEY", "")
    if not key:
        raise ValueError(
            "GROQ_API_KEY is not set. "
            "Add it to your environment to enable AI features."
        )
    return key


def _call_groq(system: str, user: str, max_tokens: int = 1024) -> str:
    return _call_groq_messages(
        [{"role": "system", "content": system}, {"role": "user", "content": user}],
        max_tokens,
    )


def _call_groq_messages(messages: list[dict], max_tokens: int = 1200) -> str:
    r = http_client.post(
        _API_URL,
        headers={"Authorization": f"Bearer {_groq_key()}", "Content-Type": "application/json"},
        json={"model": _MODEL, "max_tokens": max_tokens, "messages": messages},
        timeout=45,
    )
    r.raise_for_status()
    return r.json()["choices"][0]["message"]["content"]


def _parse_json(text: str, fallback: dict) -> dict:
    """Attempt to parse JSON from a model response; return fallback on failure."""
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Try to extract first {...} block in case the model added prose
        start = text.find("{")
        end   = text.rfind("}") + 1
        if start != -1 and end > start:
            try:
                return json.loads(text[start:end])
            except Exception:
                pass
    return fallback


# ── Feature 1: Incident summary ───────────────────────────────────────────────

_SUMMARY_SYSTEM = """You are a cybersecurity analyst AI assistant embedded in NetcradXDR, a commercial XDR platform.
You generate concise, analyst-grade incident summaries for security operations teams.
Be direct and specific. Avoid filler phrases.

Output ONLY valid JSON matching exactly this schema (no markdown fences, no extra keys):
{
  "summary": "2-3 sentence plain-English description of what happened and what was affected",
  "attack_chain": "Single sentence describing the attack progression from initial access to final stage",
  "risk_assessment": "Why this is the rated severity — include specific threat indicators",
  "recommended_actions": ["concrete action 1", "concrete action 2", "concrete action 3", "concrete action 4"],
  "containment_priority": "immediate" or "urgent" or "standard"
}"""


def generate_incident_summary(incident: dict, alerts: list) -> dict:
    alerts_text = "\n".join(
        f"  - [{a.get('severity','?')}] {a.get('title','?')} "
        f"on {a.get('agent_hostname','unknown')} "
        f"({a.get('mitre_technique','N/A')}) "
        f"at {str(a.get('timestamp',''))[:19]}"
        for a in alerts[:20]
    ) or "  No alerts linked."

    user = f"""Incident to analyse:

Title: {incident.get('title')}
Severity: {incident.get('severity')}
Status: {incident.get('status')}
MITRE Tactics: {incident.get('mitre_tactics') or 'Unknown'}
Alert Count: {incident.get('alert_count', 0)}
Affected Endpoints: {incident.get('affected_endpoints', 0)}
Created: {str(incident.get('created_at',''))[:19]}
Description: {incident.get('description') or 'None provided'}

Correlated Alerts:
{alerts_text}

Generate the incident summary JSON."""

    text = _call_groq(_SUMMARY_SYSTEM, user, max_tokens=800)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return {
            "summary": text[:500],
            "attack_chain": "Analysis unavailable — see raw response above.",
            "risk_assessment": f"Severity rated as {incident.get('severity')}.",
            "recommended_actions": [
                "Review all correlated alerts",
                "Isolate affected endpoints if Critical",
                "Block any identified malicious IPs",
                "Escalate to senior analyst",
            ],
            "containment_priority": "urgent",
        }


# ── Feature 2: Natural-language query parser ──────────────────────────────────

_NL_QUERY_SYSTEM = """You are a query parser for NetcradXDR, a security XDR platform.
Convert the user's natural-language query into structured JSON filters.

Available resources: "alerts", "incidents"
Available alert severities: Critical, High, Medium, Low, Informational
Available alert statuses: Open, Resolved
Available incident statuses: Open, Investigating, Resolved
Available OS types: Windows, Linux, macOS

Output ONLY valid JSON (no markdown fences) matching exactly:
{
  "resource": "alerts" or "incidents",
  "explanation": "one sentence describing what you understood",
  "filters": {
    "severity": null or severity string,
    "status": null or status string,
    "agent_os": null or OS string,
    "hours_back": null or integer,
    "search": null or keyword string,
    "mitre_technique": null or "T1234" string
  }
}"""


def parse_nl_query(query: str) -> dict:
    text = _call_groq(_NL_QUERY_SYSTEM, f"Parse this query: {query}", max_tokens=300)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return {
            "resource": "alerts",
            "explanation": "Could not parse query — showing all recent alerts.",
            "filters": {},
        }


# ── Feature 3: Playbook recommendation ───────────────────────────────────────

_PLAYBOOK_SYSTEM = """You are a senior incident responder and SOC lead embedded in NetcradXDR.
Generate a structured, actionable response playbook for the given MITRE ATT&CK techniques.

Reference available SOAR commands: kill_process, isolate_host, block_ip, quarantine_file, restore_host

Output ONLY valid JSON (no markdown fences) matching exactly:
{
  "summary": "1-2 sentence threat overview and response approach",
  "severity_assessment": "Critical" or "High" or "Medium" or "Low",
  "steps": [
    {
      "phase": "Identification" or "Containment" or "Eradication" or "Recovery" or "Lessons Learned",
      "action": "Specific actionable step the analyst should take",
      "rationale": "Why this step is critical",
      "soar_command": null or one of the available SOAR command names
    }
  ],
  "ioc_to_collect": ["type of indicator to hunt for"],
  "escalation_trigger": "Specific condition that should trigger escalation to management/CIRT"
}
Include 5-8 steps covering the full incident response lifecycle."""


def generate_playbook_recommendation(mitre_techniques: list, context: str = "") -> dict:
    techs = ", ".join(mitre_techniques) if mitre_techniques else "Unknown technique"
    user = f"""MITRE ATT&CK Techniques detected: {techs}
Additional context: {context or 'No additional context provided.'}

Generate a response playbook."""

    text = _call_groq(_PLAYBOOK_SYSTEM, user, max_tokens=1400)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return {
            "summary": f"Response playbook for {techs}.",
            "severity_assessment": "High",
            "steps": [
                {
                    "phase": "Identification",
                    "action": "Review all correlated alerts and affected endpoints in NetcradXDR",
                    "rationale": "Understand full scope before acting",
                    "soar_command": None,
                },
                {
                    "phase": "Containment",
                    "action": "Isolate affected endpoints via SOAR to prevent lateral movement",
                    "rationale": "Stop adversary from spreading to additional hosts",
                    "soar_command": "isolate_host",
                },
                {
                    "phase": "Containment",
                    "action": "Block known malicious IP addresses at the network perimeter",
                    "rationale": "Cut command-and-control communication",
                    "soar_command": "block_ip",
                },
                {
                    "phase": "Eradication",
                    "action": "Kill malicious processes identified in process telemetry",
                    "rationale": "Remove active threat from memory",
                    "soar_command": "kill_process",
                },
                {
                    "phase": "Eradication",
                    "action": "Quarantine suspicious files identified in file telemetry",
                    "rationale": "Prevent re-execution of malware",
                    "soar_command": "quarantine_file",
                },
                {
                    "phase": "Recovery",
                    "action": "Restore network access after cleanup is confirmed",
                    "rationale": "Resume normal operations safely",
                    "soar_command": "restore_host",
                },
                {
                    "phase": "Lessons Learned",
                    "action": "Document IOCs in Threat Intelligence and update detection rules",
                    "rationale": "Prevent recurrence and improve detection coverage",
                    "soar_command": None,
                },
            ],
            "ioc_to_collect": ["Process hashes", "Malicious IP addresses", "Suspicious file paths", "Registry persistence keys"],
            "escalation_trigger": "Critical severity confirmed or evidence of data exfiltration detected",
        }


# ═══════════════════════════════════════════════════════════════════════════════
# AI SECURITY COPILOT — new features
# ═══════════════════════════════════════════════════════════════════════════════

_COPILOT_PERSONA = (
    "You are NetcradXDR's AI Security Copilot — an expert cybersecurity analyst "
    "embedded in a commercial XDR platform. You communicate clearly and concisely "
    "to SOC analysts. You always cite specific evidence from the telemetry provided. "
    "You never invent facts not present in the data."
)


# ── Context builder ───────────────────────────────────────────────────────────

def _fmt_context(alert: dict, ctx: dict) -> str:
    """Format alert + telemetry context into a compact LLM-ready string."""
    tech = alert.get("mitre_technique", "")
    tech_name = _TECHNIQUE_NAMES.get(tech, _TECHNIQUE_NAMES.get(tech.split(".")[0], "Unknown")) if tech else "Unknown"

    lines = [
        f"=== ALERT ===",
        f"Title: {alert.get('title', 'N/A')}",
        f"Severity: {alert.get('severity', 'N/A')}",
        f"Description: {alert.get('description', 'N/A')}",
        f"MITRE Technique: {tech} — {tech_name}",
        f"Timestamp: {str(alert.get('timestamp', ''))[:19]}",
        f"Agent: {ctx.get('hostname', 'unknown')} ({ctx.get('os_type', '?')}) IP={ctx.get('ip', '?')}",
        "",
    ]

    procs = ctx.get("processes", [])
    if procs:
        lines.append("=== RECENT PROCESSES (30-min window) ===")
        for p in procs[:12]:
            lines.append(
                f"  [{p.get('timestamp','')[:19]}] {p.get('process_name','?')} "
                f"(pid={p.get('pid','?')}) parent={p.get('parent_process_name','?')} "
                f"user={p.get('username','?')} cmdline={str(p.get('cmdline',''))[:120]}"
            )
        lines.append("")

    nets = ctx.get("network", [])
    if nets:
        lines.append("=== RECENT NETWORK CONNECTIONS ===")
        for n in nets[:8]:
            lines.append(
                f"  [{n.get('timestamp','')[:19]}] {n.get('local_ip','?')} → "
                f"{n.get('remote_ip','?')}:{n.get('remote_port','?')} {n.get('protocol','?')}"
            )
        lines.append("")

    files = ctx.get("files", [])
    if files:
        lines.append("=== RECENT FILE EVENTS ===")
        for f in files[:8]:
            lines.append(
                f"  [{f.get('timestamp','')[:19]}] {f.get('event_type','?')} "
                f"{f.get('file_path','?')}"
                + (f" sha256={f['sha256'][:16]}…" if f.get('sha256') else "")
            )
        lines.append("")

    dns = ctx.get("dns", [])
    if dns:
        lines.append("=== RECENT DNS QUERIES ===")
        for d in dns[:8]:
            lines.append(
                f"  [{d.get('timestamp','')[:19]}] {d.get('query_name','?')} "
                f"({d.get('query_type','?')}) → {d.get('response','?')}"
            )
        lines.append("")

    persist = ctx.get("persistence", [])
    if persist:
        lines.append("=== PERSISTENCE EVENTS ===")
        for pe in persist[:5]:
            lines.append(
                f"  [{pe.get('timestamp','')[:19]}] {pe.get('persistence_type','?')} "
                f"{pe.get('entry_name','?')} → {pe.get('entry_path','?')}"
            )
        lines.append("")

    other_alerts = ctx.get("recent_alerts", [])
    if other_alerts:
        lines.append("=== OTHER RECENT ALERTS ON THIS ENDPOINT ===")
        for a in other_alerts[:5]:
            lines.append(
                f"  [{str(a.get('timestamp',''))[:19]}] [{a.get('severity','?')}] "
                f"{a.get('title','?')} ({a.get('mitre_technique','')})"
            )

    return "\n".join(lines)


# ── Feature: Alert explanation ────────────────────────────────────────────────

_EXPLAIN_SYSTEM = _COPILOT_PERSONA + """

Output ONLY valid JSON (no markdown) matching exactly:
{
  "headline": "One crisp sentence: WHAT happened and HOW",
  "explanation": "2-3 sentences in plain English suitable for a non-technical stakeholder",
  "why_dangerous": "Specific threat this poses — data theft, ransomware, lateral movement, etc.",
  "attacker_intent": "What the attacker was most likely trying to achieve at this stage",
  "mitre_technique": "Technique ID from the alert",
  "mitre_description": "1-sentence explanation of what this technique is",
  "blast_radius": "What could be compromised if this goes uncontained",
  "confidence": "High or Medium or Low — based on available evidence"
}"""


def explain_alert(alert: dict, ctx: dict) -> dict:
    context_str = _fmt_context(alert, ctx)
    text = _call_groq(
        _EXPLAIN_SYSTEM,
        f"Explain this security alert:\n\n{context_str}",
        max_tokens=700,
    )
    return _parse_json(text, {
        "headline": alert.get("title", "Alert explanation unavailable"),
        "explanation": alert.get("description", ""),
        "why_dangerous": f"Severity rated {alert.get('severity')}.",
        "attacker_intent": "Could not be determined — insufficient telemetry.",
        "mitre_technique": alert.get("mitre_technique", ""),
        "mitre_description": _TECHNIQUE_NAMES.get(alert.get("mitre_technique", ""), ""),
        "blast_radius": "Review alert manually for scope.",
        "confidence": "Low",
    })


# ── Feature: Root cause analysis ──────────────────────────────────────────────

_ROOT_CAUSE_SYSTEM = _COPILOT_PERSONA + """

Output ONLY valid JSON (no markdown) matching exactly:
{
  "root_cause": "1-2 sentences identifying the fundamental cause of this alert",
  "attack_vector": "How the attacker got in or how the activity started",
  "initial_access_method": "Phishing | Drive-by | Credential Abuse | Supply Chain | Unknown | etc.",
  "process_chain": "parent → child → grandchild process chain inferred from telemetry",
  "affected_user": "Username identified as the affected or abused account",
  "lateral_movement_detected": true or false,
  "persistence_detected": true or false,
  "exfiltration_risk": "High or Medium or Low",
  "timeline_summary": "2-3 sentences narrating the sequence of events in chronological order",
  "confidence": "High or Medium or Low"
}"""


def analyze_root_cause(alert: dict, ctx: dict) -> dict:
    context_str = _fmt_context(alert, ctx)
    text = _call_groq(
        _ROOT_CAUSE_SYSTEM,
        f"Perform root cause analysis on this alert:\n\n{context_str}",
        max_tokens=900,
    )
    return _parse_json(text, {
        "root_cause": "Could not determine root cause from available telemetry.",
        "attack_vector": "Unknown",
        "initial_access_method": "Unknown",
        "process_chain": "Insufficient process telemetry available.",
        "affected_user": ctx.get("affected_user", "Unknown"),
        "lateral_movement_detected": False,
        "persistence_detected": False,
        "exfiltration_risk": "Medium",
        "timeline_summary": "Root cause analysis requires additional telemetry context.",
        "confidence": "Low",
    })


# ── Feature: Remediation steps ────────────────────────────────────────────────

_REMEDIATION_SYSTEM = _COPILOT_PERSONA + """

Output ONLY valid JSON (no markdown) matching exactly:
{
  "urgency": "Immediate or Urgent or Standard",
  "immediate_actions": [
    "Specific action with concrete detail — include PID, IP, path, username where visible in telemetry"
  ],
  "investigation_steps": [
    "What the analyst should verify or investigate next"
  ],
  "prevention": [
    "Longer-term control to prevent recurrence"
  ],
  "estimated_containment_time": "e.g. 15-30 minutes",
  "escalation_criteria": "Specific condition that warrants escalation to management or CIRT"
}
Include 3-5 items per list. Reference specific evidence from the telemetry."""


def generate_alert_remediation(alert: dict, ctx: dict) -> dict:
    context_str = _fmt_context(alert, ctx)
    text = _call_groq(
        _REMEDIATION_SYSTEM,
        f"Generate remediation steps for this alert:\n\n{context_str}",
        max_tokens=900,
    )
    return _parse_json(text, {
        "urgency": "Urgent",
        "immediate_actions": [
            "Isolate the affected endpoint to prevent lateral movement",
            "Kill any suspicious processes identified in telemetry",
            "Block identified malicious IPs at the network perimeter",
        ],
        "investigation_steps": [
            "Review process telemetry for the alert time window",
            "Check for additional alerts on the same endpoint",
            "Verify user account for signs of compromise",
        ],
        "prevention": [
            "Review and tighten endpoint detection rules",
            "Enable application allowlisting if not already in place",
        ],
        "estimated_containment_time": "30-60 minutes",
        "escalation_criteria": "Evidence of data exfiltration or lateral movement detected",
    })


# ── Feature: Attack chain builder ────────────────────────────────────────────

_ATTACK_CHAIN_SYSTEM = _COPILOT_PERSONA + """

You will receive a list of raw security events from an endpoint around the time of an alert.
Annotate each event with its role in the attack, filter out clearly benign background noise,
and assemble the story of what the attacker did.

Output ONLY valid JSON (no markdown) matching exactly:
{
  "summary": "2-3 sentence narrative of the complete attack chain",
  "attacker_stage": "Current stage: Reconnaissance | Initial Access | Execution | Persistence | Privilege Escalation | Defense Evasion | Credential Access | Discovery | Lateral Movement | Collection | Exfiltration | Impact",
  "dwell_time_estimate": "How long the attacker appears to have been active e.g. '< 5 minutes'",
  "chain": [
    {
      "sequence": 1,
      "timestamp": "ISO timestamp from event",
      "event_type": "process | network | file | dns | persistence | alert",
      "description": "Analyst-readable description of this event",
      "role": "What role this plays in the attack",
      "mitre_technique": "T1059.001 or null",
      "is_malicious": true or false
    }
  ]
}
Include only events relevant to the attack (skip obvious noise).
Order by sequence number ascending (chronological).
Limit to 15 chain events maximum."""


def build_attack_chain(alert: dict, events: list[dict]) -> dict:
    events_text = "\n".join(
        f"  [{e.get('timestamp','')[:19]}] [{e.get('type','?')}] {e.get('summary','?')}"
        for e in events[:40]
    ) or "  No telemetry events available."

    tech = alert.get("mitre_technique", "")
    user_msg = (
        f"Alert: [{alert.get('severity')}] {alert.get('title')} ({tech})\n"
        f"Agent: {alert.get('hostname', 'unknown')}\n\n"
        f"Events around the alert:\n{events_text}\n\n"
        f"Build the attack chain."
    )
    text = _call_groq(_ATTACK_CHAIN_SYSTEM, user_msg, max_tokens=1400)
    return _parse_json(text, {
        "summary": f"Alert '{alert.get('title')}' detected. Insufficient telemetry to reconstruct full chain.",
        "attacker_stage": "Execution",
        "dwell_time_estimate": "Unknown",
        "chain": [
            {
                "sequence": 1,
                "timestamp": str(alert.get("timestamp", ""))[:19],
                "event_type": "alert",
                "description": alert.get("title", "Alert triggered"),
                "role": "Triggering event",
                "mitre_technique": tech or None,
                "is_malicious": True,
            }
        ],
    })


# ── Feature: Conversational Q&A (multi-turn) ─────────────────────────────────

_CHAT_SYSTEM = _COPILOT_PERSONA + """

The analyst may ask follow-up questions about a specific alert, incident, or general
security topics. Answer concisely and specifically. When you reference evidence from
the provided context, cite it explicitly. Do not speculate beyond the data provided.

Output ONLY valid JSON (no markdown) matching exactly:
{
  "answer": "Your response to the analyst's question",
  "confidence": "High or Medium or Low",
  "follow_up_questions": ["Suggested next question 1", "Suggested next question 2"],
  "suggested_actions": ["Specific action if any — or empty list if N/A"]
}"""


def chat_with_copilot(
    message: str,
    system_context: Optional[str] = None,
    history: Optional[list[dict]] = None,
) -> dict:
    """Multi-turn chat. history is [{role, content}, ...] in OpenAI format."""
    messages: list[dict] = [{"role": "system", "content": _CHAT_SYSTEM}]

    if system_context:
        messages.append({
            "role": "system",
            "content": f"Current security context:\n\n{system_context}",
        })

    for h in (history or [])[-8:]:   # cap history to last 8 turns
        role = h.get("role", "user")
        if role in ("user", "assistant"):
            messages.append({"role": role, "content": str(h.get("content", ""))[:1000]})

    messages.append({"role": "user", "content": message})

    text = _call_groq_messages(messages, max_tokens=800)
    return _parse_json(text, {
        "answer": text[:1000],
        "confidence": "Medium",
        "follow_up_questions": [],
        "suggested_actions": [],
    })
