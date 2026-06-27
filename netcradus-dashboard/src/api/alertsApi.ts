import { apiFetch } from '@/api/client'
import type { BackendAlert, AlertStats } from '@/types/api.types'

export interface AlertFilters {
  status?: string
  severity?: string
  limit?: number
}

export async function fetchAlerts(filters: AlertFilters = {}): Promise<BackendAlert[]> {
  const params = new URLSearchParams()
  if (filters.status)   params.set('status', filters.status)
  if (filters.severity) params.set('severity', filters.severity)
  if (filters.limit)    params.set('limit', String(filters.limit))
  const qs = params.toString()
  return apiFetch<BackendAlert[]>(`/alerts/${qs ? `?${qs}` : ''}`)
}

export async function fetchOpenAlerts(): Promise<BackendAlert[]> {
  return fetchAlerts({ status: 'Open', limit: 10 })
}

export async function fetchAlertStats(): Promise<AlertStats> {
  return apiFetch<AlertStats>('/alerts/stats')
}

export async function resolveAlert(alertId: number): Promise<void> {
  await apiFetch(`/alerts/${alertId}/resolve`, { method: 'PUT' })
}
