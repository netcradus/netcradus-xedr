"""
Thin wrapper around the Groq API (OpenAI-compatible).
Uses requests — no extra dependency needed.
Set GROQ_API_KEY in the environment before starting the server.
"""

import json
import os

import requests as http_client

_API_URL = "https://api.groq.com/openai/v1/chat/completions"
_MODEL = "llama-3.3-70b-versatile"


# ── Core call ─────────────────────────────────────────────────────────────────

def _call_groq(system: str, user: str, max_tokens: int = 1024) -> str:
    api_key = os.environ.get("GROQ_API_KEY", "")
    if not api_key:
        raise ValueError(
            "GROQ_API_KEY is not set. "
            "Add it to your server environment to enable AI features."
        )

    r = http_client.post(
        _API_URL,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": _MODEL,
            "max_tokens": max_tokens,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        },
        timeout=30,
    )
    r.raise_for_status()
    return r.json()["choices"][0]["message"]["content"]


# ── Feature 1: Incident summary ───────────────────────────────────────────────

_SUMMARY_SYSTEM = """You are a cybersecurity analyst AI assistant embedded in SentryXDR, a commercial XDR platform.
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

_NL_QUERY_SYSTEM = """You are a query parser for SentryXDR, a security XDR platform.
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

_PLAYBOOK_SYSTEM = """You are a senior incident responder and SOC lead embedded in SentryXDR.
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
                    "action": "Review all correlated alerts and affected endpoints in SentryXDR",
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
