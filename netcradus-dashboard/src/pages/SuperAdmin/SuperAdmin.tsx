import { useEffect, useState, useCallback } from 'react'
import {
  Building2, RefreshCw, AlertTriangle, Plus, X, Users,
  Monitor, Shield, CheckCircle2, XCircle, Globe, Loader2,
  ChevronDown,
} from 'lucide-react'
import Topbar from '@/components/layout/Topbar/Topbar'
import Card from '@/components/ui/Card/Card'
import {
  fetchPlatformStats,
  fetchAllTenants,
  createTenant,
  toggleTenantStatus,
  updateTenantPlan,
} from '@/api/superAdminApi'
import type { TenantStats, PlatformStats } from '@/types/api.types'

const PLANS = ['Free', 'Pro', 'Enterprise']

const PLAN_STYLE: Record<string, string> = {
  Free:       'bg-gray-100 text-gray-600',
  Pro:        'bg-blue-50 text-blue-700 border border-blue-200',
  Enterprise: 'bg-purple-50 text-purple-700 border border-purple-200',
}

// ── Create Tenant Modal ───────────────────────────────────────────────────────

function CreateTenantModal({
  onClose,
  onCreate,
}: {
  onClose: () => void
  onCreate: (t: TenantStats) => void
}) {
  const [name, setName] = useState('')
  const [plan, setPlan] = useState('Free')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Organisation name is required'); return }
    setLoading(true)
    setError(null)
    try {
      const t = await createTenant({ name: name.trim(), plan })
      onCreate(t)
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create tenant')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Building2 size={18} className="text-blue-600" />
            <h2 className="text-base font-semibold text-gray-900">Create New Organisation</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={submit} className="px-6 py-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1.5">Organisation Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Acme Corp Security"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1.5">Plan</label>
            <div className="flex gap-2">
              {PLANS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPlan(p)}
                  className={`flex-1 py-2 text-sm rounded-lg border transition-colors font-medium ${
                    plan === p
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5 text-xs text-blue-700">
            A unique API key will be auto-generated and can be shared with the tenant's agents for registration.
          </div>

          {error && (
            <p className="text-sm text-red-500 flex items-center gap-1">
              <AlertTriangle size={13} /> {error}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              {loading ? 'Creating…' : 'Create Organisation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Plan selector inline ──────────────────────────────────────────────────────

function PlanSelector({ tenantId, current, onChange }: {
  tenantId: number
  current: string
  onChange: (plan: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  async function select(p: string) {
    if (p === current) { setOpen(false); return }
    setSaving(true)
    setOpen(false)
    try {
      await updateTenantPlan(tenantId, p)
      onChange(p)
    } catch { /* keep current */ } finally {
      setSaving(false)
    }
  }

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={saving}
        className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${PLAN_STYLE[current] ?? PLAN_STYLE.Free} hover:opacity-80 transition-opacity`}
      >
        {saving ? <Loader2 size={10} className="animate-spin" /> : null}
        {current}
        <ChevronDown size={10} />
      </button>
      {open && (
        <div className="absolute left-0 top-8 z-30 bg-white border border-gray-200 rounded-lg shadow-lg w-28 overflow-hidden">
          {PLANS.map((p) => (
            <button
              key={p}
              onClick={() => select(p)}
              className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 transition-colors ${
                p === current ? 'font-semibold text-blue-600' : 'text-gray-700'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SuperAdmin() {
  const [stats, setStats] = useState<PlatformStats | null>(null)
  const [tenants, setTenants] = useState<TenantStats[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [toggling, setToggling] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [s, t] = await Promise.all([fetchPlatformStats(), fetchAllTenants()])
      setStats(s)
      setTenants(t)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load platform data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleToggle(tenant: TenantStats) {
    setToggling(tenant.id)
    try {
      const result = await toggleTenantStatus(tenant.id, !tenant.is_active)
      setTenants((prev) =>
        prev.map((t) => t.id === tenant.id ? { ...t, is_active: result.is_active } : t)
      )
      if (stats) {
        setStats((s) => s ? {
          ...s,
          active_tenants: result.is_active ? s.active_tenants + 1 : s.active_tenants - 1,
        } : s)
      }
    } catch { /* keep */ } finally {
      setToggling(null)
    }
  }

  function relDate(iso: string | null) {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <div className="pb-8">
      <Topbar
        title="Platform Admin"
        subtitle="SuperAdmin console · all tenants"
        onRefresh={load}
      />

      <div className="px-4 sm:px-6 lg:px-8 space-y-6">

        {/* Platform stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Total Orgs',    value: stats?.total_tenants ?? '—',  Icon: Building2, color: 'text-gray-900'  },
            { label: 'Active Orgs',   value: stats?.active_tenants ?? '—', Icon: CheckCircle2, color: 'text-green-600' },
            { label: 'Total Agents',  value: stats?.total_agents ?? '—',   Icon: Monitor,   color: 'text-blue-600'  },
            { label: 'Online Agents', value: stats?.online_agents ?? '—',  Icon: Globe,     color: 'text-green-600' },
            { label: 'Total Users',   value: stats?.total_users ?? '—',    Icon: Users,     color: 'text-purple-600'},
            { label: 'Total Alerts',  value: stats?.total_alerts ?? '—',   Icon: Shield,    color: 'text-red-500'   },
          ].map(({ label, value, Icon, color }) => (
            <div key={label} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Icon size={14} className={color} />
                <span className="text-xs text-gray-400">{label}</span>
              </div>
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Tenants table */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Building2 size={16} className="text-gray-500" />
              <h2 className="text-sm font-semibold text-gray-800">Organisations</h2>
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                {tenants.length} total
              </span>
            </div>
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={14} /> New Organisation
            </button>
          </div>

          <Card>
            {loading ? (
              <div className="flex items-center justify-center py-16 gap-2 text-gray-400">
                <RefreshCw size={15} className="animate-spin" />
                <span className="text-sm">Loading tenants…</span>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-16 gap-2 text-red-500">
                <AlertTriangle size={18} />
                <p className="text-sm">{error}</p>
                <button onClick={load} className="text-xs underline">Retry</button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                      <th className="font-medium py-2 pr-4 w-8">#</th>
                      <th className="font-medium py-2 pr-4">Organisation</th>
                      <th className="font-medium py-2 pr-4">Plan</th>
                      <th className="font-medium py-2 pr-4">Status</th>
                      <th className="font-medium py-2 pr-4 text-center">Users</th>
                      <th className="font-medium py-2 pr-4 text-center">Agents</th>
                      <th className="font-medium py-2 pr-4 text-center">Alerts</th>
                      <th className="font-medium py-2 pr-4">API Key</th>
                      <th className="font-medium py-2 pr-4">Created</th>
                      <th className="font-medium py-2">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tenants.map((t) => (
                      <tr key={t.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
                        <td className="py-3 pr-4 text-xs text-gray-400 font-mono">{t.id}</td>
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2">
                            <div className="h-7 w-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                              <span className="text-[11px] font-bold text-blue-600">
                                {t.name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <span className="font-medium text-gray-900">{t.name}</span>
                          </div>
                        </td>
                        <td className="py-3 pr-4">
                          <PlanSelector
                            tenantId={t.id}
                            current={t.plan}
                            onChange={(plan) =>
                              setTenants((prev) => prev.map((x) => x.id === t.id ? { ...x, plan } : x))
                            }
                          />
                        </td>
                        <td className="py-3 pr-4">
                          {t.is_active ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2.5 py-1 rounded-full">
                              <span className="h-1.5 w-1.5 rounded-full bg-green-500" /> Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">
                              <span className="h-1.5 w-1.5 rounded-full bg-gray-400" /> Inactive
                            </span>
                          )}
                        </td>
                        <td className="py-3 pr-4 text-center">
                          <span className="inline-flex items-center gap-1 text-xs text-gray-600">
                            <Users size={11} className="text-gray-400" />
                            {t.user_count}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-center">
                          <span className="inline-flex items-center gap-1 text-xs text-gray-600">
                            <Monitor size={11} className="text-gray-400" />
                            {t.agent_count}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-center">
                          <span className="inline-flex items-center gap-1 text-xs text-gray-600">
                            <Shield size={11} className="text-gray-400" />
                            {t.alert_count}
                          </span>
                        </td>
                        <td className="py-3 pr-4">
                          <span className="font-mono text-xs text-gray-400">
                            {t.api_key_tail ?? '—'}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-xs text-gray-400">
                          {relDate(t.created_at)}
                        </td>
                        <td className="py-3">
                          <button
                            onClick={() => handleToggle(t)}
                            disabled={toggling === t.id}
                            className={`inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                              t.is_active
                                ? 'border-red-200 text-red-500 hover:bg-red-50'
                                : 'border-green-200 text-green-600 hover:bg-green-50'
                            } disabled:opacity-40`}
                          >
                            {toggling === t.id
                              ? <Loader2 size={11} className="animate-spin" />
                              : t.is_active ? <XCircle size={11} /> : <CheckCircle2 size={11} />}
                            {t.is_active ? 'Deactivate' : 'Activate'}
                          </button>
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

      {showCreate && (
        <CreateTenantModal
          onClose={() => setShowCreate(false)}
          onCreate={(t) => setTenants((prev) => [...prev, t])}
        />
      )}
    </div>
  )
}
