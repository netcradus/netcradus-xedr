import { useEffect, useState, useCallback } from 'react'
import {
  Monitor, Wifi, WifiOff, RefreshCw, AlertTriangle, Clock,
  ShieldOff, ShieldCheck, Plus, Copy, Check, X, Terminal,
  Package, Key, ChevronRight, Loader2,
} from 'lucide-react'
import Topbar from '@/components/layout/Topbar/Topbar'
import Card from '@/components/ui/Card/Card'
import { fetchAgents, fetchOnboardingInfo } from '@/api/agentsApi'
import { isolateHost, restoreHost } from '@/api/commandsApi'
import { useAuthStore } from '@/store/authStore'
import type { BackendAgent, OnboardingInfo } from '@/types/api.types'

// ── Copy button ───────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <button
      onClick={copy}
      className="shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
      title="Copy"
    >
      {copied ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
    </button>
  )
}

// ── Onboarding wizard ─────────────────────────────────────────────────────────

const STEPS = ['Prerequisites', 'Install Agent', 'Verify Connection']

const POLL_INTERVAL_MS = 5000

function AgentOnboardingModal({
  onClose,
  onDone,
}: {
  onClose: () => void
  onDone: () => void
}) {
  const [step, setStep] = useState(0)
  const [info, setInfo] = useState<OnboardingInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [serverUrl, setServerUrl] = useState(window.location.origin.replace(':5173', ':8000'))

  // Verification state
  const [initialAgentIds, setInitialAgentIds] = useState<Set<number>>(new Set())
  const [verifying, setVerifying] = useState(false)
  const [verified, setVerified] = useState(false)
  const [newAgent, setNewAgent] = useState<BackendAgent | null>(null)
  const [lastChecked, setLastChecked] = useState<Date | null>(null)
  const [pollTick, setPollTick] = useState(0)

  // Load onboarding config + snapshot existing agent IDs on mount
  useEffect(() => {
    Promise.all([
      fetchOnboardingInfo(),
      fetchAgents(),
    ]).then(([inf, agents]) => {
      setInfo(inf)
      setInitialAgentIds(new Set(agents.map((a) => a.id)))
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  // Auto-poll every 5 s while on the Verify step and not yet verified
  useEffect(() => {
    if (step !== 2 || verified) return
    const id = setInterval(() => setPollTick((t) => t + 1), POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [step, verified])

  // Run a check whenever pollTick increments (auto) or handleVerify is called
  useEffect(() => {
    if (step !== 2 || verified || pollTick === 0) return
    let cancelled = false
    setVerifying(true)
    fetchAgents().then((agents) => {
      if (cancelled) return
      setLastChecked(new Date())
      const found = agents.find((a) => !initialAgentIds.has(a.id))
      if (found) {
        setNewAgent(found)
        setVerified(true)
      }
    }).catch(() => {}).finally(() => { if (!cancelled) setVerifying(false) })
    return () => { cancelled = true }
  }, [pollTick, step, verified, initialAgentIds])

  async function handleVerify() {
    setVerifying(true)
    try {
      const agents = await fetchAgents()
      setLastChecked(new Date())
      const found = agents.find((a) => !initialAgentIds.has(a.id))
      if (found) {
        setNewAgent(found)
        setVerified(true)
      }
    } catch { /* ignore */ } finally {
      setVerifying(false)
    }
  }

  const apiKey  = info?.tenant_api_key ?? '<YOUR_TENANT_API_KEY>'
  const linuxCmd = `python3 agent/main.py --server ${serverUrl} --tenant-api-key ${apiKey}`
  const winCmd   = `python agent\\main.py --server ${serverUrl} --tenant-api-key ${apiKey}`
  const pipCmd   = `pip install requests watchdog psutil`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2">
            <Monitor size={18} className="text-blue-600" />
            <h2 className="text-base font-semibold text-gray-900">Add New Agent</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center px-6 py-4 border-b border-gray-100 shrink-0">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center flex-1">
              <div className="flex items-center gap-2">
                <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  i < step ? 'bg-green-500 text-white' :
                  i === step ? 'bg-blue-600 text-white' :
                  'bg-gray-100 text-gray-400'
                }`}>
                  {i < step ? <Check size={12} /> : i + 1}
                </div>
                <span className={`text-xs font-medium ${i === step ? 'text-blue-600' : i < step ? 'text-green-600' : 'text-gray-400'}`}>
                  {s}
                </span>
              </div>
              {i < STEPS.length - 1 && <div className="flex-1 mx-3 h-px bg-gray-200" />}
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading ? (
            <div className="flex items-center justify-center py-8 gap-2 text-gray-400">
              <Loader2 size={16} className="animate-spin" />
              <span className="text-sm">Loading configuration…</span>
            </div>
          ) : step === 0 ? (
            // ── Step 0: Prerequisites ─────────────────────────────────────
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Package size={15} className="text-blue-500" />
                  <h3 className="text-sm font-semibold text-gray-800">Requirements</h3>
                </div>
                <ul className="text-sm text-gray-600 space-y-1 ml-5 list-disc">
                  <li>Python 3.8 or newer</li>
                  <li>Network access to this SentryXDR server</li>
                  <li>Admin / root privileges (for network isolation commands)</li>
                </ul>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Terminal size={15} className="text-blue-500" />
                  <h3 className="text-sm font-semibold text-gray-800">Install dependencies</h3>
                </div>
                <div className="flex items-center gap-2 bg-gray-900 rounded-lg px-4 py-3">
                  <code className="flex-1 text-sm text-green-400 font-mono">{pipCmd}</code>
                  <CopyButton text={pipCmd} />
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Key size={15} className="text-blue-500" />
                  <h3 className="text-sm font-semibold text-gray-800">Your tenant API key</h3>
                </div>
                <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
                  <code className="flex-1 text-sm font-mono text-gray-700 break-all">
                    {info?.tenant_api_key ?? 'Loading…'}
                  </code>
                  {info?.tenant_api_key && <CopyButton text={info.tenant_api_key} />}
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Unique to <strong>{info?.tenant_name}</strong> — agents registered with it appear in this workspace only.
                </p>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-800 mb-2">Server URL</h3>
                <input
                  type="text"
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">The URL where the agent should reach this backend.</p>
              </div>
            </div>
          ) : step === 1 ? (
            // ── Step 1: Install ───────────────────────────────────────────
            <div className="space-y-5">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Terminal size={15} className="text-blue-500" />
                  <h3 className="text-sm font-semibold text-gray-800">Linux / macOS</h3>
                </div>
                <div className="flex items-start gap-2 bg-gray-900 rounded-lg px-4 py-3">
                  <code className="flex-1 text-sm text-green-400 font-mono whitespace-pre-wrap break-all">{linuxCmd}</code>
                  <CopyButton text={linuxCmd} />
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Terminal size={15} className="text-blue-500" />
                  <h3 className="text-sm font-semibold text-gray-800">Windows (Command Prompt / PowerShell)</h3>
                </div>
                <div className="flex items-start gap-2 bg-gray-900 rounded-lg px-4 py-3">
                  <code className="flex-1 text-sm text-green-400 font-mono whitespace-pre-wrap break-all">{winCmd}</code>
                  <CopyButton text={winCmd} />
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-100 rounded-lg px-4 py-3 text-xs text-amber-700">
                The agent runs continuously in the foreground. Use a process manager (systemd, NSSM) or <code className="font-mono">screen</code> / <code className="font-mono">tmux</code> to keep it running in the background.
              </div>

              <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-xs text-blue-700">
                The agent registers itself automatically on first run and sends heartbeats every 15 seconds. It will appear in Assets within 30 seconds.
              </div>
            </div>
          ) : (
            // ── Step 2: Verify ────────────────────────────────────────────
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Start the agent on the target machine. This page polls every 5 seconds and will confirm automatically the moment a new agent connects.
              </p>

              {verified && newAgent ? (
                // ── Success ───────────────────────────────────────────────
                <div className="rounded-xl border border-green-200 bg-green-50 overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-3 border-b border-green-200">
                    <ShieldCheck size={18} className="text-green-600 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-green-800">Agent verified and connected!</p>
                      <p className="text-xs text-green-600">The new agent checked in successfully. You can now close this wizard.</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-px bg-green-200">
                    {[
                      { label: 'Hostname', value: newAgent.hostname },
                      { label: 'IP Address', value: newAgent.ip_address },
                      { label: 'OS', value: newAgent.os_type },
                      { label: 'Agent Version', value: newAgent.agent_version },
                    ].map(({ label, value }) => (
                      <div key={label} className="bg-white px-4 py-2.5">
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
                        <p className="text-sm font-medium text-gray-800 mt-0.5">{value || '—'}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                // ── Waiting ───────────────────────────────────────────────
                <div>
                  <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-4 mb-3">
                    <div className="relative shrink-0">
                      <div className="h-10 w-10 rounded-full border-2 border-blue-200 flex items-center justify-center">
                        <Monitor size={18} className="text-gray-400" />
                      </div>
                      {verifying && (
                        <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-blue-600 flex items-center justify-center">
                          <Loader2 size={10} className="text-white animate-spin" />
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700">
                        {verifying ? 'Checking for new agents…' : 'Waiting for agent connection'}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {lastChecked
                          ? `Last checked ${lastChecked.toLocaleTimeString()} · auto-checks every 5 s`
                          : 'Will check automatically every 5 seconds'}
                      </p>
                    </div>
                    <div className="ml-auto flex gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>

                  <button
                    onClick={handleVerify}
                    disabled={verifying}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    {verifying ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                    Check Now
                  </button>
                </div>
              )}

              <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-xs text-blue-700">
                <strong>How it works:</strong> verification detects agents that were not present when you opened this wizard — existing agents do not count. The Done button unlocks once a new agent is confirmed.
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 shrink-0">
          <button
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="text-sm px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-colors"
          >
            Back
          </button>
          <div className="flex gap-3">
            <button onClick={onClose} className="text-sm px-4 py-2 text-gray-500 hover:text-gray-700">
              Cancel
            </button>
            {step < STEPS.length - 1 ? (
              <button
                onClick={() => setStep((s) => s + 1)}
                className="inline-flex items-center gap-2 text-sm px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Next <ChevronRight size={14} />
              </button>
            ) : (
              <button
                onClick={() => { onDone(); onClose() }}
                disabled={!verified}
                title={verified ? 'Agent verified — close wizard' : 'Waiting for a new agent to connect…'}
                className={`inline-flex items-center gap-2 text-sm px-4 py-2 rounded-lg transition-colors ${
                  verified
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                <Check size={14} />
                {verified ? 'Done — View Agent' : 'Waiting for agent…'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatLastSeen(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

type StatusFilter = 'All' | 'Online' | 'Offline'

export default function Assets() {
  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.role === 'Admin' || user?.role === 'SuperAdmin'

  const [agents, setAgents] = useState<BackendAgent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All')
  const [search, setSearch] = useState('')
  const [actionLoading, setActionLoading] = useState<number | null>(null)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const [showOnboarding, setShowOnboarding] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchAgents()
      setAgents(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load agents')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const onlineCount = agents.filter((a) => a.status === 'Online').length
  const offlineCount = agents.filter((a) => a.status === 'Offline').length

  const filtered = agents.filter((a) => {
    if (statusFilter !== 'All' && a.status !== statusFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        a.hostname.toLowerCase().includes(q) ||
        a.ip_address.toLowerCase().includes(q) ||
        a.os_type.toLowerCase().includes(q)
      )
    }
    return true
  })

  async function handleIsolate(agent: BackendAgent) {
    if (!confirm(`Isolate ${agent.hostname}? This will cut its network connectivity.`)) return
    setActionLoading(agent.id)
    try {
      await isolateHost(agent.id)
      showToast(`Isolate command dispatched to ${agent.hostname}`, true)
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Command failed', false)
    } finally {
      setActionLoading(null)
    }
  }

  async function handleRestore(agent: BackendAgent) {
    if (!confirm(`Restore ${agent.hostname}? This will re-enable full network access.`)) return
    setActionLoading(agent.id)
    try {
      await restoreHost(agent.id)
      showToast(`Restore command dispatched to ${agent.hostname}`, true)
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Command failed', false)
    } finally {
      setActionLoading(null)
    }
  }

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 4000)
  }

  return (
    <div className="pb-8">
      <Topbar
        title="Assets"
        subtitle={`${agents.length} endpoints · ${onlineCount} online · ${offlineCount} offline`}
        onRefresh={load}
      />

      <div className="px-4 sm:px-6 lg:px-8 space-y-4">
        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-gray-200 bg-white p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <Monitor size={20} className="text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{agents.length}</p>
              <p className="text-xs text-gray-500">Total Endpoints</p>
            </div>
          </div>
          <div className="rounded-lg border border-green-200 bg-green-50 p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
              <Wifi size={20} className="text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-700">{onlineCount}</p>
              <p className="text-xs text-green-600">Online</p>
            </div>
          </div>
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-red-100 flex items-center justify-center">
              <WifiOff size={20} className="text-red-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">{offlineCount}</p>
              <p className="text-xs text-red-500">Offline</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
            {(['All', 'Online', 'Offline'] as StatusFilter[]).map((f) => (
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

          <input
            type="text"
            placeholder="Search hostname, IP, OS…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 w-56 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <span className="text-sm text-gray-400">{filtered.length} results</span>

          {isAdmin && (
            <button
              onClick={() => setShowOnboarding(true)}
              className="ml-auto inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={14} /> Add Agent
            </button>
          )}
        </div>

        {/* Table */}
        <Card>
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-2 text-gray-400">
              <RefreshCw size={16} className="animate-spin" />
              <span className="text-sm">Loading endpoints…</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-red-500">
              <AlertTriangle size={20} />
              <p className="text-sm">{error}</p>
              <button onClick={load} className="text-xs underline mt-1">Retry</button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-gray-400 text-sm">No endpoints found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                    <th className="font-medium py-2 pr-4">Status</th>
                    <th className="font-medium py-2 pr-4">Hostname</th>
                    <th className="font-medium py-2 pr-4">IP Address</th>
                    <th className="font-medium py-2 pr-4">OS</th>
                    <th className="font-medium py-2 pr-4">Agent Version</th>
                    <th className="font-medium py-2 pr-4">Last Seen</th>
                    {isAdmin && <th className="font-medium py-2">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((agent) => {
                    const isOnline = agent.status === 'Online'
                    const busy = actionLoading === agent.id
                    return (
                      <tr key={agent.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
                        <td className="py-3 pr-4">
                          <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
                            isOnline ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                          }`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                            {agent.status}
                          </span>
                        </td>
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2">
                            <Monitor size={15} className="text-gray-400 shrink-0" />
                            <span className="font-medium text-gray-900">{agent.hostname}</span>
                          </div>
                        </td>
                        <td className="py-3 pr-4 text-gray-600 font-mono text-xs">{agent.ip_address}</td>
                        <td className="py-3 pr-4 text-gray-600">{agent.os_type}</td>
                        <td className="py-3 pr-4 text-gray-500 text-xs">{agent.agent_version}</td>
                        <td className="py-3 pr-4 text-gray-400 text-xs">
                          <div className="flex items-center gap-1">
                            <Clock size={12} />
                            {formatLastSeen(agent.last_seen)}
                          </div>
                        </td>
                        {isAdmin && (
                          <td className="py-3">
                            <div className="flex items-center gap-2">
                              {isOnline ? (
                                <button
                                  onClick={() => handleIsolate(agent)}
                                  disabled={busy}
                                  title="Isolate this endpoint from the network"
                                  className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
                                >
                                  {busy ? <RefreshCw size={11} className="animate-spin" /> : <ShieldOff size={11} />}
                                  Isolate
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleRestore(agent)}
                                  disabled={busy}
                                  title="Restore network access to this endpoint"
                                  className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 transition-colors disabled:opacity-50"
                                >
                                  {busy ? <RefreshCw size={11} className="animate-spin" /> : <ShieldCheck size={11} />}
                                  Restore
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* Agent onboarding wizard */}
      {showOnboarding && (
        <AgentOnboardingModal
          onClose={() => setShowOnboarding(false)}
          onDone={load}
        />
      )}

      {/* Toast notification */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 text-sm px-4 py-3 rounded-xl shadow-xl animate-slide-in ${
          toast.ok ? 'bg-gray-900 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.ok
            ? <ShieldOff size={15} className="text-amber-400 shrink-0" />
            : <AlertTriangle size={15} className="shrink-0" />
          }
          {toast.msg}
        </div>
      )}
    </div>
  )
}
