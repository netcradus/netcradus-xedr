import { apiFetch } from '@/api/client'
import type {
  BackendIncident,
  BackendIncidentDetail,
  IncidentStats,
  IncidentStatus,
  InvestigationNote,
  EvidenceItem,
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
  status: IncidentStatus,
): Promise<BackendIncident> {
  return apiFetch<BackendIncident>(`/incidents/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  })
}

export async function resolveIncident(
  id: number,
  payload: {
    root_cause?: string
    resolution_summary?: string
    containment_actions?: string
    lessons_learned?: string
  },
): Promise<BackendIncident> {
  return apiFetch<BackendIncident>(`/incidents/${id}/resolve`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export async function backfillIncidents(): Promise<{ incidents_total: number }> {
  return apiFetch('/incidents/backfill', { method: 'POST' })
}

// ── Investigation notes ───────────────────────────────────────────────────────

export async function addNote(
  incidentId: number,
  payload: { note_type: string; content: string },
): Promise<InvestigationNote> {
  return apiFetch<InvestigationNote>(`/incidents/${incidentId}/notes`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function deleteNote(incidentId: number, noteId: number): Promise<void> {
  await apiFetch(`/incidents/${incidentId}/notes/${noteId}`, { method: 'DELETE' })
}

// ── Evidence ──────────────────────────────────────────────────────────────────

export async function addEvidence(
  incidentId: number,
  payload: { title: string; evidence_type: string; content?: string },
): Promise<EvidenceItem> {
  return apiFetch<EvidenceItem>(`/incidents/${incidentId}/evidence`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function deleteEvidence(incidentId: number, evidenceId: number): Promise<void> {
  await apiFetch(`/incidents/${incidentId}/evidence/${evidenceId}`, { method: 'DELETE' })
}
