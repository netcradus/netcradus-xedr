import { apiFetch, BASE_URL, getToken } from '@/api/client'

export interface YaraRule {
  id: number
  name: string
  description: string | null
  tags: string | null
  malware_family: string | null
  severity: string
  mitre_tactic: string | null
  mitre_technique: string | null
  enabled: boolean
  is_system: boolean
  tenant_id: number | null
  created_at: string | null
  updated_at: string | null
  content?: string
}

export interface YaraScanResult {
  id: number
  file_path: string | null
  sha256: string | null
  matched_rule_name: string
  malware_family: string | null
  severity: string
  mitre_tactic: string | null
  mitre_technique: string | null
  scan_context: string | null
  agent_id: number | null
  tenant_id: number | null
  created_at: string | null
}

export interface YaraStats {
  total_detections: number
  detections_24h: number
  unique_families: number
}

export interface YaraRulePayload {
  name: string
  description?: string
  tags?: string
  malware_family?: string
  content: string
  severity: string
  mitre_tactic?: string
  mitre_technique?: string
  enabled?: boolean
}

export interface YaraScanResponse {
  file_name: string
  file_size: number
  sha256: string
  matches: Array<{
    rule_name: string
    malware_family: string | null
    severity: string
    mitre_tactic: string | null
    mitre_technique: string | null
  }>
  clean: boolean
}

export const fetchYaraRules = () =>
  apiFetch<YaraRule[]>('/yara-rules/')

export const getYaraRule = (id: number) =>
  apiFetch<YaraRule>(`/yara-rules/${id}`)

export const createYaraRule = (p: YaraRulePayload) =>
  apiFetch<YaraRule>('/yara-rules/', { method: 'POST', body: JSON.stringify(p) })

export const updateYaraRule = (id: number, p: Partial<YaraRulePayload>) =>
  apiFetch<YaraRule>(`/yara-rules/${id}`, { method: 'PUT', body: JSON.stringify(p) })

export const deleteYaraRule = (id: number) =>
  apiFetch<void>(`/yara-rules/${id}`, { method: 'DELETE' })

export const validateYaraContent = (content: string) =>
  apiFetch<{ valid: boolean; error: string | null }>('/yara-rules/validate', {
    method: 'POST',
    body: JSON.stringify({ content }),
  })

export const fetchScanResults = (params?: { limit?: number; family?: string; severity?: string }) => {
  const q = new URLSearchParams()
  if (params?.limit)    q.set('limit',    String(params.limit))
  if (params?.family)   q.set('family',   params.family)
  if (params?.severity) q.set('severity', params.severity)
  const qs = q.toString()
  return apiFetch<YaraScanResult[]>(`/yara-rules/scan-results${qs ? '?' + qs : ''}`)
}

export const fetchScanStats = () =>
  apiFetch<YaraStats>('/yara-rules/scan-results/stats')

// File upload uses raw fetch — apiFetch always sets Content-Type: application/json
// which would break multipart/form-data. Let the browser set the boundary.
export async function scanFile(file: File): Promise<YaraScanResponse> {
  const token = getToken()
  const form  = new FormData()
  form.append('file', file)
  const res = await fetch(`${BASE_URL}/yara-rules/scan-file`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
    credentials: 'include',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(typeof err.detail === 'string' ? err.detail : res.statusText)
  }
  return res.json()
}
