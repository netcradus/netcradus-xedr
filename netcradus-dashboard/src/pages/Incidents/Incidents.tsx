import { useEffect, useState, useCallback } from 'react'
import {
  RefreshCw, AlertTriangle, ChevronRight, X, ShieldAlert, Clock,
  Monitor, Tag, CheckCircle2, Search, Loader2, ArrowRight, Layers,
  Sparkles, AlertCircle, Shield, Zap, ChevronDown, Plus, Trash2,
  FileText, Database, Link2, Terminal, Wifi, StickyNote, Send,
  BookOpen, PackageCheck, FileSearch, AlertOctagon,
} from 'lucide-react'
import Topbar from '@/components/layout/Topbar/Topbar'
import Card from '@/components/ui/Card/Card'
import Badge from '@/components/ui/Badge/Badge'
import {
  fetchIncidents,
  fetchIncidentStats,
  fetchIncidentDetail,
  updateIncidentStatus,
  resolveIncident,
  backfillIncidents,
  addNote,
  deleteNote,
  addEvidence,
  deleteEvidence,
} from '@/api/incidentsApi'
import { getIncidentAISummary } from '@/api/aiApi'
import type {
  BackendIncident,
  BackendIncidentDetail,
  IncidentStats,
  IncidentStatus,
  IncidentAISummary,
  InvestigationNote,
  EvidenceItem,
} from '@/types/api.types'
import type { Severity } from '@/types/dashboard.types'
import { useAuthStore } from '@/store/authStore'

// ── Helpers ──────────────────────────────────────────────────────────────────

function incId(id: number): string {
  return `INC-${String(id).padStart(5, '0')}`
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function absoluteTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function mitreList(tactics: string | null): string[] {
  if (!tactics) return []
  return tactics.split(',').map((t) => t.trim()).filter(Boolean)
}

// ── Status styles ─────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<IncidentStatus, string> = {
  Open:          'bg-red-50 text-red-600 border border-red-200',
  Investigating: 'bg-amber-50 text-amber-700 border border-amber-200',
  Contained:     'bg-blue-50 text-blue-700 border border-blue-200',
  Resolved:      'bg-green-50 text-green-700 border border-green-200',
}

const STATUS_DOT: Record<IncidentStatus, string> = {
  Open:          'bg-red-500',
  Investigating: 'bg-amber-500',
  Contained:     'bg-blue-500',
  Resolved:      'bg-green-500',
}

function StatusBadge({ status }: { status: IncidentStatus }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_STYLES[status]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[status]}`} />
      {status}
    </span>
  )
}

// ── Workflow stepper ──────────────────────────────────────────────────────────

const STATUS_STEPS: IncidentStatus[] = ['Open', 'Investigating', 'Contained', 'Resolved']

function StatusStepper({
  current,
  onChange,
  loading,
}: {
  current: IncidentStatus
  onChange: (s: IncidentStatus) => void
  loading: boolean
}) {
  const currentIdx = STATUS_STEPS.indexOf(current)
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {STATUS_STEPS.map((step, i) => {
        const isPast    = i < currentIdx
        const isCurrent = i === currentIdx
        return (
          <div key={step} className="flex items-center gap-1">
            <button
              disabled={loading || isCurrent}
              onClick={() => !isCurrent && onChange(step)}
              className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-all ${
                isCurrent
                  ? `${STATUS_STYLES[step]} cursor-default`
                  : isPast
                  ? 'border-gray-200 text-gray-400 bg-gray-50 hover:bg-gray-100 cursor-pointer'
                  : 'border-dashed border-gray-300 text-gray-400 hover:border-gray-400 hover:text-gray-600 cursor-pointer'
              }`}
            >
              {isCurrent && loading
                ? <Loader2 size={11} className="animate-spin" />
                : isPast ? <CheckCircle2 size={11} className="text-gray-400" /> : null}
              {step}
            </button>
            {i < STATUS_STEPS.length - 1 && (
              <ArrowRight size={12} className="text-gray-300 shrink-0" />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── AI Summary panel ──────────────────────────────────────────────────────────

const PRIORITY_STYLES: Record<string, string> = {
  immediate: 'bg-red-50 text-red-700 border-red-200',
  urgent:    'bg-amber-50 text-amber-700 border-amber-200',
  standard:  'bg-green-50 text-green-700 border-green-200',
}

function AISummaryPanel({ incidentId }: { incidentId: number }) {
  const [summary, setSummary] = useState<IncidentAISummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [open, setOpen]       = useState(false)

  async function generate() {
    setLoading(true); setError(null); setOpen(true)
    try {
      setSummary(await getIncidentAISummary(incidentId))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'AI summary failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="px-6 py-4 border-b border-gray-100">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-purple-500" />
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">AI Analysis</p>
        </div>
        <button
          onClick={summary ? () => setOpen((o) => !o) : generate}
          disabled={loading}
          className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 disabled:opacity-60 transition-colors border border-purple-200"
        >
          {loading ? (
            <><Loader2 size={12} className="animate-spin" /> Analysing…</>
          ) : summary ? (
            <>{open ? 'Collapse' : 'Expand'} <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} /></>
          ) : (
            <><Sparkles size={12} /> Generate Summary</>
          )}
        </button>
      </div>
      {!summary && !loading && !error && (
        <p className="text-xs text-gray-400">Click "Generate Summary" to get an AI-powered analysis of this incident.</p>
      )}
      {error && (
        <div className="flex items-center gap-2 text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">
          <AlertCircle size={13} /><span>{error}</span>
        </div>
      )}
      {summary && open && (
        <div className="space-y-3 mt-1">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-700 leading-relaxed">{summary.summary}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-[10px] font-medium text-gray-400 uppercase mb-1">Containment Priority</p>
              <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border ${PRIORITY_STYLES[summary.containment_priority] ?? PRIORITY_STYLES.urgent}`}>
                <Zap size={10} />
                {summary.containment_priority.charAt(0).toUpperCase() + summary.containment_priority.slice(1)}
              </span>
            </div>
            <div>
              <p className="text-[10px] font-medium text-gray-400 uppercase mb-1">Attack Chain</p>
              <p className="text-xs text-gray-600 leading-snug">{summary.attack_chain}</p>
            </div>
          </div>
          <div>
            <p className="text-[10px] font-medium text-gray-400 uppercase mb-1">Risk Assessment</p>
            <p className="text-xs text-gray-600 leading-snug">{summary.risk_assessment}</p>
          </div>
          <div>
            <p className="text-[10px] font-medium text-gray-400 uppercase mb-1.5">Recommended Actions</p>
            <ul className="space-y-1">
              {summary.recommended_actions.map((action, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-gray-700">
                  <Shield size={11} className="text-purple-400 mt-0.5 shrink-0" />{action}
                </li>
              ))}
            </ul>
          </div>
          <p className="text-[10px] text-gray-300 flex items-center gap-1">
            <Sparkles size={9} /> Generated by Claude AI · Not a substitute for analyst judgement
          </p>
        </div>
      )}
    </div>
  )
}

// ── Tab: Overview ─────────────────────────────────────────────────────────────

function OverviewTab({ detail }: { detail: BackendIncidentDetail }) {
  return (
    <>
      {/* Key metrics */}
      <div className="px-6 py-4 grid grid-cols-3 gap-4 border-b border-gray-100">
        <div>
          <p className="text-xs text-gray-400 mb-1">Alerts</p>
          <p className="text-xl font-semibold text-gray-900">{detail.alert_count}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-1">Endpoints</p>
          <p className="text-xl font-semibold text-gray-900">{detail.affected_endpoints}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-1">Opened</p>
          <p className="text-sm font-medium text-gray-700">{absoluteTime(detail.created_at)}</p>
        </div>
      </div>

      {/* MITRE tactics */}
      {mitreList(detail.mitre_tactics).length > 0 && (
        <div className="px-6 py-4 border-b border-gray-100">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">MITRE ATT&CK Techniques</p>
          <div className="flex flex-wrap gap-2">
            {mitreList(detail.mitre_tactics).map((t) => (
              <span key={t} className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 border border-blue-100 px-2.5 py-1 rounded-full">
                <Tag size={10} />{t}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* AI Summary */}
      <AISummaryPanel incidentId={detail.id} />

      {/* Correlated alerts */}
      <div className="px-6 py-4">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-4">
          Correlated Alerts ({detail.alerts.length})
        </p>
        {detail.alerts.length === 0 ? (
          <p className="text-sm text-gray-400">No alerts linked yet.</p>
        ) : (
          <div className="relative">
            <div className="absolute left-3.5 top-2 bottom-2 w-px bg-gray-100" />
            <div className="space-y-4">
              {detail.alerts.map((alert) => (
                <div key={alert.id} className="flex gap-4 relative">
                  <div className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 z-10 ${
                    alert.severity === 'Critical' ? 'bg-purple-100' :
                    alert.severity === 'High'     ? 'bg-red-100' :
                    alert.severity === 'Medium'   ? 'bg-amber-100' : 'bg-gray-100'
                  }`}>
                    <ShieldAlert size={13} className={
                      alert.severity === 'Critical' ? 'text-purple-600' :
                      alert.severity === 'High'     ? 'text-red-500' :
                      alert.severity === 'Medium'   ? 'text-amber-500' : 'text-gray-400'
                    } />
                  </div>
                  <div className="flex-1 min-w-0 pb-1">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate">{alert.title}</p>
                        {alert.description && (
                          <p className="text-xs text-gray-400 truncate mt-0.5">{alert.description}</p>
                        )}
                      </div>
                      <Badge severity={alert.severity as Severity} />
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                      <span className="flex items-center gap-1"><Monitor size={11} />{alert.agent_hostname ?? `Agent #${alert.agent_id}`}</span>
                      <span className="flex items-center gap-1"><Clock size={11} />{absoluteTime(alert.timestamp)}</span>
                      {alert.occurrence_count > 1 && <span className="text-gray-300">×{alert.occurrence_count}</span>}
                    </div>
                    {alert.mitre_technique && (
                      <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded mt-1.5">
                        <Tag size={9} />{alert.mitre_technique}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  )
}

// ── Tab: Investigation ────────────────────────────────────────────────────────

const NOTE_TYPE_META = {
  note:         { label: 'Note',          icon: StickyNote,    color: 'bg-gray-100 text-gray-600' },
  finding:      { label: 'Finding',       icon: FileSearch,    color: 'bg-amber-100 text-amber-700' },
  action_taken: { label: 'Action Taken',  icon: PackageCheck,  color: 'bg-green-100 text-green-700' },
  ioc_ref:      { label: 'IOC Reference', icon: AlertOctagon,  color: 'bg-red-100 text-red-600' },
}

function InvestigationTab({
  notes,
  incidentId,
  onNotesChange,
}: {
  notes: InvestigationNote[]
  incidentId: number
  onNotesChange: (notes: InvestigationNote[]) => void
}) {
  const [noteType, setNoteType]   = useState<InvestigationNote['note_type']>('note')
  const [content, setContent]     = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  async function handleSubmit() {
    if (!content.trim()) return
    setSubmitting(true)
    try {
      const note = await addNote(incidentId, { note_type: noteType, content: content.trim() })
      onNotesChange([...notes, note])
      setContent('')
    } catch { /* ignore */ } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(noteId: number) {
    setDeletingId(noteId)
    try {
      await deleteNote(incidentId, noteId)
      onNotesChange(notes.filter((n) => n.id !== noteId))
    } catch { /* ignore */ } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="px-6 py-4 space-y-5">
      {/* Add note form */}
      <div className="border border-gray-200 rounded-xl p-4 space-y-3 bg-gray-50">
        <div className="flex items-center gap-2 flex-wrap">
          {(Object.keys(NOTE_TYPE_META) as InvestigationNote['note_type'][]).map((t) => {
            const m = NOTE_TYPE_META[t]
            const Icon = m.icon
            return (
              <button
                key={t}
                onClick={() => setNoteType(t)}
                className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium transition-all ${
                  noteType === t
                    ? `${m.color} border-transparent shadow-sm`
                    : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                <Icon size={11} />{m.label}
              </button>
            )
          })}
        </div>
        <textarea
          rows={3}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={
            noteType === 'finding'      ? 'Describe what you found during investigation…' :
            noteType === 'action_taken' ? 'Describe what action was taken…' :
            noteType === 'ioc_ref'      ? 'Reference an IOC value or indicator…' :
            'Add an investigation note…'
          }
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white resize-none"
        />
        <button
          onClick={handleSubmit}
          disabled={submitting || !content.trim()}
          className="inline-flex items-center gap-2 text-sm px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {submitting ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
          {submitting ? 'Adding…' : 'Add Note'}
        </button>
      </div>

      {/* Notes timeline */}
      {notes.length === 0 ? (
        <div className="py-10 text-center">
          <BookOpen size={28} className="mx-auto text-gray-200 mb-2" />
          <p className="text-sm text-gray-400">No investigation notes yet. Add your first finding above.</p>
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-3.5 top-2 bottom-2 w-px bg-gray-100" />
          <div className="space-y-4">
            {notes.map((note) => {
              const meta = NOTE_TYPE_META[note.note_type] ?? NOTE_TYPE_META.note
              const Icon = meta.icon
              return (
                <div key={note.id} className="flex gap-4">
                  <div className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 z-10 ${meta.color}`}>
                    <Icon size={13} />
                  </div>
                  <div className="flex-1 min-w-0 bg-white border border-gray-100 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${meta.color}`}>
                          {meta.label}
                        </span>
                        <span className="text-xs text-gray-400">{note.user_name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-300">{relativeTime(note.created_at)}</span>
                        <button
                          onClick={() => handleDelete(note.id)}
                          disabled={deletingId === note.id}
                          className="text-gray-300 hover:text-red-400 transition-colors"
                        >
                          {deletingId === note.id
                            ? <Loader2 size={12} className="animate-spin" />
                            : <Trash2 size={12} />}
                        </button>
                      </div>
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{note.content}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Tab: Evidence ─────────────────────────────────────────────────────────────

const EVIDENCE_META = {
  log_snippet:     { label: 'Log Snippet',     icon: FileText,  color: 'bg-blue-100 text-blue-700',   border: 'border-blue-200' },
  ioc_ref:         { label: 'IOC Reference',   icon: AlertOctagon, color: 'bg-red-100 text-red-600', border: 'border-red-200' },
  artifact:        { label: 'Artifact',        icon: Database,  color: 'bg-purple-100 text-purple-700', border: 'border-purple-200' },
  network_capture: { label: 'Network Capture', icon: Wifi,      color: 'bg-cyan-100 text-cyan-700',   border: 'border-cyan-200' },
  command_output:  { label: 'Command Output',  icon: Terminal,  color: 'bg-gray-100 text-gray-700',   border: 'border-gray-200' },
  note:            { label: 'Note',            icon: Link2,     color: 'bg-amber-100 text-amber-700', border: 'border-amber-200' },
}

function EvidenceTab({
  evidence,
  incidentId,
  onEvidenceChange,
}: {
  evidence: EvidenceItem[]
  incidentId: number
  onEvidenceChange: (items: EvidenceItem[]) => void
}) {
  const [evType, setEvType]     = useState<EvidenceItem['evidence_type']>('log_snippet')
  const [title, setTitle]       = useState('')
  const [content, setContent]   = useState('')
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  async function handleSubmit() {
    if (!title.trim()) return
    setSubmitting(true)
    try {
      const ev = await addEvidence(incidentId, {
        title: title.trim(), evidence_type: evType, content: content.trim() || undefined,
      })
      onEvidenceChange([...evidence, ev])
      setTitle(''); setContent(''); setShowForm(false)
    } catch { /* ignore */ } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(evId: number) {
    setDeletingId(evId)
    try {
      await deleteEvidence(incidentId, evId)
      onEvidenceChange(evidence.filter((e) => e.id !== evId))
    } catch { /* ignore */ } finally {
      setDeletingId(null)
    }
  }

  const hasContent = (ev: EvidenceItem) =>
    ev.evidence_type === 'log_snippet' || ev.evidence_type === 'command_output'

  return (
    <div className="px-6 py-4 space-y-4">
      {/* Add button */}
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 text-sm px-4 py-2 border border-dashed border-gray-300 text-gray-500 rounded-lg hover:border-blue-400 hover:text-blue-600 transition-colors"
        >
          <Plus size={14} /> Add Evidence
        </button>
      ) : (
        <div className="border border-gray-200 rounded-xl p-4 space-y-3 bg-gray-50">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(EVIDENCE_META) as EvidenceItem['evidence_type'][]).map((t) => {
              const m = EVIDENCE_META[t]
              const Icon = m.icon
              return (
                <button
                  key={t}
                  onClick={() => setEvType(t)}
                  className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium transition-all ${
                    evType === t ? `${m.color} ${m.border}` : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  <Icon size={11} />{m.label}
                </button>
              )
            })}
          </div>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title / identifier (e.g. 'mimikatz.exe SHA256', 'attacker_ip', 'firewall log 10:42')"
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
          {(evType === 'log_snippet' || evType === 'command_output') && (
            <textarea
              rows={4}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Paste the log output or command result here…"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white font-mono resize-none"
            />
          )}
          {evType === 'ioc_ref' && (
            <input
              type="text"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="IOC value (e.g. 185.220.101.42, malicious.com)"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white font-mono"
            />
          )}
          <div className="flex gap-2">
            <button
              onClick={handleSubmit}
              disabled={submitting || !title.trim()}
              className="inline-flex items-center gap-2 text-sm px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
              {submitting ? 'Adding…' : 'Add'}
            </button>
            <button
              onClick={() => { setShowForm(false); setTitle(''); setContent('') }}
              className="text-sm px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Evidence list */}
      {evidence.length === 0 && !showForm ? (
        <div className="py-10 text-center">
          <Database size={28} className="mx-auto text-gray-200 mb-2" />
          <p className="text-sm text-gray-400">No evidence collected yet. Add logs, IOCs, artifacts, or command outputs.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {evidence.map((ev) => {
            const meta = EVIDENCE_META[ev.evidence_type] ?? EVIDENCE_META.note
            const Icon = meta.icon
            return (
              <div key={ev.id} className={`border rounded-xl p-4 bg-white ${meta.border}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 ${meta.color}`}>
                      <Icon size={13} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-gray-900 truncate">{ev.title}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide ${meta.color}`}>
                          {meta.label}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Added by {ev.added_by_name ?? 'Unknown'} · {relativeTime(ev.created_at)}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(ev.id)}
                    disabled={deletingId === ev.id}
                    className="text-gray-300 hover:text-red-400 transition-colors shrink-0"
                  >
                    {deletingId === ev.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                  </button>
                </div>
                {ev.content && hasContent(ev) && (
                  <pre className="mt-3 text-xs bg-gray-900 text-gray-100 rounded-lg p-3 overflow-x-auto leading-relaxed whitespace-pre-wrap">
                    {ev.content}
                  </pre>
                )}
                {ev.content && !hasContent(ev) && (
                  <p className="mt-2 text-xs font-mono text-gray-600 bg-gray-50 rounded px-2 py-1 break-all">{ev.content}</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Tab: Resolution ───────────────────────────────────────────────────────────

function ResolutionTab({
  detail,
  onResolved,
}: {
  detail: BackendIncidentDetail
  onResolved: (updated: BackendIncident) => void
}) {
  const isResolved = detail.status === 'Resolved'
  const [rootCause,     setRootCause]     = useState(detail.root_cause ?? '')
  const [summary,       setSummary]       = useState(detail.resolution_summary ?? '')
  const [containment,   setContainment]   = useState(detail.containment_actions ?? '')
  const [lessons,       setLessons]       = useState(detail.lessons_learned ?? '')
  const [saving,        setSaving]        = useState(false)
  const [saved,         setSaved]         = useState(false)
  const [error,         setError]         = useState<string | null>(null)

  async function handleResolve() {
    setSaving(true); setError(null)
    try {
      const updated = await resolveIncident(detail.id, {
        root_cause:          rootCause  || undefined,
        resolution_summary:  summary    || undefined,
        containment_actions: containment|| undefined,
        lessons_learned:     lessons    || undefined,
      })
      onResolved(updated)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to resolve incident')
    } finally {
      setSaving(false)
    }
  }

  const fieldClass = `w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${isResolved ? 'bg-gray-50 text-gray-600' : 'bg-white'}`

  return (
    <div className="px-6 py-4 space-y-5">
      {isResolved && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
          <CheckCircle2 size={15} />
          <span>Incident resolved {absoluteTime(detail.resolved_at!)}</span>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1.5">Root Cause</label>
          <textarea
            rows={3}
            value={rootCause}
            onChange={(e) => setRootCause(e.target.value)}
            disabled={isResolved}
            placeholder="What was the underlying root cause of this incident? (e.g. phishing email led to initial access via macro execution)"
            className={`${fieldClass} resize-none`}
          />
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1.5">Containment Actions Taken</label>
          <textarea
            rows={3}
            value={containment}
            onChange={(e) => setContainment(e.target.value)}
            disabled={isResolved}
            placeholder="List the actions taken to contain the threat (e.g. isolated WIN-DC-01, blocked IP 185.220.101.42, killed mimikatz.exe)"
            className={`${fieldClass} resize-none`}
          />
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1.5">Resolution Summary</label>
          <textarea
            rows={3}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            disabled={isResolved}
            placeholder="Describe how the incident was fully resolved and what the final outcome was…"
            className={`${fieldClass} resize-none`}
          />
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1.5">Lessons Learned</label>
          <textarea
            rows={3}
            value={lessons}
            onChange={(e) => setLessons(e.target.value)}
            disabled={isResolved}
            placeholder="What would you do differently? What detection gaps were identified? What improvements should be made?"
            className={`${fieldClass} resize-none`}
          />
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-500 flex items-center gap-1.5">
          <AlertTriangle size={13} />{error}
        </p>
      )}

      {!isResolved && (
        <button
          onClick={handleResolve}
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          {saving
            ? <><Loader2 size={14} className="animate-spin" /> Resolving…</>
            : <><CheckCircle2 size={14} /> Resolve Incident</>}
        </button>
      )}
      {saved && (
        <p className="text-sm text-green-600 flex items-center gap-1.5">
          <CheckCircle2 size={13} /> Incident resolved and documentation saved.
        </p>
      )}
    </div>
  )
}

// ── Detail Drawer ─────────────────────────────────────────────────────────────

type DrawerTab = 'overview' | 'investigation' | 'evidence' | 'resolution'

const DRAWER_TABS: { id: DrawerTab; label: string }[] = [
  { id: 'overview',      label: 'Overview'      },
  { id: 'investigation', label: 'Investigation' },
  { id: 'evidence',      label: 'Evidence'      },
  { id: 'resolution',    label: 'Resolution'    },
]

function DetailDrawer({
  incidentId,
  onClose,
  onStatusChange,
}: {
  incidentId: number
  onClose: () => void
  onStatusChange: (id: number, status: IncidentStatus) => void
}) {
  const [detail, setDetail]           = useState<BackendIncidentDetail | null>(null)
  const [loading, setLoading]         = useState(true)
  const [statusLoading, setStatusLoading] = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [activeTab, setActiveTab]     = useState<DrawerTab>('overview')

  useEffect(() => {
    setLoading(true)
    fetchIncidentDetail(incidentId)
      .then(setDetail)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [incidentId])

  async function handleStatusChange(newStatus: IncidentStatus) {
    if (!detail) return
    setStatusLoading(true)
    try {
      const updated = await updateIncidentStatus(detail.id, newStatus)
      setDetail((d) => d ? { ...d, status: updated.status as IncidentStatus, resolved_at: updated.resolved_at } : d)
      onStatusChange(detail.id, newStatus)
    } finally {
      setStatusLoading(false)
    }
  }

  function handleResolved(updated: BackendIncident) {
    setDetail((d) => d ? {
      ...d,
      status: 'Resolved',
      resolved_at: updated.resolved_at,
      root_cause:          updated.root_cause,
      resolution_summary:  updated.resolution_summary,
      containment_actions: updated.containment_actions,
      lessons_learned:     updated.lessons_learned,
    } : d)
    onStatusChange(incidentId, 'Resolved')
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px]" onClick={onClose} />
      <aside className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-2xl bg-white shadow-2xl flex flex-col overflow-hidden animate-slide-in">

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-gray-100">
          <div className="min-w-0 flex-1 pr-4">
            {loading ? (
              <div className="h-5 w-48 bg-gray-100 rounded animate-pulse" />
            ) : detail ? (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono text-gray-400">{incId(detail.id)}</span>
                  <Badge severity={detail.severity as Severity} />
                  <StatusBadge status={detail.status as IncidentStatus} />
                </div>
                <h2 className="text-base font-semibold text-gray-900 leading-snug">{detail.title}</h2>
                {detail.description && (
                  <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{detail.description}</p>
                )}
              </>
            ) : null}
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 size={24} className="animate-spin text-gray-300" />
          </div>
        ) : error ? (
          <div className="flex-1 flex items-center justify-center text-red-500 text-sm">{error}</div>
        ) : detail ? (
          <>
            {/* Status stepper */}
            <div className="px-6 py-3 border-b border-gray-100 bg-gray-50">
              <StatusStepper
                current={detail.status as IncidentStatus}
                onChange={handleStatusChange}
                loading={statusLoading}
              />
              {detail.resolved_at && (
                <p className="text-xs text-gray-400 mt-1.5">Resolved {absoluteTime(detail.resolved_at)}</p>
              )}
            </div>

            {/* Tab bar */}
            <div className="flex border-b border-gray-100 bg-white px-6">
              {DRAWER_TABS.map((tab) => {
                const badge =
                  tab.id === 'investigation' && detail.notes.length > 0   ? detail.notes.length :
                  tab.id === 'evidence'      && detail.evidence.length > 0 ? detail.evidence.length : null
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`relative py-3 px-4 text-xs font-medium border-b-2 transition-colors ${
                      activeTab === tab.id
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {tab.label}
                    {badge !== null && (
                      <span className="ml-1.5 inline-flex items-center justify-center h-4 min-w-4 px-1 text-[10px] font-bold rounded-full bg-blue-100 text-blue-700">
                        {badge}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto">
              {activeTab === 'overview' && <OverviewTab detail={detail} />}
              {activeTab === 'investigation' && (
                <InvestigationTab
                  notes={detail.notes}
                  incidentId={detail.id}
                  onNotesChange={(notes) => setDetail((d) => d ? { ...d, notes } : d)}
                />
              )}
              {activeTab === 'evidence' && (
                <EvidenceTab
                  evidence={detail.evidence}
                  incidentId={detail.id}
                  onEvidenceChange={(evidence) => setDetail((d) => d ? { ...d, evidence } : d)}
                />
              )}
              {activeTab === 'resolution' && (
                <ResolutionTab detail={detail} onResolved={handleResolved} />
              )}
            </div>
          </>
        ) : null}
      </aside>
    </>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

type StatusFilter = 'All' | IncidentStatus

export default function Incidents() {
  const user    = useAuthStore((s) => s.user)
  const isAdmin = user?.role === 'SuperAdmin' || user?.role === 'Admin'

  const [incidents, setIncidents] = useState<BackendIncident[]>([])
  const [stats, setStats]         = useState<IncidentStats | null>(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All')
  const [search, setSearch]       = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [backfilling, setBackfilling] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [list, s] = await Promise.all([fetchIncidents(), fetchIncidentStats()])
      setIncidents(list); setStats(s)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load incidents')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function handleStatusChange(id: number, newStatus: IncidentStatus) {
    setIncidents((prev) => prev.map((inc) => inc.id === id ? { ...inc, status: newStatus } : inc))
    load()
  }

  async function handleBackfill() {
    setBackfilling(true)
    try { await backfillIncidents(); await load() }
    finally { setBackfilling(false) }
  }

  const filtered = incidents.filter((inc) => {
    if (statusFilter !== 'All' && inc.status !== statusFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        inc.title.toLowerCase().includes(q) ||
        incId(inc.id).toLowerCase().includes(q) ||
        (inc.mitre_tactics ?? '').toLowerCase().includes(q)
      )
    }
    return true
  })

  const activeCount = (stats?.open ?? 0) + (stats?.investigating ?? 0) + (stats?.contained ?? 0)

  return (
    <div className="pb-8">
      <Topbar
        title="Incidents"
        subtitle={`${activeCount} active · ${stats?.resolved ?? 0} resolved`}
        onRefresh={load}
      />

      <div className="px-4 sm:px-6 lg:px-8 space-y-4">
        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: 'Total',          value: stats?.total ?? '—',         color: 'bg-white border-gray-200',     text: 'text-gray-900'  },
            { label: 'Open',           value: stats?.open ?? '—',          color: 'bg-red-50 border-red-200',     text: 'text-red-600'   },
            { label: 'Investigating',  value: stats?.investigating ?? '—',  color: 'bg-amber-50 border-amber-200', text: 'text-amber-700' },
            { label: 'Contained',      value: stats?.contained ?? '—',     color: 'bg-blue-50 border-blue-200',   text: 'text-blue-700'  },
            { label: 'Resolved',       value: stats?.resolved ?? '—',      color: 'bg-green-50 border-green-200', text: 'text-green-700' },
          ].map(({ label, value, color, text }) => (
            <div key={label} className={`rounded-xl border p-4 ${color}`}>
              <p className={`text-2xl font-bold ${text}`}>{value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Controls */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
            {(['All', 'Open', 'Investigating', 'Contained', 'Resolved'] as StatusFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`px-4 py-2 transition-colors ${
                  statusFilter === f ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search incidents, ID, MITRE…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white w-56 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <span className="text-sm text-gray-400">{filtered.length} results</span>

          {isAdmin && incidents.length === 0 && !loading && (
            <button
              onClick={handleBackfill}
              disabled={backfilling}
              className="ml-auto inline-flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
            >
              {backfilling ? <Loader2 size={14} className="animate-spin" /> : <Layers size={14} />}
              {backfilling ? 'Correlating…' : 'Correlate existing alerts'}
            </button>
          )}
        </div>

        {/* Table */}
        <Card>
          {loading ? (
            <div className="flex items-center justify-center py-20 gap-2 text-gray-400">
              <RefreshCw size={16} className="animate-spin" />
              <span className="text-sm">Loading incidents…</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20 gap-2 text-red-500">
              <AlertTriangle size={20} />
              <p className="text-sm">{error}</p>
              <button onClick={load} className="text-xs underline mt-1">Retry</button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-20 text-center">
              <ShieldAlert size={36} className="mx-auto text-gray-200 mb-3" />
              <p className="text-gray-400 text-sm font-medium">No incidents found</p>
              {incidents.length === 0 && isAdmin && (
                <p className="text-gray-400 text-xs mt-1">Use "Correlate existing alerts" to group your current alerts into incidents.</p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                    <th className="font-medium py-3 pr-4 w-28">ID</th>
                    <th className="font-medium py-3 pr-4">Title</th>
                    <th className="font-medium py-3 pr-4">Severity</th>
                    <th className="font-medium py-3 pr-4">Status</th>
                    <th className="font-medium py-3 pr-4">Alerts</th>
                    <th className="font-medium py-3 pr-4">Endpoints</th>
                    <th className="font-medium py-3 pr-4">MITRE</th>
                    <th className="font-medium py-3 pr-4">Opened</th>
                    <th className="font-medium py-3">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((inc) => (
                    <tr
                      key={inc.id}
                      className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60 transition-colors cursor-pointer"
                      onClick={() => setSelectedId(inc.id)}
                    >
                      <td className="py-3.5 pr-4">
                        <span className="font-mono text-xs text-gray-500">{incId(inc.id)}</span>
                      </td>
                      <td className="py-3.5 pr-4 max-w-[220px]">
                        <p className="font-medium text-gray-900 truncate">{inc.title}</p>
                        {inc.description && (
                          <p className="text-xs text-gray-400 truncate mt-0.5">{inc.description}</p>
                        )}
                      </td>
                      <td className="py-3.5 pr-4"><Badge severity={inc.severity as Severity} /></td>
                      <td className="py-3.5 pr-4"><StatusBadge status={inc.status as IncidentStatus} /></td>
                      <td className="py-3.5 pr-4 text-center">
                        <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-gray-100 text-xs font-medium text-gray-700">
                          {inc.alert_count}
                        </span>
                      </td>
                      <td className="py-3.5 pr-4">
                        <div className="flex items-center gap-1 text-gray-600">
                          <Monitor size={13} className="text-gray-400" />
                          <span className="text-xs">{inc.affected_endpoints}</span>
                        </div>
                      </td>
                      <td className="py-3.5 pr-4 max-w-[160px]">
                        <div className="flex flex-wrap gap-1">
                          {mitreList(inc.mitre_tactics).slice(0, 2).map((t) => (
                            <span key={t} className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded truncate max-w-[120px]">{t}</span>
                          ))}
                          {mitreList(inc.mitre_tactics).length > 2 && (
                            <span className="text-[10px] text-gray-400">+{mitreList(inc.mitre_tactics).length - 2}</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 pr-4 text-xs text-gray-400 whitespace-nowrap">{relativeTime(inc.created_at)}</td>
                      <td className="py-3.5">
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedId(inc.id) }}
                          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 hover:underline"
                        >
                          View <ChevronRight size={13} />
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

      {selectedId !== null && (
        <DetailDrawer
          incidentId={selectedId}
          onClose={() => setSelectedId(null)}
          onStatusChange={handleStatusChange}
        />
      )}
    </div>
  )
}
