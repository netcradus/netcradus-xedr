import { useEffect, useState, useCallback } from 'react'
import { ShieldAlert, Globe, Flag, CheckCircle, RefreshCw, AlertTriangle } from 'lucide-react'
import Topbar from '@/components/layout/Topbar/Topbar'
import Card from '@/components/ui/Card/Card'
import Badge from '@/components/ui/Badge/Badge'
import { fetchAlerts, resolveAlert, type AlertFilters } from '@/api/alertsApi'
import { fetchAgents } from '@/api/agentsApi'
import type { BackendAlert, BackendAgent } from '@/types/api.types'
import type { Severity } from '@/types/dashboard.types'

type StatusFilter = 'All' | 'Open' | 'Resolved'
type SeverityFilter = 'All' | Severity

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function severityIcon(s: string) {
  if (s === 'Critical' || s === 'High') return ShieldAlert
  if (s === 'Medium') return Globe
  return Flag
}

const SEVERITY_ORDER: Record<string, number> = {
  Critical: 0, High: 1, Medium: 2, Low: 3, Informational: 4,
}

export default function Alerts() {
  const [alerts, setAlerts] = useState<BackendAlert[]>([])
  const [agentMap, setAgentMap] = useState<Map<number, BackendAgent>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All')
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('All')
  const [resolvingId, setResolvingId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const filters: AlertFilters = {}
      if (statusFilter !== 'All') filters.status = statusFilter
      if (severityFilter !== 'All') filters.severity = severityFilter
      const [rawAlerts, agents] = await Promise.all([fetchAlerts(filters), fetchAgents()])
      const sorted = [...rawAlerts].sort(
        (a, b) =>
          (SEVERITY_ORDER[a.severity] ?? 99) - (SEVERITY_ORDER[b.severity] ?? 99) ||
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )
      setAlerts(sorted)
      setAgentMap(new Map(agents.map((ag) => [ag.id, ag])))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load alerts')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, severityFilter])

  useEffect(() => { load() }, [load])

  async function handleResolve(id: number) {
    setResolvingId(id)
    try {
      await resolveAlert(id)
      setAlerts((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: 'Resolved' } : a))
      )
    } catch {
      // silently keep state — user sees no change
    } finally {
      setResolvingId(null)
    }
  }

  const filtered = alerts  // filtering is now done server-side

  const openCount = alerts.filter((a) => a.status === 'Open').length
  const criticalCount = alerts.filter((a) => a.severity === 'Critical' && a.status === 'Open').length

  return (
    <div className="pb-8">
      <Topbar
        title="Alerts"
        subtitle={`${openCount} open alerts · ${criticalCount} critical`}
        onRefresh={load}
      />

      <div className="px-4 sm:px-6 lg:px-8 space-y-4">
        {/* Summary strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(['Critical', 'High', 'Medium', 'Low'] as Severity[]).map((sev) => {
            const count = alerts.filter((a) => a.severity === sev && a.status === 'Open').length
            const colorMap: Record<string, string> = {
              Critical: 'border-purple-200 bg-purple-50',
              High: 'border-red-200 bg-red-50',
              Medium: 'border-amber-200 bg-amber-50',
              Low: 'border-green-200 bg-green-50',
            }
            const textMap: Record<string, string> = {
              Critical: 'text-purple-700', High: 'text-red-600',
              Medium: 'text-amber-600', Low: 'text-green-600',
            }
            return (
              <div key={sev} className={`rounded-lg border p-3 ${colorMap[sev]}`}>
                <p className={`text-2xl font-bold ${textMap[sev]}`}>{count}</p>
                <p className="text-xs text-gray-500 mt-0.5">{sev} (Open)</p>
              </div>
            )
          })}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
            {(['All', 'Open', 'Resolved'] as StatusFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`px-4 py-2 transition-colors ${
                  statusFilter === f
                    ? 'bg-gray-900 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value as SeverityFilter)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="All">All Severities</option>
            {(['Critical', 'High', 'Medium', 'Low'] as Severity[]).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <span className="ml-auto text-sm text-gray-400">{filtered.length} results</span>
        </div>

        {/* Table */}
        <Card>
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-2 text-gray-400">
              <RefreshCw size={16} className="animate-spin" />
              <span className="text-sm">Loading alerts…</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-red-500">
              <AlertTriangle size={20} />
              <p className="text-sm">{error}</p>
              <button onClick={load} className="text-xs underline mt-1">Retry</button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-gray-400 text-sm">No alerts match the current filters.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                    <th className="font-medium py-2 pr-4">Alert</th>
                    <th className="font-medium py-2 pr-4">Endpoint</th>
                    <th className="font-medium py-2 pr-4">Severity</th>
                    <th className="font-medium py-2 pr-4">MITRE</th>
                    <th className="font-medium py-2 pr-4">Occurrences</th>
                    <th className="font-medium py-2 pr-4">Time</th>
                    <th className="font-medium py-2 pr-4">Status</th>
                    <th className="font-medium py-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((alert) => {
                    const Icon = severityIcon(alert.severity)
                    const agent = agentMap.get(alert.agent_id)
                    const isOpen = alert.status === 'Open'
                    return (
                      <tr key={alert.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
                        <td className="py-3 pr-4">
                          <div className="flex items-start gap-3 min-w-0">
                            <span className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 bg-red-50 text-red-500">
                              <Icon size={15} />
                            </span>
                            <div className="min-w-0">
                              <p className="font-medium text-gray-900 truncate max-w-[220px]">{alert.title}</p>
                              <p className="text-xs text-gray-400 truncate max-w-[220px]">{alert.description}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 pr-4 text-gray-600 whitespace-nowrap">
                          {agent?.hostname ?? `Agent #${alert.agent_id}`}
                        </td>
                        <td className="py-3 pr-4">
                          <Badge severity={alert.severity as Severity} />
                        </td>
                        <td className="py-3 pr-4 text-gray-500 text-xs whitespace-nowrap">
                          {alert.mitre_technique || '—'}
                        </td>
                        <td className="py-3 pr-4 text-center text-gray-600">
                          {alert.occurrence_count}
                        </td>
                        <td className="py-3 pr-4 text-gray-400 whitespace-nowrap text-xs">
                          {formatTime(alert.timestamp)}
                        </td>
                        <td className="py-3 pr-4">
                          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                            isOpen
                              ? 'bg-red-50 text-red-600'
                              : 'bg-green-50 text-green-600'
                          }`}>
                            {alert.status}
                          </span>
                        </td>
                        <td className="py-3">
                          {isOpen ? (
                            <button
                              onClick={() => handleResolve(alert.id)}
                              disabled={resolvingId === alert.id}
                              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 disabled:opacity-50 transition-colors"
                            >
                              <CheckCircle size={13} />
                              {resolvingId === alert.id ? 'Resolving…' : 'Resolve'}
                            </button>
                          ) : (
                            <span className="text-xs text-gray-300">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
