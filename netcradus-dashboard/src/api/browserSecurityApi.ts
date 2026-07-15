import { apiFetch } from '@/api/client'

export type BrowserEventType =
  | 'extension'
  | 'password_leak'
  | 'ai_usage'
  | 'malicious_download'
  | 'malicious_site'

export type BrowserEventStatus = 'open' | 'acknowledged' | 'resolved' | 'false_positive'
export type Severity = 'Critical' | 'High' | 'Medium' | 'Low' | 'Info'

export interface BrowserSecurityEvent {
  id:             number
  agent_id:       number
  event_type:     BrowserEventType
  severity:       Severity
  browser:        string | null
  title:          string
  description:    string | null
  url:            string | null
  extension_id:   string | null
  extension_name: string | null
  file_name:      string | null
  file_path:      string | null
  sha256:         string | null
  username:       string | null
  status:         BrowserEventStatus
  detected_at:    string | null
}

export interface BrowserDashboard {
  total_open:  number
  by_type: {
    extension:          number
    password_leak:      number
    ai_usage:           number
    malicious_download: number
    malicious_site:     number
  }
  by_severity: {
    Critical: number
    High:     number
    Medium:   number
    Low:      number
    Info:     number
  }
  by_browser:    Record<string, number>
  recent_events: BrowserSecurityEvent[]
}

export async function fetchBrowserDashboard(): Promise<BrowserDashboard> {
  return apiFetch<BrowserDashboard>('/browser-security/dashboard')
}

export async function fetchBrowserEvents(params?: {
  event_type?: BrowserEventType
  severity?:   Severity
  status?:     BrowserEventStatus
  browser?:    string
  limit?:      number
}): Promise<BrowserSecurityEvent[]> {
  const qs = new URLSearchParams()
  if (params?.event_type) qs.set('event_type', params.event_type)
  if (params?.severity)   qs.set('severity',   params.severity)
  if (params?.status)     qs.set('status',      params.status)
  if (params?.browser)    qs.set('browser',     params.browser)
  if (params?.limit)      qs.set('limit',       String(params.limit))
  const q = qs.toString()
  return apiFetch<BrowserSecurityEvent[]>(`/browser-security/events${q ? `?${q}` : ''}`)
}

export async function updateBrowserEventStatus(
  id: number,
  status: BrowserEventStatus,
): Promise<BrowserSecurityEvent> {
  return apiFetch<BrowserSecurityEvent>(`/browser-security/events/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
}
