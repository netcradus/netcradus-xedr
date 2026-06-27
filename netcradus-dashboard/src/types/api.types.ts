export type BackendSeverity = 'Critical' | 'High' | 'Medium' | 'Low' | 'Informational'
export type AlertStatus = 'Open' | 'Resolved'
export type AgentStatus = 'Online' | 'Offline'
export type IncidentStatus = 'Open' | 'Investigating' | 'Resolved'

export interface BackendAlert {
  id: number
  title: string
  description: string
  severity: BackendSeverity
  mitre_technique: string
  status: AlertStatus
  occurrence_count: number
  timestamp: string
  agent_id: number
}

export interface BackendAgent {
  id: number
  hostname: string
  ip_address: string
  os_type: string
  agent_version: string
  last_seen: string
  status: AgentStatus
  agent_token: string
  tenant_id: number
}

export interface BackendUser {
  id: number
  name: string
  email: string
  is_active: boolean
  role: { id: number; name: string }
  tenant: { id: number; name: string; is_active: boolean }
}

export interface AlertStats {
  critical: number
  high: number
  medium: number
  low: number
  open: number
  resolved: number
}

export interface BackendIOC {
  id: number
  type: string
  value: string
  description: string
  category: string
  severity: BackendSeverity
  source: string
  created_by: string
  created_at: string
  expires_at: string | null
  is_active: boolean
  enrichment_status?: string | null
  vt_score?: number | null
}

export interface ThreatFeedConfig {
  virustotal_api_key: string | null
  abuseipdb_api_key: string | null
  has_virustotal: boolean
  has_abuseipdb: boolean
}

export interface FeedResult {
  source: string
  score_pct?: number
  malicious?: number
  total_engines?: number
  reputation?: number
  tags?: string[]
  confidence?: number
  country?: string | null
  isp?: string | null
  total_reports?: number
  is_tor?: boolean
  status?: string
  error?: string
}

export interface LookupResult {
  vt_score: number | null
  feeds: FeedResult[]
}

export interface LinkedAlert {
  id: number
  title: string
  description: string | null
  severity: BackendSeverity
  mitre_technique: string | null
  status: AlertStatus
  occurrence_count: number
  timestamp: string
  agent_id: number
  agent_hostname: string | null
}

export interface BackendIncident {
  id: number
  title: string
  description: string | null
  severity: BackendSeverity
  status: IncidentStatus
  tenant_id: number
  assigned_to: number | null
  mitre_tactics: string | null
  alert_count: number
  affected_endpoints: number
  created_at: string
  updated_at: string
  resolved_at: string | null
}

export interface BackendIncidentDetail extends BackendIncident {
  alerts: LinkedAlert[]
}

export interface IncidentStats {
  total: number
  open: number
  investigating: number
  resolved: number
  critical: number
  high: number
}

export type CommandStatus = 'Pending' | 'Completed' | 'Failed'
export type CommandType =
  | 'kill_process'
  | 'isolate_host'
  | 'block_ip'
  | 'quarantine_file'
  | 'restore_host'

export interface BackendCommand {
  id: number
  command_type: CommandType
  argument: string
  status: CommandStatus
  result: string | null
  error: string | null
  timestamp: string
  completed_at: string | null
  agent_id: number
  agent_hostname: string
}

export interface ReportSummary {
  alerts: {
    total: number; open: number; resolved: number
    by_severity: Record<string, number>
  }
  incidents: {
    total: number; open: number; resolved: number; mttr_hours: number | null
  }
  agents: { total: number; online: number }
  commands: { total: number; completed: number }
  trend_30d: { date: string; count: number }[]
  top_mitre: { technique: string; count: number }[]
}

export interface AuditLogEntry {
  id: number
  user_name: string | null
  action: string
  resource_type: string | null
  resource_id: number | null
  details: string | null
  timestamp: string
}

export interface NotificationConfig {
  slack_webhook_url:       string | null
  teams_webhook_url:       string | null
  email_to:                string | null
  email_smtp_host:         string | null
  email_smtp_port:         number | null
  email_smtp_user:         string | null
  email_smtp_pass:         string | null
  email_smtp_from:         string | null
  email_use_tls:           boolean
  notify_on_critical:      boolean
  notify_on_high:          boolean
  notify_on_new_incident:  boolean
  notify_on_agent_offline: boolean
}

export interface TestNotificationResult {
  results: {
    slack?: string
    teams?: string
    email?: string
  }
}

export interface BackendTeamMember {
  id: number
  name: string
  email: string
  role: string
  is_active: boolean
}

export interface BackendOrg {
  id: number
  name: string
  api_key: string | null
  is_active: boolean
}

// ── SuperAdmin types ──────────────────────────────────────────────────────────

export interface TenantStats {
  id: number
  name: string
  api_key_tail: string | null
  is_active: boolean
  plan: string
  user_count: number
  agent_count: number
  alert_count: number
  created_at: string | null
}

export interface PlatformStats {
  total_tenants: number
  active_tenants: number
  total_agents: number
  online_agents: number
  total_users: number
  total_alerts: number
}

export interface OnboardingInfo {
  tenant_name: string
  tenant_api_key: string | null
}

// ── AI types ──────────────────────────────────────────────────────────────────

export interface IncidentAISummary {
  summary: string
  attack_chain: string
  risk_assessment: string
  recommended_actions: string[]
  containment_priority: 'immediate' | 'urgent' | 'standard'
}

export interface NLQueryAlertRow {
  id: number
  title: string
  severity: string
  status: string
  agent_hostname: string
  agent_os: string
  mitre_technique: string | null
  timestamp: string
  occurrence_count: number
}

export interface NLQueryIncidentRow {
  id: number
  title: string
  severity: string
  status: string
  alert_count: number
  created_at: string
  mitre_tactics: string | null
}

export interface NLQueryResult {
  resource: 'alerts' | 'incidents'
  explanation: string
  filters_applied: Record<string, unknown>
  total: number
  results: NLQueryAlertRow[] | NLQueryIncidentRow[]
}

export interface PlaybookStep {
  phase: string
  action: string
  rationale: string
  soar_command: string | null
}

export interface AIPlaybookRecommendation {
  summary: string
  severity_assessment: string
  steps: PlaybookStep[]
  ioc_to_collect: string[]
  escalation_trigger: string
}

export interface CreateIOCPayload {
  type: string
  value: string
  description: string
  category: string
  severity: BackendSeverity
  source: string
  expires_at?: string | null
  is_active: boolean
}
