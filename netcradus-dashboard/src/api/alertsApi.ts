import { apiFetch } from '@/api/client'
import type { BackendAlert, AlertStats } from '@/types/api.types'

export async function fetchAlerts(): Promise<BackendAlert[]> {
  return apiFetch<BackendAlert[]>('/alerts/')
}

export async function fetchOpenAlerts(): Promise<BackendAlert[]> {
  return apiFetch<BackendAlert[]>('/alerts/open')
}

export async function fetchAlertStats(): Promise<AlertStats> {
  return apiFetch<AlertStats>('/alerts/stats')
}

export async function resolveAlert(alertId: number): Promise<void> {
  await apiFetch(`/alerts/${alertId}/resolve`, { method: 'PUT' })
}
