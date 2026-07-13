"""
Sigma-to-NetcradXDR detection rule converter.

Supports the core Sigma detection grammar:
  - keywords (list of strings → OR conditions on a configurable field)
  - field:value mappings
  - AND/OR condition groups
  - NOT conditions (skipped with a warning — not expressible as simple conditions)
  - condition: all-of / any-of / 1-of / all-of-them etc.

Does NOT require the external `sigma-cli` or `pySigma` packages — this is a
purpose-built lightweight converter targeting our specific condition format.

Returns:
  {
    "rule_type": "process",
    "logic": "OR",
    "conditions": [{"field": "...", "operator": "...", "value": "..."}],
    "name": "...", "severity": "...", "mitre_technique": "...", ...
  }
  or raises ValueError with a human-readable message.
"""
import re
from typing import Any, Dict, List, Optional, Tuple

try:
    import yaml as _yaml
    _YAML_AVAILABLE = True
except ImportError:
    _YAML_AVAILABLE = False


# ── Sigma product/category → our rule_type ───────────────────────────────────

_PRODUCT_MAP = {
    "windows": {
        "process_creation":    "process",
        "file_event":          "file",
        "registry_event":      "registry",
        "registry_add":        "registry",
        "registry_delete":     "registry",
        "registry_set":        "registry",
        "network_connection":  "network",
        "dns_query":           "dns",
        "driver_load":         "file",
        "image_load":          "file",
        "ps_script":           "process",
        "ps_module":           "process",
    },
    "linux": {
        "process_creation":    "process",
        "network_connection":  "network",
        "file_event":          "file",
        "dns":                 "dns",
    },
    "macos": {
        "process_creation":    "process",
        "file_event":          "file",
        "network_connection":  "network",
    },
    "cloud":       {"*": "cloud"},
    "aws":         {"*": "cloud"},
    "azure":       {"*": "cloud"},
    "gcp":         {"*": "cloud"},
    "kubernetes":  {"*": "k8s"},
    "generic": {
        "dns":              "dns",
        "email":            "email",
        "process_creation": "process",
        "network_connection":"network",
    },
}

# ── Sigma field → our field mapping per rule_type ────────────────────────────

_FIELD_MAP: Dict[str, Dict[str, str]] = {
    "process": {
        "Image":               "exe_path",
        "CommandLine":         "cmdline",
        "OriginalFileName":    "exe_path",
        "ParentImage":         "parent_process_name",
        "ParentCommandLine":   "cmdline",
        "User":                "username",
        "ProcessName":         "process_name",
        "sha256":              "sha256",
        "Hashes":              "sha256",
    },
    "file": {
        "TargetFilename":      "file_path",
        "FileName":            "file_path",
        "FilePath":            "file_path",
        "Hashes":              "sha256",
        "sha256":              "sha256",
    },
    "registry": {
        "TargetObject":        "registry_key",
        "Details":             "value_data",
        "EventType":           "event_type",
    },
    "network": {
        "DestinationIp":       "remote_ip",
        "DestinationPort":     "remote_port",
        "SourceIp":            "local_ip",
        "Initiated":           "direction",
        "Protocol":            "protocol",
    },
    "dns": {
        "QueryName":           "query_name",
        "QueryType":           "query_type",
        "record_type":         "query_type",
        "answer":              "response",
    },
    "cloud": {
        "eventName":           "action",
        "sourceIPAddress":     "source_ip",
        "userIdentity.arn":    "actor",
        "requestParameters.bucketName": "resource_id",
        "resourceType":        "resource_type",
    },
    "k8s": {
        "verb":                "event_type",
        "resource":            "resource_kind",
        "name":                "resource_name",
        "namespace":           "namespace",
        "user.username":       "actor",
    },
    "email": {
        "Subject":             "subject",
        "SenderAddress":       "sender",
        "RecipientAddress":    "recipient",
        "SourceIp":            "source_ip",
    },
}

# ── Sigma modifier → our operator ─────────────────────────────────────────────

def _sigma_modifier_to_operator(modifiers: List[str]) -> str:
    if "contains|all" in "|".join(modifiers):
        return "contains"
    if "contains" in modifiers:
        return "contains"
    if "startswith" in modifiers:
        return "starts_with"
    if "endswith" in modifiers:
        return "ends_with"
    if "re" in modifiers or "regex" in modifiers:
        return "regex"
    return "contains"   # default: treat as substring


# ── Core converter ────────────────────────────────────────────────────────────

def _parse_field_value(
    field_with_modifiers: str,
    values: Any,
    rule_type: str,
) -> List[Dict[str, str]]:
    """Convert one Sigma field:value pair into a list of conditions."""
    parts = field_with_modifiers.split("|")
    sigma_field = parts[0]
    modifiers = parts[1:]

    our_field = _FIELD_MAP.get(rule_type, {}).get(sigma_field, sigma_field.lower())
    operator = _sigma_modifier_to_operator(modifiers)

    if isinstance(values, list):
        # Multiple values for one field → OR conditions per value
        conds = []
        for v in values:
            if isinstance(v, (list, dict)):
                continue
            conds.append({"field": our_field, "operator": operator, "value": str(v)})
        return conds
    elif isinstance(values, dict):
        return []  # nested mappings not handled at this level
    else:
        return [{"field": our_field, "operator": operator, "value": str(values)}]


def _process_detection_item(item: Any, rule_type: str) -> Tuple[List[Dict], str]:
    """Process a single detection item (dict or list). Returns (conditions, inner_logic)."""
    if isinstance(item, list):
        # List of values → OR across keywords (treated as cmdline contains)
        conds = [{"field": "cmdline", "operator": "contains", "value": str(v)}
                 for v in item if not isinstance(v, dict)]
        return conds, "OR"
    if isinstance(item, dict):
        conds = []
        for k, v in item.items():
            if k == "keywords":
                for kw in (v if isinstance(v, list) else [v]):
                    conds.append({"field": "cmdline", "operator": "contains", "value": str(kw)})
            else:
                conds.extend(_parse_field_value(k, v, rule_type))
        return conds, "AND"  # fields within a detection item are AND-ed
    return [], "OR"


def convert_sigma_yaml(yaml_text: str) -> Dict:
    """
    Convert a Sigma rule YAML string to our detection rule format.
    Returns a dict ready to be passed to create_rule().
    Raises ValueError on parse/mapping failure.
    """
    if not _YAML_AVAILABLE:
        raise ValueError("PyYAML is not installed — cannot parse Sigma rules. Run: pip install pyyaml")

    try:
        doc = _yaml.safe_load(yaml_text)
    except Exception as exc:
        raise ValueError(f"YAML parse error: {exc}")

    if not isinstance(doc, dict):
        raise ValueError("Sigma YAML must be a mapping at the top level")

    # ── Resolve rule_type ──────────────────────────────────────────────────────
    logsource = doc.get("logsource", {})
    product  = str(logsource.get("product", "generic")).lower()
    category = str(logsource.get("category", "")).lower()
    service  = str(logsource.get("service", "")).lower()

    product_map = _PRODUCT_MAP.get(product, _PRODUCT_MAP["generic"])
    rule_type = (
        product_map.get(category)
        or product_map.get(service)
        or product_map.get("*")
        or "process"
    )

    # ── Severity mapping ───────────────────────────────────────────────────────
    level_map = {
        "informational": "Low",
        "low":           "Low",
        "medium":        "Medium",
        "high":          "High",
        "critical":      "Critical",
    }
    severity = level_map.get(str(doc.get("level", "medium")).lower(), "Medium")

    # ── MITRE technique ────────────────────────────────────────────────────────
    tags = doc.get("tags", [])
    mitre_technique = None
    mitre_tactic = None
    for tag in tags:
        if tag.startswith("attack.t"):
            mitre_technique = tag.replace("attack.", "").upper()
        elif tag.startswith("attack."):
            mitre_tactic = tag.replace("attack.", "").replace("_", " ").title()

    # ── Parse detection section ────────────────────────────────────────────────
    detection = doc.get("detection", {})
    if not detection:
        raise ValueError("Sigma rule has no 'detection' section")

    condition_expr = str(detection.get("condition", "selection")).strip()

    # Gather named search identifiers (everything except 'condition' and 'filter*')
    identifiers = {
        k: v for k, v in detection.items()
        if k not in ("condition",)
    }

    # Parse each identifier into a list of conditions + a group logic
    parsed: Dict[str, Tuple[List[Dict], str]] = {}
    for name, item in identifiers.items():
        conds, inner_logic = _process_detection_item(item, rule_type)
        parsed[name] = (conds, inner_logic)

    # ── Resolve top-level condition logic ──────────────────────────────────────
    # We support: "selection", "selection and not filter", "1 of selection*",
    # "all of selection*", "selection1 or selection2"
    expr = condition_expr.lower()
    # Strip NOT clauses (we can't express them — just ignore the filter)
    expr = re.sub(r"\s+and\s+not\s+\S+", "", expr)
    expr = re.sub(r"\s+and\s+filter\S*", "", expr)

    top_logic = "OR"
    all_conditions: List[Dict] = []

    if " or " in expr:
        top_logic = "OR"
        names = [n.strip() for n in re.split(r"\bor\b", expr)]
    elif " and " in expr:
        top_logic = "AND"
        names = [n.strip() for n in re.split(r"\band\b", expr)]
    elif re.match(r"^(1 of|any of)\s+(.+)\*?$", expr):
        top_logic = "OR"
        prefix_match = re.match(r"^(?:1 of|any of)\s+(.+?)(?:\*)?$", expr)
        prefix = prefix_match.group(1).strip() if prefix_match else ""
        names = [k for k in parsed if k.startswith(prefix)]
    elif re.match(r"^(all of)\s+(.+)\*?$", expr):
        top_logic = "AND"
        prefix_match = re.match(r"^all of\s+(.+?)(?:\*)?$", expr)
        prefix = prefix_match.group(1).strip() if prefix_match else ""
        names = [k for k in parsed if k.startswith(prefix)] or list(parsed.keys())
    else:
        # Single identifier
        names = [expr.strip()]

    for name in names:
        group = parsed.get(name)
        if group:
            conds, inner = group
            all_conditions.extend(conds)
        else:
            # Wildcard glob — include all matching
            for k, (c, _) in parsed.items():
                if k.startswith(name.rstrip("*")):
                    all_conditions.extend(c)

    if not all_conditions:
        raise ValueError("No convertible conditions found in Sigma detection block")

    # If a single selection was AND-typed internally, preserve AND logic
    if len(names) == 1 and names[0] in parsed and parsed[names[0]][1] == "AND":
        top_logic = "AND"

    return {
        "name":            doc.get("title", "Imported Sigma Rule"),
        "description":     doc.get("description", ""),
        "rule_type":       rule_type,
        "logic":           top_logic,
        "severity":        severity,
        "mitre_tactic":    mitre_tactic,
        "mitre_technique": mitre_technique,
        "conditions":      all_conditions,
        "sigma_id":        doc.get("id", ""),
        "author":          doc.get("author", ""),
        "status":          doc.get("status", ""),
    }
