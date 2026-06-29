import { apiFetch } from '@/api/client'

export interface PlatformOverview {
  total_tenants: number
  active_tenants: number
  inactive_tenants: number
  new_this_month: number
  new_last_month: number
  growth_pct: number
  total_users: number
  total_agents: number
  online_agents: number
  alerts_today: number
  critical_today: number
  total_alerts: number
  mrr_estimate: number
  plan_distribution: Record<string, number>
  signup_trend: { date: string; count: number }[]
  alert_trend: { date: string; count: number }[]
  recent_signups: { id: number; name: string; plan: string; created_at: string | null }[]
  top_tenants_by_alerts: { id: number; name: string; plan: string; alert_count: number }[]
  top_tenants_by_users: { id: number; name: string; plan: string; user_count: number }[]
}

export interface PlatformTenant {
  id: number
  name: string
  plan: string
  is_active: boolean
  user_count: number
  agent_count: number
  online_agents: number
  alert_count: number
  critical_count: number
  mrr: number
  created_at: string | null
  last_activity: string | null
}

export interface PlatformActivity {
  id: number
  tenant_id: number
  tenant_name: string
  user_name: string | null
  action: string
  resource_type: string | null
  details: string | null
  timestamp: string | null
}

export interface PlatformSystem {
  status: 'ok' | 'degraded'
  db: 'ok' | 'error'
  db_latency_ms: number | null
  redis: 'ok' | 'error' | 'not configured'
  redis_latency_ms: number | null
  version: string
  uptime_seconds: number
}

export interface PlatformSupportTicket {
  id: number
  tenant_name: string
  user_name: string
  user_email: string
  subject: string
  message: string
  priority: string
  status: string
  admin_note: string | null
  created_at: string | null
  updated_at: string | null
}

export interface UpdateTicketPayload {
  status?: string
  admin_note?: string
}

export const fetchPlatformOverview = () => apiFetch<PlatformOverview>('/platform/overview')
export const fetchPlatformTenants  = () => apiFetch<PlatformTenant[]>('/platform/tenants')
export const fetchPlatformActivity = () => apiFetch<PlatformActivity[]>('/platform/activity')
export const fetchPlatformSystem   = () => apiFetch<PlatformSystem>('/platform/system')
export const fetchPlatformSupport  = () => apiFetch<PlatformSupportTicket[]>('/platform/support')
export const updateTicketStatus    = (id: number, payload: UpdateTicketPayload) =>
  apiFetch<{ id: number; status: string; admin_note: string | null }>(`/platform/support/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
