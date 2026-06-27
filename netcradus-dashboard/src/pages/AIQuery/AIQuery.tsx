import { useState } from 'react'
import {
  Sparkles, Search, AlertTriangle, Shield, ShieldAlert,
  Monitor, Clock, Tag, Loader2, CheckCircle, ChevronRight,
} from 'lucide-react'
import Topbar from '@/components/layout/Topbar/Topbar'
import Card from '@/components/ui/Card/Card'
import Badge from '@/components/ui/Badge/Badge'
import { runNLQuery } from '@/api/aiApi'
import type {
  NLQueryResult,
  NLQueryAlertRow,
  NLQueryIncidentRow,
} from '@/types/api.types'
import type { Severity } from '@/types/dashboard.types'

// ── Example queries ───────────────────────────────────────────────────────────

const EXAMPLES = [
  'Show all Critical alerts in the last 24 hours',
  'Open incidents from the last 7 days',
  'High severity alerts from Windows endpoints',
  'Unresolved alerts related to T1071',
  'All alerts in the last hour',
  'Investigating incidents with Critical severity',
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function incId(id: number) {
  return `INC-${String(id).padStart(5, '0')}`
}

const SEVERITY_CHIP: Record<string, string> = {
  Critical: 'bg-purple-50 text-purple-700',
  High: 'bg-red-50 text-red-600',
  Medium: 'bg-amber-50 text-amber-700',
  Low: 'bg-blue-50 text-blue-700',
  Informational: 'bg-gray-100 text-gray-500',
}

const STATUS_CHIP: Record<string, string> = {
  Open: 'bg-red-50 text-red-600',
  Resolved: 'bg-green-50 text-green-700',
  Investigating: 'bg-amber-50 text-amber-700',
}

// ── Result tables ─────────────────────────────────────────────────────────────

function AlertsTable({ rows }: { rows: NLQueryAlertRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
            <th className="font-medium py-2 pr-4">Title</th>
            <th className="font-medium py-2 pr-4">Severity</th>
            <th className="font-medium py-2 pr-4">Status</th>
            <th className="font-medium py-2 pr-4">Endpoint</th>
            <th className="font-medium py-2 pr-4">OS</th>
            <th className="font-medium py-2 pr-4">MITRE</th>
            <th className="font-medium py-2">Time</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
              <td className="py-3 pr-4 max-w-[220px]">
                <p className="text-gray-900 font-medium truncate">{row.title}</p>
                {row.occurrence_count > 1 && (
                  <span className="text-xs text-gray-400">×{row.occurrence_count}</span>
                )}
              </td>
              <td className="py-3 pr-4">
                <Badge severity={row.severity as Severity} />
              </td>
              <td className="py-3 pr-4">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_CHIP[row.status] ?? 'bg-gray-100 text-gray-500'}`}>
                  {row.status}
                </span>
              </td>
              <td className="py-3 pr-4">
                <div className="flex items-center gap-1 text-xs text-gray-600">
                  <Monitor size={11} className="text-gray-400" />
                  {row.agent_hostname}
                </div>
              </td>
              <td className="py-3 pr-4 text-xs text-gray-500">{row.agent_os || '—'}</td>
              <td className="py-3 pr-4">
                {row.mitre_technique && (
                  <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded">
                    <Tag size={9} />
                    {row.mitre_technique}
                  </span>
                )}
              </td>
              <td className="py-3 text-xs text-gray-400 whitespace-nowrap">
                <div className="flex items-center gap-1">
                  <Clock size={11} />
                  {relTime(row.timestamp)}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function IncidentsTable({ rows }: { rows: NLQueryIncidentRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
            <th className="font-medium py-2 pr-4">ID</th>
            <th className="font-medium py-2 pr-4">Title</th>
            <th className="font-medium py-2 pr-4">Severity</th>
            <th className="font-medium py-2 pr-4">Status</th>
            <th className="font-medium py-2 pr-4">Alerts</th>
            <th className="font-medium py-2 pr-4">MITRE Tactics</th>
            <th className="font-medium py-2">Created</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
              <td className="py-3 pr-4">
                <span className="font-mono text-xs text-gray-500">{incId(row.id)}</span>
              </td>
              <td className="py-3 pr-4 max-w-[220px]">
                <p className="text-gray-900 font-medium truncate">{row.title}</p>
              </td>
              <td className="py-3 pr-4">
                <Badge severity={row.severity as Severity} />
              </td>
              <td className="py-3 pr-4">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_CHIP[row.status] ?? 'bg-gray-100 text-gray-500'}`}>
                  {row.status}
                </span>
              </td>
              <td className="py-3 pr-4">
                <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-gray-100 text-xs font-medium text-gray-700">
                  {row.alert_count}
                </span>
              </td>
              <td className="py-3 pr-4 max-w-[180px]">
                <div className="flex flex-wrap gap-1">
                  {(row.mitre_tactics ?? '').split(',').filter(Boolean).slice(0, 2).map((t) => (
                    <span key={t} className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded truncate max-w-[120px]">
                      {t.trim()}
                    </span>
                  ))}
                </div>
              </td>
              <td className="py-3 text-xs text-gray-400 whitespace-nowrap">
                <div className="flex items-center gap-1">
                  <Clock size={11} />
                  {relTime(row.created_at)}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AIQuery() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<NLQueryResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSearch(q: string = query) {
    const trimmed = q.trim()
    if (!trimmed) return
    setQuery(trimmed)
    setLoading(true)
    setResult(null)
    setError(null)
    try {
      const r = await runNLQuery(trimmed)
      setResult(r)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Query failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="pb-8">
      <Topbar
        title="AI Query"
        subtitle="Ask questions about your security data in plain English"
      />

      <div className="px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Search bar */}
        <div className="max-w-3xl">
          <div className="relative">
            <Sparkles size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-purple-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="e.g. Show all Critical alerts from Windows endpoints in the last 24 hours"
              className="w-full pl-11 pr-28 py-3.5 text-sm border-2 border-purple-200 rounded-xl focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 bg-white shadow-sm"
            />
            <button
              onClick={() => handleSearch()}
              disabled={loading || !query.trim()}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 inline-flex items-center gap-2 px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
            >
              {loading
                ? <Loader2 size={14} className="animate-spin" />
                : <Search size={14} />}
              {loading ? 'Searching…' : 'Search'}
            </button>
          </div>

          {/* Example queries */}
          {!result && !loading && (
            <div className="mt-3 flex flex-wrap gap-2">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  onClick={() => handleSearch(ex)}
                  className="text-xs px-3 py-1.5 rounded-full border border-gray-200 text-gray-500 hover:border-purple-300 hover:text-purple-600 hover:bg-purple-50 transition-colors bg-white"
                >
                  {ex}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <Card>
            <div className="flex items-center gap-2 text-red-500 py-4">
              <AlertTriangle size={16} />
              <span className="text-sm">{error}</span>
            </div>
          </Card>
        )}

        {/* Loading */}
        {loading && (
          <Card>
            <div className="flex items-center justify-center gap-3 py-12 text-purple-400">
              <Loader2 size={20} className="animate-spin" />
              <div>
                <p className="text-sm font-medium">Analysing your query…</p>
                <p className="text-xs text-gray-400 mt-0.5">Claude is extracting filters from your request</p>
              </div>
            </div>
          </Card>
        )}

        {/* Results */}
        {result && !loading && (
          <div className="space-y-4">
            {/* Interpretation bar */}
            <div className="flex items-start gap-3 bg-purple-50 border border-purple-100 rounded-xl px-4 py-3">
              <Sparkles size={15} className="text-purple-500 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-purple-800 font-medium">
                  {result.explanation}
                </p>
                <div className="flex flex-wrap gap-2 mt-1.5">
                  {Object.entries(result.filters_applied).map(([k, v]) =>
                    v != null ? (
                      <span key={k} className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                        {k.replace(/_/g, ' ')}: <strong>{String(v)}</strong>
                      </span>
                    ) : null
                  )}
                </div>
              </div>
              <div className="shrink-0 flex items-center gap-1.5">
                {result.resource === 'alerts'
                  ? <ShieldAlert size={14} className="text-purple-400" />
                  : <Shield size={14} className="text-purple-400" />}
                <span className="text-xs text-purple-500 font-medium capitalize">{result.resource}</span>
              </div>
            </div>

            {/* Result count */}
            <div className="flex items-center gap-2">
              <CheckCircle size={14} className="text-green-500" />
              <span className="text-sm text-gray-600">
                Found <strong>{result.total}</strong> {result.resource}
              </span>
            </div>

            {/* Data table */}
            <Card>
              {result.total === 0 ? (
                <div className="py-12 text-center">
                  <Shield size={28} className="mx-auto text-gray-200 mb-2" />
                  <p className="text-sm text-gray-400">No {result.resource} match your query.</p>
                  <p className="text-xs text-gray-300 mt-1">Try broadening the time range or removing filters.</p>
                </div>
              ) : result.resource === 'alerts' ? (
                <AlertsTable rows={result.results as NLQueryAlertRow[]} />
              ) : (
                <IncidentsTable rows={result.results as NLQueryIncidentRow[]} />
              )}
            </Card>
          </div>
        )}

        {/* Empty state */}
        {!result && !loading && !error && (
          <div className="max-w-xl">
            <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center">
              <Sparkles size={32} className="mx-auto text-purple-200 mb-3" />
              <h3 className="text-sm font-semibold text-gray-700 mb-1">Ask your security data a question</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                AI Query translates plain English into real-time searches across your alerts and incidents.
                No SQL or filter syntax needed.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
