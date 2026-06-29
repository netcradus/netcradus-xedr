import { apiFetch } from '@/api/client'

export interface DetectionRule {
  id: number
  name: string
  description: string | null
  rule_type: 'process' | 'network' | 'file' | 'persistence'
  field: string
  operator: string
  value: string
  severity: 'Low' | 'Medium' | 'High' | 'Critical'
  mitre_tactic: string | null
  mitre_technique: string | null
  enabled: boolean
  is_system: boolean
  tenant_id: number | null
  created_at: string | null
  updated_at: string | null
}

export interface RulePayload {
  name: string
  description?: string
  rule_type: string
  field: string
  operator: string
  value: string
  severity: string
  mitre_tactic?: string
  mitre_technique?: string
  enabled?: boolean
}

export const fetchRules       = () => apiFetch<DetectionRule[]>('/detection-rules/')
export const createRule       = (p: RulePayload) => apiFetch<DetectionRule>('/detection-rules/', { method: 'POST', body: JSON.stringify(p) })
export const updateRule       = (id: number, p: Partial<RulePayload>) => apiFetch<DetectionRule>(`/detection-rules/${id}`, { method: 'PUT', body: JSON.stringify(p) })
export const toggleRule       = (id: number) => apiFetch<{ id: number; enabled: boolean }>(`/detection-rules/${id}/toggle`, { method: 'PATCH' })
export const deleteRule       = (id: number) => apiFetch<void>(`/detection-rules/${id}`, { method: 'DELETE' })
