import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import {
  LayoutDashboard, Building2, Activity, Server,
  RefreshCw, Users, Monitor, Bell, AlertTriangle, CheckCircle2,
  XCircle, Wifi, WifiOff, Clock, ShieldCheck, Search, LogOut,
} from 'lucide-react'
import {
  fetchPlatformOverview, fetchPlatformTenants, fetchPlatformActivity, fetchPlatformSystem,
} from '@/api/platformApi'
import type { PlatformOverview, PlatformTenant, PlatformActivity, PlatformSystem } from '@/api/platformApi'
import { useAuthStore } from '@/store/authStore'

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'tenants' | 'activity' | 'system'

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string | null): string {
  if (!iso) return '—'
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function fmtUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m ${seconds % 60}s`
}

const PLAN_STYLE: Record<string, string> = {
  Free:       'bg-gray-100 text-gray-600',
  Pro:        'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  Enterprise: 'bg-purple-50 text-purple-700 ring-1 ring-purple-200',
}

const ACTION_COLOR: Record<string, string> = {
  LOGIN:    'bg-blue-500',
  REGISTER: 'bg-green-500',
  LOGOUT:   'bg-gray-400',
  DELETE:   'bg-red-500',
  UPDATE:   'bg-amber-500',
  CREATE:   'bg-emerald-500',
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KPICard({
  label, value, sub, icon: Icon, color,
}: {
  label: string
  value: number | string
  sub?: string
  icon: React.ElementType
  color: string
}) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</span>
        <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${color}`}>
          <Icon size={18} className="text-white" />
        </div>
      </div>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

// ── Status Pill ───────────────────────────────────────────────────────────────

function StatusPill({ value }: { value: string }) {
  const ok = value === 'ok'
  const nc = value === 'not configured'
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
      ok ? 'bg-green-100 text-green-700' : nc ? 'bg-gray-100 text-gray-500' : 'bg-red-100 text-red-700'
    }`}>
      {ok ? <CheckCircle2 size={11} /> : nc ? <Clock size={11} /> : <XCircle size={11} />}
      {ok ? 'Healthy' : nc ? 'Not configured' : 'Error'}
    </span>
  )
}

// ── Overview Tab ──────────────────────────────────────────────────────────────

function OverviewTab() {
  const [data, setData] = useState<PlatformOverview | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPlatformOverview().then(setData).finally(() => setLoading(false))
  }, [])

  if (loading) return <Spinner />

  if (!data) return <ErrorMsg msg="Failed to load overview data." />

  const planColors: Record<string, string> = { Free: '#6b7280', Pro: '#3b82f6', Enterprise: '#8b5cf6' }
  const totalByPlan = Object.values(data.plan_distribution).reduce((a, b) => a + b, 0)

  return (
    <div className="space-y-6">
      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <KPICard label="Total Tenants"  value={data.total_tenants}  sub={`${data.active_tenants} active`}      icon={Building2}     color="bg-slate-600" />
        <KPICard label="Users"          value={data.total_users}    sub="across all tenants"                    icon={Users}         color="bg-blue-500" />
        <KPICard label="Agents"         value={data.total_agents}   sub={`${data.online_agents} online`}        icon={Monitor}       color="bg-teal-500" />
        <KPICard label="Alerts Today"   value={data.alerts_today}   sub="all tenants"                           icon={Bell}          color="bg-amber-500" />
        <KPICard label="Critical Today" value={data.critical_today} sub="needs attention"                       icon={AlertTriangle} color="bg-red-500" />
        <KPICard label="Active Rate"    value={`${data.total_tenants ? Math.round(data.active_tenants / data.total_tenants * 100) : 0}%`} sub="tenants active" icon={ShieldCheck} color="bg-green-500" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Signup trend */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">New Tenants — Last 14 Days</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data.signup_trend} barSize={14}>
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} width={24} />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12 }}
                cursor={{ fill: '#f1f5f9' }}
              />
              <Bar dataKey="count" name="Signups" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Alert trend */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Platform Alerts — Last 7 Days</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data.alert_trend} barSize={24}>
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} width={24} />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12 }}
                cursor={{ fill: '#f1f5f9' }}
              />
              <Bar dataKey="count" name="Alerts" radius={[4, 4, 0, 0]}>
                {data.alert_trend.map((_, i) => (
                  <Cell key={i} fill={_ .count > 10 ? '#ef4444' : '#f97316'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Plan distribution */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Plan Distribution</h3>
        <div className="grid grid-cols-3 gap-4">
          {['Free', 'Pro', 'Enterprise'].map((plan) => {
            const count = data.plan_distribution[plan] ?? 0
            const pct = totalByPlan > 0 ? Math.round(count / totalByPlan * 100) : 0
            return (
              <div key={plan} className="text-center p-4 rounded-xl bg-gray-50 border border-gray-100">
                <p className="text-3xl font-bold text-gray-900 mb-1">{count}</p>
                <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${PLAN_STYLE[plan]}`}>{plan}</span>
                <div className="mt-3 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, backgroundColor: planColors[plan] }}
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">{pct}% of tenants</p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Tenants Tab ───────────────────────────────────────────────────────────────

function TenantsTab() {
  const [tenants, setTenants] = useState<PlatformTenant[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [planFilter, setPlanFilter] = useState<string>('All')

  useEffect(() => {
    fetchPlatformTenants().then(setTenants).finally(() => setLoading(false))
  }, [])

  const filtered = tenants.filter((t) => {
    const matchSearch = t.name.toLowerCase().includes(search.toLowerCase())
    const matchPlan = planFilter === 'All' || t.plan === planFilter
    return matchSearch && matchPlan
  })

  if (loading) return <Spinner />

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search tenants…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>
        <div className="flex gap-1.5 bg-gray-100 rounded-xl p-1 w-fit">
          {['All', 'Free', 'Pro', 'Enterprise'].map((p) => (
            <button
              key={p}
              onClick={() => setPlanFilter(p)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                planFilter === p ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-50">
              {['Tenant', 'Plan', 'Status', 'Users', 'Agents', 'Alerts', 'Last Activity', 'Joined'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-12 text-sm text-gray-400">No tenants found.</td>
              </tr>
            ) : (
              filtered.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600 shrink-0">
                        {t.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{t.name}</p>
                        <p className="text-[11px] text-gray-400">ID #{t.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${PLAN_STYLE[t.plan] ?? 'bg-gray-100 text-gray-600'}`}>
                      {t.plan}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                      t.is_active ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
                    }`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${t.is_active ? 'bg-green-500' : 'bg-red-400'}`} />
                      {t.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-sm text-gray-700">{t.user_count}</td>
                  <td className="px-4 py-3.5 text-sm text-gray-700">
                    <span className="flex items-center gap-1">
                      {t.agent_count}
                      {t.online_agents > 0 && (
                        <span className="text-[10px] text-green-600 font-medium">({t.online_agents} online)</span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-sm text-gray-700">{t.alert_count}</td>
                  <td className="px-4 py-3.5 text-xs text-gray-400">{timeAgo(t.last_activity)}</td>
                  <td className="px-4 py-3.5 text-xs text-gray-400">
                    {t.created_at ? new Date(t.created_at).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <div className="px-4 py-2.5 border-t border-gray-50 text-xs text-gray-400">
          {filtered.length} of {tenants.length} tenants
        </div>
      </div>
    </div>
  )
}

// ── Activity Tab ──────────────────────────────────────────────────────────────

function ActivityTab() {
  const [events, setEvents] = useState<PlatformActivity[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    fetchPlatformActivity().then(setEvents).finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return <Spinner />

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Platform Activity Feed</h3>
          <p className="text-xs text-gray-400 mt-0.5">Latest 100 events across all tenants</p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      <div className="divide-y divide-gray-50 max-h-[600px] overflow-y-auto">
        {events.length === 0 ? (
          <p className="text-center py-12 text-sm text-gray-400">No activity recorded yet.</p>
        ) : (
          events.map((e) => (
            <div key={e.id} className="px-5 py-3.5 flex items-start gap-3 hover:bg-gray-50/50 transition-colors">
              <div className={`h-2 w-2 rounded-full mt-1.5 shrink-0 ${ACTION_COLOR[e.action] ?? 'bg-gray-400'}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-gray-900">{e.action}</span>
                  <span className="text-xs text-gray-400">·</span>
                  <span className="text-xs font-medium text-blue-600">{e.tenant_name}</span>
                  {e.user_name && (
                    <>
                      <span className="text-xs text-gray-400">·</span>
                      <span className="text-xs text-gray-500">{e.user_name}</span>
                    </>
                  )}
                </div>
                {e.details && (
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{e.details}</p>
                )}
              </div>
              <span className="text-[11px] text-gray-400 shrink-0 whitespace-nowrap">{timeAgo(e.timestamp)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ── System Tab ────────────────────────────────────────────────────────────────

function SystemTab() {
  const [data, setData] = useState<PlatformSystem | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState(new Date())

  const load = useCallback(() => {
    setLoading(true)
    fetchPlatformSystem()
      .then((d) => { setData(d); setLastRefresh(new Date()) })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(load, 30_000)   // auto-refresh every 30s
    return () => clearInterval(id)
  }, [load])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">System Health</h3>
          <p className="text-xs text-gray-400">Auto-refreshes every 30 seconds</p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          Last: {lastRefresh.toLocaleTimeString()}
        </button>
      </div>

      {/* Overall status banner */}
      {data && (
        <div className={`flex items-center gap-3 px-5 py-4 rounded-2xl ${
          data.status === 'ok' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
        }`}>
          {data.status === 'ok'
            ? <CheckCircle2 size={20} className="text-green-600 shrink-0" />
            : <XCircle size={20} className="text-red-500 shrink-0" />
          }
          <div>
            <p className={`text-sm font-semibold ${data.status === 'ok' ? 'text-green-800' : 'text-red-700'}`}>
              {data.status === 'ok' ? 'All systems operational' : 'System degraded — check details below'}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">Version {data.version} · Uptime {fmtUptime(data.uptime_seconds)}</p>
          </div>
        </div>
      )}

      {/* Service cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'API Server',     icon: Server,   value: data?.status ?? 'ok',             desc: 'FastAPI backend' },
          { label: 'Database',       icon: data?.db === 'ok' ? Wifi : WifiOff, value: data?.db ?? 'ok', desc: 'PostgreSQL' },
          { label: 'Redis / Celery', icon: Activity, value: data?.redis ?? 'not configured',  desc: 'Task broker' },
          { label: 'Uptime',         icon: Clock,    value: 'ok',                              desc: data ? fmtUptime(data.uptime_seconds) : '—' },
        ].map(({ label, icon: Icon, value, desc }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-gray-400 font-medium">{label}</span>
              <Icon size={16} className="text-gray-400" />
            </div>
            <StatusPill value={value} />
            <p className="text-xs text-gray-400 mt-2">{desc}</p>
          </div>
        ))}
      </div>

      {loading && !data && <Spinner />}
    </div>
  )
}

// ── Shared ────────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="flex items-center justify-center py-20 gap-2 text-gray-400">
      <RefreshCw size={16} className="animate-spin" />
      <span className="text-sm">Loading…</span>
    </div>
  )
}

function ErrorMsg({ msg }: { msg: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3 border border-red-200">
      <AlertTriangle size={14} /> {msg}
    </div>
  )
}

// ── Sidebar nav items ─────────────────────────────────────────────────────────

const NAV: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'overview',  label: 'Overview',        icon: LayoutDashboard },
  { id: 'tenants',   label: 'Tenants',          icon: Building2       },
  { id: 'activity',  label: 'Activity Feed',    icon: Activity        },
  { id: 'system',    label: 'System Health',    icon: Server          },
]

// ── Main Component ────────────────────────────────────────────────────────────

export default function PlatformAdmin() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const { logout } = useAuthStore()
  const [tab, setTab] = useState<Tab>('overview')

  const TAB_TITLES: Record<Tab, string> = {
    overview: 'Platform Overview',
    tenants:  'Tenant Registry',
    activity: 'Activity Feed',
    system:   'System Health',
  }

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-[#F3F5F9] flex">
      {/* ── Left Sidebar ─────────────────────────────────────────────────── */}
      <aside className="fixed inset-y-0 left-0 w-60 bg-[#0f172a] text-white flex flex-col z-40">
        {/* Brand */}
        <div className="px-5 py-5 border-b border-white/10">
          <div className="flex items-center gap-2.5 mb-0.5">
            <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
              <ShieldCheck size={16} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-bold tracking-wide text-white">PLATFORM ADMIN</p>
              <p className="text-[10px] text-white/40">SentryXDR Operator Console</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                tab === id
                  ? 'bg-blue-600 text-white'
                  : 'text-white/60 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Icon size={17} />
              {label}
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-4 py-4 border-t border-white/10 space-y-2">
          <div className="flex items-center gap-3 px-3 pt-1">
            <div className="h-7 w-7 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold shrink-0">
              {user?.initials ?? 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-white truncate">{user?.firstName} {user?.lastName}</p>
              <p className="text-[10px] text-white/40 truncate">{user?.email}</p>
            </div>
            <button onClick={handleLogout} title="Sign out"
              className="text-white/40 hover:text-white transition-colors">
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main content ──────────────────────────────────────────────────── */}
      <div className="ml-60 flex-1 min-w-0">
        {/* Top bar */}
        <div className="sticky top-0 z-30 bg-white/80 backdrop-blur border-b border-gray-100 px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold text-gray-900">{TAB_TITLES[tab]}</h1>
            <p className="text-xs text-gray-400">SentryXDR · Operator view</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full ring-1 ring-emerald-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live
            </span>
          </div>
        </div>

        {/* Content */}
        <main className="p-6">
          {tab === 'overview' && <OverviewTab />}
          {tab === 'tenants'  && <TenantsTab />}
          {tab === 'activity' && <ActivityTab />}
          {tab === 'system'   && <SystemTab />}
        </main>
      </div>
    </div>
  )
}
