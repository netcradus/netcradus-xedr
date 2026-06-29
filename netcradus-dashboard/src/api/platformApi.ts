import { apiFetch } from '@/api/client'

export interface PlatformOverview {
  total_tenants: number
  active_tenants: number
  total_users: number
  total_agents: number
  online_agents: number
  alerts_today: number
  critical_today: number
  plan_distribution: Record<string, number>
  signup_trend: { date: string; count: number }[]
  alert_trend: { date: string; count: number }[]
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
  redis: 'ok' | 'error' | 'not configured'
  version: string
  uptime_seconds: number
}

export const fetchPlatformOverview = () => apiFetch<PlatformOverview>('/platform/overview')
export const fetchPlatformTenants  = () => apiFetch<PlatformTenant[]>('/platform/tenants')
export const fetchPlatformActivity = () => apiFetch<PlatformActivity[]>('/platform/activity')
export const fetchPlatformSystem   = () => apiFetch<PlatformSystem>('/platform/system')
