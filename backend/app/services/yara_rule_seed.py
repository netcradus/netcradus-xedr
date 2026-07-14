"""
Seeds built-in (system) YARA rules covering the most common malware families.
Rules with is_system=True and tenant_id=None are platform-wide and match every tenant.
"""
from datetime import datetime
from sqlalchemy.orm import Session
from app.models.yara_rule import YaraRule

SYSTEM_YARA_RULES = [
    {
        "name":             "Mimikatz Credential Dumper",
        "description":      "Detects Mimikatz credential dumping tool strings in file content.",
        "malware_family":   "Mimikatz",
        "severity":         "Critical",
        "mitre_tactic":     "Credential Access",
        "mitre_technique":  "T1003",
        "tags":             "credentials dumper lsass lateral-movement",
        "content": """\
rule Mimikatz_Strings
{
    meta:
        description = "Mimikatz credential dumping tool"
        family      = "Mimikatz"
    strings:
        $s1 = "mimikatz" ascii nocase wide
        $s2 = "sekurlsa::" ascii
        $s3 = "lsadump::"  ascii
        $s4 = "privilege::debug" ascii nocase
        $s5 = "kerberos::ptt"    ascii nocase
    condition:
        any of them
}""",
    },
    {
        "name":             "Metasploit Meterpreter",
        "description":      "Detects Metasploit meterpreter payload and reflective loader strings.",
        "malware_family":   "Metasploit",
        "severity":         "Critical",
        "mitre_tactic":     "Execution",
        "mitre_technique":  "T1059",
        "tags":             "meterpreter shellcode exploit post-exploitation",
        "content": """\
rule Metasploit_Meterpreter
{
    meta:
        description = "Metasploit meterpreter payload"
        family      = "Metasploit"
    strings:
        $s1 = "metsrv.dll"             ascii
        $s2 = "ReflectiveLoader"       ascii
        $s3 = "meterpreter"            ascii nocase wide
        $s4 = "stdapi_sys_config_getuid" ascii
    condition:
        any of them
}""",
    },
    {
        "name":             "Cobalt Strike Beacon",
        "description":      "Detects Cobalt Strike beacon configuration and loader strings.",
        "malware_family":   "CobaltStrike",
        "severity":         "Critical",
        "mitre_tactic":     "Command and Control",
        "mitre_technique":  "T1071.001",
        "tags":             "c2 beacon loader apt red-team",
        "content": """\
rule CobaltStrike_Beacon
{
    meta:
        description = "Cobalt Strike beacon strings"
        family      = "CobaltStrike"
    strings:
        $s1 = "ReflectiveDll"    ascii
        $s2 = "beacon.dll"       ascii nocase
        $s3 = "cobaltstrike"     ascii nocase wide
        $s4 = "Cobalt Strike"    ascii wide
        $s5 = "%s (admin)"       ascii
    condition:
        any of ($s1, $s2, $s3, $s4)
}""",
    },
    {
        "name":             "Web Shell (PHP/ASP)",
        "description":      "Detects generic PHP and ASP web shell patterns.",
        "malware_family":   "WebShell",
        "severity":         "High",
        "mitre_tactic":     "Persistence",
        "mitre_technique":  "T1505.003",
        "tags":             "webshell php asp persistence server-side",
        "content": """\
rule WebShell_Generic
{
    meta:
        description = "Generic web shell patterns (PHP/ASP)"
        family      = "WebShell"
    strings:
        $php1 = "<?php eval("           ascii nocase
        $php2 = "<?php system("         ascii nocase
        $php3 = "base64_decode($_POST"  ascii nocase
        $php4 = "$_REQUEST['cmd']"      ascii
        $php5 = "shell_exec($_"         ascii nocase
        $asp1 = "eval request("         ascii nocase
    condition:
        any of them
}""",
    },
    {
        "name":             "Ransomware Extortion Note",
        "description":      "Detects common ransomware ransom note text patterns in files.",
        "malware_family":   "Ransomware",
        "severity":         "Critical",
        "mitre_tactic":     "Impact",
        "mitre_technique":  "T1486",
        "tags":             "ransomware encryption extortion bitcoin",
        "content": """\
rule Ransomware_Note
{
    meta:
        description = "Ransomware ransom note patterns"
        family      = "Ransomware"
    strings:
        $n1 = "YOUR FILES HAVE BEEN ENCRYPTED" ascii nocase wide
        $n2 = "send Bitcoin"                   ascii nocase wide
        $n3 = "All your files are encrypted"   ascii nocase wide
        $n4 = "pay the ransom"                 ascii nocase wide
        $n5 = "decrypt your files"             ascii nocase wide
        $n6 = ".onion"                         ascii
    condition:
        2 of them
}""",
    },
    {
        "name":             "Emotet Banking Trojan",
        "description":      "Detects Emotet banking trojan loader and delivery strings.",
        "malware_family":   "Emotet",
        "severity":         "Critical",
        "mitre_tactic":     "Initial Access",
        "mitre_technique":  "T1566.001",
        "tags":             "banking trojan downloader email emotet heodo",
        "content": """\
rule Emotet_Loader
{
    meta:
        description = "Emotet banking trojan indicators"
        family      = "Emotet"
    strings:
        $s1 = "EmotetLoader" ascii nocase wide
        $s2 = "Geodo"        ascii nocase
        $s3 = "heodo"        ascii nocase
        $s4 = "Emotet"       ascii nocase wide
    condition:
        any of them
}""",
    },
    {
        "name":             "Agent Tesla Infostealer",
        "description":      "Detects Agent Tesla credential and keylogging strings.",
        "malware_family":   "AgentTesla",
        "severity":         "High",
        "mitre_tactic":     "Credential Access",
        "mitre_technique":  "T1555",
        "tags":             "infostealer credentials keylogger stealer",
        "content": """\
rule AgentTesla_Stealer
{
    meta:
        description = "Agent Tesla infostealer"
        family      = "AgentTesla"
    strings:
        $s1 = "AgentTesla"       ascii wide nocase
        $s2 = "smtp_password"    ascii wide
        $s3 = "get_KeyboardInfo" ascii
        $s4 = "KeyboardSendKeys" ascii
        $s5 = "Telegram Bot"     ascii nocase
    condition:
        2 of them
}""",
    },
    {
        "name":             "PowerShell Encoded Dropper",
        "description":      "Detects base64-encoded PowerShell dropper patterns that download and execute payloads.",
        "malware_family":   "PowerShellDropper",
        "severity":         "High",
        "mitre_tactic":     "Defense Evasion",
        "mitre_technique":  "T1027",
        "tags":             "powershell dropper encoded obfuscation downloader",
        "content": """\
rule PowerShell_Encoded_Dropper
{
    meta:
        description = "Base64-encoded PowerShell dropper that downloads and executes"
        family      = "PowerShellDropper"
    strings:
        $enc1 = "-EncodedCommand" ascii nocase
        $enc2 = "-enc "           ascii nocase
        $enc3 = "FromBase64String" ascii
        $iex1 = "IEX("            ascii nocase
        $iex2 = "Invoke-Expression" ascii nocase
        $dl1  = "DownloadString"  ascii
        $dl2  = "DownloadFile"    ascii
    condition:
        ($enc1 or $enc2 or $enc3) and ($iex1 or $iex2) and ($dl1 or $dl2)
}""",
    },
]


def seed_yara_rules(db: Session) -> None:
    for rule_data in SYSTEM_YARA_RULES:
        existing = (
            db.query(YaraRule)
            .filter(YaraRule.name == rule_data["name"], YaraRule.is_system.is_(True))
            .first()
        )
        if existing:
            continue
        db.add(YaraRule(
            name=rule_data["name"],
            description=rule_data.get("description"),
            tags=rule_data.get("tags"),
            content=rule_data["content"],
            malware_family=rule_data.get("malware_family"),
            severity=rule_data.get("severity", "High"),
            mitre_tactic=rule_data.get("mitre_tactic"),
            mitre_technique=rule_data.get("mitre_technique"),
            enabled=True,
            is_system=True,
            tenant_id=None,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        ))
    db.commit()
