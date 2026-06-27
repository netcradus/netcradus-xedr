import { useEffect, useState, useCallback, type FormEvent } from 'react'
import {
  Hash,
  MessageSquare,
  Mail,
  CheckCircle2,
  XCircle,
  RefreshCw,
  AlertTriangle,
  Send,
  Save,
  Eye,
  EyeOff,
  Bell,
} from 'lucide-react'
import Topbar from '@/components/layout/Topbar/Topbar'
import Card from '@/components/ui/Card/Card'
import { useAuthStore } from '@/store/authStore'
import {
  fetchNotificationConfig,
  updateNotificationConfig,
  testNotifications,
} from '@/api/notificationsApi'
import type { NotificationConfig } from '@/types/api.types'

// ── Helpers ───────────────────────────────────────────────────────────────────

type TestStatus = 'ok' | 'error' | 'not_configured' | 'dispatched' | null

function StatusChip({ status }: { status: TestStatus }) {
  if (!status) return null
  const cfg: Record<string, { cls: string; label: string }> = {
    ok:              { cls: 'bg-green-100 text-green-700',  label: 'Delivered' },
    dispatched:      { cls: 'bg-green-100 text-green-700',  label: 'Dispatched' },
    not_configured:  { cls: 'bg-gray-100 text-gray-500',    label: 'Not configured' },
    error:           { cls: 'bg-red-100 text-red-600',      label: 'Failed' },
  }
  const s = cfg[status] ?? cfg.error
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${s.cls}`}>{s.label}</span>
}

function ConfiguredBadge({ configured }: { configured: boolean }) {
  return configured ? (
    <span className="flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
      <CheckCircle2 size={11} /> Configured
    </span>
  ) : (
    <span className="flex items-center gap-1 text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
      <XCircle size={11} /> Not configured
    </span>
  )
}

// ── Slack card ─────────────────────────────────────────────────────────────────

interface SlackCardProps {
  cfg: NotificationConfig
  isAdmin: boolean
  testResult: TestStatus
  onSave: (url: string) => Promise<void>
}

function SlackCard({ cfg, isAdmin, testResult, onSave }: SlackCardProps) {
  const [url, setUrl] = useState(cfg.slack_webhook_url ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try { await onSave(url) }
    catch (err: unknown) { setError(err instanceof Error ? err.message : 'Save failed') }
    finally { setSaving(false) }
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-[#4A154B]/10 flex items-center justify-center">
            <Hash size={20} className="text-[#4A154B]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Slack</p>
            <p className="text-xs text-gray-400">Incoming Webhook</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {testResult && <StatusChip status={testResult} />}
          <ConfiguredBadge configured={!!cfg.slack_webhook_url} />
        </div>
      </div>

      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Webhook URL</label>
          <input
            type="url" value={url} onChange={(e) => setUrl(e.target.value)}
            disabled={!isAdmin}
            placeholder="https://hooks.slack.com/services/…"
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400 font-mono text-xs"
          />
        </div>
        <p className="text-xs text-gray-400">
          Create a Slack app → Incoming Webhooks → copy the URL here.
        </p>
        {error && <p className="text-xs text-red-500">{error}</p>}
        {isAdmin && (
          <button type="submit" disabled={saving}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-700 transition-colors disabled:opacity-50">
            {saving ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />}
            {saving ? 'Saving…' : 'Save'}
          </button>
        )}
      </form>
    </Card>
  )
}

// ── Teams card ─────────────────────────────────────────────────────────────────

interface TeamsCardProps {
  cfg: NotificationConfig
  isAdmin: boolean
  testResult: TestStatus
  onSave: (url: string) => Promise<void>
}

function TeamsCard({ cfg, isAdmin, testResult, onSave }: TeamsCardProps) {
  const [url, setUrl] = useState(cfg.teams_webhook_url ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try { await onSave(url) }
    catch (err: unknown) { setError(err instanceof Error ? err.message : 'Save failed') }
    finally { setSaving(false) }
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center">
            <MessageSquare size={20} className="text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Microsoft Teams</p>
            <p className="text-xs text-gray-400">Incoming Webhook</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {testResult && <StatusChip status={testResult} />}
          <ConfiguredBadge configured={!!cfg.teams_webhook_url} />
        </div>
      </div>

      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Webhook URL</label>
          <input
            type="url" value={url} onChange={(e) => setUrl(e.target.value)}
            disabled={!isAdmin}
            placeholder="https://outlook.office.com/webhook/…"
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400 font-mono text-xs"
          />
        </div>
        <p className="text-xs text-gray-400">
          In Teams → channel → Connectors → Incoming Webhook → copy URL here.
        </p>
        {error && <p className="text-xs text-red-500">{error}</p>}
        {isAdmin && (
          <button type="submit" disabled={saving}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-700 transition-colors disabled:opacity-50">
            {saving ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />}
            {saving ? 'Saving…' : 'Save'}
          </button>
        )}
      </form>
    </Card>
  )
}

// ── Email card ─────────────────────────────────────────────────────────────────

interface EmailCardProps {
  cfg: NotificationConfig
  isAdmin: boolean
  testResult: TestStatus
  onSave: (fields: Partial<NotificationConfig>) => Promise<void>
}

function EmailCard({ cfg, isAdmin, testResult, onSave }: EmailCardProps) {
  const [host, setHost]       = useState(cfg.email_smtp_host ?? '')
  const [port, setPort]       = useState(String(cfg.email_smtp_port ?? 587))
  const [user, setUser]       = useState(cfg.email_smtp_user ?? '')
  const [pass_, setPass]      = useState('')
  const [from_, setFrom]      = useState(cfg.email_smtp_from ?? '')
  const [to, setTo]           = useState(cfg.email_to ?? '')
  const [tls, setTls]         = useState(cfg.email_use_tls ?? true)
  const [showPass, setShowPass] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await onSave({
        email_smtp_host: host || null,
        email_smtp_port: Number(port) || 587,
        email_smtp_user: user || null,
        email_smtp_pass: pass_ || undefined,   // undefined = don't overwrite
        email_smtp_from: from_ || null,
        email_to:        to || null,
        email_use_tls:   tls,
      })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const isConfigured = !!(cfg.email_smtp_host && cfg.email_to)

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-orange-50 flex items-center justify-center">
            <Mail size={20} className="text-orange-500" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Email</p>
            <p className="text-xs text-gray-400">SMTP / TLS</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {testResult && <StatusChip status={testResult} />}
          <ConfiguredBadge configured={isConfigured} />
        </div>
      </div>

      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">SMTP Host</label>
            <input type="text" value={host} onChange={(e) => setHost(e.target.value)}
              disabled={!isAdmin} placeholder="smtp.gmail.com"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Port</label>
            <input type="number" value={port} onChange={(e) => setPort(e.target.value)}
              disabled={!isAdmin}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Username</label>
          <input type="email" value={user} onChange={(e) => setUser(e.target.value)}
            disabled={!isAdmin} placeholder="you@gmail.com"
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400" />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Password {cfg.email_smtp_pass && <span className="text-gray-400 font-normal">(saved — enter new to change)</span>}
          </label>
          <div className="relative">
            <input type={showPass ? 'text' : 'password'} value={pass_}
              onChange={(e) => setPass(e.target.value)}
              disabled={!isAdmin} placeholder={cfg.email_smtp_pass ? '••••••••' : 'App password'}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 pr-9 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400" />
            <button type="button" onClick={() => setShowPass((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              {showPass ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">From Address</label>
          <input type="email" value={from_} onChange={(e) => setFrom(e.target.value)}
            disabled={!isAdmin} placeholder="SentryXDR <alerts@company.com>"
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400" />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Recipients</label>
          <input type="text" value={to} onChange={(e) => setTo(e.target.value)}
            disabled={!isAdmin} placeholder="soc@company.com, manager@company.com"
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400" />
          <p className="text-xs text-gray-400 mt-1">Comma-separated for multiple recipients.</p>
        </div>

        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input type="checkbox" checked={tls} onChange={(e) => setTls(e.target.checked)}
            disabled={!isAdmin}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
          <span className="text-xs text-gray-700">Use STARTTLS (recommended)</span>
        </label>

        {error && <p className="text-xs text-red-500">{error}</p>}

        {isAdmin && (
          <button type="submit" disabled={saving}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-700 transition-colors disabled:opacity-50">
            {saving ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />}
            {saving ? 'Saving…' : 'Save'}
          </button>
        )}
      </form>
    </Card>
  )
}

// ── Notification rules ────────────────────────────────────────────────────────

interface RulesCardProps {
  cfg: NotificationConfig
  isAdmin: boolean
  onSave: (rules: Partial<NotificationConfig>) => Promise<void>
}

const RULES: { key: keyof NotificationConfig; label: string; description: string }[] = [
  { key: 'notify_on_critical',      label: 'Critical Alerts',    description: 'Fire when a new Critical severity alert is detected' },
  { key: 'notify_on_high',          label: 'High Alerts',        description: 'Fire when a new High severity alert is detected' },
  { key: 'notify_on_new_incident',  label: 'New Incidents',      description: 'Fire when correlated alerts form a new incident' },
  { key: 'notify_on_agent_offline', label: 'Agent Offline',      description: 'Fire when an endpoint agent stops responding' },
]

function RulesCard({ cfg, isAdmin, onSave }: RulesCardProps) {
  const [values, setValues] = useState({
    notify_on_critical:      cfg.notify_on_critical,
    notify_on_high:          cfg.notify_on_high,
    notify_on_new_incident:  cfg.notify_on_new_incident,
    notify_on_agent_offline: cfg.notify_on_agent_offline,
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)

  async function save() {
    setSaving(true)
    try {
      await onSave(values)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <div className="flex items-center gap-3 mb-5">
        <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center">
          <Bell size={20} className="text-blue-600" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Notification Rules</h3>
          <p className="text-xs text-gray-400">Choose which events trigger channel alerts</p>
        </div>
      </div>

      <div className="space-y-3">
        {RULES.map(({ key, label, description }) => (
          <label key={key} className={`flex items-start gap-3 p-3 rounded-xl border transition-colors cursor-pointer select-none ${
            values[key as keyof typeof values]
              ? 'border-blue-200 bg-blue-50/50'
              : 'border-gray-100 bg-gray-50/50 hover:bg-gray-50'
          }`}>
            <input
              type="checkbox"
              checked={!!values[key as keyof typeof values]}
              onChange={(e) =>
                setValues((v) => ({ ...v, [key]: e.target.checked }))
              }
              disabled={!isAdmin}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <div>
              <p className="text-sm font-medium text-gray-900">{label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{description}</p>
            </div>
          </label>
        ))}
      </div>

      {isAdmin && (
        <button
          onClick={save}
          disabled={saving}
          className="mt-4 flex items-center gap-1.5 text-sm font-medium px-4 py-2.5 rounded-lg bg-gray-900 text-white hover:bg-gray-700 transition-colors disabled:opacity-50"
        >
          {saving
            ? <RefreshCw size={14} className="animate-spin" />
            : saved
            ? <CheckCircle2 size={14} className="text-green-400" />
            : <Save size={14} />}
          {saving ? 'Saving…' : saved ? 'Saved!' : 'Save Rules'}
        </button>
      )}
    </Card>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Integrations() {
  const user    = useAuthStore((s) => s.user)
  const isAdmin = user?.role === 'Admin' || user?.role === 'SuperAdmin'

  const [cfg, setCfg]         = useState<NotificationConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [testing, setTesting] = useState(false)
  const [testResults, setTestResults] = useState<Record<string, TestStatus>>({})
  const [toast, setToast]     = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try { setCfg(await fetchNotificationConfig()) }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed to load config') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  async function save(partial: Partial<NotificationConfig>) {
    const updated = await updateNotificationConfig(partial)
    setCfg(updated)
    showToast('Configuration saved')
  }

  async function runTest() {
    setTesting(true)
    setTestResults({})
    try {
      const { results } = await testNotifications()
      const mapped: Record<string, TestStatus> = {}
      for (const [k, v] of Object.entries(results)) {
        mapped[k] = (v === 'ok' || v === 'dispatched') ? 'ok'
          : v === 'not_configured' ? 'not_configured'
          : 'error'
        if (v === 'dispatched') mapped[k] = 'dispatched'
      }
      setTestResults(mapped)
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Test failed')
    } finally {
      setTesting(false)
    }
  }

  if (loading) return (
    <div className="pb-8">
      <Topbar title="Integrations" subtitle="Notification channels & webhook configuration" />
      <div className="flex items-center justify-center py-32 gap-2 text-gray-400">
        <RefreshCw size={16} className="animate-spin" /> <span className="text-sm">Loading…</span>
      </div>
    </div>
  )

  if (error || !cfg) return (
    <div className="pb-8">
      <Topbar title="Integrations" subtitle="Notification channels & webhook configuration" />
      <div className="flex flex-col items-center justify-center py-32 gap-2 text-red-500">
        <AlertTriangle size={20} />
        <p className="text-sm">{error ?? 'Unknown error'}</p>
      </div>
    </div>
  )

  return (
    <div className="pb-8">
      <Topbar title="Integrations" subtitle="Notification channels & webhook configuration" />

      <div className="px-4 sm:px-6 lg:px-8 space-y-6">

        {/* ── Header row ── */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Configure where SentryXDR sends alerts. All channels fire simultaneously when a rule matches.
          </p>
          {isAdmin && (
            <button
              onClick={runTest}
              disabled={testing}
              className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {testing
                ? <RefreshCw size={14} className="animate-spin" />
                : <Send size={14} />}
              {testing ? 'Sending…' : 'Send Test'}
            </button>
          )}
        </div>

        {/* ── Channel cards ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <SlackCard
            cfg={cfg} isAdmin={isAdmin}
            testResult={testResults['slack'] ?? null}
            onSave={(url) => save({ slack_webhook_url: url || null })}
          />
          <TeamsCard
            cfg={cfg} isAdmin={isAdmin}
            testResult={testResults['teams'] ?? null}
            onSave={(url) => save({ teams_webhook_url: url || null })}
          />
          <EmailCard
            cfg={cfg} isAdmin={isAdmin}
            testResult={testResults['email'] ?? null}
            onSave={(fields) => save(fields)}
          />
        </div>

        {/* ── Rules ── */}
        <div className="max-w-lg">
          <RulesCard cfg={cfg} isAdmin={isAdmin} onSave={(rules) => save(rules)} />
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 bg-gray-900 text-white text-sm px-4 py-3 rounded-xl shadow-xl animate-slide-in">
          <CheckCircle2 size={15} className="text-green-400 shrink-0" /> {toast}
        </div>
      )}
    </div>
  )
}
