import { apiFetch } from '@/api/client'
import type { BackendAlert, AlertsPage, AlertStats } from '@/types/api.types'

export interface AlertFilters {
  offset?:          number
  limit?:           number
  status?:          string
  severity?:        string
  search?:          string
  from_date?:       string   // ISO date string YYYY-MM-DD
  to_date?:         string
  agent_id?:        number
  mitre_technique?: string
  sort_by?:         'timestamp' | 'severity' | 'title' | 'status'
  sort_dir?:        'asc' | 'desc'
}

export async function fetchAlerts(filters: AlertFilters = {}): Promise<AlertsPage> {
  const params = new URLSearchParams()
  if (filters.offset    != null) params.set('offset',          String(filters.offset))
  if (filters.limit     != null) params.set('limit',           String(filters.limit))
  if (filters.status)            params.set('status',          filters.status)
  if (filters.severity)          params.set('severity',        filters.severity)
  if (filters.search)            params.set('search',          filters.search)
  if (filters.from_date)         params.set('from_date',       filters.from_date)
  if (filters.to_date)           params.set('to_date',         filters.to_date)
  if (filters.agent_id  != null) params.set('agent_id',        String(filters.agent_id))
  if (filters.mitre_technique)   params.set('mitre_technique', filters.mitre_technique)
  if (filters.sort_by)           params.set('sort_by',         filters.sort_by)
  if (filters.sort_dir)          params.set('sort_dir',        filters.sort_dir)
  const qs = params.toString()
  return apiFetch<AlertsPage>(`/alerts/${qs ? `?${qs}` : ''}`)
}

export async function fetchOpenAlerts(limit = 10): Promise<BackendAlert[]> {
  return apiFetch<BackendAlert[]>(`/alerts/open?limit=${limit}`)
}

export async function fetchAlertStats(): Promise<AlertStats> {
  return apiFetch<AlertStats>('/alerts/stats')
}

export async function resolveAlert(alertId: number): Promise<void> {
  await apiFetch(`/alerts/${alertId}/resolve`, { method: 'PUT' })
}
