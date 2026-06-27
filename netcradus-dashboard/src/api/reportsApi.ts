import { apiFetch } from '@/api/client'
import type { ReportSummary, AuditLogEntry } from '@/types/api.types'

export async function fetchReportSummary(): Promise<ReportSummary> {
  return apiFetch<ReportSummary>('/reports/summary')
}

export async function fetchAuditLogs(params?: {
  action?: string
  resource_type?: string
}): Promise<AuditLogEntry[]> {
  const qs = new URLSearchParams()
  if (params?.action) qs.set('action', params.action)
  if (params?.resource_type) qs.set('resource_type', params.resource_type)
  const query = qs.toString() ? `?${qs.toString()}` : ''
  return apiFetch<AuditLogEntry[]>(`/audit-logs/${query}`)
}
