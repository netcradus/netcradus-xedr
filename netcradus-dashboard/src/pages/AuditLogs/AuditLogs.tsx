import { useEffect, useState, useCallback } from 'react'
import { ClipboardList, RefreshCw, AlertTriangle, Clock, User, Filter } from 'lucide-react'
import Topbar from '@/components/layout/Topbar/Topbar'
import Card from '@/components/ui/Card/Card'
import { fetchAuditLogs } from '@/api/reportsApi'
import type { AuditLogEntry } from '@/types/api.types'

// ── Action label + colour ─────────────────────────────────────────────────────

const ACTION_META: Record<string, { label: string; colour: string }> = {
  LOGIN:                   { label: 'Login',                colour: 'bg-green-50 text-green-700' },
  LOGOUT:                  { label: 'Logout',               colour: 'bg-gray-100 text-gray-600' },
  RESOLVE_ALERT:           { label: 'Alert Resolved',       colour: 'bg-blue-50 text-blue-700' },
  UPDATE_INCIDENT_STATUS:  { label: 'Incident Updated',     colour: 'bg-amber-50 text-amber-700' },
  EXECUTE_COMMAND:         { label: 'SOAR Command',         colour: 'bg-purple-50 text-purple-700' },
  INVITE_USER:             { label: 'User Invited',         colour: 'bg-teal-50 text-teal-700' },
  UPDATE_ORG:              { label: 'Org Updated',          colour: 'bg-indigo-50 text-indigo-700' },
  UPDATE_ROLE:             { label: 'Role Changed',         colour: 'bg-orange-50 text-orange-600' },
}

const ALL_ACTIONS = Object.keys(ACTION_META)

function ActionBadge({ action }: { action: string }) {
  const meta = ACTION_META[action] ?? { label: action, colour: 'bg-gray-100 text-gray-600' }
  return (
    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${meta.colour}`}>
      {meta.label}
    </span>
  )
}

// ── Resource label ────────────────────────────────────────────────────────────

function ResourceChip({ type, id }: { type: string | null; id: number | null }) {
  if (!type) return <span className="text-gray-300">—</span>
  return (
    <span className="text-xs text-gray-500">
      {type}{id ? ` #${id}` : ''}
    </span>
  )
}

// ── Relative time ─────────────────────────────────────────────────────────────

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const secs = Math.floor(diff / 1000)
  if (secs < 60) return 'just now'
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return new Date(iso).toLocaleDateString()
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AuditLogs() {
  const [logs, setLogs]         = useState<AuditLogEntry[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [actionFilter, setActionFilter] = useState('')
  const [search, setSearch]     = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchAuditLogs(actionFilter ? { action: actionFilter } : undefined)
      setLogs(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load audit logs')
    } finally {
      setLoading(false)
    }
  }, [actionFilter])

  useEffect(() => { load() }, [load])

  const filtered = search
    ? logs.filter((l) =>
        (l.user_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (l.details ?? '').toLowerCase().includes(search.toLowerCase()) ||
        l.action.toLowerCase().includes(search.toLowerCase())
      )
    : logs

  return (
    <div className="pb-8">
      <Topbar
        title="Audit Logs"
        subtitle={`${logs.length} events · immutable activity record`}
        onRefresh={load}
      />

      <div className="px-4 sm:px-6 lg:px-8 space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 bg-white">
            <Filter size={13} className="text-gray-400" />
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="text-sm text-gray-700 bg-transparent focus:outline-none"
            >
              <option value="">All actions</option>
              {ALL_ACTIONS.map((a) => (
                <option key={a} value={a}>{ACTION_META[a].label}</option>
              ))}
            </select>
          </div>

          <input
            type="text"
            placeholder="Search user, details…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 w-52 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <span className="ml-auto text-sm text-gray-400">{filtered.length} entries</span>
        </div>

        {/* Table */}
        <Card>
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-2 text-gray-400">
              <RefreshCw size={15} className="animate-spin" />
              <span className="text-sm">Loading audit log…</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-red-500">
              <AlertTriangle size={18} />
              <p className="text-sm">{error}</p>
              <button onClick={load} className="text-xs underline">Retry</button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <ClipboardList size={28} className="text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No audit events yet.</p>
              <p className="text-xs text-gray-300 mt-1">
                Events are recorded as your team takes actions in SentryXDR.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                    <th className="font-medium py-2 pr-4 w-36">Time</th>
                    <th className="font-medium py-2 pr-4 w-28">User</th>
                    <th className="font-medium py-2 pr-4 w-40">Action</th>
                    <th className="font-medium py-2 pr-4 w-32">Resource</th>
                    <th className="font-medium py-2">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((log) => (
                    <tr key={log.id}
                      className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
                      <td className="py-3 pr-4 text-gray-400 text-xs">
                        <div className="flex items-center gap-1">
                          <Clock size={11} />
                          <span title={log.timestamp}>{relTime(log.timestamp)}</span>
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-1.5">
                          <User size={12} className="text-gray-400 shrink-0" />
                          <span className="text-gray-700 text-xs truncate max-w-[100px]">
                            {log.user_name ?? 'System'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <ActionBadge action={log.action} />
                      </td>
                      <td className="py-3 pr-4">
                        <ResourceChip type={log.resource_type} id={log.resource_id} />
                      </td>
                      <td className="py-3 text-xs text-gray-500 max-w-xs truncate">
                        {log.details ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
