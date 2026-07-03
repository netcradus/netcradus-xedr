import { useEffect, useState, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  ShieldAlert, Globe, Flag, CheckCircle, RefreshCw, AlertTriangle,
  Search, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown,
  X,
} from 'lucide-react'
import Topbar from '@/components/layout/Topbar/Topbar'
import Card from '@/components/ui/Card/Card'
import Badge from '@/components/ui/Badge/Badge'
import { fetchAlerts, fetchAlertStats, resolveAlert } from '@/api/alertsApi'
import { fetchAgents } from '@/api/agentsApi'
import type { BackendAlert, BackendAgent, AlertStats } from '@/types/api.types'
import type { Severity } from '@/types/dashboard.types'
import type { AlertFilters } from '@/api/alertsApi'

// ── Constants ─────────────────────────────────────────────────────────────────

const PAGE_SIZES = [25, 50, 100] as const
type PageSize = (typeof PAGE_SIZES)[number]

type SortCol = 'timestamp' | 'severity' | 'title' | 'status'
type SortDir = 'asc' | 'desc'

const SEV_COLORS: Record<string, { border: string; bg: string; text: string }> = {
  Critical: { border: 'border-purple-200', bg: 'bg-purple-50', text: 'text-purple-700' },
  High:     { border: 'border-red-200',    bg: 'bg-red-50',    text: 'text-red-600'    },
  Medium:   { border: 'border-amber-200',  bg: 'bg-amber-50',  text: 'text-amber-600'  },
  Low:      { border: 'border-green-200',  bg: 'bg-green-50',  text: 'text-green-600'  },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function severityIcon(s: string) {
  if (s === 'Critical' || s === 'High') return ShieldAlert
  if (s === 'Medium') return Globe
  return Flag
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function pageNumbers(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  if (current <= 4) return [1, 2, 3, 4, 5, '…', total]
  if (current >= total - 3) return [1, '…', total - 4, total - 3, total - 2, total - 1, total]
  return [1, '…', current - 1, current, current + 1, '…', total]
}

// ── Sort header ───────────────────────────────────────────────────────────────

function SortTh({
  col, label, active, dir, onSort,
}: {
  col: SortCol; label: string; active: boolean; dir: SortDir; onSort: (c: SortCol) => void
}) {
  const Icon = active ? (dir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown
  return (
    <th
      className="font-medium py-2 pr-4 cursor-pointer select-none whitespace-nowrap group"
      onClick={() => onSort(col)}
    >
      <span className="inline-flex items-center gap-1 text-gray-400 hover:text-gray-600 transition-colors">
        {label}
        <Icon size={12} className={active ? 'text-blue-500' : 'opacity-40 group-hover:opacity-80'} />
      </span>
    </th>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Alerts() {
  const [searchParams, setSearchParams] = useSearchParams()

  // ── Filter state from URL ─────────────────────────────────────────────────
  const getParam = (k: string, fallback = '') => searchParams.get(k) ?? fallback
  const getNum   = (k: string, fallback: number) => Number(searchParams.get(k) ?? fallback)

  const [search,    setSearch]    = useState(getParam('search'))
  const [status,    setStatus]    = useState(getParam('status'))
  const [severity,  setSeverity]  = useState(getParam('severity'))
  const [fromDate,  setFromDate]  = useState(getParam('from_date'))
  const [toDate,    setToDate]    = useState(getParam('to_date'))
  const [agentId,   setAgentId]   = useState<number | undefined>(
    searchParams.has('agent_id') ? Number(searchParams.get('agent_id')) : undefined
  )
  const [mitre,     setMitre]     = useState(getParam('mitre'))
  const [sortBy,    setSortBy]    = useState<SortCol>((getParam('sort_by', 'timestamp')) as SortCol)
  const [sortDir,   setSortDir]   = useState<SortDir>((getParam('sort_dir', 'desc')) as SortDir)
  const [pageSize,  setPageSize]  = useState<PageSize>((getNum('limit', 25)) as PageSize)
  const [page,      setPage]      = useState(Math.max(1, getNum('page', 1)))

  // ── Data state ────────────────────────────────────────────────────────────
  const [items,     setItems]     = useState<BackendAlert[]>([])
  const [total,     setTotal]     = useState(0)
  const [stats,     setStats]     = useState<AlertStats | null>(null)
  const [agents,    setAgents]    = useState<BackendAgent[]>([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)
  const [resolvingId, setResolvingId] = useState<number | null>(null)

  // ── Debounce search ───────────────────────────────────────────────────────
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [debouncedSearch, setDebouncedSearch] = useState(search)

  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current)
    searchDebounce.current = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 300)
    return () => { if (searchDebounce.current) clearTimeout(searchDebounce.current) }
  }, [search])

  // ── Sync URL params ───────────────────────────────────────────────────────
  useEffect(() => {
    const p: Record<string, string> = {}
    if (debouncedSearch) p.search    = debouncedSearch
    if (status)          p.status    = status
    if (severity)        p.severity  = severity
    if (fromDate)        p.from_date = fromDate
    if (toDate)          p.to_date   = toDate
    if (agentId != null) p.agent_id  = String(agentId)
    if (mitre)           p.mitre     = mitre
    p.sort_by  = sortBy
    p.sort_dir = sortDir
    p.limit    = String(pageSize)
    p.page     = String(page)
    setSearchParams(p, { replace: true })
  }, [debouncedSearch, status, severity, fromDate, toDate, agentId, mitre, sortBy, sortDir, pageSize, page, setSearchParams])

  // ── Load agents + stats once (not affected by filters) ───────────────────
  useEffect(() => {
    fetchAgents().then(setAgents).catch(() => {})
    fetchAlertStats().then(setStats).catch(() => {})
  }, [])

  // ── Fetch alerts ──────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const filters: AlertFilters = {
      offset:   (page - 1) * pageSize,
      limit:    pageSize,
      sort_by:  sortBy,
      sort_dir: sortDir,
    }
    if (debouncedSearch) filters.search          = debouncedSearch
    if (status)          filters.status          = status
    if (severity)        filters.severity        = severity
    if (fromDate)        filters.from_date       = fromDate
    if (toDate)          filters.to_date         = toDate
    if (agentId != null) filters.agent_id        = agentId
    if (mitre)           filters.mitre_technique = mitre

    try {
      const data = await fetchAlerts(filters)
      setItems(data.items)
      setTotal(data.total)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load alerts')
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, status, severity, fromDate, toDate, agentId, mitre, sortBy, sortDir, pageSize, page])

  useEffect(() => { load() }, [load])

  // ── Derived ───────────────────────────────────────────────────────────────
  const totalPages  = Math.max(1, Math.ceil(total / pageSize))
  const openCount   = items.filter((a) => a.status === 'Open').length
  const showingFrom = total === 0 ? 0 : (page - 1) * pageSize + 1
  const showingTo   = Math.min(page * pageSize, total)

  const hasFilters = !!(debouncedSearch || status || severity || fromDate || toDate || agentId != null || mitre)

  function clearFilters() {
    setSearch(''); setStatus(''); setSeverity(''); setFromDate('')
    setToDate(''); setAgentId(undefined); setMitre(''); setPage(1)
  }

  function handleSort(col: SortCol) {
    if (col === sortBy) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
    } else {
      setSortBy(col)
      setSortDir('desc')
    }
    setPage(1)
  }

  async function handleResolve(id: number) {
    setResolvingId(id)
    try {
      await resolveAlert(id)
      setItems((prev) => prev.map((a) => a.id === id ? { ...a, status: 'Resolved' } : a))
    } catch {
      // keep state
    } finally {
      setResolvingId(null)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="pb-8">
      <Topbar
        title="Alerts"
        subtitle={`${total.toLocaleString()} total · ${openCount} open on this page`}
        onRefresh={load}
      />

      <div className="px-4 sm:px-6 lg:px-8 space-y-4">

        {/* Severity summary strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(['Critical', 'High', 'Medium', 'Low'] as Severity[]).map((sev) => {
            const c = SEV_COLORS[sev]
            const active = severity === sev
            const count = stats?.[sev.toLowerCase() as keyof AlertStats] ?? '—'
            return (
              <button
                key={sev}
                onClick={() => { setSeverity(active ? '' : sev); setPage(1) }}
                className={`rounded-lg border p-3 text-left transition-all
                  ${c.border} ${c.bg}
                  ${active ? 'ring-2 ring-offset-1 ring-blue-500' : 'hover:brightness-95'}`}
              >
                <p className={`text-2xl font-bold ${c.text}`}>{count}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {sev}{active ? ' ✕' : ''}
                </p>
              </button>
            )
          })}
        </div>

        {/* Filter bar */}
        <Card>
          <div className="flex flex-wrap gap-3 items-end p-1">

            {/* Search */}
            <div className="relative flex-1 min-w-[180px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search title or description…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Status */}
            <select
              value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(1) }}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Statuses</option>
              <option value="Open">Open</option>
              <option value="Resolved">Resolved</option>
            </select>

            {/* Severity */}
            <select
              value={severity}
              onChange={(e) => { setSeverity(e.target.value); setPage(1) }}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Severities</option>
              {(['Critical', 'High', 'Medium', 'Low'] as Severity[]).map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            {/* Agent */}
            <select
              value={agentId ?? ''}
              onChange={(e) => { setAgentId(e.target.value ? Number(e.target.value) : undefined); setPage(1) }}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Endpoints</option>
              {agents.map((ag) => (
                <option key={ag.id} value={ag.id}>{ag.hostname}</option>
              ))}
            </select>

            {/* Date range */}
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={fromDate}
                onChange={(e) => { setFromDate(e.target.value); setPage(1) }}
                className="text-sm border border-gray-200 rounded-lg px-2 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                title="From date"
              />
              <span className="text-gray-400 text-xs">→</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => { setToDate(e.target.value); setPage(1) }}
                className="text-sm border border-gray-200 rounded-lg px-2 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                title="To date"
              />
            </div>

            {/* MITRE */}
            <input
              type="text"
              placeholder="MITRE (e.g. T1059)"
              value={mitre}
              onChange={(e) => { setMitre(e.target.value); setPage(1) }}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white w-36 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            {/* Clear filters */}
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                <X size={13} /> Clear
              </button>
            )}
          </div>
        </Card>

        {/* Table */}
        <Card>
          {loading ? (
            <div className="flex items-center justify-center py-20 gap-2 text-gray-400">
              <RefreshCw size={16} className="animate-spin" />
              <span className="text-sm">Loading…</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20 gap-2 text-red-500">
              <AlertTriangle size={20} />
              <p className="text-sm">{error}</p>
              <button onClick={load} className="text-xs underline mt-1">Retry</button>
            </div>
          ) : items.length === 0 ? (
            <div className="py-20 text-center text-gray-400 text-sm">
              No alerts match the current filters.
              {hasFilters && (
                <button onClick={clearFilters} className="ml-2 underline text-blue-500">Clear filters</button>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs border-b border-gray-100">
                      <SortTh col="title"     label="Alert"       active={sortBy === 'title'}     dir={sortDir} onSort={handleSort} />
                      <th className="font-medium py-2 pr-4 text-gray-400 whitespace-nowrap">Endpoint</th>
                      <SortTh col="severity"  label="Severity"    active={sortBy === 'severity'}  dir={sortDir} onSort={handleSort} />
                      <th className="font-medium py-2 pr-4 text-gray-400 whitespace-nowrap">MITRE</th>
                      <th className="font-medium py-2 pr-4 text-gray-400 whitespace-nowrap text-center">Hits</th>
                      <SortTh col="timestamp" label="Time"        active={sortBy === 'timestamp'} dir={sortDir} onSort={handleSort} />
                      <SortTh col="status"    label="Status"      active={sortBy === 'status'}    dir={sortDir} onSort={handleSort} />
                      <th className="font-medium py-2 text-gray-400">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((alert) => {
                      const Icon   = severityIcon(alert.severity)
                      const isOpen = alert.status === 'Open'
                      return (
                        <tr
                          key={alert.id}
                          className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors"
                        >
                          {/* Alert */}
                          <td className="py-3 pr-4">
                            <div className="flex items-start gap-3 min-w-0">
                              <span className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                                alert.severity === 'Critical' ? 'bg-purple-50 text-purple-500'
                                : alert.severity === 'High'   ? 'bg-red-50 text-red-500'
                                : alert.severity === 'Medium' ? 'bg-amber-50 text-amber-500'
                                : 'bg-green-50 text-green-500'
                              }`}>
                                <Icon size={15} />
                              </span>
                              <div className="min-w-0">
                                <p className="font-medium text-gray-900 truncate max-w-[240px]">{alert.title}</p>
                                <p className="text-xs text-gray-400 truncate max-w-[240px]">{alert.description}</p>
                              </div>
                            </div>
                          </td>

                          {/* Endpoint */}
                          <td className="py-3 pr-4 text-gray-600 whitespace-nowrap text-xs">
                            {alert.agent_hostname ?? `Agent #${alert.agent_id}`}
                          </td>

                          {/* Severity */}
                          <td className="py-3 pr-4">
                            <Badge severity={alert.severity as Severity} />
                          </td>

                          {/* MITRE */}
                          <td className="py-3 pr-4 text-gray-500 text-xs whitespace-nowrap">
                            {alert.mitre_technique
                              ? <button
                                  onClick={() => { setMitre(alert.mitre_technique!); setPage(1) }}
                                  className="hover:text-blue-600 hover:underline transition-colors"
                                  title="Filter by this technique"
                                >
                                  {alert.mitre_technique}
                                </button>
                              : '—'
                            }
                          </td>

                          {/* Hits */}
                          <td className="py-3 pr-4 text-center text-gray-600 text-xs">
                            {alert.occurrence_count > 1
                              ? <span className="px-1.5 py-0.5 rounded bg-gray-100 font-medium">{alert.occurrence_count}×</span>
                              : alert.occurrence_count}
                          </td>

                          {/* Time */}
                          <td className="py-3 pr-4 text-gray-400 whitespace-nowrap text-xs">
                            {fmt(alert.timestamp)}
                          </td>

                          {/* Status */}
                          <td className="py-3 pr-4">
                            <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${
                              isOpen ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
                            }`}>
                              {alert.status}
                            </span>
                          </td>

                          {/* Action */}
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

              {/* Pagination footer */}
              <div className="flex flex-wrap items-center justify-between gap-3 px-1 pt-4 border-t border-gray-100 mt-2">
                <p className="text-xs text-gray-400">
                  Showing <span className="font-medium text-gray-600">{showingFrom}–{showingTo}</span> of{' '}
                  <span className="font-medium text-gray-600">{total.toLocaleString()}</span> alerts
                </p>

                <div className="flex items-center gap-3">
                  {/* Page size */}
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <span>Rows</span>
                    <select
                      value={pageSize}
                      onChange={(e) => { setPageSize(Number(e.target.value) as PageSize); setPage(1) }}
                      className="border border-gray-200 rounded px-1.5 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>

                  {/* Page numbers */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronLeft size={14} />
                    </button>

                    {pageNumbers(page, totalPages).map((n, i) =>
                      n === '…' ? (
                        <span key={`ellipsis-${i}`} className="px-1 text-gray-400 text-xs">…</span>
                      ) : (
                        <button
                          key={n}
                          onClick={() => setPage(n as number)}
                          className={`min-w-[28px] h-7 rounded text-xs font-medium transition-colors ${
                            page === n
                              ? 'bg-gray-900 text-white'
                              : 'hover:bg-gray-100 text-gray-600'
                          }`}
                        >
                          {n}
                        </button>
                      )
                    )}

                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
