import { apiFetch } from '@/api/client'
import type { ThreatFeedConfig, LookupResult } from '@/types/api.types'

export async function fetchFeedConfig(): Promise<ThreatFeedConfig> {
  return apiFetch<ThreatFeedConfig>('/threat-feeds/config')
}

export async function updateFeedConfig(payload: {
  virustotal_api_key?: string | null
  abuseipdb_api_key?: string | null
  otx_api_key?: string | null
}): Promise<ThreatFeedConfig> {
  return apiFetch<ThreatFeedConfig>('/threat-feeds/config', {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export async function lookupIndicator(
  ioc_type: string,
  value: string
): Promise<LookupResult> {
  return apiFetch<LookupResult>('/threat-feeds/lookup', {
    method: 'POST',
    body: JSON.stringify({ ioc_type, value }),
  })
}

export async function enrichIOC(
  ioc_id: number
): Promise<{ status: string; ioc_id: number }> {
  return apiFetch('/threat-feeds/enrich/' + ioc_id, { method: 'POST' })
}
