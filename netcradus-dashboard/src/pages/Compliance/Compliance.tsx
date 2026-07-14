import { useEffect, useState, useCallback } from 'react'
import {
  ShieldCheck, AlertTriangle, FileCheck2, TrendingUp,
  ChevronRight, CheckCircle2, XCircle, MinusCircle,
  Ban, RefreshCw, Plus, X, ChevronDown, ChevronUp,
  ClipboardList, Loader2,
} from 'lucide-react'
import {
  fetchComplianceDashboard,
  patchAssessment,
  fetchEvidence,
  addEvidence,
  type ComplianceDashboard,
  type FrameworkSummary,
  type ControlDetail,
  type EvidenceItem,
} from '@/api/complianceApi'

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  compliant:       { label: 'Compliant',       icon: CheckCircle2,  cls: 'text-emerald-400', bg: 'bg-emerald-400/10 text-emerald-400' },
  partial:         { label: 'Partial',          icon: MinusCircle,   cls: 'text-amber-400',   bg: 'bg-amber-400/10   text-amber-400'   },
  non_compliant:   { label: 'Non-Compliant',    icon: XCircle,       cls: 'text-red-400',     bg: 'bg-red-400/10     text-red-400'     },
  not_applicable:  { label: 'Not Applicable',   icon: Ban,           cls: 'text-slate-400',   bg: 'bg-slate-400/10   text-slate-400'   },
} as const
type StatusKey = keyof typeof STATUS_CONFIG

const PRIORITY_CLS: Record<string, string> = {
  Critical: 'bg-red-500/15 text-red-400 border border-red-500/30',
  High:     'bg-orange-500/15 text-orange-400 border border-orange-500/30',
  Medium:   'bg-amber-500/15 text-amber-400 border border-amber-500/30',
  Low:      'bg-slate-500/15 text-slate-400 border border-slate-500/30',
}

// ── Ring Chart (SVG donut) ─────────────────────────────────────────────────────

function RingChart({ score, color, size = 80 }: { score: number; color: string; size?: number }) {
  const r = (size - 10) / 2
  const circ = 2 * Math.PI * r
  const dash = (score / 100) * circ

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rotate-[-90deg]">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={8} />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none"
        stroke={color}
        strokeWidth={8}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.6s ease' }}
      />
    </svg>
  )
}

// ── Framework Card ─────────────────────────────────────────────────────────────

function FrameworkCard({
  fw,
  selected,
  onClick,
}: {
  fw: FrameworkSummary
  selected: boolean
  onClick: () => void
}) {
  const color = fw.color ?? '#3B82F6'
  return (
    <button
      onClick={onClick}
      className={`relative w-full text-left rounded-xl border transition-all duration-200 p-4 group
        ${selected
          ? 'border-white/20 bg-white/[0.06] shadow-lg'
          : 'border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.05] hover:border-white/10'
        }`}
    >
      {/* colored top bar */}
      <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-xl" style={{ background: color }} />

      <div className="flex items-center gap-3">
        <div className="relative flex-shrink-0">
          <RingChart score={fw.score} color={color} size={72} />
          <span
            className="absolute inset-0 flex items-center justify-center text-sm font-bold"
            style={{ color }}
          >
            {fw.score}%
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-white font-semibold text-sm truncate">{fw.name}</p>
          <p className="text-xs text-slate-400 mt-0.5">{fw.version}</p>
          <div className="mt-2 flex gap-3 text-xs">
            <span className="text-emerald-400">{fw.compliant} passed</span>
            <span className="text-red-400">{fw.missing} missing</span>
          </div>
        </div>

        <ChevronRight
          size={14}
          className={`flex-shrink-0 transition-transform ${selected ? 'rotate-90 text-white' : 'text-slate-500 group-hover:text-slate-300'}`}
        />
      </div>
    </button>
  )
}

// ── Control Row ────────────────────────────────────────────────────────────────

function ControlRow({
  ctrl,
  onStatusChange,
  onOpenEvidence,
}: {
  ctrl: ControlDetail
  onStatusChange: (id: number, status: StatusKey) => void
  onOpenEvidence: (ctrl: ControlDetail) => void
}) {
  const [open, setOpen] = useState(false)
  const cfg = STATUS_CONFIG[ctrl.status as StatusKey] ?? STATUS_CONFIG.non_compliant
  const Icon = cfg.icon

  return (
    <div className="border border-white/[0.06] rounded-lg overflow-hidden">
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/[0.03] transition-colors"
        onClick={() => setOpen(v => !v)}
      >
        {/* status icon */}
        <Icon size={16} className={cfg.cls} />

        {/* ref badge */}
        <span className="text-xs font-mono text-slate-400 flex-shrink-0 w-28">{ctrl.control_ref}</span>

        {/* title */}
        <span className="text-sm text-slate-200 flex-1 min-w-0 truncate">{ctrl.title}</span>

        {/* priority */}
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${PRIORITY_CLS[ctrl.priority] ?? ''}`}>
          {ctrl.priority}
        </span>

        {/* category */}
        <span className="text-xs text-slate-500 flex-shrink-0 hidden lg:block w-28 text-right truncate">{ctrl.category}</span>

        {/* auto tag */}
        {ctrl.xdr_auto && (
          <span className="text-[10px] bg-blue-500/15 text-blue-400 border border-blue-500/30 px-1.5 py-0.5 rounded flex-shrink-0">
            Auto
          </span>
        )}

        {/* evidence count */}
        <span className="text-xs text-slate-500 flex-shrink-0 w-14 text-right">{ctrl.evidence} ev.</span>

        {open ? <ChevronUp size={14} className="text-slate-400 flex-shrink-0" /> : <ChevronDown size={14} className="text-slate-400 flex-shrink-0" />}
      </div>

      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-white/[0.04] bg-white/[0.02]">
          <p className="text-xs text-slate-400 mb-3">{ctrl.category} control — set status or add evidence.</p>

          {/* Status selector */}
          <div className="flex flex-wrap gap-2 mb-3">
            {(Object.keys(STATUS_CONFIG) as StatusKey[]).map(s => {
              const c = STATUS_CONFIG[s]
              const Ico = c.icon
              return (
                <button
                  key={s}
                  onClick={() => onStatusChange(ctrl.id, s)}
                  className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-all
                    ${ctrl.status === s
                      ? `${c.bg} border-current font-semibold`
                      : 'border-white/10 text-slate-400 hover:border-white/20 hover:text-slate-200'
                    }`}
                >
                  <Ico size={12} />
                  {c.label}
                </button>
              )
            })}
          </div>

          <button
            onClick={() => onOpenEvidence(ctrl)}
            className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            <ClipboardList size={13} />
            Manage Evidence ({ctrl.evidence})
          </button>
        </div>
      )}
    </div>
  )
}

// ── Evidence Panel ─────────────────────────────────────────────────────────────

function EvidencePanel({
  ctrl,
  onClose,
}: {
  ctrl: ControlDetail
  onClose: () => void
}) {
  const [items, setItems]   = useState<EvidenceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [title, setTitle]   = useState('')
  const [desc, setDesc]     = useState('')
  const [type, setType]     = useState('document')
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    fetchEvidence(ctrl.id)
      .then(setItems)
      .finally(() => setLoading(false))
  }, [ctrl.id])

  const handleAdd = async () => {
    if (!title.trim()) return
    setAdding(true)
    try {
      const ev = await addEvidence(ctrl.id, { title: title.trim(), description: desc.trim() || undefined, evidence_type: type })
      setItems(prev => [ev, ...prev])
      setTitle('')
      setDesc('')
    } finally {
      setAdding(false)
    }
  }

  const EVIDENCE_TYPES = ['document', 'screenshot', 'log_export', 'config', 'policy', 'test_result']

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#111827] border border-white/10 rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div>
            <p className="text-xs text-slate-500 font-mono">{ctrl.control_ref}</p>
            <h3 className="text-sm font-semibold text-white mt-0.5">{ctrl.title}</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Add form */}
        <div className="px-5 py-4 border-b border-white/[0.06] space-y-3">
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Evidence title..."
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
          />
          <textarea
            value={desc}
            onChange={e => setDesc(e.target.value)}
            placeholder="Description (optional)..."
            rows={2}
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 resize-none"
          />
          <div className="flex gap-2 items-center">
            <select
              value={type}
              onChange={e => setType(e.target.value)}
              className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:outline-none flex-1"
            >
              {EVIDENCE_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
            </select>
            <button
              onClick={handleAdd}
              disabled={!title.trim() || adding}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm px-4 py-2 rounded-lg transition-colors"
            >
              {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Add
            </button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="animate-spin text-slate-500" />
            </div>
          ) : items.length === 0 ? (
            <p className="text-center text-slate-500 text-sm py-8">No evidence attached yet.</p>
          ) : items.map(ev => (
            <div key={ev.id} className="border border-white/[0.06] rounded-lg px-3 py-2.5">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm text-white">{ev.title}</p>
                <span className="text-[10px] bg-slate-500/15 text-slate-400 border border-slate-500/20 px-1.5 py-0.5 rounded flex-shrink-0">
                  {ev.evidence_type.replace('_', ' ')}
                </span>
              </div>
              {ev.description && <p className="text-xs text-slate-400 mt-1">{ev.description}</p>}
              <p className="text-[10px] text-slate-600 mt-1">
                {ev.created_at ? new Date(ev.created_at).toLocaleDateString() : ''}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, icon: Icon, accent,
}: {
  label: string; value: string | number; sub: string
  icon: React.ElementType; accent: string
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.03] px-5 py-4">
      <div className="absolute top-0 right-0 w-20 h-20 rounded-bl-full opacity-5" style={{ background: accent }} />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-wider">{label}</p>
          <p className="text-3xl font-bold text-white mt-1 tabular-nums">{value}</p>
          <p className="text-xs text-slate-500 mt-1">{sub}</p>
        </div>
        <div className="p-2 rounded-lg mt-1" style={{ background: `${accent}20` }}>
          <Icon size={18} style={{ color: accent }} />
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function Compliance() {
  const [data, setData]         = useState<ComplianceDashboard | null>(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [selectedFw, setSelectedFw] = useState<FrameworkSummary | null>(null)
  const [evidenceCtrl, setEvidenceCtrl] = useState<ControlDetail | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    setError(null)
    try {
      const d = await fetchComplianceDashboard()
      setData(d)
      if (!selectedFw && d.frameworks.length) setSelectedFw(d.frameworks[0])
      else if (selectedFw) {
        const updated = d.frameworks.find(f => f.id === selectedFw.id)
        if (updated) setSelectedFw(updated)
      }
    } catch {
      setError('Failed to load compliance data.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [selectedFw])

  useEffect(() => { load() }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  const handleStatusChange = async (controlId: number, status: StatusKey) => {
    try {
      await patchAssessment(controlId, { status })
      load(true)
    } catch {}
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <Loader2 size={40} className="animate-spin text-blue-400 mx-auto" />
          <p className="text-slate-400">Loading compliance data…</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <AlertTriangle size={40} className="text-red-400 mx-auto" />
          <p className="text-slate-300">{error ?? 'No data'}</p>
          <button onClick={() => load()} className="text-sm text-blue-400 hover:text-blue-300 underline">
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="max-w-screen-2xl mx-auto px-6 py-6 space-y-6">

        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <ShieldCheck size={24} className="text-blue-400" />
              Compliance Dashboard
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Multi-framework compliance posture — ISO 27001 · SOC 2 · PCI DSS · GDPR · DPDP Act · HIPAA
            </p>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="flex items-center gap-2 text-sm text-slate-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.06] px-4 py-2 rounded-lg transition-all disabled:opacity-50"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* ── Overall Score Hero ── */}
        <div className="rounded-2xl border border-white/[0.06] bg-gradient-to-br from-blue-600/10 via-transparent to-purple-600/10 p-6">
          <div className="flex flex-col md:flex-row items-center gap-8">
            {/* big ring */}
            <div className="relative flex-shrink-0">
              <RingChart score={data.overall_score} color="#3B82F6" size={140} />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-bold text-white tabular-nums">{data.overall_score}%</span>
                <span className="text-xs text-slate-400 mt-1">Overall</span>
              </div>
            </div>

            {/* KPI strip */}
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
              <KpiCard
                label="Total Controls"
                value={data.total_controls}
                sub="across all frameworks"
                icon={TrendingUp}
                accent="#3B82F6"
              />
              <KpiCard
                label="Missing Controls"
                value={data.missing_controls}
                sub="need attention"
                icon={AlertTriangle}
                accent="#EF4444"
              />
              <KpiCard
                label="Evidence Ready"
                value={data.evidence_ready}
                sub="controls with attached evidence"
                icon={FileCheck2}
                accent="#10B981"
              />
            </div>
          </div>
        </div>

        {/* ── Framework Grid + Detail Panel ── */}
        <div className="grid grid-cols-1 xl:grid-cols-[340px_1fr] gap-6">

          {/* Framework list */}
          <div className="space-y-2">
            <p className="text-xs text-slate-500 uppercase tracking-wider font-medium px-1 mb-3">Frameworks</p>
            {data.frameworks.map(fw => (
              <FrameworkCard
                key={fw.id}
                fw={fw}
                selected={selectedFw?.id === fw.id}
                onClick={() => setSelectedFw(fw)}
              />
            ))}
          </div>

          {/* Controls detail */}
          {selectedFw && (
            <div className="min-w-0">
              {/* Framework header */}
              <div className="flex items-start justify-between mb-4 gap-4 flex-wrap">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ background: selectedFw.color ?? '#3B82F6' }} />
                    <h2 className="text-lg font-semibold text-white">{selectedFw.name}</h2>
                    {selectedFw.version && (
                      <span className="text-xs bg-white/[0.06] text-slate-400 px-2 py-0.5 rounded">{selectedFw.version}</span>
                    )}
                  </div>
                  {selectedFw.description && (
                    <p className="text-sm text-slate-400 mt-1">{selectedFw.description}</p>
                  )}
                </div>

                {/* Mini summary */}
                <div className="flex items-center gap-4 text-sm flex-shrink-0">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-white tabular-nums"
                      style={{ color: selectedFw.color ?? '#3B82F6' }}>
                      {selectedFw.score}%
                    </p>
                    <p className="text-xs text-slate-500">Score</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-emerald-400 tabular-nums">{selectedFw.compliant}</p>
                    <p className="text-xs text-slate-500">Passed</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-red-400 tabular-nums">{selectedFw.missing}</p>
                    <p className="text-xs text-slate-500">Missing</p>
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full h-1.5 bg-white/[0.06] rounded-full mb-5 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${selectedFw.score}%`,
                    background: selectedFw.color ?? '#3B82F6',
                  }}
                />
              </div>

              {/* Controls list grouped by category */}
              {(() => {
                const grouped: Record<string, ControlDetail[]> = {}
                for (const c of selectedFw.controls) {
                  ;(grouped[c.category] ??= []).push(c)
                }
                return Object.entries(grouped).map(([cat, ctrls]) => (
                  <div key={cat} className="mb-5">
                    <p className="text-xs text-slate-500 uppercase tracking-wider font-medium mb-2 px-1">{cat}</p>
                    <div className="space-y-1.5">
                      {ctrls.map(ctrl => (
                        <ControlRow
                          key={ctrl.id}
                          ctrl={ctrl}
                          onStatusChange={handleStatusChange}
                          onOpenEvidence={setEvidenceCtrl}
                        />
                      ))}
                    </div>
                  </div>
                ))
              })()}
            </div>
          )}
        </div>

        {/* ── All Frameworks Overview grid ── */}
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider font-medium mb-3">All Frameworks At a Glance</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {data.frameworks.map(fw => {
              const color = fw.color ?? '#3B82F6'
              return (
                <button
                  key={fw.id}
                  onClick={() => setSelectedFw(fw)}
                  className={`relative rounded-xl border p-4 text-center transition-all group
                    ${selectedFw?.id === fw.id
                      ? 'border-white/20 bg-white/[0.06]'
                      : 'border-white/[0.06] bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.04]'
                    }`}
                >
                  <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-xl" style={{ background: color }} />
                  <div className="relative mx-auto w-14 h-14 mb-2">
                    <RingChart score={fw.score} color={color} size={56} />
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-bold" style={{ color }}>
                      {fw.score}%
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-white truncate">{fw.name}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{fw.version}</p>
                  <p className="text-[10px] mt-1.5">
                    <span className="text-emerald-400">{fw.compliant}✓</span>{' '}
                    <span className="text-red-400">{fw.missing}✗</span>
                  </p>
                </button>
              )
            })}
          </div>
        </div>

      </div>

      {/* Evidence panel modal */}
      {evidenceCtrl && (
        <EvidencePanel ctrl={evidenceCtrl} onClose={() => setEvidenceCtrl(null)} />
      )}
    </div>
  )
}
