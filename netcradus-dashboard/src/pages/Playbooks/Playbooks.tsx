import { useEffect, useState, useCallback, useRef, type ElementType } from 'react'
import {
  XCircle,
  WifiOff,
  Ban,
  FolderLock,
  Wifi,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ChevronRight,
  Zap,
  Terminal,
  Play,
  X,
  Sparkles,
  Loader2,
  Shield,
  Tag,
  ChevronDown,
  AlertCircle,
  Plus,
} from 'lucide-react'
import Topbar from '@/components/layout/Topbar/Topbar'
import Card from '@/components/ui/Card/Card'
import { fetchAgents } from '@/api/agentsApi'
import { fetchCommands, executeCommand } from '@/api/commandsApi'
import { getPlaybookRecommendation } from '@/api/aiApi'
import { useAuthStore } from '@/store/authStore'
import type { BackendAgent, BackendCommand, CommandType, AIPlaybookRecommendation, PlaybookStep } from '@/types/api.types'

// ── Types ──────────────────────────────────────────────────────────────────────

interface ActionDef {
  type: CommandType
  label: string
  description: string
  risk: 'Critical' | 'High' | 'Medium' | 'Low'
  requiresArg: 'pid' | 'ip_address' | 'file_path' | null
  argLabel?: string
  argType?: 'number' | 'text'
  argPlaceholder?: string
  Icon: ElementType
}

// ── Action definitions ─────────────────────────────────────────────────────────

const ACTIONS: ActionDef[] = [
  {
    type: 'kill_process',
    label: 'Kill Process',
    description: 'Terminate a running process by PID on the target endpoint. Use to stop malicious processes immediately.',
    risk: 'High',
    requiresArg: 'pid',
    argLabel: 'Process ID (PID)',
    argType: 'number',
    argPlaceholder: 'e.g. 1234',
    Icon: XCircle,
  },
  {
    type: 'isolate_host',
    label: 'Isolate Host',
    description: 'Cut all network connectivity on an endpoint. Agent maintains its C2 channel only. Use for full containment.',
    risk: 'Critical',
    requiresArg: null,
    Icon: WifiOff,
  },
  {
    type: 'block_ip',
    label: 'Block IP Address',
    description: 'Push a firewall rule to the endpoint to drop all traffic to/from a specific IP. Effective against C2 beaconing.',
    risk: 'Medium',
    requiresArg: 'ip_address',
    argLabel: 'IP Address',
    argType: 'text',
    argPlaceholder: 'e.g. 192.168.1.100',
    Icon: Ban,
  },
  {
    type: 'quarantine_file',
    label: 'Quarantine File',
    description: 'Move a suspicious file to an isolated quarantine directory and deny read/exec access. Preserves evidence.',
    risk: 'High',
    requiresArg: 'file_path',
    argLabel: 'File Path',
    argType: 'text',
    argPlaceholder: 'e.g. C:\\Windows\\Temp\\malware.exe',
    Icon: FolderLock,
  },
  {
    type: 'restore_host',
    label: 'Restore Host',
    description: 'Lift network isolation from an endpoint and restore full connectivity. Use after threat has been remediated.',
    risk: 'Low',
    requiresArg: null,
    Icon: Wifi,
  },
]

// ── Risk badge ─────────────────────────────────────────────────────────────────

const RISK_STYLE: Record<string, string> = {
  Critical: 'bg-purple-100 text-purple-700',
  High:     'bg-red-100 text-red-600',
  Medium:   'bg-amber-100 text-amber-700',
  Low:      'bg-green-100 text-green-700',
}

const RISK_BORDER: Record<string, string> = {
  Critical: 'border-purple-200',
  High:     'border-red-200',
  Medium:   'border-amber-200',
  Low:      'border-green-200',
}

// ── Command status badge ───────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { cls: string; dot: string }> = {
    Pending:   { cls: 'bg-amber-50 text-amber-700',  dot: 'bg-amber-400' },
    Completed: { cls: 'bg-green-50 text-green-700',  dot: 'bg-green-500' },
    Failed:    { cls: 'bg-red-50 text-red-600',      dot: 'bg-red-500' },
  }
  const s = cfg[status] ?? { cls: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400' }
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${s.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {status}
    </span>
  )
}

// ── Relative time ──────────────────────────────────────────────────────────────

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const secs = Math.floor(diff / 1000)
  if (secs < 60) return 'just now'
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// ── Command type label ─────────────────────────────────────────────────────────

const CMD_LABEL: Record<CommandType, string> = {
  kill_process:    'Kill Process',
  isolate_host:    'Isolate Host',
  block_ip:        'Block IP',
  quarantine_file: 'Quarantine File',
  restore_host:    'Restore Host',
}

// ── Execute modal ──────────────────────────────────────────────────────────────

interface ModalProps {
  action: ActionDef
  agents: BackendAgent[]
  onClose: () => void
  onSuccess: (cmd: BackendCommand) => void
}

function ExecuteModal({ action, agents, onClose, onSuccess }: ModalProps) {
  const [agentId, setAgentId] = useState<number | ''>('')
  const [arg, setArg] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)

  const isCritical = action.risk === 'Critical' || action.risk === 'High'

  async function submit() {
    if (!agentId) { setError('Select an agent.'); return }
    if (action.requiresArg && !arg.trim()) { setError(`${action.argLabel} is required.`); return }
    if (isCritical && !confirmed) { setError('Confirm the risk acknowledgement.'); return }
    setLoading(true)
    setError(null)
    try {
      const cmd = await executeCommand(action.type, Number(agentId), arg.trim() || undefined)
      onSuccess(cmd)
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Command failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className={`px-6 pt-6 pb-4 border-b ${RISK_BORDER[action.risk]} border-b`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${RISK_STYLE[action.risk]} bg-opacity-20`}>
                <action.Icon size={20} />
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900">{action.label}</h2>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${RISK_STYLE[action.risk]}`}>
                  {action.risk} Risk
                </span>
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors mt-0.5">
              <X size={20} />
            </button>
          </div>
          <p className="mt-3 text-sm text-gray-500">{action.description}</p>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Agent selector */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Target Endpoint</label>
            <select
              value={agentId}
              onChange={(e) => setAgentId(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select agent…</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.hostname} ({a.ip_address}) — {a.status}
                </option>
              ))}
            </select>
          </div>

          {/* Argument input */}
          {action.requiresArg && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">{action.argLabel}</label>
              <input
                type={action.argType ?? 'text'}
                value={arg}
                onChange={(e) => setArg(e.target.value)}
                placeholder={action.argPlaceholder}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>
          )}

          {/* Risk acknowledgement */}
          {isCritical && (
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
              />
              <span className="text-xs text-gray-600">
                I understand this action may disrupt the endpoint's normal operation and have authorization to proceed.
              </span>
            </label>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2.5">
              <AlertTriangle size={14} />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg py-2.5 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={loading}
            className={`flex-1 flex items-center justify-center gap-2 text-sm font-medium text-white rounded-lg py-2.5 transition-colors ${
              action.risk === 'Critical' ? 'bg-purple-600 hover:bg-purple-700' :
              action.risk === 'High'     ? 'bg-red-600 hover:bg-red-700' :
              action.risk === 'Medium'   ? 'bg-amber-500 hover:bg-amber-600' :
                                           'bg-green-600 hover:bg-green-700'
            } disabled:opacity-60`}
          >
            {loading ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />}
            {loading ? 'Sending…' : 'Execute'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── AI Playbook Recommendation ────────────────────────────────────────────────

const PHASE_STYLE: Record<string, string> = {
  Identification: 'bg-blue-50 text-blue-700',
  Containment:    'bg-red-50 text-red-600',
  Eradication:    'bg-purple-50 text-purple-700',
  Recovery:       'bg-green-50 text-green-700',
  'Lessons Learned': 'bg-gray-100 text-gray-600',
}

const SOAR_CMD_LABEL: Record<string, string> = {
  kill_process:    'Kill Process',
  isolate_host:    'Isolate Host',
  block_ip:        'Block IP',
  quarantine_file: 'Quarantine File',
  restore_host:    'Restore Host',
}

function AIRecommendationPanel({ onExecute }: { onExecute: (type: CommandType) => void }) {
  const [open, setOpen] = useState(false)
  const [mitreTags, setMitreTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [context, setContext] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AIPlaybookRecommendation | null>(null)
  const [error, setError] = useState<string | null>(null)

  function addTag() {
    const v = tagInput.trim().toUpperCase()
    if (v && !mitreTags.includes(v)) setMitreTags((prev) => [...prev, v])
    setTagInput('')
  }

  async function generate() {
    setLoading(true)
    setResult(null)
    setError(null)
    try {
      const r = await getPlaybookRecommendation(mitreTags, context)
      setResult(r)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'AI recommendation failed')
    } finally {
      setLoading(false)
    }
  }

  const severityColor: Record<string, string> = {
    Critical: 'text-purple-700 bg-purple-50 border-purple-200',
    High:     'text-red-600 bg-red-50 border-red-200',
    Medium:   'text-amber-700 bg-amber-50 border-amber-200',
    Low:      'text-green-700 bg-green-50 border-green-200',
  }

  return (
    <div className="rounded-xl border border-purple-100 bg-white overflow-hidden">
      {/* Header */}
      <button
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-purple-50/40 transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-purple-500" />
          <span className="text-sm font-semibold text-gray-800">AI Playbook Recommendations</span>
          <span className="text-xs text-purple-500 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-100">
            Powered by Claude
          </span>
        </div>
        <ChevronDown size={16} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="border-t border-purple-100 px-5 py-4 space-y-4">
          {/* MITRE input */}
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1.5">
              MITRE ATT&CK Techniques <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addTag()}
                placeholder="e.g. T1071, T1059"
                className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
              <button
                type="button"
                onClick={addTag}
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600"
              >
                <Plus size={14} />
              </button>
            </div>
            {mitreTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {mitreTags.map((t) => (
                  <span key={t} className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full border border-blue-100">
                    <Tag size={9} /> {t}
                    <button onClick={() => setMitreTags((prev) => prev.filter((x) => x !== t))} className="ml-0.5 hover:text-blue-800">×</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Context */}
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1.5">
              Context <span className="text-gray-400 font-normal">(describe the situation)</span>
            </label>
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="e.g. Ransomware detected on a domain controller. Multiple endpoints affected. Lateral movement via PsExec observed."
              rows={2}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none"
            />
          </div>

          <button
            onClick={generate}
            disabled={loading || (mitreTags.length === 0 && !context.trim())}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
          >
            {loading
              ? <><Loader2 size={13} className="animate-spin" /> Generating…</>
              : <><Sparkles size={13} /> Get Playbook</>}
          </button>

          {error && (
            <div className="flex items-center gap-2 text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">
              <AlertCircle size={12} /> {error}
            </div>
          )}

          {result && !loading && (
            <div className="space-y-4 pt-1">
              {/* Summary bar */}
              <div className="flex items-start gap-3 bg-purple-50 border border-purple-100 rounded-xl px-4 py-3">
                <Sparkles size={14} className="text-purple-500 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-purple-900 font-medium">{result.summary}</p>
                </div>
                {result.severity_assessment && (
                  <span className={`shrink-0 text-xs font-medium px-2.5 py-1 rounded-full border ${severityColor[result.severity_assessment] ?? severityColor.High}`}>
                    {result.severity_assessment}
                  </span>
                )}
              </div>

              {/* Steps */}
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Response Steps</p>
                <div className="space-y-2">
                  {result.steps.map((step: PlaybookStep, i: number) => (
                    <div key={i} className="flex gap-3 p-3 rounded-lg border border-gray-100 bg-gray-50/50 hover:bg-white transition-colors">
                      <div className="flex flex-col items-center gap-1 shrink-0">
                        <span className="h-5 w-5 rounded-full bg-gray-200 text-gray-600 text-[10px] font-bold flex items-center justify-center">
                          {i + 1}
                        </span>
                        {i < result.steps.length - 1 && <div className="w-px flex-1 bg-gray-200" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${PHASE_STYLE[step.phase] ?? 'bg-gray-100 text-gray-600'}`}>
                            {step.phase}
                          </span>
                          {step.soar_command && (
                            <button
                              onClick={() => onExecute(step.soar_command as CommandType)}
                              className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-100 transition-colors"
                            >
                              <Zap size={9} /> {SOAR_CMD_LABEL[step.soar_command]}
                            </button>
                          )}
                        </div>
                        <p className="text-xs font-medium text-gray-800">{step.action}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{step.rationale}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* IOCs to collect */}
              {result.ioc_to_collect.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">IOCs to Collect</p>
                  <div className="flex flex-wrap gap-1.5">
                    {result.ioc_to_collect.map((ioc) => (
                      <span key={ioc} className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full border border-amber-100">
                        {ioc}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Escalation trigger */}
              {result.escalation_trigger && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  <AlertCircle size={13} className="text-red-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] font-medium text-red-600 uppercase">Escalation Trigger</p>
                    <p className="text-xs text-red-700 mt-0.5">{result.escalation_trigger}</p>
                  </div>
                </div>
              )}

              <p className="text-[10px] text-gray-300 flex items-center gap-1">
                <Sparkles size={9} /> Generated by Claude AI · Validate all steps before executing
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function Playbooks() {
  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.role === 'Admin' || user?.role === 'SuperAdmin'

  const [agents, setAgents] = useState<BackendAgent[]>([])
  const [commands, setCommands] = useState<BackendCommand[]>([])
  const [loading, setLoading] = useState(true)
  const [historyLoading, setHistoryLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeModal, setActiveModal] = useState<ActionDef | null>(null)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const [liveRefresh, setLiveRefresh] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadAgents = useCallback(async () => {
    try {
      const data = await fetchAgents()
      setAgents(data)
    } catch {
      // non-critical
    }
  }, [])

  const loadHistory = useCallback(async (silent = false) => {
    if (!silent) setHistoryLoading(true)
    try {
      const data = await fetchCommands()
      setCommands(data)
    } catch (e: unknown) {
      if (!silent) setError(e instanceof Error ? e.message : 'Failed to load history')
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  const loadAll = useCallback(async () => {
    setLoading(true)
    await Promise.all([loadAgents(), loadHistory()])
    setLoading(false)
  }, [loadAgents, loadHistory])

  useEffect(() => { loadAll() }, [loadAll])

  // Auto-refresh command history every 10 s
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setLiveRefresh(true)
      loadHistory(true).finally(() => setLiveRefresh(false))
    }, 10_000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [loadHistory])

  function onCommandSuccess(cmd: BackendCommand) {
    setToastMsg(`Command dispatched → ${CMD_LABEL[cmd.command_type]} [#${cmd.id}] is ${cmd.status}`)
    setTimeout(() => setToastMsg(null), 4000)
    loadHistory(true)
  }

  const pendingCount = commands.filter((c) => c.status === 'Pending').length

  return (
    <div className="pb-8">
      <Topbar
        title="SOAR Playbooks"
        subtitle="Response actions & command execution history"
        onRefresh={loadAll}
      />

      <div className="px-4 sm:px-6 lg:px-8 space-y-6">

        {/* ── Stats strip ── */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Total Executed',  value: commands.length,                              color: 'text-gray-900',  bg: 'bg-white' },
            { label: 'Pending',         value: pendingCount,                                  color: 'text-amber-600', bg: 'bg-amber-50' },
            { label: 'Completed',       value: commands.filter((c) => c.status === 'Completed').length, color: 'text-green-700', bg: 'bg-green-50' },
            { label: 'Failed',          value: commands.filter((c) => c.status === 'Failed').length,    color: 'text-red-600',   bg: 'bg-red-50' },
          ].map(({ label, value, color, bg }) => (
            <div key={label} className={`rounded-xl border border-gray-200 ${bg} p-4`}>
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* ── Response actions ── */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Zap size={16} className="text-blue-600" />
            <h2 className="text-sm font-semibold text-gray-800">Response Actions</h2>
            {!isAdmin && (
              <span className="ml-2 text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
                View only — Admin required to execute
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
            {ACTIONS.map((action) => (
              <div
                key={action.type}
                className={`relative bg-white rounded-xl border ${RISK_BORDER[action.risk]} p-4 flex flex-col gap-3 hover:shadow-md transition-shadow`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${RISK_STYLE[action.risk]}`}>
                    <action.Icon size={18} />
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${RISK_STYLE[action.risk]}`}>
                    {action.risk}
                  </span>
                </div>

                <div>
                  <p className="text-sm font-semibold text-gray-900">{action.label}</p>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed line-clamp-3">{action.description}</p>
                </div>

                {action.requiresArg && (
                  <p className="text-xs text-gray-400">
                    Requires: <span className="font-mono">{action.argLabel}</span>
                  </p>
                )}

                <button
                  onClick={() => isAdmin && setActiveModal(action)}
                  disabled={!isAdmin}
                  className={`mt-auto flex items-center justify-center gap-1.5 text-xs font-medium py-2 rounded-lg transition-colors ${
                    isAdmin
                      ? 'bg-gray-900 text-white hover:bg-gray-700'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <ChevronRight size={13} />
                  Execute
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* ── AI Recommendations ── */}
        <AIRecommendationPanel
          onExecute={(type) => {
            const action = ACTIONS.find((a) => a.type === type)
            if (action && isAdmin) setActiveModal(action)
          }}
        />

        {/* ── Command history ── */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Terminal size={16} className="text-gray-500" />
            <h2 className="text-sm font-semibold text-gray-800">Command History</h2>
            <span className="ml-auto flex items-center gap-1.5 text-xs text-gray-400">
              <span
                className={`h-1.5 w-1.5 rounded-full ${liveRefresh ? 'bg-blue-400 animate-pulse' : 'bg-green-400'}`}
              />
              Auto-refresh 10s
            </span>
          </div>

          <Card>
            {historyLoading ? (
              <div className="flex items-center justify-center py-14 gap-2 text-gray-400">
                <RefreshCw size={15} className="animate-spin" />
                <span className="text-sm">Loading history…</span>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-14 gap-2 text-red-500">
                <AlertTriangle size={18} />
                <p className="text-sm">{error}</p>
              </div>
            ) : commands.length === 0 ? (
              <div className="py-14 text-center">
                <Terminal size={28} className="text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No commands have been executed yet.</p>
                {isAdmin && (
                  <p className="text-xs text-gray-300 mt-1">Use the Response Actions above to dispatch your first command.</p>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                      <th className="font-medium py-2 pr-4 w-14">#</th>
                      <th className="font-medium py-2 pr-4">Action</th>
                      <th className="font-medium py-2 pr-4">Agent</th>
                      <th className="font-medium py-2 pr-4">Argument</th>
                      <th className="font-medium py-2 pr-4">Status</th>
                      <th className="font-medium py-2 pr-4">Sent</th>
                      <th className="font-medium py-2">Result / Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {commands.map((cmd) => (
                      <tr
                        key={cmd.id}
                        className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors"
                      >
                        <td className="py-3 pr-4 text-gray-400 text-xs font-mono">#{cmd.id}</td>
                        <td className="py-3 pr-4">
                          <span className="font-medium text-gray-800">
                            {CMD_LABEL[cmd.command_type] ?? cmd.command_type}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-gray-600 font-mono text-xs">
                          {cmd.agent_hostname}
                        </td>
                        <td className="py-3 pr-4 text-gray-500 font-mono text-xs max-w-[160px] truncate">
                          {cmd.argument || <span className="text-gray-300 italic">—</span>}
                        </td>
                        <td className="py-3 pr-4">
                          <StatusBadge status={cmd.status} />
                        </td>
                        <td className="py-3 pr-4 text-gray-400 text-xs">
                          <div className="flex items-center gap-1">
                            <Clock size={11} />
                            {relTime(cmd.timestamp)}
                          </div>
                        </td>
                        <td className="py-3 text-xs max-w-[200px] truncate">
                          {cmd.status === 'Completed' && cmd.result ? (
                            <span className="text-green-600 flex items-center gap-1">
                              <CheckCircle2 size={12} />
                              {cmd.result}
                            </span>
                          ) : cmd.status === 'Failed' && cmd.error ? (
                            <span className="text-red-500 flex items-center gap-1">
                              <AlertTriangle size={12} />
                              {cmd.error}
                            </span>
                          ) : cmd.status === 'Pending' ? (
                            <span className="text-amber-500 flex items-center gap-1">
                              <RefreshCw size={11} className="animate-spin" />
                              Awaiting agent…
                            </span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
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

      {/* ── Execute modal ── */}
      {activeModal && (
        <ExecuteModal
          action={activeModal}
          agents={agents}
          onClose={() => setActiveModal(null)}
          onSuccess={onCommandSuccess}
        />
      )}

      {/* ── Toast ── */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 bg-gray-900 text-white text-sm px-4 py-3 rounded-xl shadow-xl animate-slide-in">
          <CheckCircle2 size={16} className="text-green-400 shrink-0" />
          {toastMsg}
        </div>
      )}
    </div>
  )
}
