import { useEffect, useState, useCallback } from 'react'
import {
  Building2, RefreshCw, AlertTriangle, Plus, X, Users,
  Monitor, Shield, CheckCircle2, XCircle, Globe, Loader2,
  ChevronDown, Settings, Trash2, UserPlus, Eye, EyeOff,
} from 'lucide-react'
import Topbar from '@/components/layout/Topbar/Topbar'
import Card from '@/components/ui/Card/Card'
import {
  fetchPlatformStats, fetchAllTenants, createTenant,
  toggleTenantStatus, updateTenantPlan,
  fetchTenantUsers, addTenantUser, removeTenantUser,
  fetchTenantAgents, removeTenantAgent,
} from '@/api/superAdminApi'
import type { TenantStats, PlatformStats, TenantUser, TenantAgent } from '@/types/api.types'

const PLANS = ['Free', 'Pro', 'Enterprise']
const ROLES = ['Admin', 'Analyst', 'Viewer']

const PLAN_STYLE: Record<string, string> = {
  Free:       'bg-gray-100 text-gray-600',
  Pro:        'bg-blue-50 text-blue-700 border border-blue-200',
  Enterprise: 'bg-purple-50 text-purple-700 border border-purple-200',
}

const ROLE_STYLE: Record<string, string> = {
  SuperAdmin: 'bg-red-50 text-red-700',
  Admin:      'bg-orange-50 text-orange-700',
  Analyst:    'bg-blue-50 text-blue-700',
  Viewer:     'bg-gray-100 text-gray-600',
}

const STATUS_DOT: Record<string, string> = {
  Online:  'bg-green-500',
  Offline: 'bg-gray-400',
}

function timeAgo(iso: string | null) {
  if (!iso) return '—'
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60)   return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
}

// ── Create Tenant Modal ───────────────────────────────────────────────────────

function CreateTenantModal({ onClose, onCreate }: { onClose: () => void; onCreate: (t: TenantStats) => void }) {
  const [name, setName] = useState('')
  const [plan, setPlan] = useState('Free')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Organisation name is required'); return }
    setLoading(true); setError(null)
    try { const t = await createTenant({ name: name.trim(), plan }); onCreate(t); onClose() }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed to create') }
    finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Building2 size={18} className="text-blue-600" />
            <h2 className="text-base font-semibold text-gray-900">Create New Organisation</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="px-6 py-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1.5">Organisation Name *</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Acme Corp Security" autoFocus
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1.5">Plan</label>
            <div className="flex gap-2">
              {PLANS.map((p) => (
                <button key={p} type="button" onClick={() => setPlan(p)}
                  className={`flex-1 py-2 text-sm rounded-lg border transition-colors font-medium ${plan === p ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5 text-xs text-blue-700">
            A unique API key will be auto-generated for agent registration.
          </div>
          {error && <p className="text-sm text-red-500 flex items-center gap-1"><AlertTriangle size={13} /> {error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={loading}
              className="flex-1 py-2.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              {loading ? 'Creating…' : 'Create Organisation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Plan selector ─────────────────────────────────────────────────────────────

function PlanSelector({ tenantId, current, onChange }: { tenantId: number; current: string; onChange: (p: string) => void }) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  async function select(p: string) {
    if (p === current) { setOpen(false); return }
    setSaving(true); setOpen(false)
    try { await updateTenantPlan(tenantId, p); onChange(p) }
    catch { /* keep */ } finally { setSaving(false) }
  }

  return (
    <div className="relative inline-block">
      <button onClick={() => setOpen((o) => !o)} disabled={saving}
        className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${PLAN_STYLE[current] ?? PLAN_STYLE.Free} hover:opacity-80`}>
        {saving ? <Loader2 size={10} className="animate-spin" /> : null}
        {current}<ChevronDown size={10} />
      </button>
      {open && (
        <div className="absolute left-0 top-8 z-30 bg-white border border-gray-200 rounded-lg shadow-lg w-28 overflow-hidden">
          {PLANS.map((p) => (
            <button key={p} onClick={() => select(p)}
              className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 ${p === current ? 'font-semibold text-blue-600' : 'text-gray-700'}`}>
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Manage Drawer ─────────────────────────────────────────────────────────────

function ManageDrawer({ tenant, onClose }: { tenant: TenantStats; onClose: () => void }) {
  const [tab, setTab] = useState<'team' | 'agents'>('team')
  const [users, setUsers] = useState<TenantUser[]>([])
  const [agents, setAgents] = useState<TenantAgent[]>([])
  const [loadingData, setLoadingData] = useState(false)

  // Add user form
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [role, setRole] = useState('Analyst')
  const [addError, setAddError] = useState<string | null>(null)
  const [addLoading, setAddLoading] = useState(false)

  // Remove states
  const [removingUser, setRemovingUser] = useState<number | null>(null)
  const [removingAgent, setRemovingAgent] = useState<number | null>(null)

  const loadData = useCallback(async () => {
    setLoadingData(true)
    try {
      const [u, a] = await Promise.all([fetchTenantUsers(tenant.id), fetchTenantAgents(tenant.id)])
      setUsers(u); setAgents(a)
    } catch { /* ignore */ } finally { setLoadingData(false) }
  }, [tenant.id])

  useEffect(() => { loadData() }, [loadData])

  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !email.trim() || !password) { setAddError('All fields are required'); return }
    setAddLoading(true); setAddError(null)
    try {
      const u = await addTenantUser(tenant.id, { name: name.trim(), email: email.trim(), password, role })
      setUsers((prev) => [...prev, u])
      setName(''); setEmail(''); setPassword(''); setRole('Analyst')
    } catch (e: unknown) {
      setAddError(e instanceof Error ? e.message : 'Failed to add user')
    } finally { setAddLoading(false) }
  }

  async function handleRemoveUser(userId: number) {
    setRemovingUser(userId)
    try {
      await removeTenantUser(tenant.id, userId)
      setUsers((prev) => prev.filter((u) => u.id !== userId))
    } catch { /* keep */ } finally { setRemovingUser(null) }
  }

  async function handleRemoveAgent(agentId: number) {
    setRemovingAgent(agentId)
    try {
      await removeTenantAgent(tenant.id, agentId)
      setAgents((prev) => prev.filter((a) => a.id !== agentId))
    } catch { /* keep */ } finally { setRemovingAgent(null) }
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-xl bg-white shadow-2xl flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
              <span className="text-sm font-bold text-blue-600">{tenant.name.charAt(0).toUpperCase()}</span>
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 truncate">{tenant.name}</p>
              <p className="text-xs text-gray-400">Manage team & agents</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 shrink-0"><X size={18} /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 px-6">
          {(['team', 'agents'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`py-3 mr-6 text-sm font-medium border-b-2 transition-colors capitalize ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
              {t === 'team' ? `Team (${users.length})` : `Agents (${agents.length})`}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {loadingData ? (
            <div className="flex items-center justify-center py-16 gap-2 text-gray-400">
              <Loader2 size={16} className="animate-spin" /><span className="text-sm">Loading…</span>
            </div>
          ) : tab === 'team' ? (
            <>
              {/* Add user form */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <UserPlus size={14} className="text-blue-600" />
                  <span className="text-sm font-semibold text-gray-800">Add Team Member</span>
                </div>
                <form onSubmit={handleAddUser} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <input value={name} onChange={(e) => setName(e.target.value)}
                      placeholder="Full name" className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                    <input value={email} onChange={(e) => setEmail(e.target.value)}
                      placeholder="Email address" type="email" className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="relative">
                      <input value={password} onChange={(e) => setPassword(e.target.value)}
                        type={showPw ? 'text' : 'password'} placeholder="Password"
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                      <button type="button" onClick={() => setShowPw((v) => !v)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {showPw ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                    </div>
                    <select value={role} onChange={(e) => setRole(e.target.value)}
                      className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                      {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  {addError && <p className="text-xs text-red-500 flex items-center gap-1"><AlertTriangle size={11} />{addError}</p>}
                  <button type="submit" disabled={addLoading}
                    className="w-full py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
                    {addLoading ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                    {addLoading ? 'Adding…' : 'Add Member'}
                  </button>
                </form>
              </div>

              {/* User list */}
              {users.length === 0 ? (
                <div className="text-center py-10 text-gray-400 text-sm">No team members yet.</div>
              ) : (
                <div className="space-y-2">
                  {users.map((u) => (
                    <div key={u.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors">
                      <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-blue-600">{u.name.charAt(0).toUpperCase()}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{u.name}</p>
                        <p className="text-xs text-gray-400 truncate">{u.email}</p>
                      </div>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${ROLE_STYLE[u.role] ?? ROLE_STYLE.Viewer}`}>
                        {u.role}
                      </span>
                      {u.role !== 'SuperAdmin' && (
                        <button onClick={() => handleRemoveUser(u.id)} disabled={removingUser === u.id}
                          className="shrink-0 h-7 w-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-40 transition-colors">
                          {removingUser === u.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              {/* Agent list */}
              <p className="text-xs text-gray-400">Agents register automatically via the tenant API key. Remove decommissioned agents here.</p>
              {agents.length === 0 ? (
                <div className="text-center py-10 text-gray-400 text-sm">No agents registered for this tenant.</div>
              ) : (
                <div className="space-y-2">
                  {agents.map((a) => (
                    <div key={a.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors">
                      <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${STATUS_DOT[a.status] ?? 'bg-gray-400'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-gray-900 truncate">{a.hostname}</p>
                          <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded shrink-0">{a.os_type}</span>
                        </div>
                        <p className="text-xs text-gray-400 truncate">{a.ip_address} · last seen {timeAgo(a.last_seen)}</p>
                      </div>
                      <span className={`text-xs font-medium shrink-0 ${a.status === 'Online' ? 'text-green-600' : 'text-gray-400'}`}>
                        {a.status}
                      </span>
                      <button onClick={() => handleRemoveAgent(a.id)} disabled={removingAgent === a.id}
                        className="shrink-0 h-7 w-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-40 transition-colors">
                        {removingAgent === a.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
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
  const [manageTenant, setManageTenant] = useState<TenantStats | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [s, t] = await Promise.all([fetchPlatformStats(), fetchAllTenants()])
      setStats(s); setTenants(t)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load platform data')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleToggle(tenant: TenantStats) {
    setToggling(tenant.id)
    try {
      const result = await toggleTenantStatus(tenant.id, !tenant.is_active)
      setTenants((prev) => prev.map((t) => t.id === tenant.id ? { ...t, is_active: result.is_active } : t))
      setStats((s) => s ? {
        ...s,
        active_tenants: result.is_active ? s.active_tenants + 1 : s.active_tenants - 1,
      } : s)
    } catch { /* keep */ } finally { setToggling(null) }
  }

  function relDate(iso: string | null) {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <div className="pb-8">
      <Topbar title="Super Admin" subtitle="Tenant management console · all organisations" onRefresh={load} />

      <div className="px-4 sm:px-6 lg:px-8 space-y-6">

        {/* Platform stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Total Orgs',    value: stats?.total_tenants ?? '—',  Icon: Building2,   color: 'text-gray-900'   },
            { label: 'Active Orgs',   value: stats?.active_tenants ?? '—', Icon: CheckCircle2, color: 'text-green-600' },
            { label: 'Total Agents',  value: stats?.total_agents ?? '—',   Icon: Monitor,     color: 'text-blue-600'   },
            { label: 'Online Agents', value: stats?.online_agents ?? '—',  Icon: Globe,       color: 'text-green-600'  },
            { label: 'Total Users',   value: stats?.total_users ?? '—',    Icon: Users,       color: 'text-purple-600' },
            { label: 'Total Alerts',  value: stats?.total_alerts ?? '—',   Icon: Shield,      color: 'text-red-500'    },
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
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{tenants.length} total</span>
            </div>
            <button onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              <Plus size={14} /> New Organisation
            </button>
          </div>

          <Card>
            {loading ? (
              <div className="flex items-center justify-center py-16 gap-2 text-gray-400">
                <RefreshCw size={15} className="animate-spin" /><span className="text-sm">Loading tenants…</span>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-16 gap-2 text-red-500">
                <AlertTriangle size={18} /><p className="text-sm">{error}</p>
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
                      <th className="font-medium py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tenants.map((t) => (
                      <tr key={t.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
                        <td className="py-3 pr-4 text-xs text-gray-400 font-mono">{t.id}</td>
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2">
                            <div className="h-7 w-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                              <span className="text-[11px] font-bold text-blue-600">{t.name.charAt(0).toUpperCase()}</span>
                            </div>
                            <span className="font-medium text-gray-900">{t.name}</span>
                          </div>
                        </td>
                        <td className="py-3 pr-4">
                          <PlanSelector tenantId={t.id} current={t.plan}
                            onChange={(plan) => setTenants((prev) => prev.map((x) => x.id === t.id ? { ...x, plan } : x))} />
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
                            <Users size={11} className="text-gray-400" />{t.user_count}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-center">
                          <span className="inline-flex items-center gap-1 text-xs text-gray-600">
                            <Monitor size={11} className="text-gray-400" />{t.agent_count}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-center">
                          <span className="inline-flex items-center gap-1 text-xs text-gray-600">
                            <Shield size={11} className="text-gray-400" />{t.alert_count}
                          </span>
                        </td>
                        <td className="py-3 pr-4">
                          <span className="font-mono text-xs text-gray-400">{t.api_key_tail ?? '—'}</span>
                        </td>
                        <td className="py-3 pr-4 text-xs text-gray-400">{relDate(t.created_at)}</td>
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            {/* Manage button */}
                            <button onClick={() => setManageTenant(t)}
                              className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
                              <Settings size={11} /> Manage
                            </button>
                            {/* Activate / Deactivate */}
                            <button onClick={() => handleToggle(t)} disabled={toggling === t.id}
                              className={`inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border transition-colors ${t.is_active ? 'border-red-200 text-red-500 hover:bg-red-50' : 'border-green-200 text-green-600 hover:bg-green-50'} disabled:opacity-40`}>
                              {toggling === t.id ? <Loader2 size={11} className="animate-spin" /> : t.is_active ? <XCircle size={11} /> : <CheckCircle2 size={11} />}
                              {t.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                          </div>
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
        <CreateTenantModal onClose={() => setShowCreate(false)}
          onCreate={(t) => setTenants((prev) => [...prev, t])} />
      )}

      {manageTenant && (
        <ManageDrawer tenant={manageTenant} onClose={() => setManageTenant(null)} />
      )}
    </div>
  )
}
