import { apiFetch } from '@/api/client'

// ── Result shapes ──────────────────────────────────────────────────────────────

export interface HuntHit {
  // common
  id?: number
  agent_id?: number
  agent_hostname?: string
  timestamp?: string | null
  // process / hash / domain / username
  source?: string
  process_name?: string | null
  parent_process_name?: string | null
  cmdline?: string | null
  exe_path?: string | null
  username?: string | null
  sha256?: string | null
  md5?: string | null
  // file
  file_path?: string | null
  event_type?: string | null
  // network / ip
  local_ip?: string | null
  remote_ip?: string | null
  remote_port?: number | null
  protocol?: string | null
  // country enrichment
  country_code?: string | null
  isp?: string | null
  abuse_score?: number | null
  // log
  log_source?: string | null
  log_message?: string | null
  severity?: string | null
  // persistence
  persistence_type?: string | null
  entry_name?: string | null
  entry_path?: string | null
  // mitre
  title?: string
  description?: string
  mitre_technique?: string | null
  status?: string | null
  occurrence_count?: number | null
}

export interface DetectionRuleHit {
  id?: number
  name?: string
  description?: string | null
  rule_type?: string | null
  severity?: string | null
  mitre_tactic?: string | null
  mitre_technique?: string | null
  enabled?: boolean
  is_system?: boolean
}

export interface HuntResult {
  query: Record<string, unknown>
  total: number
  hits: HuntHit[]
  // optional enrichments
  unique_agents?: number
  unique_hosts?: string[]
  attributed_ips?: string[]
  country_code?: string
  display_country?: string
  summary?: Record<string, unknown>
  // mitre-specific
  alerts?: HuntHit[]
  detection_rules?: DetectionRuleHit[]
}

// ── Query builder ──────────────────────────────────────────────────────────────

export type HuntKey =
  | 'hash' | 'ip' | 'domain' | 'username' | 'process'
  | 'parent_process' | 'cmdline' | 'mitre' | 'country' | 'persistence'

export interface ParsedQuery {
  key: HuntKey
  value: string
  raw: string
}

export function parseHuntQuery(raw: string): ParsedQuery | null {
  const m = raw.trim().match(/^(\w+):(.+)$/)
  if (!m) return null
  const key = m[1].toLowerCase() as HuntKey
  const VALID_KEYS: HuntKey[] = [
    'hash', 'ip', 'domain', 'username', 'process',
    'parent_process', 'cmdline', 'mitre', 'country', 'persistence',
  ]
  if (!VALID_KEYS.includes(key)) return null
  return { key, value: m[2].trim(), raw }
}

function qs(params: Record<string, string | number | undefined>): string {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== '') p.set(k, String(v))
  }
  return p.toString() ? '?' + p.toString() : ''
}

export async function executeHunt(
  parsed: ParsedQuery,
  days: number,
  limit = 200,
): Promise<HuntResult> {
  const { key, value } = parsed
  const base = '/hunt'

  switch (key) {
    case 'hash':
      return apiFetch<HuntResult>(`${base}/hash${qs({ value, days, limit })}`)
    case 'ip':
      return apiFetch<HuntResult>(`${base}/ip${qs({ value, days, limit })}`)
    case 'domain':
      return apiFetch<HuntResult>(`${base}/domain${qs({ value, days, limit })}`)
    case 'username':
      return apiFetch<HuntResult>(`${base}/username${qs({ value, days, limit })}`)
    case 'process':
      return apiFetch<HuntResult>(`${base}/process${qs({ name: value, days, limit })}`)
    case 'parent_process':
      return apiFetch<HuntResult>(`${base}/process${qs({ parent: value, days, limit })}`)
    case 'cmdline':
      return apiFetch<HuntResult>(`${base}/process${qs({ cmdline: value, days, limit })}`)
    case 'mitre':
      return apiFetch<HuntResult>(`${base}/mitre${qs({ technique: value, days, limit })}`)
    case 'country':
      return apiFetch<HuntResult>(`${base}/country${qs({ value, days, limit })}`)
    case 'persistence':
      return apiFetch<HuntResult>(`${base}/persistence${qs({ type: value, days, limit })}`)
    default:
      throw new Error(`Unknown hunt key: ${key}`)
  }
}
