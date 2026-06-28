import { useEffect, useState, useCallback, type FormEvent } from 'react'
import {
  Building2,
  Users,
  User as UserIcon,
  Copy,
  Check,
  RefreshCw,
  AlertTriangle,
  Plus,
  X,
  Shield,
  Key,
  CheckCircle2,
  UserX,
  UserCheck,
  Eye,
  EyeOff,
  Smartphone,
  Lock,
  Unlock,
} from 'lucide-react'
import Topbar from '@/components/layout/Topbar/Topbar'
import Card from '@/components/ui/Card/Card'
import { useAuthStore } from '@/store/authStore'
import {
  fetchOrg,
  updateOrg,
  fetchTeam,
  inviteMember,
  changeRole,
  toggleUserStatus,
  changePassword,
} from '@/api/settingsApi'
import { apiMfaSetup, apiMfaEnable, apiMfaDisable, type MFASetupData } from '@/api/authApi'
import type { BackendTeamMember, BackendOrg } from '@/types/api.types'

// ── Helpers ───────────────────────────────────────────────────────────────────

type Tab = 'org' | 'team' | 'account'

const ASSIGNABLE_ROLES = ['Admin', 'Analyst', 'Viewer']

const ROLE_STYLE: Record<string, string> = {
  SuperAdmin: 'bg-purple-100 text-purple-700',
  Admin:      'bg-blue-100 text-blue-700',
  Analyst:    'bg-teal-100 text-teal-700',
  Viewer:     'bg-gray-100 text-gray-600',
}

function RoleBadge({ role }: { role: string }) {
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ROLE_STYLE[role] ?? 'bg-gray-100 text-gray-600'}`}>
      {role}
    </span>
  )
}

function initials(name: string) {
  return name.trim().split(' ').map((p) => p[0] ?? '').join('').slice(0, 2).toUpperCase() || '?'
}

// ── Copy button ───────────────────────────────────────────────────────────────

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={copy} title="Copy to clipboard"
      className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
      {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
    </button>
  )
}

// ── Invite Modal ──────────────────────────────────────────────────────────────

interface InviteModalProps {
  onClose: () => void
  onSuccess: (member: BackendTeamMember) => void
}

function InviteModal({ onClose, onSuccess }: InviteModalProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('Analyst')
  const [tempPwd, setTempPwd] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function generatePassword() {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$'
    setTempPwd(Array.from({ length: 14 }, () => chars[Math.floor(Math.random() * chars.length)]).join(''))
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim() || !email.trim() || !tempPwd.trim()) {
      setError('All fields are required.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const member = await inviteMember({ name, email, role, temp_password: tempPwd })
      onSuccess(member)
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to invite member')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Invite Team Member</h2>
            <p className="text-xs text-gray-400 mt-0.5">Add someone to your organization</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={submit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Full Name</label>
            <input
              type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Jane Smith" autoFocus
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Work Email</label>
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@company.com"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Role</label>
            <select
              value={role} onChange={(e) => setRole(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {ASSIGNABLE_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Temporary Password</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showPwd ? 'text' : 'password'} value={tempPwd}
                  onChange={(e) => setTempPwd(e.target.value)}
                  placeholder="Min 8 characters"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 pr-9 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button type="button" onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <button type="button" onClick={generatePassword}
                className="text-xs font-medium px-3 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 whitespace-nowrap transition-colors">
                Generate
              </button>
              {tempPwd && <CopyButton value={tempPwd} />}
            </div>
            <p className="text-xs text-gray-400 mt-1">Share this with the team member — they can change it from Settings.</p>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2.5">
              <AlertTriangle size={14} /> {error}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg py-2.5 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg py-2.5 transition-colors disabled:opacity-60">
              {loading ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
              {loading ? 'Creating…' : 'Create Member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Org Tab ───────────────────────────────────────────────────────────────────

function OrgTab({ isAdmin }: { isAdmin: boolean }) {
  const [org, setOrg] = useState<BackendOrg | null>(null)
  const [loading, setLoading] = useState(true)
  const [orgName, setOrgName] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchOrg()
      .then((data) => { setOrg(data); setOrgName(data.name) })
      .catch(() => setError('Failed to load organization info'))
      .finally(() => setLoading(false))
  }, [])

  async function saveOrgName() {
    if (!orgName.trim() || orgName === org?.name) return
    setSaving(true)
    setError(null)
    try {
      const updated = await updateOrg(orgName.trim())
      setOrg(updated)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to update name')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20 gap-2 text-gray-400">
      <RefreshCw size={15} className="animate-spin" /> <span className="text-sm">Loading…</span>
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Org name */}
      <Card>
        <div className="flex items-center gap-3 mb-5">
          <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center">
            <Building2 size={20} className="text-blue-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Organization Profile</h3>
            <p className="text-xs text-gray-400">Name shown to all team members</p>
          </div>
        </div>

        <div className="space-y-4 max-w-md">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Organization Name</label>
            <div className="flex gap-2">
              <input
                type="text" value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                disabled={!isAdmin}
                onKeyDown={(e) => e.key === 'Enter' && saveOrgName()}
                className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
              />
              {isAdmin && (
                <button
                  onClick={saveOrgName}
                  disabled={saving || orgName === org?.name}
                  className="flex items-center gap-1.5 text-sm font-medium px-4 py-2.5 rounded-lg bg-gray-900 text-white hover:bg-gray-700 transition-colors disabled:opacity-40"
                >
                  {saving ? <RefreshCw size={13} className="animate-spin" /> : saved ? <Check size={13} className="text-green-400" /> : null}
                  {saving ? 'Saving…' : saved ? 'Saved' : 'Save'}
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Tenant ID</label>
            <div className="flex items-center gap-2">
              <input type="text" value={org?.id ?? '—'} readOnly
                className="flex-1 text-sm border border-gray-100 rounded-lg px-3 py-2.5 bg-gray-50 text-gray-500 font-mono" />
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-3 flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2.5 max-w-md">
            <AlertTriangle size={14} /> {error}
          </div>
        )}
      </Card>

      {/* API key */}
      <Card>
        <div className="flex items-center gap-3 mb-5">
          <div className="h-10 w-10 rounded-xl bg-amber-50 flex items-center justify-center">
            <Key size={20} className="text-amber-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">API Key</h3>
            <p className="text-xs text-gray-400">Used by agents and external integrations</p>
          </div>
        </div>

        <div className="max-w-md">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={org?.api_key ? `${org.api_key.slice(0, 8)}${'•'.repeat(24)}${org.api_key.slice(-4)}` : 'Not configured'}
              readOnly
              className="flex-1 text-sm border border-gray-100 rounded-lg px-3 py-2.5 bg-gray-50 text-gray-600 font-mono"
            />
            {org?.api_key && <CopyButton value={org.api_key} />}
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Include this key as <span className="font-mono bg-gray-100 px-1 py-0.5 rounded">X-API-Key</span> header for agent registration.
          </p>
        </div>
      </Card>

      {/* Plan */}
      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-purple-50 flex items-center justify-center">
              <Shield size={20} className="text-purple-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Plan</h3>
              <p className="text-xs text-gray-400">Current subscription tier</p>
            </div>
          </div>
          <span className="text-sm font-semibold text-purple-700 bg-purple-100 px-3 py-1 rounded-full">
            Pro
          </span>
        </div>
      </Card>
    </div>
  )
}

// ── Team Tab ──────────────────────────────────────────────────────────────────

function TeamTab({ isAdmin, currentUserId }: { isAdmin: boolean; currentUserId: string }) {
  const [members, setMembers] = useState<BackendTeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showInvite, setShowInvite] = useState(false)
  const [actionLoading, setActionLoading] = useState<number | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setMembers(await fetchTeam())
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load team')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  async function handleRoleChange(member: BackendTeamMember, role: string) {
    setActionLoading(member.id)
    try {
      const updated = await changeRole(member.id, role)
      setMembers((prev) => prev.map((m) => m.id === updated.id ? updated : m))
      showToast(`${updated.name}'s role updated to ${updated.role}`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to change role')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleToggleStatus(member: BackendTeamMember) {
    const action = member.is_active ? 'Deactivate' : 'Reactivate'
    if (!confirm(`${action} ${member.name}?`)) return
    setActionLoading(member.id)
    try {
      const updated = await toggleUserStatus(member.id)
      setMembers((prev) => prev.map((m) => m.id === updated.id ? updated : m))
      showToast(`${updated.name} ${updated.is_active ? 'reactivated' : 'deactivated'}`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to update status')
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div>
      <Card>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Team Members</h3>
            <p className="text-xs text-gray-400 mt-0.5">{members.length} member{members.length !== 1 ? 's' : ''} in this organization</p>
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowInvite(true)}
              className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-700 transition-colors"
            >
              <Plus size={14} /> Invite Member
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 gap-2 text-gray-400">
            <RefreshCw size={15} className="animate-spin" /> <span className="text-sm">Loading team…</span>
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2.5">
            <AlertTriangle size={14} /> {error}
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {members.map((member) => {
              const isSelf = String(member.id) === currentUserId
              const busy = actionLoading === member.id
              return (
                <div key={member.id} className={`flex items-center gap-4 py-3.5 ${!member.is_active ? 'opacity-50' : ''}`}>
                  {/* Avatar */}
                  <div className="h-9 w-9 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                    {initials(member.name)}
                  </div>

                  {/* Name + email */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900 truncate">{member.name}</p>
                      {isSelf && <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">You</span>}
                      {!member.is_active && <span className="text-xs text-red-500 bg-red-50 rounded-full px-2 py-0.5">Inactive</span>}
                    </div>
                    <p className="text-xs text-gray-400 truncate">{member.email}</p>
                  </div>

                  {/* Role */}
                  <div className="shrink-0">
                    {isAdmin && !isSelf && member.role !== 'SuperAdmin' ? (
                      <select
                        value={member.role}
                        onChange={(e) => handleRoleChange(member, e.target.value)}
                        disabled={busy}
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                      >
                        {ASSIGNABLE_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    ) : (
                      <RoleBadge role={member.role} />
                    )}
                  </div>

                  {/* Toggle status */}
                  {isAdmin && !isSelf && member.role !== 'SuperAdmin' && (
                    <button
                      onClick={() => handleToggleStatus(member)}
                      disabled={busy}
                      title={member.is_active ? 'Deactivate user' : 'Reactivate user'}
                      className={`p-2 rounded-lg transition-colors disabled:opacity-40 ${
                        member.is_active
                          ? 'text-red-400 hover:bg-red-50 hover:text-red-600'
                          : 'text-green-500 hover:bg-green-50 hover:text-green-700'
                      }`}
                    >
                      {busy
                        ? <RefreshCw size={15} className="animate-spin" />
                        : member.is_active ? <UserX size={15} /> : <UserCheck size={15} />
                      }
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {showInvite && (
        <InviteModal
          onClose={() => setShowInvite(false)}
          onSuccess={(member) => {
            setMembers((prev) => [...prev, member])
            showToast(`${member.name} added as ${member.role}`)
          }}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 bg-gray-900 text-white text-sm px-4 py-3 rounded-xl shadow-xl animate-slide-in">
          <CheckCircle2 size={15} className="text-green-400 shrink-0" /> {toast}
        </div>
      )}
    </div>
  )
}

// ── MFA Card ──────────────────────────────────────────────────────────────────

type MFAPhase = 'idle' | 'setup' | 'confirm-enable' | 'confirm-disable'

function MFACard({ mfaEnabled, onToggle }: { mfaEnabled: boolean; onToggle: (enabled: boolean) => void }) {
  const [phase, setPhase] = useState<MFAPhase>('idle')
  const [setupData, setSetupData] = useState<MFASetupData | null>(null)
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  function reset() {
    setPhase('idle')
    setSetupData(null)
    setCode('')
    setError(null)
  }

  async function startSetup() {
    setLoading(true)
    setError(null)
    try {
      const data = await apiMfaSetup()
      setSetupData(data)
      setPhase('setup')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to start MFA setup')
    } finally {
      setLoading(false)
    }
  }

  async function confirmEnable(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const result = await apiMfaEnable(code)
    setLoading(false)
    if (result.success) {
      onToggle(true)
      setSuccess('MFA enabled! Your account is now protected.')
      reset()
    } else {
      setError(result.error ?? 'Invalid code')
    }
  }

  async function confirmDisable(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const result = await apiMfaDisable(code)
    setLoading(false)
    if (result.success) {
      onToggle(false)
      setSuccess('MFA has been disabled.')
      reset()
    } else {
      setError(result.error ?? 'Invalid code')
    }
  }

  return (
    <Card>
      <div className="flex items-center gap-3 mb-5">
        <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center">
          <Smartphone size={20} className="text-indigo-600" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-gray-900">Two-Factor Authentication (MFA)</h3>
          <p className="text-xs text-gray-400">Use Google Authenticator or any TOTP app</p>
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
          mfaEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
        }`}>
          {mfaEnabled ? 'Enabled' : 'Disabled'}
        </span>
      </div>

      {success && (
        <div className="mb-4 flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2.5">
          <CheckCircle2 size={14} /> {success}
        </div>
      )}

      {/* Idle state */}
      {phase === 'idle' && (
        mfaEnabled ? (
          <button
            onClick={() => { setPhase('confirm-disable'); setError(null) }}
            className="flex items-center gap-1.5 text-sm font-medium text-red-600 hover:text-red-700 px-3 py-2 rounded-lg hover:bg-red-50 transition-colors"
          >
            <Unlock size={14} /> Disable MFA
          </button>
        ) : (
          <button
            onClick={startSetup}
            disabled={loading}
            className="flex items-center gap-1.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2.5 rounded-lg transition-colors disabled:opacity-60"
          >
            {loading ? <RefreshCw size={14} className="animate-spin" /> : <Lock size={14} />}
            {loading ? 'Loading…' : 'Enable MFA'}
          </button>
        )
      )}

      {/* Setup: show QR code */}
      {phase === 'setup' && setupData && (
        <div className="max-w-sm space-y-4">
          <p className="text-sm text-gray-600">
            Scan this QR code with <strong>Google Authenticator</strong>, Authy, or any TOTP app.
          </p>
          {setupData.qr_code ? (
            <img src={setupData.qr_code} alt="MFA QR code" className="w-48 h-48 border rounded-lg" />
          ) : (
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1">Manual entry key:</p>
              <p className="font-mono text-sm text-gray-800 break-all">{setupData.secret}</p>
            </div>
          )}
          <button
            onClick={() => setPhase('confirm-enable')}
            className="text-sm font-medium text-indigo-600 hover:underline"
          >
            I've scanned it — enter my code →
          </button>
          <button onClick={reset} className="block text-xs text-gray-400 hover:text-gray-600">
            Cancel
          </button>
        </div>
      )}

      {/* Confirm enable */}
      {phase === 'confirm-enable' && (
        <form onSubmit={confirmEnable} className="max-w-xs space-y-4">
          <p className="text-sm text-gray-600">Enter the 6-digit code from your authenticator app to confirm.</p>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            autoFocus
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            className="w-full text-xl tracking-[0.4em] font-mono text-center border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              <AlertTriangle size={13} /> {error}
            </div>
          )}
          <div className="flex gap-3">
            <button type="button" onClick={reset}
              className="flex-1 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg py-2 transition-colors">
              Back
            </button>
            <button type="submit" disabled={loading || code.length < 6}
              className="flex-1 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg py-2 transition-colors disabled:opacity-60">
              {loading ? 'Verifying…' : 'Activate MFA'}
            </button>
          </div>
        </form>
      )}

      {/* Confirm disable */}
      {phase === 'confirm-disable' && (
        <form onSubmit={confirmDisable} className="max-w-xs space-y-4">
          <p className="text-sm text-gray-600">Enter your current authenticator code to disable MFA.</p>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            autoFocus
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            className="w-full text-xl tracking-[0.4em] font-mono text-center border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-red-500"
          />
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              <AlertTriangle size={13} /> {error}
            </div>
          )}
          <div className="flex gap-3">
            <button type="button" onClick={reset}
              className="flex-1 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg py-2 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading || code.length < 6}
              className="flex-1 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg py-2 transition-colors disabled:opacity-60">
              {loading ? 'Disabling…' : 'Disable MFA'}
            </button>
          </div>
        </form>
      )}
    </Card>
  )
}

// ── Account Tab ───────────────────────────────────────────────────────────────

function AccountTab() {
  const user = useAuthStore((s) => s.user)
  const [mfaEnabled, setMfaEnabled] = useState(user?.mfaEnabled ?? false)
  const [currentPwd, setCurrentPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (newPwd.length < 8) { setError('New password must be at least 8 characters.'); return }
    if (newPwd !== confirmPwd) { setError('Passwords do not match.'); return }
    setSaving(true)
    setError(null)
    try {
      await changePassword(currentPwd, newPwd)
      setSuccess(true)
      setCurrentPwd(''); setNewPwd(''); setConfirmPwd('')
      setTimeout(() => setSuccess(false), 3000)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to update password')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Profile card */}
      <Card>
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-full bg-blue-600 flex items-center justify-center text-white text-lg font-bold shrink-0">
            {user?.initials ?? '?'}
          </div>
          <div>
            <p className="text-base font-semibold text-gray-900">{user?.firstName} {user?.lastName}</p>
            <p className="text-sm text-gray-400">{user?.email}</p>
            <div className="mt-1.5">
              <RoleBadge role={user?.role ?? 'Viewer'} />
            </div>
          </div>
        </div>
      </Card>

      {/* Change password */}
      <Card>
        <div className="flex items-center gap-3 mb-5">
          <div className="h-10 w-10 rounded-xl bg-gray-50 flex items-center justify-center">
            <Key size={20} className="text-gray-500" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Change Password</h3>
            <p className="text-xs text-gray-400">Use a strong password you don't use elsewhere</p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-4 max-w-md">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Current Password</label>
            <input
              type="password" value={currentPwd} onChange={(e) => setCurrentPwd(e.target.value)}
              required placeholder="Enter current password"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">New Password</label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'} value={newPwd} onChange={(e) => setNewPwd(e.target.value)}
                required placeholder="Min 8 characters"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 pr-9 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button type="button" onClick={() => setShowNew((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showNew ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Confirm New Password</label>
            <input
              type="password" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)}
              required placeholder="Repeat new password"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2.5">
              <AlertTriangle size={14} /> {error}
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2.5">
              <CheckCircle2 size={14} /> Password updated successfully.
            </div>
          )}

          <button
            type="submit" disabled={saving}
            className="flex items-center justify-center gap-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg px-5 py-2.5 transition-colors disabled:opacity-60"
          >
            {saving ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
            {saving ? 'Updating…' : 'Update Password'}
          </button>
        </form>
      </Card>

      {/* MFA */}
      <MFACard mfaEnabled={mfaEnabled} onToggle={setMfaEnabled} />
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string; Icon: typeof Building2 }[] = [
  { id: 'org',     label: 'Organization',  Icon: Building2 },
  { id: 'team',    label: 'Team Members',  Icon: Users     },
  { id: 'account', label: 'My Account',    Icon: UserIcon  },
]

export default function Settings() {
  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.role === 'Admin' || user?.role === 'SuperAdmin'
  const [tab, setTab] = useState<Tab>('org')

  return (
    <div className="pb-8">
      <Topbar title="Settings" subtitle="Organization, team, and account management" />

      <div className="px-4 sm:px-6 lg:px-8 space-y-4">
        {/* Tab bar */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg transition-colors ${
                tab === id
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === 'org'     && <OrgTab isAdmin={isAdmin} />}
        {tab === 'team'    && <TeamTab isAdmin={isAdmin} currentUserId={user?.id ?? ''} />}
        {tab === 'account' && <AccountTab />}
      </div>
    </div>
  )
}
