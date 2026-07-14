import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertTriangle, CheckCircle2, ChevronDown, Code2, Download,
  FileSearch, Loader2, Plus, RefreshCw, Shield, ScanLine,
  Tag, Trash2, ToggleLeft, ToggleRight, Upload, X, Zap,
} from 'lucide-react'
import {
  fetchYaraRules, fetchScanResults, fetchScanStats,
  createYaraRule, updateYaraRule, deleteYaraRule,
  validateYaraContent, scanFile,
  type YaraRule, type YaraScanResult, type YaraStats, type YaraRulePayload,
  type YaraScanResponse,
} from '@/api/yaraRulesApi'

// ── Severity config ────────────────────────────────────────────────────────────

const SEV_STYLE: Record<string, string> = {
  Critical: 'bg-red-100 text-red-700 border border-red-200',
  High:     'bg-orange-100 text-orange-700 border border-orange-200',
  Medium:   'bg-yellow-100 text-yellow-700 border border-yellow-200',
  Low:      'bg-blue-100 text-blue-700 border border-blue-200',
}

const SEVERITIES = ['Low', 'Medium', 'High', 'Critical']

const FAMILY_COLORS: Record<string, string> = {
  Mimikatz:           'bg-purple-100 text-purple-700',
  Metasploit:         'bg-red-100 text-red-700',
  CobaltStrike:       'bg-gray-100 text-gray-700',
  WebShell:           'bg-yellow-100 text-yellow-700',
  Ransomware:         'bg-rose-100 text-rose-700',
  Emotet:             'bg-orange-100 text-orange-700',
  AgentTesla:         'bg-blue-100 text-blue-700',
  PowerShellDropper:  'bg-indigo-100 text-indigo-700',
}

function familyBadge(family: string | null) {
  if (!family) return null
  const cls = FAMILY_COLORS[family] ?? 'bg-gray-100 text-gray-600'
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      <Tag size={10} />
      {family}
    </span>
  )
}

function sevBadge(sev: string) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${SEV_STYLE[sev] ?? 'bg-gray-100 text-gray-600'}`}>
      {sev}
    </span>
  )
}

// ── EXAMPLE YARA ──────────────────────────────────────────────────────────────

const EXAMPLE_YARA = `rule Example_Malware_Detector
{
    meta:
        description = "Example YARA rule"
        family      = "Example"
        author      = "NetcradXDR"
    strings:
        $s1 = "malicious_string" ascii nocase
        $s2 = "another_ioc"     ascii wide
    condition:
        any of them
}`

// ── Rule creation modal ────────────────────────────────────────────────────────

interface RuleModalProps {
  rule?: YaraRule | null
  onClose: () => void
  onSaved: (r: YaraRule) => void
}

function RuleModal({ rule, onClose, onSaved }: RuleModalProps) {
  const [name,      setName]      = useState(rule?.name            ?? '')
  const [desc,      setDesc]      = useState(rule?.description     ?? '')
  const [family,    setFamily]    = useState(rule?.malware_family  ?? '')
  const [tags,      setTags]      = useState(rule?.tags            ?? '')
  const [content,   setContent]   = useState(rule?.content        ?? EXAMPLE_YARA)
  const [severity,  setSeverity]  = useState(rule?.severity       ?? 'High')
  const [tactic,    setTactic]    = useState(rule?.mitre_tactic   ?? '')
  const [technique, setTechnique] = useState(rule?.mitre_technique ?? '')
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [syntaxErr, setSyntaxErr] = useState<string | null>(null)

  const isEdit = !!rule && !rule.is_system

  async function checkSyntax() {
    const res = await validateYaraContent(content).catch(() => null)
    setSyntaxErr(res ? (res.valid ? null : (res.error ?? 'Invalid')) : null)
  }

  async function handleSave() {
    if (!name.trim() || !content.trim()) { setError('Name and content are required'); return }
    setLoading(true); setError(null)
    try {
      const p: YaraRulePayload = {
        name: name.trim(), description: desc.trim() || undefined,
        malware_family: family.trim() || undefined,
        tags: tags.trim() || undefined, content,
        severity, mitre_tactic: tactic.trim() || undefined,
        mitre_technique: technique.trim() || undefined,
      }
      const saved = isEdit
        ? await updateYaraRule(rule!.id, p)
        : await createYaraRule(p)
      onSaved(saved)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2">
            <Code2 size={16} className="text-blue-600" />
            <h2 className="text-sm font-semibold text-gray-900">
              {isEdit ? 'Edit YARA Rule' : 'Create YARA Rule'}
            </h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Name + Family */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Rule Name *</label>
              <input value={name} onChange={e => setName(e.target.value)}
                placeholder="e.g. Emotet_Loader"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Malware Family</label>
              <input value={family} onChange={e => setFamily(e.target.value)}
                placeholder="e.g. Emotet"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
            <input value={desc} onChange={e => setDesc(e.target.value)}
              placeholder="What does this rule detect?"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          {/* Severity */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Severity</label>
            <div className="flex gap-2">
              {SEVERITIES.map(s => (
                <button key={s} onClick={() => setSeverity(s)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                    severity === s ? SEV_STYLE[s] : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}>{s}</button>
              ))}
            </div>
          </div>

          {/* MITRE */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">MITRE Tactic</label>
              <input value={tactic} onChange={e => setTactic(e.target.value)}
                placeholder="e.g. Execution"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">MITRE Technique</label>
              <input value={technique} onChange={e => setTechnique(e.target.value)}
                placeholder="e.g. T1059.001"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Tags (space-separated)</label>
            <input value={tags} onChange={e => setTags(e.target.value)}
              placeholder="dropper c2 loader"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          {/* YARA content */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-gray-700">YARA Rule Content *</label>
              <button onClick={checkSyntax} className="text-xs text-blue-600 hover:text-blue-800">
                Validate syntax
              </button>
            </div>
            <textarea value={content} onChange={e => setContent(e.target.value)}
              rows={12}
              className="w-full text-xs font-mono border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-gray-50" />
            {syntaxErr && (
              <p className="mt-1 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5 font-mono">
                {syntaxErr}
              </p>
            )}
            {syntaxErr === null && content.trim() && (
              <p className="mt-1 text-xs text-green-600 flex items-center gap-1">
                <CheckCircle2 size={12} /> Syntax valid
              </p>
            )}
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100 shrink-0">
          <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2">Cancel</button>
          <button onClick={handleSave} disabled={loading}
            className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors">
            {loading ? <Loader2 size={13} className="animate-spin" /> : <Shield size={13} />}
            {loading ? 'Saving…' : (isEdit ? 'Update Rule' : 'Create Rule')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Manual scan panel ─────────────────────────────────────────────────────────

function ManualScanPanel() {
  const [file,      setFile]      = useState<File | null>(null)
  const [scanning,  setScanning]  = useState(false)
  const [result,    setResult]    = useState<YaraScanResponse | null>(null)
  const [error,     setError]     = useState<string | null>(null)
  const [dragging,  setDragging]  = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) { setFile(f); setResult(null); setError(null) }
  }

  function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) { setFile(f); setResult(null); setError(null) }
  }

  async function handleScan() {
    if (!file) return
    setScanning(true); setError(null); setResult(null)
    try {
      const res = await scanFile(file)
      setResult(res)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Scan failed')
    } finally {
      setScanning(false)
    }
  }

  const fmtSize = (b: number) =>
    b < 1024 ? `${b} B` : b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} KB` : `${(b / (1024 * 1024)).toFixed(1)} MB`

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
          dragging ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
        }`}
      >
        <input ref={inputRef} type="file" className="hidden" onChange={handlePick} />
        <Upload size={32} className="mx-auto mb-3 text-gray-300" />
        {file ? (
          <div className="space-y-1">
            <p className="text-sm font-medium text-gray-700">{file.name}</p>
            <p className="text-xs text-gray-400">{fmtSize(file.size)}</p>
          </div>
        ) : (
          <div className="space-y-1">
            <p className="text-sm font-medium text-gray-500">Drop a file here or click to browse</p>
            <p className="text-xs text-gray-400">Max 50 MB — scanned against all enabled YARA rules</p>
          </div>
        )}
      </div>

      {file && (
        <div className="flex items-center gap-3">
          <button onClick={handleScan} disabled={scanning}
            className="inline-flex items-center gap-2 text-sm font-medium px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors">
            {scanning ? <Loader2 size={14} className="animate-spin" /> : <ScanLine size={14} />}
            {scanning ? 'Scanning…' : 'Scan File'}
          </button>
          <button onClick={() => { setFile(null); setResult(null); setError(null) }}
            className="text-sm text-gray-400 hover:text-gray-600">
            Clear
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      {result && (
        <div className={`rounded-xl border p-4 ${result.clean ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {result.clean
                ? <><CheckCircle2 size={16} className="text-green-600" /><span className="text-sm font-semibold text-green-700">Clean — no threats detected</span></>
                : <><AlertTriangle size={16} className="text-red-600" /><span className="text-sm font-semibold text-red-700">{result.matches.length} rule{result.matches.length > 1 ? 's' : ''} matched</span></>}
            </div>
            <span className="text-xs text-gray-400 font-mono">{result.sha256.slice(0, 16)}…</span>
          </div>

          {result.matches.length > 0 && (
            <div className="space-y-2">
              {result.matches.map((m, i) => (
                <div key={i} className="bg-white rounded-lg border border-red-200 px-3 py-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {familyBadge(m.malware_family)}
                    <span className="text-xs font-mono text-gray-600">{m.rule_name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {m.mitre_technique && (
                      <span className="text-xs text-gray-400">{m.mitre_technique}</span>
                    )}
                    {sevBadge(m.severity)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

type Tab = 'rules' | 'history' | 'scan'

export default function YaraRules() {
  const [tab,       setTab]       = useState<Tab>('rules')
  const [rules,     setRules]     = useState<YaraRule[]>([])
  const [history,   setHistory]   = useState<YaraScanResult[]>([])
  const [stats,     setStats]     = useState<YaraStats | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState('')
  const [sevFilter, setSevFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editRule,  setEditRule]  = useState<YaraRule | null>(null)
  const [toDelete,  setToDelete]  = useState<YaraRule | null>(null)
  const [deleting,  setDeleting]  = useState(false)
  const [toggling,  setToggling]  = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [r, h, s] = await Promise.all([fetchYaraRules(), fetchScanResults(), fetchScanStats()])
      setRules(r); setHistory(h); setStats(s)
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // ── Rules tab ──────────────────────────────────────────────────────────────

  const filteredRules = rules.filter(r => {
    const q = search.toLowerCase()
    const matchQ = !q || r.name.toLowerCase().includes(q)
      || (r.malware_family ?? '').toLowerCase().includes(q)
      || (r.tags ?? '').toLowerCase().includes(q)
    const matchSev = !sevFilter || r.severity === sevFilter
    return matchQ && matchSev
  })

  async function handleToggle(rule: YaraRule) {
    setToggling(rule.id)
    try {
      const updated = await updateYaraRule(rule.id, { enabled: !rule.enabled })
      setRules(prev => prev.map(r => r.id === rule.id ? { ...r, enabled: updated.enabled } : r))
    } catch {}
    setToggling(null)
  }

  async function handleDelete() {
    if (!toDelete) return
    setDeleting(true)
    try {
      await deleteYaraRule(toDelete.id)
      setRules(prev => prev.filter(r => r.id !== toDelete.id))
      setToDelete(null)
    } catch {}
    setDeleting(false)
  }

  // ── History tab ────────────────────────────────────────────────────────────

  const filteredHistory = history.filter(h => {
    const q = search.toLowerCase()
    const matchQ = !q
      || (h.file_path ?? '').toLowerCase().includes(q)
      || (h.malware_family ?? '').toLowerCase().includes(q)
      || h.matched_rule_name.toLowerCase().includes(q)
    const matchSev = !sevFilter || h.severity === sevFilter
    return matchQ && matchSev
  })

  const fmtDate = (s: string | null) => s
    ? new Date(s).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—'

  // ── Stats ──────────────────────────────────────────────────────────────────

  const totalRules   = rules.length
  const enabledRules = rules.filter(r => r.enabled).length
  const systemRules  = rules.filter(r => r.is_system).length

  return (
    <div className="p-6 space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <ScanLine size={22} className="text-blue-600" />
            YARA Rules
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Automatic file scanning → malware family detection → alerts</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2 text-gray-400 hover:text-gray-600 transition-colors" title="Refresh">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={() => { setEditRule(null); setShowModal(true) }}
            className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors">
            <Plus size={14} /> Create Rule
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Rules',       value: totalRules,               icon: Shield,    color: 'text-blue-600'  },
          { label: 'Enabled',           value: enabledRules,             icon: Zap,       color: 'text-green-600' },
          { label: 'Detections (24h)',  value: stats?.detections_24h ?? 0, icon: AlertTriangle, color: 'text-red-500' },
          { label: 'Families Seen',     value: stats?.unique_families ?? 0, icon: Tag,    color: 'text-purple-600'},
        ].map(card => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-200 px-5 py-4 flex items-center gap-3">
            <card.icon size={20} className={card.color} />
            <div>
              <p className="text-xl font-bold text-gray-900">{card.value}</p>
              <p className="text-xs text-gray-500">{card.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Pipeline banner */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl px-5 py-3 flex items-center gap-3 flex-wrap text-xs text-gray-600">
        {['Downloaded File', 'YARA Engine', 'Malware Family ID', 'Alert Fired', 'Incident'].map((s, i, arr) => (
          <span key={s} className="flex items-center gap-2">
            <span className="font-medium text-gray-700">{s}</span>
            {i < arr.length - 1 && <span className="text-blue-300">→</span>}
          </span>
        ))}
        <span className="ml-auto text-gray-400">{systemRules} system rules active</span>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="flex border-b border-gray-100">
          {([
            { id: 'rules',   label: 'Rules',       icon: Shield },
            { id: 'history', label: 'Scan History', icon: FileSearch },
            { id: 'scan',    label: 'Manual Scan',  icon: ScanLine },
          ] as const).map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-200'
              }`}>
              <t.icon size={14} />
              {t.label}
              {t.id === 'rules'   && <span className="ml-1 text-xs bg-gray-100 text-gray-500 rounded-full px-1.5">{totalRules}</span>}
              {t.id === 'history' && <span className="ml-1 text-xs bg-red-100 text-red-500 rounded-full px-1.5">{history.length}</span>}
            </button>
          ))}
        </div>

        <div className="p-5">
          {/* Shared controls for rules + history tabs */}
          {tab !== 'scan' && (
            <div className="flex items-center gap-3 mb-4">
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder={tab === 'rules' ? 'Search rules, families, tags…' : 'Search files, families, rules…'}
                className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="relative">
                <select value={sevFilter} onChange={e => setSevFilter(e.target.value)}
                  className="text-sm border border-gray-200 rounded-lg pl-3 pr-8 py-2 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                  <option value="">All severities</option>
                  {SEVERITIES.map(s => <option key={s}>{s}</option>)}
                </select>
                <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
          )}

          {/* ── Rules tab ─────────────────────────────────────────────────── */}
          {tab === 'rules' && (
            loading ? (
              <div className="flex items-center justify-center h-40">
                <Loader2 size={24} className="animate-spin text-gray-300" />
              </div>
            ) : filteredRules.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <Shield size={32} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">No rules match your search</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-xs font-medium text-gray-400 uppercase tracking-wide">
                      <th className="text-left py-2 pr-4">Name</th>
                      <th className="text-left py-2 pr-4">Family</th>
                      <th className="text-left py-2 pr-4">Severity</th>
                      <th className="text-left py-2 pr-4">Tags</th>
                      <th className="text-left py-2 pr-4">Type</th>
                      <th className="text-left py-2 pr-4">Enabled</th>
                      <th className="text-left py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredRules.map(rule => (
                      <tr key={rule.id} className="hover:bg-gray-50 transition-colors">
                        <td className="py-3 pr-4">
                          <span className="font-medium text-gray-800">{rule.name}</span>
                          {rule.description && (
                            <p className="text-xs text-gray-400 mt-0.5 truncate max-w-48">{rule.description}</p>
                          )}
                        </td>
                        <td className="py-3 pr-4">{familyBadge(rule.malware_family) ?? <span className="text-gray-300">—</span>}</td>
                        <td className="py-3 pr-4">{sevBadge(rule.severity)}</td>
                        <td className="py-3 pr-4">
                          {rule.tags ? (
                            <span className="text-xs text-gray-500 truncate max-w-32 block">{rule.tags}</span>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="py-3 pr-4">
                          {rule.is_system
                            ? <span className="text-xs bg-blue-50 text-blue-600 border border-blue-100 px-2 py-0.5 rounded-full">System</span>
                            : <span className="text-xs bg-purple-50 text-purple-600 border border-purple-100 px-2 py-0.5 rounded-full">Custom</span>}
                        </td>
                        <td className="py-3 pr-4">
                          <button onClick={() => handleToggle(rule)} disabled={toggling === rule.id}
                            className="text-gray-400 hover:text-blue-600 transition-colors">
                            {toggling === rule.id
                              ? <Loader2 size={18} className="animate-spin" />
                              : rule.enabled
                              ? <ToggleRight size={20} className="text-green-500" />
                              : <ToggleLeft size={20} />}
                          </button>
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-1">
                            {!rule.is_system && (
                              <>
                                <button onClick={() => { setEditRule(rule); setShowModal(true) }}
                                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                  title="Edit">
                                  <Code2 size={14} />
                                </button>
                                <button onClick={() => setToDelete(rule)}
                                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Delete">
                                  <Trash2 size={14} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}

          {/* ── Scan History tab ──────────────────────────────────────────── */}
          {tab === 'history' && (
            loading ? (
              <div className="flex items-center justify-center h-40">
                <Loader2 size={24} className="animate-spin text-gray-300" />
              </div>
            ) : filteredHistory.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <FileSearch size={32} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">No scan detections yet</p>
                <p className="text-xs mt-1">Matches appear here when file telemetry triggers a YARA rule or you run a manual scan</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-xs font-medium text-gray-400 uppercase tracking-wide">
                      <th className="text-left py-2 pr-4">Time</th>
                      <th className="text-left py-2 pr-4">File</th>
                      <th className="text-left py-2 pr-4">SHA-256</th>
                      <th className="text-left py-2 pr-4">Matched Rule</th>
                      <th className="text-left py-2 pr-4">Family</th>
                      <th className="text-left py-2 pr-4">Severity</th>
                      <th className="text-left py-2">Context</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredHistory.map(h => (
                      <tr key={h.id} className="hover:bg-gray-50 transition-colors">
                        <td className="py-3 pr-4 text-xs text-gray-500 whitespace-nowrap">{fmtDate(h.created_at)}</td>
                        <td className="py-3 pr-4">
                          <span className="text-xs font-mono text-gray-700 max-w-40 truncate block" title={h.file_path ?? ''}>
                            {h.file_path ?? '—'}
                          </span>
                        </td>
                        <td className="py-3 pr-4">
                          <span className="text-xs font-mono text-gray-400" title={h.sha256 ?? ''}>
                            {h.sha256 ? h.sha256.slice(0, 12) + '…' : '—'}
                          </span>
                        </td>
                        <td className="py-3 pr-4">
                          <span className="text-xs font-mono text-gray-600">{h.matched_rule_name}</span>
                        </td>
                        <td className="py-3 pr-4">{familyBadge(h.malware_family) ?? <span className="text-gray-300">—</span>}</td>
                        <td className="py-3 pr-4">{sevBadge(h.severity)}</td>
                        <td className="py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            h.scan_context === 'manual'   ? 'bg-purple-50 text-purple-600' :
                            h.scan_context === 'download' ? 'bg-orange-50 text-orange-600' :
                            'bg-gray-100 text-gray-500'
                          }`}>
                            {h.scan_context ?? 'auto'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}

          {/* ── Manual Scan tab ───────────────────────────────────────────── */}
          {tab === 'scan' && <ManualScanPanel />}
        </div>
      </div>

      {/* Create/Edit modal */}
      {showModal && (
        <RuleModal
          rule={editRule}
          onClose={() => { setShowModal(false); setEditRule(null) }}
          onSaved={saved => {
            setRules(prev => {
              const idx = prev.findIndex(r => r.id === saved.id)
              return idx >= 0 ? prev.map(r => r.id === saved.id ? saved : r) : [saved, ...prev]
            })
            setShowModal(false); setEditRule(null)
          }}
        />
      )}

      {/* Delete confirmation */}
      {toDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Delete YARA Rule</h3>
            <p className="text-sm text-gray-500 mb-5">
              Delete <span className="font-medium text-gray-800">"{toDelete.name}"</span>? This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setToDelete(null)} className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2">Cancel</button>
              <button onClick={handleDelete} disabled={deleting}
                className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-60 transition-colors">
                {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
