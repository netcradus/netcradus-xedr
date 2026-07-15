import { useState, useEffect, useCallback } from 'react'
import {
  ShieldAlert, Globe, KeyRound, Bot, Download, AlertTriangle,
  Chrome, RefreshCw, CheckCircle2, Eye, EyeOff, ChevronDown, ChevronUp,
  Crown, Puzzle, Lock,
} from 'lucide-react'
import {
  fetchBrowserDashboard, fetchBrowserEvents, updateBrowserEventStatus,
  type BrowserDashboard, type BrowserSecurityEvent, type BrowserEventType,
  type BrowserEventStatus,
} from '@/api/browserSecurityApi'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SEV_COLOR: Record<string, string> = {
  Critical: 'bg-red-500',
  High:     'bg-orange-500',
  Medium:   'bg-yellow-500',
  Low:      'bg-blue-500',
  Info:     'bg-slate-400',
}
const SEV_BADGE: Record<string, string> = {
  Critical: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  High:     'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  Medium:   'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  Low:      'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  Info:     'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
}
const STATUS_BADGE: Record<string, string> = {
  open:           'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  acknowledged:   'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  resolved:       'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  false_positive: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400',
}

const EVENT_META: Record<BrowserEventType, { label: string; icon: React.ElementType; color: string }> = {
  extension:          { label: 'Extensions',     icon: Puzzle,        color: 'text-purple-500' },
  password_leak:      { label: 'Password Leaks', icon: KeyRound,      color: 'text-red-500'    },
  ai_usage:           { label: 'AI Usage',       icon: Bot,           color: 'text-blue-500'   },
  malicious_download: { label: 'Downloads',      icon: Download,      color: 'text-orange-500' },
  malicious_site:     { label: 'Malicious Sites',icon: Globe,         color: 'text-pink-500'   },
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function KpiCard({
  label, value, icon: Icon, color, active, onClick,
}: {
  label: string; value: number; icon: React.ElementType
  color: string; active: boolean; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex flex-col gap-2 rounded-xl border p-4 text-left transition-all
        ${active
          ? 'border-brand-blue bg-brand-blue/5 shadow-md dark:bg-brand-blue/10'
          : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600'
        }`}
    >
      <div className="flex items-center justify-between">
        <span className={`text-[13px] font-medium text-slate-500 dark:text-slate-400`}>{label}</span>
        <Icon size={16} className={color} />
      </div>
      <span className="text-3xl font-black text-slate-900 dark:text-white tabular-nums">{value}</span>
      {active && (
        <span className="absolute bottom-2 right-3 text-[10px] font-semibold text-brand-blue uppercase tracking-wide">
          Filtered
        </span>
      )}
    </button>
  )
}

function BrowserBar({ by_browser }: { by_browser: Record<string, number> }) {
  const total = Object.values(by_browser).reduce((a, b) => a + b, 0)
  if (!total) return null

  const BROWSER_COLORS: Record<string, string> = {
    chrome:  'bg-yellow-400',
    edge:    'bg-blue-500',
    firefox: 'bg-orange-500',
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
      <p className="mb-3 text-[13px] font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide">
        By Browser
      </p>
      <div className="flex h-3 w-full overflow-hidden rounded-full gap-0.5">
        {Object.entries(by_browser).map(([br, cnt]) => (
          <div
            key={br}
            className={`${BROWSER_COLORS[br] ?? 'bg-slate-400'} rounded-full transition-all`}
            style={{ width: `${(cnt / total) * 100}%` }}
            title={`${br}: ${cnt}`}
          />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-3">
        {Object.entries(by_browser).map(([br, cnt]) => (
          <div key={br} className="flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-full ${BROWSER_COLORS[br] ?? 'bg-slate-400'}`} />
            <span className="text-xs text-slate-600 dark:text-slate-400 capitalize">{br}</span>
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 tabular-nums">{cnt}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function SeverityRow({ by_severity }: { by_severity: Record<string, number> }) {
  const order = ['Critical', 'High', 'Medium', 'Low', 'Info']
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
      <p className="mb-3 text-[13px] font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide">
        By Severity
      </p>
      <div className="flex flex-col gap-2">
        {order.map(sev => {
          const cnt = by_severity[sev] ?? 0
          const max = Math.max(...Object.values(by_severity), 1)
          return (
            <div key={sev} className="flex items-center gap-2">
              <span className="w-16 shrink-0 text-[11px] font-medium text-slate-500 dark:text-slate-400">{sev}</span>
              <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                <div
                  className={`h-full rounded-full ${SEV_COLOR[sev] ?? 'bg-slate-400'} transition-all`}
                  style={{ width: `${(cnt / max) * 100}%` }}
                />
              </div>
              <span className="w-6 text-right text-[11px] font-bold tabular-nums text-slate-700 dark:text-slate-200">{cnt}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function EventRow({
  event, onStatusChange,
}: {
  event: BrowserSecurityEvent
  onStatusChange: (id: number, status: BrowserEventStatus) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [updating, setUpdating] = useState(false)
  const meta = EVENT_META[event.event_type]
  const Icon = meta?.icon ?? AlertTriangle

  async function handleStatus(status: BrowserEventStatus) {
    setUpdating(true)
    await onStatusChange(event.id, status)
    setUpdating(false)
  }

  const ts = event.detected_at
    ? new Date(event.detected_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
    : '—'

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 overflow-hidden">
      {/* Header row */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-start gap-3 p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors"
      >
        {/* Severity stripe */}
        <div className={`mt-0.5 w-1 self-stretch rounded-full shrink-0 ${SEV_COLOR[event.severity] ?? 'bg-slate-400'}`} />

        <Icon size={16} className={`mt-0.5 shrink-0 ${meta?.color ?? 'text-slate-500'}`} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-slate-900 dark:text-white leading-tight">
              {event.title}
            </span>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide ${SEV_BADGE[event.severity]}`}>
              {event.severity}
            </span>
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${STATUS_BADGE[event.status]}`}>
              {event.status.replace('_', ' ')}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {event.browser && (
              <span className="text-[11px] text-slate-500 dark:text-slate-400 capitalize">
                {event.browser}
              </span>
            )}
            <span className="text-[11px] text-slate-400 dark:text-slate-500">{ts}</span>
          </div>
        </div>

        {expanded ? <ChevronUp size={14} className="shrink-0 text-slate-400 mt-1" /> : <ChevronDown size={14} className="shrink-0 text-slate-400 mt-1" />}
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-slate-100 dark:border-slate-700 px-4 pb-4 pt-3 space-y-3">
          {event.description && (
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {event.description}
            </p>
          )}

          {/* Context fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {event.url && (
              <Detail label="URL" value={event.url} mono />
            )}
            {event.extension_name && (
              <Detail label="Extension" value={`${event.extension_name} (${event.extension_id ?? '?'})`} mono />
            )}
            {event.file_name && (
              <Detail label="File" value={event.file_name} mono />
            )}
            {event.file_path && (
              <Detail label="Path" value={event.file_path} mono />
            )}
            {event.sha256 && (
              <Detail label="SHA-256" value={event.sha256} mono />
            )}
            {event.username && (
              <Detail label="User" value={event.username} />
            )}
          </div>

          {/* Status actions */}
          {event.status === 'open' && (
            <div className="flex flex-wrap gap-2 pt-1">
              <ActionBtn
                label="Acknowledge"
                icon={Eye}
                color="yellow"
                loading={updating}
                onClick={() => handleStatus('acknowledged')}
              />
              <ActionBtn
                label="Resolve"
                icon={CheckCircle2}
                color="green"
                loading={updating}
                onClick={() => handleStatus('resolved')}
              />
              <ActionBtn
                label="False Positive"
                icon={EyeOff}
                color="slate"
                loading={updating}
                onClick={() => handleStatus('false_positive')}
              />
            </div>
          )}
          {event.status === 'acknowledged' && (
            <div className="flex gap-2 pt-1">
              <ActionBtn
                label="Mark Resolved"
                icon={CheckCircle2}
                color="green"
                loading={updating}
                onClick={() => handleStatus('resolved')}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Detail({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{label}</span>
      <span className={`text-xs text-slate-700 dark:text-slate-300 break-all ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  )
}

function ActionBtn({
  label, icon: Icon, color, loading, onClick,
}: {
  label: string; icon: React.ElementType; color: string; loading: boolean; onClick: () => void
}) {
  const colors: Record<string, string> = {
    yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100 dark:bg-yellow-900/20 dark:text-yellow-300 dark:border-yellow-700',
    green:  'bg-green-50 text-green-700 border-green-200 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-300 dark:border-green-700',
    slate:  'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600',
  }
  return (
    <button
      disabled={loading}
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors disabled:opacity-50 ${colors[color]}`}
    >
      <Icon size={12} />
      {label}
    </button>
  )
}

function Skeleton() {
  return (
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-16 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
      ))}
    </div>
  )
}

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <ShieldAlert size={40} className="text-slate-300 dark:text-slate-600 mb-3" />
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
        {filtered ? 'No events match this filter' : 'No browser security events detected'}
      </p>
      <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
        {filtered ? 'Try clearing the filter.' : 'The agent will report events when the next scan completes.'}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

type Filter = BrowserEventType | 'all'

export default function BrowserSecurity() {
  const [dashboard, setDashboard] = useState<BrowserDashboard | null>(null)
  const [events,    setEvents]    = useState<BrowserSecurityEvent[]>([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)
  const [filter,    setFilter]    = useState<Filter>('all')
  const [statusFilter, setStatusFilter] = useState<string>('open')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [dash, evts] = await Promise.all([
        fetchBrowserDashboard(),
        fetchBrowserEvents({ limit: 200 }),
      ])
      if (!dash || typeof dash.total_open !== 'number') throw new Error('Unexpected response')
      setDashboard(dash)
      setEvents(evts)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleStatusChange(id: number, status: BrowserEventStatus) {
    try {
      const updated = await updateBrowserEventStatus(id, status)
      setEvents(prev => prev.map(e => e.id === id ? updated : e))
      if (dashboard) {
        setDashboard(d => d ? { ...d, total_open: status === 'open' ? d.total_open + 1 : Math.max(0, d.total_open - 1) } : d)
      }
    } catch { /* ignore */ }
  }

  const filtered = events.filter(e => {
    const typeOk   = filter === 'all' || e.event_type === filter
    const statusOk = !statusFilter || e.status === statusFilter
    return typeOk && statusOk
  })

  const noData = !dashboard || typeof dashboard.total_open !== 'number'

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
            <Chrome size={18} className="text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">Browser Security</h1>
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[10px] font-bold uppercase tracking-wide">
                <Crown size={9} /> Premium
              </span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Monitor extensions, password leaks, AI usage, downloads, and malicious sites
            </p>
          </div>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {loading && noData ? (
        <Skeleton />
      ) : noData ? null : (
        <>
          {/* KPI strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Total */}
            <button
              onClick={() => setFilter('all')}
              className={`col-span-1 flex flex-col gap-2 rounded-xl border p-4 text-left transition-all
                ${filter === 'all'
                  ? 'border-brand-blue bg-brand-blue/5 shadow-md dark:bg-brand-blue/10'
                  : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800'
                }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-medium text-slate-500 dark:text-slate-400">Total Open</span>
                <Lock size={16} className="text-slate-400" />
              </div>
              <span className="text-3xl font-black text-slate-900 dark:text-white tabular-nums">
                {dashboard.total_open}
              </span>
            </button>

            {(Object.entries(EVENT_META) as [BrowserEventType, typeof EVENT_META[BrowserEventType]][]).map(
              ([type, meta]) => (
                <KpiCard
                  key={type}
                  label={meta.label}
                  value={dashboard.by_type[type] ?? 0}
                  icon={meta.icon}
                  color={meta.color}
                  active={filter === type}
                  onClick={() => setFilter(f => f === type ? 'all' : type)}
                />
              )
            )}
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SeverityRow by_severity={dashboard.by_severity} />
            <BrowserBar by_browser={dashboard.by_browser} />
          </div>

          {/* Events table */}
          <div className="space-y-3">
            {/* Filters bar */}
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Events</span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {(['open', 'acknowledged', 'resolved', ''] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`px-2.5 py-1 rounded-full text-[12px] font-medium transition-colors
                      ${statusFilter === s
                        ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
                      }`}
                  >
                    {s === '' ? 'All statuses' : s.replace('_', ' ')}
                  </button>
                ))}
              </div>
              <span className="text-[12px] text-slate-400 ml-auto">
                {filtered.length} event{filtered.length !== 1 ? 's' : ''}
              </span>
            </div>

            {filtered.length === 0 ? (
              <EmptyState filtered={filter !== 'all' || statusFilter !== ''} />
            ) : (
              <div className="space-y-2">
                {filtered.map(e => (
                  <EventRow
                    key={e.id}
                    event={e}
                    onStatusChange={handleStatusChange}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
