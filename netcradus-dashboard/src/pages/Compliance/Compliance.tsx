import { useEffect, useState, useCallback } from 'react'
import {
  ShieldCheck, AlertTriangle, FileCheck2,
  CheckCircle2, XCircle, MinusCircle, Ban,
  RefreshCw, Plus, X, ClipboardList, Loader2,
  Download, ChevronDown, ChevronUp, Zap,
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

// ── Status config ──────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  compliant:      { label: 'Compliant',     icon: CheckCircle2, cls: 'text-emerald-400', bg: 'bg-emerald-400/10 text-emerald-400', bar: '#10B981' },
  partial:        { label: 'Partial',        icon: MinusCircle,  cls: 'text-amber-400',   bg: 'bg-amber-400/10 text-amber-400',    bar: '#F59E0B' },
  non_compliant:  { label: 'Non-Compliant',  icon: XCircle,      cls: 'text-red-400',     bg: 'bg-red-400/10 text-red-400',        bar: '#EF4444' },
  not_applicable: { label: 'N/A',            icon: Ban,          cls: 'text-slate-500',   bg: 'bg-slate-500/10 text-slate-400',    bar: '#475569' },
} as const
type StatusKey = keyof typeof STATUS_CONFIG

const PRIORITY_PILL: Record<string, string> = {
  Critical: 'bg-red-500/15 text-red-400 border border-red-500/25',
  High:     'bg-orange-500/15 text-orange-400 border border-orange-500/25',
  Medium:   'bg-amber-500/15 text-amber-400 border border-amber-500/25',
  Low:      'bg-slate-500/15 text-slate-400 border border-slate-500/25',
}

// ── Export helper ──────────────────────────────────────────────────────────────

function exportCSV(data: ComplianceDashboard) {
  const header = ['Framework', 'Version', 'Control Ref', 'Title', 'Category', 'Priority', 'Status', 'Evidence']
  const rows = data.frameworks.flatMap(fw =>
    fw.controls.map(c => [fw.name, fw.version ?? '', c.control_ref, c.title, c.category, c.priority, c.status, String(c.evidence)])
  )
  const csv = [header, ...rows].map(r => r.map(v => `"${v.replace(/"/g, '""')}"`).join(',')).join('\n')
  const url  = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  const a    = Object.assign(document.createElement('a'), { href: url, download: `netxdr-compliance-${new Date().toISOString().slice(0, 10)}.csv` })
  a.click()
  URL.revokeObjectURL(url)
}

// ── Animated ring (stroke-dashoffset draws in on mount) ────────────────────────

function AnimatedRing({
  score, stroke, size, sw = 9,
}: { score: number; stroke: string; size: number; sw?: number }) {
  const [drawn, setDrawn] = useState(false)
  const r      = (size - sw) / 2
  const circ   = 2 * Math.PI * r
  const offset = drawn ? circ - (score / 100) * circ : circ

  useEffect(() => {
    const t = setTimeout(() => setDrawn(true), 120)
    return () => clearTimeout(t)
  }, [score])

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={sw} />
      <circle
        cx={size/2} cy={size/2} r={r}
        fill="none" stroke={stroke}
        strokeWidth={sw}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{ transition: 'stroke-dashoffset 1s cubic-bezier(.4,0,.2,1)' }}
      />
    </svg>
  )
}

// ── Gradient ring (overall score) ─────────────────────────────────────────────

function GradientRing({ score, size }: { score: number; size: number }) {
  const [drawn, setDrawn] = useState(false)
  const sw    = 14
  const r     = (size - sw) / 2
  const circ  = 2 * Math.PI * r
  const offset = drawn ? circ - (score / 100) * circ : circ

  useEffect(() => {
    const t = setTimeout(() => setDrawn(true), 200)
    return () => clearTimeout(t)
  }, [score])

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <defs>
        <linearGradient id="score-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#60A5FA" />
          <stop offset="45%"  stopColor="#A78BFA" />
          <stop offset="100%" stopColor="#F472B6" />
        </linearGradient>
      </defs>
      {/* Glow halo */}
      <circle
        cx={size/2} cy={size/2} r={r}
        fill="none" stroke="url(#score-grad)"
        strokeWidth={sw + 10}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`}
        opacity={0.12}
        style={{ transition: 'stroke-dashoffset 1s cubic-bezier(.4,0,.2,1)' }}
      />
      {/* Track */}
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={sw} />
      {/* Progress */}
      <circle
        cx={size/2} cy={size/2} r={r}
        fill="none" stroke="url(#score-grad)"
        strokeWidth={sw}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{ transition: 'stroke-dashoffset 1s cubic-bezier(.4,0,.2,1)' }}
      />
    </svg>
  )
}

// ── KPI card ──────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, accent, icon: Icon,
}: { label: string; value: string | number; sub: string; accent: string; icon: React.ElementType }) {
  return (
    <div
      className="relative flex-1 min-w-0 rounded-2xl border p-5 overflow-hidden"
      style={{ borderColor: `${accent}25`, background: `${accent}0A` }}
    >
      <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full" style={{ background: `${accent}12` }} />
      <div className="relative flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] uppercase tracking-widest font-semibold mb-2" style={{ color: `${accent}CC` }}>{label}</p>
          <p className="text-4xl font-black text-white tabular-nums leading-none">{value}</p>
          <p className="text-xs text-slate-500 mt-2 leading-tight">{sub}</p>
        </div>
        <div className="p-2.5 rounded-xl flex-shrink-0" style={{ background: `${accent}18` }}>
          <Icon size={20} style={{ color: accent }} />
        </div>
      </div>
    </div>
  )
}

// ── Framework selector card ────────────────────────────────────────────────────

function FwCard({
  fw, selected, onClick,
}: { fw: FrameworkSummary; selected: boolean; onClick: () => void }) {
  const color  = fw.color ?? '#3B82F6'
  const compliantPct = fw.total > 0 ? (fw.compliant / fw.total) * 100 : 0
  const missingPct   = fw.total > 0 ? (fw.missing  / fw.total) * 100 : 0

  return (
    <button
      onClick={onClick}
      className="relative flex flex-col items-center gap-3 rounded-2xl border p-5 transition-all duration-300 flex-shrink-0 w-44 text-left"
      style={selected ? {
        borderColor: `${color}55`,
        background:  `${color}12`,
        boxShadow:   `0 0 32px ${color}22, 0 8px 24px rgba(0,0,0,0.4)`,
      } : {
        borderColor: 'rgba(255,255,255,0.06)',
        background:  'rgba(255,255,255,0.025)',
      }}
    >
      {/* top accent line */}
      <div className="absolute top-0 inset-x-0 h-[2px] rounded-t-2xl" style={{ background: selected ? color : `${color}60` }} />

      {/* Ring */}
      <div className="relative">
        <AnimatedRing score={fw.score} stroke={color} size={84} sw={9} />
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-black tabular-nums" style={{ color }}>{fw.score}%</span>
        </div>
      </div>

      {/* Name + version */}
      <div className="text-center w-full">
        <p className="text-sm font-bold text-white leading-tight truncate">{fw.name}</p>
        <p className="text-[10px] text-slate-500 mt-0.5">{fw.version}</p>
      </div>

      {/* Status distribution bar */}
      <div className="w-full space-y-1.5">
        <div className="flex h-1.5 w-full rounded-full overflow-hidden bg-white/[0.06]">
          <div
            className="h-full rounded-l-full transition-all duration-700"
            style={{ width: `${compliantPct}%`, background: '#10B981' }}
          />
          <div
            className="h-full transition-all duration-700"
            style={{ width: `${missingPct}%`, background: '#EF4444' }}
          />
        </div>
        <div className="flex justify-between text-[9px] tabular-nums font-medium">
          <span className="text-emerald-400">{fw.compliant} passed</span>
          <span className="text-red-400">{fw.missing} missing</span>
        </div>
      </div>
    </button>
  )
}

// ── Control row ────────────────────────────────────────────────────────────────

function ControlRow({
  ctrl, onStatusChange, onOpenEvidence,
}: {
  ctrl: ControlDetail
  onStatusChange: (id: number, s: StatusKey) => void
  onOpenEvidence: (c: ControlDetail) => void
}) {
  const [open, setOpen] = useState(false)
  const cfg  = STATUS_CONFIG[ctrl.status as StatusKey] ?? STATUS_CONFIG.non_compliant
  const Icon = cfg.icon

  return (
    <div className="relative border-l-2 transition-colors" style={{ borderColor: open ? cfg.bar : 'transparent' }}>
      {/* Row */}
      <div
        className="flex items-center gap-3 px-5 py-3.5 cursor-pointer select-none hover:bg-white/[0.025] transition-colors"
        onClick={() => setOpen(v => !v)}
      >
        <Icon size={14} className={`flex-shrink-0 ${cfg.cls}`} />
        <span className="font-mono text-[11px] text-slate-500 w-28 flex-shrink-0 truncate">{ctrl.control_ref}</span>
        <span className="text-sm text-slate-200 flex-1 min-w-0 truncate">{ctrl.title}</span>
        <span className={`hidden md:inline-block text-[10px] px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ${PRIORITY_PILL[ctrl.priority] ?? ''}`}>
          {ctrl.priority}
        </span>
        <span className="hidden xl:block text-[11px] text-slate-500 flex-shrink-0 w-28 text-right truncate">{ctrl.category}</span>
        {ctrl.xdr_auto && (
          <span className="hidden sm:inline-flex items-center gap-1 text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded-full">
            <Zap size={9} />Auto
          </span>
        )}
        {ctrl.evidence > 0 && (
          <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded-full flex-shrink-0 hidden sm:inline">
            {ctrl.evidence} ev
          </span>
        )}
        {open
          ? <ChevronUp   size={13} className="text-slate-500 flex-shrink-0" />
          : <ChevronDown size={13} className="text-slate-500 flex-shrink-0" />
        }
      </div>

      {/* Expanded */}
      {open && (
        <div className="px-5 pb-4 border-t border-white/[0.05] bg-white/[0.02]">
          <div className="flex flex-wrap gap-2 mt-3 mb-3">
            {(Object.keys(STATUS_CONFIG) as StatusKey[]).map(s => {
              const c = STATUS_CONFIG[s]; const Ico = c.icon
              return (
                <button
                  key={s}
                  onClick={() => onStatusChange(ctrl.id, s)}
                  className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-all ${
                    ctrl.status === s
                      ? `${c.bg} border-current font-semibold`
                      : 'border-white/10 text-slate-400 hover:border-white/20 hover:text-slate-200'
                  }`}
                >
                  <Ico size={11} />{c.label}
                </button>
              )
            })}
          </div>
          <button
            onClick={() => onOpenEvidence(ctrl)}
            className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            <ClipboardList size={12} />
            Manage Evidence ({ctrl.evidence})
          </button>
        </div>
      )}
    </div>
  )
}

// ── Evidence modal ─────────────────────────────────────────────────────────────

function EvidenceModal({ ctrl, onClose }: { ctrl: ControlDetail; onClose: () => void }) {
  const [items,   setItems]   = useState<EvidenceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [title,   setTitle]   = useState('')
  const [desc,    setDesc]    = useState('')
  const [type,    setType]    = useState('document')
  const [adding,  setAdding]  = useState(false)

  useEffect(() => {
    fetchEvidence(ctrl.id).then(setItems).finally(() => setLoading(false))
  }, [ctrl.id])

  const handleAdd = async () => {
    if (!title.trim()) return
    setAdding(true)
    try {
      const ev = await addEvidence(ctrl.id, { title: title.trim(), description: desc.trim() || undefined, evidence_type: type })
      setItems(p => [ev, ...p])
      setTitle(''); setDesc('')
    } finally { setAdding(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full max-w-lg max-h-[85vh] flex flex-col rounded-2xl border border-white/10 shadow-2xl" style={{ background: '#0D1117' }}>
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-white/[0.06]">
          <div>
            <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">{ctrl.control_ref}</p>
            <h3 className="text-sm font-semibold text-white mt-1">{ctrl.title}</h3>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors mt-0.5">
            <X size={18} />
          </button>
        </div>

        {/* Add form */}
        <div className="px-5 py-4 border-b border-white/[0.06] space-y-2.5">
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Evidence title…"
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/40"
          />
          <textarea
            value={desc}
            onChange={e => setDesc(e.target.value)}
            placeholder="Description (optional)…"
            rows={2}
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/40 resize-none"
          />
          <div className="flex gap-2">
            <select
              value={type}
              onChange={e => setType(e.target.value)}
              className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none"
            >
              {['document','screenshot','log_export','config','policy','test_result'].map(t =>
                <option key={t} value={t}>{t.replace('_',' ')}</option>
              )}
            </select>
            <button
              onClick={handleAdd}
              disabled={!title.trim() || adding}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium px-4 rounded-xl transition-colors"
            >
              {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Add
            </button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
          {loading
            ? <div className="flex items-center justify-center py-10"><Loader2 size={20} className="animate-spin text-slate-500" /></div>
            : items.length === 0
            ? <p className="text-center text-slate-600 text-sm py-10">No evidence attached yet.</p>
            : items.map(ev => (
              <div key={ev.id} className="border border-white/[0.06] rounded-xl px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm text-white">{ev.title}</p>
                  <span className="text-[10px] bg-slate-500/10 text-slate-400 border border-slate-500/20 px-1.5 py-0.5 rounded-full flex-shrink-0">
                    {ev.evidence_type.replace('_',' ')}
                  </span>
                </div>
                {ev.description && <p className="text-xs text-slate-400 mt-1">{ev.description}</p>}
                <p className="text-[10px] text-slate-600 mt-1">{ev.created_at ? new Date(ev.created_at).toLocaleDateString() : ''}</p>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  )
}

// ── Controls panel ────────────────────────────────────────────────────────────

function ControlsPanel({
  fw, onStatusChange, onOpenEvidence,
}: {
  fw: FrameworkSummary
  onStatusChange: (id: number, s: StatusKey) => void
  onOpenEvidence: (c: ControlDetail) => void
}) {
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const color = fw.color ?? '#3B82F6'

  const counts = {
    compliant:      fw.controls.filter(c => c.status === 'compliant').length,
    partial:        fw.controls.filter(c => c.status === 'partial').length,
    non_compliant:  fw.controls.filter(c => c.status === 'non_compliant').length,
    not_applicable: fw.controls.filter(c => c.status === 'not_applicable').length,
  }

  const filtered = statusFilter === 'all'
    ? fw.controls
    : fw.controls.filter(c => c.status === statusFilter)

  // Group by category
  const grouped: Record<string, ControlDetail[]> = {}
  for (const c of filtered) { (grouped[c.category] ??= []).push(c) }

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ borderColor: `${color}25` }}>
      {/* Panel header */}
      <div
        className="px-6 py-5 border-b flex items-center justify-between gap-4 flex-wrap"
        style={{ borderColor: `${color}20`, background: `${color}0A` }}
      >
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full" style={{ background: color }} />
          <h2 className="text-white font-bold text-base">{fw.name}</h2>
          {fw.version && (
            <span className="text-[11px] border rounded-full px-2 py-0.5 font-medium" style={{ borderColor: `${color}40`, color: `${color}CC` }}>
              {fw.version}
            </span>
          )}
          {fw.description && (
            <span className="text-xs text-slate-500 hidden lg:block truncate max-w-xs">— {fw.description}</span>
          )}
        </div>

        {/* Mini KPIs */}
        <div className="flex items-center gap-5 text-sm">
          <div className="text-center">
            <p className="text-2xl font-black tabular-nums leading-none" style={{ color }}>{fw.score}%</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Score</p>
          </div>
          <div className="w-px h-8 bg-white/[0.06]" />
          <div className="text-center">
            <p className="text-2xl font-black text-emerald-400 tabular-nums leading-none">{fw.compliant}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Passed</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-black text-red-400 tabular-nums leading-none">{fw.missing}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Missing</p>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 w-full bg-white/[0.06]">
        <div
          className="h-full transition-all duration-700"
          style={{ width: `${fw.score}%`, background: `linear-gradient(90deg, ${color}, ${color}AA)` }}
        />
      </div>

      {/* Status filter */}
      <div className="px-6 py-3 border-b border-white/[0.05] flex gap-2 flex-wrap">
        <FilterPill active={statusFilter === 'all'} onClick={() => setStatusFilter('all')} label="All" count={fw.controls.length} />
        {(Object.keys(STATUS_CONFIG) as StatusKey[]).map(s => (
          <FilterPill
            key={s}
            active={statusFilter === s}
            onClick={() => setStatusFilter(s)}
            label={STATUS_CONFIG[s].label}
            count={counts[s]}
            accent={STATUS_CONFIG[s].bar}
          />
        ))}
      </div>

      {/* Controls list */}
      <div className="divide-y divide-white/[0.04]">
        {Object.entries(grouped).length === 0 ? (
          <p className="text-center text-slate-600 text-sm py-10">No controls match this filter.</p>
        ) : Object.entries(grouped).map(([cat, ctrls]) => (
          <div key={cat}>
            <div className="px-5 py-2 bg-white/[0.02] border-b border-white/[0.04]">
              <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">{cat}</p>
            </div>
            <div className="divide-y divide-white/[0.03]">
              {ctrls.map(ctrl => (
                <ControlRow key={ctrl.id} ctrl={ctrl} onStatusChange={onStatusChange} onOpenEvidence={onOpenEvidence} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function FilterPill({ active, onClick, label, count, accent }: {
  active: boolean; onClick: () => void; label: string; count: number; accent?: string
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-all ${
        active
          ? 'border-white/20 bg-white/[0.08] text-white font-semibold'
          : 'border-white/[0.08] text-slate-400 hover:border-white/15 hover:text-slate-300'
      }`}
    >
      {accent && active && <span className="w-1.5 h-1.5 rounded-full" style={{ background: accent }} />}
      {label}
      <span className={`px-1.5 rounded-full text-[10px] ${active ? 'bg-white/10' : 'bg-white/[0.05]'}`}>{count}</span>
    </button>
  )
}

// ── Loading skeleton ───────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="animate-pulse space-y-6 p-6">
      <div className="h-8 w-64 bg-white/[0.06] rounded-lg" />
      <div className="rounded-2xl border border-white/[0.06] p-6 flex gap-6">
        <div className="w-44 h-44 rounded-full bg-white/[0.05]" />
        <div className="flex-1 space-y-3">
          <div className="h-24 rounded-2xl bg-white/[0.05]" />
          <div className="h-24 rounded-2xl bg-white/[0.05]" />
        </div>
      </div>
      <div className="flex gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="w-44 h-52 rounded-2xl bg-white/[0.05] flex-shrink-0" />
        ))}
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function Compliance() {
  const [data,         setData]         = useState<ComplianceDashboard | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState<string | null>(null)
  const [selectedFw,   setSelectedFw]   = useState<FrameworkSummary | null>(null)
  const [evidenceCtrl, setEvidenceCtrl] = useState<ControlDetail | null>(null)
  const [refreshing,   setRefreshing]   = useState(false)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    setError(null)
    try {
      const d = await fetchComplianceDashboard()
      if (!d || !Array.isArray(d.frameworks)) throw new Error('Unexpected response shape')
      setData(d)
      setSelectedFw(prev => {
        if (!prev && d.frameworks.length) return d.frameworks[0]
        return d.frameworks.find(f => f.id === prev?.id) ?? prev
      })
    } catch {
      setError('Failed to load compliance data.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleStatusChange = async (controlId: number, status: StatusKey) => {
    try {
      await patchAssessment(controlId, { status })
      load(true)
    } catch {}
  }

  // Page background
  const bg = { background: 'linear-gradient(160deg, #080C16 0%, #0B1020 60%, #080C16 100%)' }

  if (loading) {
    return (
      <div className="flex-1 min-h-screen" style={bg}>
        <Skeleton />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex-1 min-h-screen flex items-center justify-center" style={bg}>
        <div className="text-center space-y-4">
          <AlertTriangle size={44} className="text-red-400 mx-auto" />
          <p className="text-slate-300 text-sm">{error ?? 'No data available.'}</p>
          <button onClick={() => load()} className="text-sm text-blue-400 hover:text-blue-300 underline">Retry</button>
        </div>
      </div>
    )
  }

  const compliantPct = data.total_controls > 0
    ? Math.round(data.overall_score)
    : 0

  return (
    <div className="flex-1 min-h-screen overflow-y-auto" style={bg}>
      <div className="max-w-screen-2xl mx-auto px-6 py-7 space-y-7">

        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="p-1.5 rounded-lg bg-blue-500/15 border border-blue-500/20">
                <ShieldCheck size={18} className="text-blue-400" />
              </div>
              <h1 className="text-xl font-black text-white tracking-tight">Compliance Dashboard</h1>
            </div>
            <p className="text-slate-500 text-[13px] pl-9">
              ISO 27001 · SOC 2 · PCI DSS · GDPR · DPDP Act · HIPAA
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => exportCSV(data)}
              className="flex items-center gap-2 text-sm text-slate-300 hover:text-white border border-white/[0.08] hover:border-white/15 px-4 py-2 rounded-xl transition-all bg-white/[0.03] hover:bg-white/[0.06]"
            >
              <Download size={14} />
              Export CSV
            </button>
            <button
              onClick={() => load(true)}
              disabled={refreshing}
              className="flex items-center gap-2 text-sm text-slate-300 hover:text-white border border-white/[0.08] hover:border-white/15 px-4 py-2 rounded-xl transition-all bg-white/[0.03] hover:bg-white/[0.06] disabled:opacity-40"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        {/* ── Hero: Score ring + KPI strip ── */}
        <div
          className="rounded-3xl border border-white/[0.06] p-7 overflow-hidden relative"
          style={{ background: 'linear-gradient(135deg, rgba(96,165,250,0.07) 0%, rgba(167,139,250,0.05) 50%, rgba(244,114,182,0.07) 100%)' }}
        >
          {/* Background glow */}
          <div
            className="absolute -top-20 -left-20 w-72 h-72 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(96,165,250,0.12) 0%, transparent 70%)' }}
          />

          <div className="relative flex flex-col md:flex-row items-center gap-8">
            {/* Big gradient ring */}
            <div className="relative flex-shrink-0">
              <GradientRing score={data.overall_score} size={172} />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
                <span className="text-5xl font-black text-white tabular-nums leading-none">{compliantPct}%</span>
                <span className="text-[11px] text-slate-400 tracking-wider uppercase font-medium mt-1">Compliance</span>
              </div>
            </div>

            {/* Divider */}
            <div className="hidden md:block w-px self-stretch bg-white/[0.06] mx-2" />

            {/* KPI strip */}
            <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-3 gap-4">
              <KpiCard
                label="Compliance"
                value={`${compliantPct}%`}
                sub={`${data.total_controls - data.missing_controls} of ${data.total_controls} controls passing`}
                accent="#60A5FA"
                icon={ShieldCheck}
              />
              <KpiCard
                label="Missing Controls"
                value={data.missing_controls}
                sub="controls need remediation"
                accent="#F87171"
                icon={AlertTriangle}
              />
              <KpiCard
                label="Evidence Ready"
                value={data.evidence_ready}
                sub="controls have documentation"
                accent="#34D399"
                icon={FileCheck2}
              />
            </div>
          </div>

          {/* Full-width progress bar */}
          <div className="mt-7 space-y-2">
            <div className="flex justify-between text-xs text-slate-500">
              <span>Overall posture across {data.frameworks.length} frameworks</span>
              <span className="tabular-nums">{data.total_controls - data.missing_controls} / {data.total_controls} controls</span>
            </div>
            <div className="h-2 w-full rounded-full overflow-hidden bg-white/[0.06]">
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{
                  width: `${data.overall_score}%`,
                  background: 'linear-gradient(90deg, #60A5FA, #A78BFA, #F472B6)',
                }}
              />
            </div>
          </div>
        </div>

        {/* ── Framework selector row ── */}
        <div>
          <p className="text-[11px] uppercase tracking-widest text-slate-500 font-semibold mb-4">
            Frameworks — click to inspect controls
          </p>
          <div className="flex gap-4 overflow-x-auto pb-3" style={{ scrollbarWidth: 'thin' }}>
            {data.frameworks.map(fw => (
              <FwCard
                key={fw.id}
                fw={fw}
                selected={selectedFw?.id === fw.id}
                onClick={() => setSelectedFw(fw)}
              />
            ))}
          </div>
        </div>

        {/* ── Controls panel ── */}
        {selectedFw && (
          <ControlsPanel
            fw={selectedFw}
            onStatusChange={handleStatusChange}
            onOpenEvidence={setEvidenceCtrl}
          />
        )}

      </div>

      {/* Evidence modal */}
      {evidenceCtrl && (
        <EvidenceModal ctrl={evidenceCtrl} onClose={() => setEvidenceCtrl(null)} />
      )}
    </div>
  )
}
