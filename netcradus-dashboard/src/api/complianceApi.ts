import { apiFetch } from '@/api/client'

export interface ControlDetail {
  id:          number
  control_ref: string
  title:       string
  category:    string
  priority:    string
  xdr_auto:    boolean
  status:      'compliant' | 'partial' | 'non_compliant' | 'not_applicable'
  evidence:    number
}

export interface FrameworkSummary {
  id:          number
  name:        string
  version:     string | null
  description: string | null
  category:    string | null
  color:       string | null
  score:       number
  compliant:   number
  missing:     number
  total:       number
  controls:    ControlDetail[]
}

export interface ComplianceDashboard {
  overall_score:    number
  total_controls:   number
  missing_controls: number
  evidence_ready:   number
  frameworks:       FrameworkSummary[]
}

export interface AssessmentUpdate {
  status: 'compliant' | 'partial' | 'non_compliant' | 'not_applicable'
  notes?: string
}

export interface EvidenceItem {
  id:            number
  title:         string
  description:   string | null
  evidence_type: string
  created_at:    string | null
}

export interface EvidenceCreate {
  title:          string
  description?:   string
  evidence_type?: string
}

export const fetchComplianceDashboard = () =>
  apiFetch<ComplianceDashboard>('/compliance/dashboard')

export const patchAssessment = (controlId: number, body: AssessmentUpdate) =>
  apiFetch<{ status: string }>(`/compliance/controls/${controlId}/assessment`, {
    method: 'PATCH',
    body:   JSON.stringify(body),
  })

export const fetchEvidence = (controlId: number) =>
  apiFetch<EvidenceItem[]>(`/compliance/controls/${controlId}/evidence`)

export const addEvidence = (controlId: number, body: EvidenceCreate) =>
  apiFetch<EvidenceItem>(`/compliance/controls/${controlId}/evidence`, {
    method: 'POST',
    body:   JSON.stringify(body),
  })
