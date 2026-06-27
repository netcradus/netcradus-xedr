import { apiFetch } from '@/api/client'
import type {
  BackendIncident,
  BackendIncidentDetail,
  IncidentStats,
} from '@/types/api.types'

export async function fetchIncidents(params?: {
  status?: string
  severity?: string
}): Promise<BackendIncident[]> {
  const qs = new URLSearchParams()
  if (params?.status) qs.set('status', params.status)
  if (params?.severity) qs.set('severity', params.severity)
  const query = qs.toString() ? `?${qs.toString()}` : ''
  return apiFetch<BackendIncident[]>(`/incidents/${query}`)
}

export async function fetchIncidentStats(): Promise<IncidentStats> {
  return apiFetch<IncidentStats>('/incidents/stats')
}

export async function fetchIncidentDetail(id: number): Promise<BackendIncidentDetail> {
  return apiFetch<BackendIncidentDetail>(`/incidents/${id}`)
}

export async function updateIncidentStatus(
  id: number,
  status: 'Open' | 'Investigating' | 'Resolved',
): Promise<BackendIncident> {
  return apiFetch<BackendIncident>(`/incidents/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  })
}

export async function backfillIncidents(): Promise<{ incidents_total: number }> {
  return apiFetch('/incidents/backfill', { method: 'POST' })
}
