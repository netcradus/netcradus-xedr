import { useEffect, useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell, CartesianGrid,
} from 'recharts'
import {
  LayoutDashboard, Building2, Activity, Server, DollarSign,
  RefreshCw, Users, Monitor, Bell, AlertTriangle, CheckCircle2,
  XCircle, Wifi, WifiOff, Clock, ShieldCheck, Search, LogOut,
  TrendingUp, TrendingDown, Minus, ChevronUp, ChevronDown,
  Zap, Globe, Database, Headphones, MessageSquare, ChevronRight,
  Send, X,
} from 'lucide-react'
import {
  fetchPlatformOverview, fetchPlatformTenants, fetchPlatformActivity,
  fetchPlatformSystem, fetchPlatformSupport, updateTicketStatus,
} from '@/api/platformApi'
import type {
  PlatformOverview, PlatformTenant, PlatformActivity, PlatformSystem, PlatformSupportTicket,
} from '@/api/platformApi'
import { useAuthStore } from '@/store/authStore'

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'revenue' | 'tenants' | 'activity' | 'system' | 'support'
type SortKey = keyof PlatformTenant
type SortDir = 'asc' | 'desc'

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

function fmtMRR(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`
  return `$${n}`
}

const PLAN_STYLE: Record<string, string> = {
  Free:       'bg-gray-100 text-gray-600',
  Pro:        'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  Enterprise: 'bg-purple-50 text-purple-700 ring-1 ring-purple-200',
}

const PLAN_COLOR: Record<string, string> = {
  Free: '#6b7280',
  Pro: '#3b82f6',
  Enterprise: '#8b5cf6',
}

const ACTION_STYLE: Record<string, string> = {
  LOGIN:    'bg-blue-100 text-blue-700',
  REGISTER: 'bg-green-100 text-green-700',
  LOGOUT:   'bg-gray-100 text-gray-600',
  DELETE:   'bg-red-100 text-red-700',
  UPDATE:   'bg-amber-100 text-amber-700',
  CREATE:   'bg-emerald-100 text-emerald-700',
  EXPORT:   'bg-indigo-100 text-indigo-700',
}

// ── Shared Components ─────────────────────────────────────────────────────────

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

function PlanBadge({ plan }: { plan: string }) {
  return (
    <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${PLAN_STYLE[plan] ?? 'bg-gray-100 text-gray-600'}`}>
      {plan}
    </span>
  )
}

function TenantAvatar({ name }: { name: string }) {
  return (
    <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center text-xs font-bold text-slate-700 shrink-0">
      {name.slice(0, 2).toUpperCase()}
    </div>
  )
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KPICard({
  label, value, sub, icon: Icon, color, trend,
}: {
  label: string
  value: number | string
  sub?: string
  icon: React.ElementType
  color: string
  trend?: { pct: number; label: string }
}) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</span>
        <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${color}`}>
          <Icon size={17} className="text-white" />
        </div>
      </div>
      <div>
        <p className="text-3xl font-bold text-gray-900 leading-none">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-1.5">{sub}</p>}
      </div>
      {trend && (
        <div className={`flex items-center gap-1 text-xs font-medium ${
          trend.pct > 0 ? 'text-green-600' : trend.pct < 0 ? 'text-red-500' : 'text-gray-400'
        }`}>
          {trend.pct > 0 ? <TrendingUp size={12} /> : trend.pct < 0 ? <TrendingDown size={12} /> : <Minus size={12} />}
          {trend.pct > 0 ? '+' : ''}{trend.pct}% {trend.label}
        </div>
      )}
    </div>
  )
}

// ── Overview Tab ──────────────────────────────────────────────────────────────

function OverviewTab() {
  const [data, setData] = useState<PlatformOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetchPlatformOverview()
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <Spinner />
  if (error || !data) return <ErrorMsg msg="Failed to load overview data." />

  const totalByPlan = Object.values(data.plan_distribution).reduce((a, b) => a + b, 0)
  const agentOnlinePct = data.total_agents > 0 ? Math.round(data.online_agents / data.total_agents * 100) : 0

  return (
    <div className="space-y-6">
      {/* KPI grid — row 1 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KPICard
          label="Total Tenants" value={data.total_tenants}
          sub={`${data.active_tenants} active · ${data.inactive_tenants} inactive`}
          icon={Building2} color="bg-slate-600"
          trend={{ pct: data.growth_pct, label: 'vs last month' }}
        />
        <KPICard
          label="Users" value={data.total_users}
          sub="across all tenants"
          icon={Users} color="bg-blue-500"
        />
        <KPICard
          label="Agents" value={data.total_agents}
          sub={`${data.online_agents} online (${agentOnlinePct}%)`}
          icon={Monitor} color="bg-teal-500"
        />
        <KPICard
          label="MRR Estimate" value={fmtMRR(data.mrr_estimate)}
          sub="based on paid plans"
          icon={DollarSign} color="bg-emerald-600"
          trend={{ pct: data.growth_pct, label: 'growth' }}
        />
      </div>

      {/* KPI grid — row 2 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KPICard
          label="New This Month" value={data.new_this_month}
          sub={`${data.new_last_month} last month`}
          icon={TrendingUp} color="bg-indigo-500"
        />
        <KPICard
          label="Alerts Today" value={data.alerts_today}
          sub="across all tenants"
          icon={Bell} color="bg-amber-500"
        />
        <KPICard
          label="Critical Today" value={data.critical_today}
          sub="needs attention"
          icon={AlertTriangle} color="bg-red-500"
        />
        <KPICard
          label="Total Alerts" value={data.total_alerts}
          sub="all time"
          icon={Zap} color="bg-orange-500"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-1">New Tenant Signups — 14 Days</h3>
          <p className="text-xs text-gray-400 mb-4">Daily tenant registrations across the platform</p>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={data.signup_trend}>
              <defs>
                <linearGradient id="signupGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} interval={2} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} width={24} />
              <Tooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12 }} />
              <Area type="monotone" dataKey="count" name="Signups" stroke="#3b82f6" strokeWidth={2} fill="url(#signupGrad)" dot={false} activeDot={{ r: 4 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-1">Platform Alerts — 14 Days</h3>
          <p className="text-xs text-gray-400 mb-4">Total alerts generated across all tenants</p>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={data.alert_trend}>
              <defs>
                <linearGradient id="alertGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f97316" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} interval={2} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} width={24} />
              <Tooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12 }} />
              <Area type="monotone" dataKey="count" name="Alerts" stroke="#f97316" strokeWidth={2} fill="url(#alertGrad)" dot={false} activeDot={{ r: 4 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom row — Recent signups + Top tenants */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent signups */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Recent Signups</h3>
          <div className="space-y-3">
            {data.recent_signups.length === 0 ? (
              <p className="text-xs text-gray-400">No signups yet.</p>
            ) : data.recent_signups.map((t) => (
              <div key={t.id} className="flex items-center gap-3">
                <TenantAvatar name={t.name} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{t.name}</p>
                  <p className="text-[11px] text-gray-400">{timeAgo(t.created_at)}</p>
                </div>
                <PlanBadge plan={t.plan} />
              </div>
            ))}
          </div>
        </div>

        {/* Top by alerts */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Most Active by Alerts</h3>
          <div className="space-y-3">
            {data.top_tenants_by_alerts.map((t, i) => (
              <div key={t.id} className="flex items-center gap-3">
                <span className="text-xs font-bold text-gray-300 w-4 text-right shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{t.name}</p>
                  <p className="text-[11px] text-gray-400">{t.alert_count} alerts</p>
                </div>
                <PlanBadge plan={t.plan} />
              </div>
            ))}
            {data.top_tenants_by_alerts.length === 0 && (
              <p className="text-xs text-gray-400">No alert data.</p>
            )}
          </div>
        </div>

        {/* Top by users */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Largest Tenants by Users</h3>
          <div className="space-y-3">
            {data.top_tenants_by_users.map((t, i) => (
              <div key={t.id} className="flex items-center gap-3">
                <span className="text-xs font-bold text-gray-300 w-4 text-right shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{t.name}</p>
                  <p className="text-[11px] text-gray-400">{t.user_count} users</p>
                </div>
                <PlanBadge plan={t.plan} />
              </div>
            ))}
            {data.top_tenants_by_users.length === 0 && (
              <p className="text-xs text-gray-400">No user data.</p>
            )}
          </div>
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
              <div key={plan} className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                <div className="flex items-center justify-between mb-3">
                  <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${PLAN_STYLE[plan]}`}>{plan}</span>
                  <p className="text-2xl font-bold text-gray-900">{count}</p>
                </div>
                <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden mb-2">
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: PLAN_COLOR[plan] }} />
                </div>
                <p className="text-xs text-gray-400">{pct}% of tenants</p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Revenue Tab ───────────────────────────────────────────────────────────────

function RevenueTab() {
  const [data, setData] = useState<PlatformOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetchPlatformOverview()
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <Spinner />
  if (error || !data) return <ErrorMsg msg="Failed to load revenue data." />

  const planPrices: Record<string, number> = { Free: 0, Pro: 49, Enterprise: 199 }
  const plans = ['Free', 'Pro', 'Enterprise']
  const revenueByPlan = plans.map((p) => ({
    plan: p,
    tenants: data.plan_distribution[p] ?? 0,
    mrr: (data.plan_distribution[p] ?? 0) * (planPrices[p] ?? 0),
  }))
  const maxMRR = Math.max(...revenueByPlan.map((r) => r.mrr), 1)

  // ARR = MRR × 12
  const arr = data.mrr_estimate * 12
  const paidTenants = (data.plan_distribution['Pro'] ?? 0) + (data.plan_distribution['Enterprise'] ?? 0)
  const freeTenants = data.plan_distribution['Free'] ?? 0
  const conversionRate = data.total_tenants > 0 ? Math.round(paidTenants / data.total_tenants * 100) : 0

  return (
    <div className="space-y-6">
      {/* Revenue KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KPICard
          label="MRR Estimate" value={fmtMRR(data.mrr_estimate)}
          sub="monthly recurring revenue"
          icon={DollarSign} color="bg-emerald-600"
          trend={{ pct: data.growth_pct, label: 'vs last month' }}
        />
        <KPICard
          label="ARR Estimate" value={fmtMRR(arr)}
          sub="annualized run rate"
          icon={TrendingUp} color="bg-blue-600"
        />
        <KPICard
          label="Paid Tenants" value={paidTenants}
          sub={`${freeTenants} on free plan`}
          icon={Building2} color="bg-indigo-500"
        />
        <KPICard
          label="Conversion Rate" value={`${conversionRate}%`}
          sub="free → paid"
          icon={Zap} color="bg-amber-500"
        />
      </div>

      {/* Revenue breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-1">Revenue by Plan</h3>
          <p className="text-xs text-gray-400 mb-4">Pro $49/mo · Enterprise $199/mo · Free $0</p>
          <div className="space-y-4">
            {revenueByPlan.map(({ plan, tenants, mrr }) => (
              <div key={plan}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <PlanBadge plan={plan} />
                    <span className="text-xs text-gray-500">{tenants} tenants</span>
                  </div>
                  <span className="text-sm font-bold text-gray-900">{fmtMRR(mrr)}/mo</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${maxMRR > 0 ? (mrr / maxMRR) * 100 : 0}%`, backgroundColor: PLAN_COLOR[plan] }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-1">Plan Mix — Tenant Count</h3>
          <p className="text-xs text-gray-400 mb-4">Distribution of tenants across plans</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={revenueByPlan} barSize={40}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="plan" tick={{ fontSize: 12, fill: '#6b7280' }} tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} width={24} />
              <Tooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12 }} formatter={(v) => [v, 'Tenants']} />
              <Bar dataKey="tenants" radius={[6, 6, 0, 0]}>
                {revenueByPlan.map((r) => (
                  <Cell key={r.plan} fill={PLAN_COLOR[r.plan]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Growth + opportunity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Growth Signal</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-3 border-b border-gray-50">
              <span className="text-sm text-gray-600">New tenants this month</span>
              <span className="text-sm font-bold text-gray-900">{data.new_this_month}</span>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-gray-50">
              <span className="text-sm text-gray-600">New tenants last month</span>
              <span className="text-sm font-bold text-gray-900">{data.new_last_month}</span>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-gray-50">
              <span className="text-sm text-gray-600">Month-over-month growth</span>
              <span className={`text-sm font-bold ${data.growth_pct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {data.growth_pct >= 0 ? '+' : ''}{data.growth_pct}%
              </span>
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="text-sm text-gray-600">Active tenant rate</span>
              <span className="text-sm font-bold text-gray-900">
                {data.total_tenants > 0 ? Math.round(data.active_tenants / data.total_tenants * 100) : 0}%
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Upgrade Opportunity</h3>
          <p className="text-xs text-gray-500 mb-4">
            Revenue potential if free tenants convert to paid plans.
          </p>
          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-blue-50 border border-blue-100">
              <p className="text-xs text-blue-600 font-medium mb-1">If all Free → Pro</p>
              <p className="text-xl font-bold text-blue-700">{fmtMRR(freeTenants * 49)}/mo additional</p>
            </div>
            <div className="p-3 rounded-xl bg-purple-50 border border-purple-100">
              <p className="text-xs text-purple-600 font-medium mb-1">If all Free → Enterprise</p>
              <p className="text-xl font-bold text-purple-700">{fmtMRR(freeTenants * 199)}/mo additional</p>
            </div>
          </div>
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
  const [planFilter, setPlanFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')
  const [sortKey, setSortKey] = useState<SortKey>('created_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  useEffect(() => {
    fetchPlatformTenants().then(setTenants).finally(() => setLoading(false))
  }, [])

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('desc') }
  }

  const filtered = useMemo(() => {
    let rows = tenants.filter((t) => {
      const matchSearch = t.name.toLowerCase().includes(search.toLowerCase())
      const matchPlan = planFilter === 'All' || t.plan === planFilter
      const matchStatus = statusFilter === 'All' || (statusFilter === 'Active' ? t.is_active : !t.is_active)
      return matchSearch && matchPlan && matchStatus
    })
    rows = [...rows].sort((a, b) => {
      const av = a[sortKey] ?? ''
      const bv = b[sortKey] ?? ''
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return rows
  }, [tenants, search, planFilter, statusFilter, sortKey, sortDir])

  if (loading) return <Spinner />

  const totalMRR = filtered.reduce((s, t) => s + t.mrr, 0)

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <span className="text-gray-300 ml-1">↕</span>
    return sortDir === 'asc' ? <ChevronUp size={12} className="inline ml-1" /> : <ChevronDown size={12} className="inline ml-1" />
  }

  const TH = ({ label, col }: { label: string; col?: SortKey }) => (
    <th
      className={`px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide ${col ? 'cursor-pointer hover:text-gray-600 select-none' : ''}`}
      onClick={col ? () => handleSort(col) : undefined}
    >
      {label}{col && <SortIcon col={col} />}
    </th>
  )

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex gap-4 text-sm">
        <span className="text-gray-500">Showing <strong className="text-gray-900">{filtered.length}</strong> of {tenants.length} tenants</span>
        {filtered.length > 0 && <span className="text-gray-500">·  MRR for selection: <strong className="text-emerald-600">{fmtMRR(totalMRR)}/mo</strong></span>}
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text" placeholder="Search tenants…" value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>
        <div className="flex gap-1.5 bg-gray-100 rounded-xl p-1">
          {['All', 'Free', 'Pro', 'Enterprise'].map((p) => (
            <button key={p} onClick={() => setPlanFilter(p)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${planFilter === p ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {p}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5 bg-gray-100 rounded-xl p-1">
          {['All', 'Active', 'Inactive'].map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${statusFilter === s ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b border-gray-50">
                <TH label="Tenant" col="name" />
                <TH label="Plan" col="plan" />
                <TH label="Status" col="is_active" />
                <TH label="Users" col="user_count" />
                <TH label="Agents" col="agent_count" />
                <TH label="Alerts" col="alert_count" />
                <TH label="Critical" col="critical_count" />
                <TH label="MRR" col="mrr" />
                <TH label="Last Active" col="last_activity" />
                <TH label="Joined" col="created_at" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-12 text-sm text-gray-400">No tenants found.</td></tr>
              ) : filtered.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <TenantAvatar name={t.name} />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{t.name}</p>
                        <p className="text-[11px] text-gray-400">ID #{t.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5"><PlanBadge plan={t.plan} /></td>
                  <td className="px-4 py-3.5">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${t.is_active ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${t.is_active ? 'bg-green-500' : 'bg-red-400'}`} />
                      {t.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-sm text-gray-700">{t.user_count}</td>
                  <td className="px-4 py-3.5 text-sm text-gray-700">
                    <span>{t.agent_count}</span>
                    {t.online_agents > 0 && <span className="ml-1 text-[10px] text-green-600">({t.online_agents} ●)</span>}
                  </td>
                  <td className="px-4 py-3.5 text-sm text-gray-700">{t.alert_count}</td>
                  <td className="px-4 py-3.5">
                    {t.critical_count > 0
                      ? <span className="text-xs font-semibold text-red-600">{t.critical_count}</span>
                      : <span className="text-xs text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3.5 text-sm font-medium text-emerald-700">
                    {t.mrr > 0 ? `$${t.mrr}/mo` : <span className="text-gray-400 font-normal">Free</span>}
                  </td>
                  <td className="px-4 py-3.5 text-xs text-gray-400">{timeAgo(t.last_activity)}</td>
                  <td className="px-4 py-3.5 text-xs text-gray-400">
                    {t.created_at ? new Date(t.created_at).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2.5 border-t border-gray-50 text-xs text-gray-400 flex gap-4">
          <span>{filtered.length} of {tenants.length} tenants shown</span>
          {tenants.filter((t) => t.is_active).length > 0 && (
            <span>· {tenants.filter((t) => t.is_active).length} active · {tenants.filter((t) => !t.is_active).length} inactive</span>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Activity Tab ──────────────────────────────────────────────────────────────

function ActivityTab() {
  const [events, setEvents] = useState<PlatformActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [actionFilter, setActionFilter] = useState('ALL')
  const [tenantFilter, setTenantFilter] = useState('All')

  const load = useCallback(() => {
    setLoading(true)
    fetchPlatformActivity().then(setEvents).finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const allActions = useMemo(() => {
    const s = new Set(events.map((e) => e.action))
    return ['ALL', ...Array.from(s).sort()]
  }, [events])

  const allTenants = useMemo(() => {
    const s = new Set(events.map((e) => e.tenant_name))
    return ['All', ...Array.from(s).sort()]
  }, [events])

  const filtered = useMemo(() => events.filter((e) => {
    const matchAction = actionFilter === 'ALL' || e.action === actionFilter
    const matchTenant = tenantFilter === 'All' || e.tenant_name === tenantFilter
    return matchAction && matchTenant
  }), [events, actionFilter, tenantFilter])

  if (loading) return <Spinner />

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex flex-wrap gap-1.5">
          {allActions.map((a) => (
            <button key={a} onClick={() => setActionFilter(a)}
              className={`px-3 py-1 text-xs font-semibold rounded-full border transition-colors ${
                actionFilter === a
                  ? (ACTION_STYLE[a] ?? 'bg-gray-800 text-white border-gray-800')
                  : 'border-gray-200 text-gray-500 hover:border-gray-300'
              }`}>
              {a}
            </button>
          ))}
        </div>
        {allTenants.length > 2 && (
          <select
            value={tenantFilter} onChange={(e) => setTenantFilter(e.target.value)}
            className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {allTenants.map((t) => <option key={t}>{t}</option>)}
          </select>
        )}
        <button onClick={load}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100 border border-gray-200 bg-white transition-colors ml-auto">
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Platform Activity Feed</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {filtered.length} events shown {actionFilter !== 'ALL' || tenantFilter !== 'All' ? '(filtered)' : '(latest 200)'}
            </p>
          </div>
        </div>

        <div className="divide-y divide-gray-50 max-h-[640px] overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="text-center py-12 text-sm text-gray-400">No activity matches the selected filters.</p>
          ) : filtered.map((e) => (
            <div key={e.id} className="px-5 py-3.5 flex items-start gap-3 hover:bg-gray-50/50 transition-colors">
              <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full mt-0.5 ${ACTION_STYLE[e.action] ?? 'bg-gray-100 text-gray-600'}`}>
                {e.action}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-blue-600">{e.tenant_name}</span>
                  {e.user_name && <><span className="text-xs text-gray-400">·</span><span className="text-xs text-gray-500">{e.user_name}</span></>}
                  {e.resource_type && <><span className="text-xs text-gray-400">·</span><span className="text-xs text-gray-400 italic">{e.resource_type}</span></>}
                </div>
                {e.details && <p className="text-xs text-gray-500 mt-0.5 truncate">{e.details}</p>}
              </div>
              <span className="text-[11px] text-gray-400 shrink-0 whitespace-nowrap">{timeAgo(e.timestamp)}</span>
            </div>
          ))}
        </div>
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
    const id = setInterval(load, 30_000)
    return () => clearInterval(id)
  }, [load])

  const services = data ? [
    {
      label: 'API Server',
      icon: Globe,
      status: data.status,
      detail: 'FastAPI / Uvicorn',
      latency: null,
      extra: `v${data.version}`,
    },
    {
      label: 'Database',
      icon: Database,
      status: data.db,
      detail: 'PostgreSQL',
      latency: data.db_latency_ms,
      extra: data.db_latency_ms != null ? `${data.db_latency_ms} ms` : null,
    },
    {
      label: 'Redis / Celery',
      icon: data.redis === 'ok' ? Wifi : WifiOff,
      status: data.redis,
      detail: 'Task broker',
      latency: data.redis_latency_ms,
      extra: data.redis_latency_ms != null ? `${data.redis_latency_ms} ms` : null,
    },
    {
      label: 'Uptime',
      icon: Clock,
      status: 'ok' as const,
      detail: 'Server uptime',
      latency: null,
      extra: fmtUptime(data.uptime_seconds),
    },
  ] : []

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">System Health</h3>
          <p className="text-xs text-gray-400">Auto-refreshes every 30 seconds</p>
        </div>
        <button onClick={load}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100 border border-gray-200 bg-white transition-colors">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          Refreshed {lastRefresh.toLocaleTimeString()}
        </button>
      </div>

      {/* Overall status banner */}
      {data && (
        <div className={`flex items-center gap-3 px-5 py-4 rounded-2xl ${
          data.status === 'ok' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
        }`}>
          {data.status === 'ok'
            ? <CheckCircle2 size={20} className="text-green-600 shrink-0" />
            : <XCircle size={20} className="text-red-500 shrink-0" />}
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
        {services.map(({ label, icon: Icon, status, detail, extra }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-semibold text-gray-500">{label}</span>
              <div className={`h-8 w-8 rounded-xl flex items-center justify-center ${
                status === 'ok' ? 'bg-green-50' : status === 'not configured' ? 'bg-gray-50' : 'bg-red-50'
              }`}>
                <Icon size={15} className={status === 'ok' ? 'text-green-600' : status === 'not configured' ? 'text-gray-400' : 'text-red-500'} />
              </div>
            </div>
            <StatusPill value={status} />
            <p className="text-xs text-gray-400 mt-2">{detail}</p>
            {extra && <p className="text-xs font-medium text-gray-600 mt-1">{extra}</p>}
          </div>
        ))}
      </div>

      {/* Health checks detail */}
      {data && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Health Check Details</h3>
          <div className="divide-y divide-gray-50">
            {[
              { name: 'Database connectivity', status: data.db, latency: data.db_latency_ms },
              { name: 'Redis / task broker', status: data.redis, latency: data.redis_latency_ms },
              { name: 'API server', status: data.status, latency: null },
            ].map((row) => (
              <div key={row.name} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  {row.status === 'ok'
                    ? <CheckCircle2 size={14} className="text-green-500" />
                    : row.status === 'not configured'
                    ? <Clock size={14} className="text-gray-400" />
                    : <XCircle size={14} className="text-red-500" />}
                  <span className="text-sm text-gray-700">{row.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  {row.latency != null && (
                    <span className={`text-xs font-medium ${row.latency < 50 ? 'text-green-600' : row.latency < 200 ? 'text-amber-600' : 'text-red-600'}`}>
                      {row.latency} ms
                    </span>
                  )}
                  <StatusPill value={row.status} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading && !data && <Spinner />}
    </div>
  )
}

// ── Support Tab ───────────────────────────────────────────────────────────────

const PRIORITY_STYLE: Record<string, string> = {
  Low:      'bg-gray-100 text-gray-600',
  Medium:   'bg-blue-50 text-blue-700',
  High:     'bg-amber-50 text-amber-700',
  Critical: 'bg-red-100 text-red-700',
}

const STATUS_STYLE: Record<string, string> = {
  Open:        'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  'In Progress': 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  Resolved:    'bg-green-50 text-green-700 ring-1 ring-green-200',
  Closed:      'bg-gray-100 text-gray-500',
}

function TicketDetailModal({
  ticket,
  onClose,
  onUpdated,
}: {
  ticket: PlatformSupportTicket
  onClose: () => void
  onUpdated: (updated: { id: number; status: string; admin_note: string | null }) => void
}) {
  const [status, setStatus]   = useState(ticket.status)
  const [note, setNote]       = useState(ticket.admin_note ?? '')
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      const res = await updateTicketStatus(ticket.id, { status, admin_note: note || undefined })
      onUpdated(res)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <MessageSquare size={15} className="text-blue-600" />
            <h2 className="text-sm font-semibold text-gray-900">Ticket #{ticket.id}</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={15} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Meta */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div><span className="text-gray-400">Tenant</span><p className="font-medium text-gray-900 mt-0.5">{ticket.tenant_name}</p></div>
            <div><span className="text-gray-400">User</span><p className="font-medium text-gray-900 mt-0.5">{ticket.user_name}</p></div>
            <div><span className="text-gray-400">Email</span><p className="font-medium text-gray-900 mt-0.5 truncate">{ticket.user_email}</p></div>
            <div><span className="text-gray-400">Submitted</span><p className="font-medium text-gray-900 mt-0.5">{timeAgo(ticket.created_at)}</p></div>
          </div>

          {/* Subject + Priority */}
          <div>
            <p className="text-xs text-gray-400 mb-1">Subject</p>
            <div className="flex items-start gap-2">
              <p className="flex-1 text-sm font-semibold text-gray-900">{ticket.subject}</p>
              <span className={`shrink-0 text-xs font-medium px-2.5 py-0.5 rounded-full ${PRIORITY_STYLE[ticket.priority] ?? 'bg-gray-100 text-gray-600'}`}>
                {ticket.priority}
              </span>
            </div>
          </div>

          {/* Message */}
          <div>
            <p className="text-xs text-gray-400 mb-1">Message</p>
            <div className="bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-700 whitespace-pre-wrap max-h-40 overflow-y-auto border border-gray-100">
              {ticket.message}
            </div>
          </div>

          {/* Status update */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Update Status</label>
            <div className="flex gap-1.5 flex-wrap">
              {['Open', 'In Progress', 'Resolved', 'Closed'].map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={`text-xs font-medium px-3 py-1 rounded-full border transition-all ${
                    status === s
                      ? (STATUS_STYLE[s] ?? 'bg-gray-800 text-white border-gray-800')
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Admin note */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Admin Note (optional)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Internal notes visible to Platform Admin only…"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-2">
          <button onClick={onClose} className="text-sm px-4 py-2 text-gray-500 hover:text-gray-700 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
          >
            {saving ? <RefreshCw size={12} className="animate-spin" /> : saved ? <CheckCircle2 size={12} /> : <Send size={12} />}
            {saved ? 'Saved!' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

function SupportTab() {
  const [tickets, setTickets]             = useState<PlatformSupportTicket[]>([])
  const [loading, setLoading]             = useState(true)
  const [statusFilter, setStatusFilter]   = useState('All')
  const [priorityFilter, setPriorityFilter] = useState('All')
  const [search, setSearch]               = useState('')
  const [selected, setSelected]           = useState<PlatformSupportTicket | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    fetchPlatformSupport().then(setTickets).finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  function handleUpdated(updated: { id: number; status: string; admin_note: string | null }) {
    setTickets((prev) =>
      prev.map((t) => t.id === updated.id ? { ...t, status: updated.status, admin_note: updated.admin_note } : t)
    )
    setSelected((prev) => prev && prev.id === updated.id ? { ...prev, status: updated.status, admin_note: updated.admin_note } : prev)
  }

  const filtered = useMemo(() => tickets.filter((t) => {
    const matchStatus   = statusFilter === 'All' || t.status === statusFilter
    const matchPriority = priorityFilter === 'All' || t.priority === priorityFilter
    const matchSearch   = !search || t.subject.toLowerCase().includes(search.toLowerCase()) || t.tenant_name.toLowerCase().includes(search.toLowerCase()) || t.user_name.toLowerCase().includes(search.toLowerCase())
    return matchStatus && matchPriority && matchSearch
  }), [tickets, statusFilter, priorityFilter, search])

  const openCount     = tickets.filter((t) => t.status === 'Open').length
  const inProgressCnt = tickets.filter((t) => t.status === 'In Progress').length
  const criticalCount = tickets.filter((t) => t.priority === 'Critical').length

  if (loading) return <Spinner />

  return (
    <div className="space-y-5">
      {/* Summary KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
            <MessageSquare size={18} className="text-blue-600" />
          </div>
          <div>
            <p className="text-xs text-gray-400">Open Tickets</p>
            <p className="text-2xl font-bold text-gray-900">{openCount}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
            <Activity size={18} className="text-amber-600" />
          </div>
          <div>
            <p className="text-xs text-gray-400">In Progress</p>
            <p className="text-2xl font-bold text-gray-900">{inProgressCnt}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
            <AlertTriangle size={18} className="text-red-500" />
          </div>
          <div>
            <p className="text-xs text-gray-400">Critical Priority</p>
            <p className="text-2xl font-bold text-gray-900">{criticalCount}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text" placeholder="Search tickets, tenants, users…" value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>
        <div className="flex gap-1.5 bg-gray-100 rounded-xl p-1">
          {['All', 'Open', 'In Progress', 'Resolved', 'Closed'].map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${statusFilter === s ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {s}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5 bg-gray-100 rounded-xl p-1">
          {['All', 'Low', 'Medium', 'High', 'Critical'].map((p) => (
            <button key={p} onClick={() => setPriorityFilter(p)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${priorityFilter === p ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {p}
            </button>
          ))}
        </div>
        <button onClick={load}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100 border border-gray-200 bg-white transition-colors">
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {/* Ticket list */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50 text-xs text-gray-400">
          {filtered.length} ticket{filtered.length !== 1 ? 's' : ''} shown
          {statusFilter !== 'All' || priorityFilter !== 'All' || search ? ' (filtered)' : ' (all)'}
        </div>
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-sm text-gray-400">
            <Headphones size={28} className="mx-auto mb-3 text-gray-300" />
            <p>No support tickets yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filtered.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelected(t)}
                className="w-full text-left px-5 py-4 hover:bg-gray-50/70 transition-colors flex items-start gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${PRIORITY_STYLE[t.priority] ?? 'bg-gray-100 text-gray-600'}`}>
                      {t.priority}
                    </span>
                    <span className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full ${STATUS_STYLE[t.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {t.status}
                    </span>
                    <span className="text-xs font-semibold text-blue-600">{t.tenant_name}</span>
                    <span className="text-xs text-gray-400">· {t.user_name}</span>
                  </div>
                  <p className="text-sm font-semibold text-gray-900 truncate">{t.subject}</p>
                  <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{t.message}</p>
                  {t.admin_note && (
                    <p className="text-xs text-indigo-600 mt-1 line-clamp-1">Note: {t.admin_note}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] text-gray-400 whitespace-nowrap">{timeAgo(t.created_at)}</span>
                  <ChevronRight size={14} className="text-gray-300" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <TicketDetailModal
          ticket={selected}
          onClose={() => setSelected(null)}
          onUpdated={handleUpdated}
        />
      )}
    </div>
  )
}

// ── Sidebar nav ───────────────────────────────────────────────────────────────

const NAV: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'overview',  label: 'Overview',      icon: LayoutDashboard },
  { id: 'revenue',   label: 'Revenue',        icon: DollarSign      },
  { id: 'tenants',   label: 'Tenants',        icon: Building2       },
  { id: 'activity',  label: 'Activity Feed',  icon: Activity        },
  { id: 'system',    label: 'System Health',  icon: Server          },
  { id: 'support',   label: 'Support Tickets', icon: Headphones     },
]

// ── Main Component ────────────────────────────────────────────────────────────

export default function PlatformAdmin() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const { logout } = useAuthStore()
  const [tab, setTab] = useState<Tab>('overview')

  const TAB_TITLES: Record<Tab, string> = {
    overview: 'Platform Overview',
    revenue:  'Revenue & Business',
    tenants:  'Tenant Registry',
    activity: 'Activity Feed',
    system:   'System Health',
    support:  'Support Tickets',
  }

  const TAB_DESCS: Record<Tab, string> = {
    overview: 'Platform-wide KPIs, trends, and engagement metrics',
    revenue:  'MRR, ARR, plan distribution, and upgrade opportunities',
    tenants:  'All customer tenants — usage stats, status, and plan',
    activity: 'Cross-tenant audit log and user actions',
    system:   'Backend health, database latency, and uptime',
    support:  'All customer support tickets — view, respond, and update status',
  }

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-[#F3F5F9] flex">
      {/* ── Left Sidebar ─────────────────────────────────────────────────── */}
      <aside className="fixed inset-y-0 left-0 w-64 bg-[#0f172a] text-white flex flex-col z-40">
        {/* Brand */}
        <div className="px-5 py-5 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0">
              <ShieldCheck size={18} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-bold tracking-wide text-white">PLATFORM ADMIN</p>
              <p className="text-[10px] text-white/40 leading-tight">NetcradXDR Operator Console</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${
                tab === id
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/40'
                  : 'text-white/55 hover:bg-white/8 hover:text-white'
              }`}
            >
              <Icon size={17} />
              {label}
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-4 py-4 border-t border-white/10">
          <div className="flex items-center gap-3 px-2 py-2 rounded-xl bg-white/5">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-xs font-bold shrink-0">
              {user?.initials ?? 'PA'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-white truncate">{user?.name ?? 'Platform Admin'}</p>
              <p className="text-[10px] text-white/40 truncate">{user?.email}</p>
            </div>
            <button onClick={handleLogout} title="Sign out"
              className="text-white/40 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10">
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main content ──────────────────────────────────────────────────── */}
      <div className="ml-64 flex-1 min-w-0">
        {/* Top bar */}
        <div className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-gray-100 px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold text-gray-900">{TAB_TITLES[tab]}</h1>
            <p className="text-xs text-gray-400 mt-0.5">{TAB_DESCS[tab]}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full ring-1 ring-emerald-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live
            </span>
            <span className="text-xs text-gray-400">
              {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </span>
          </div>
        </div>

        {/* Content */}
        <main className="p-6">
          {tab === 'overview'  && <OverviewTab />}
          {tab === 'revenue'   && <RevenueTab />}
          {tab === 'tenants'   && <TenantsTab />}
          {tab === 'activity'  && <ActivityTab />}
          {tab === 'system'    && <SystemTab />}
          {tab === 'support'   && <SupportTab />}
        </main>
      </div>
    </div>
  )
}
