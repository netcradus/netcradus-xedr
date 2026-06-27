import { apiFetch } from '@/api/client'
import type {
  IncidentAISummary,
  NLQueryResult,
  AIPlaybookRecommendation,
} from '@/types/api.types'

export async function getIncidentAISummary(
  incident_id: number
): Promise<IncidentAISummary> {
  return apiFetch<IncidentAISummary>('/ai/incident-summary', {
    method: 'POST',
    body: JSON.stringify({ incident_id }),
  })
}

export async function runNLQuery(query: string): Promise<NLQueryResult> {
  return apiFetch<NLQueryResult>('/ai/nl-query', {
    method: 'POST',
    body: JSON.stringify({ query }),
  })
}

export async function getPlaybookRecommendation(
  mitre_techniques: string[],
  context?: string
): Promise<AIPlaybookRecommendation> {
  return apiFetch<AIPlaybookRecommendation>('/ai/playbook-recommendation', {
    method: 'POST',
    body: JSON.stringify({ mitre_techniques, context: context ?? '' }),
  })
}
