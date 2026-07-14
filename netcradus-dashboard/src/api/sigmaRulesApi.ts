import { apiFetch } from '@/api/client'

export interface SigmaRule {
  id: number
  title: string
  sigma_id: string | null
  status: string | null
  author: string | null
  description: string | null
  detection_rule_id: number | null
  conversion_error: string | null
  enabled: boolean
  tenant_id: number | null
  created_at: string | null
}

export interface SigmaUploadPayload {
  yaml_content: string
  enabled?: boolean
}

export const fetchSigmaRules = () =>
  apiFetch<SigmaRule[]>('/sigma-rules/')

export const uploadSigmaRule = (p: SigmaUploadPayload) =>
  apiFetch<SigmaRule>('/sigma-rules/upload', {
    method: 'POST',
    body: JSON.stringify(p),
  })

export const convertSigmaRule = (id: number) =>
  apiFetch<{ success: boolean; detection_rule_id?: number; error?: string }>(
    `/sigma-rules/${id}/convert`,
    { method: 'POST' },
  )

export const deleteSigmaRule = (id: number) =>
  apiFetch<void>(`/sigma-rules/${id}`, { method: 'DELETE' })
