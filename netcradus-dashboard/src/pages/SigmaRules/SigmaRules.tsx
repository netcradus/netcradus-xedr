import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import {
  FileCode2, Upload, RefreshCw, CheckCircle2, XCircle, AlertTriangle,
  Trash2, Search, ChevronDown, X, Plus, FileText, ArrowRight,
  Zap, Info,
} from 'lucide-react'
import Topbar from '@/components/layout/Topbar/Topbar'
import {
  fetchSigmaRules, uploadSigmaRule, convertSigmaRule, deleteSigmaRule,
} from '@/api/sigmaRulesApi'
import type { SigmaRule } from '@/api/sigmaRulesApi'

// ── Example Sigma YAML for the editor placeholder ─────────────────────────────

const EXAMPLE_YAML = `title: Suspicious PowerShell Encoded Command
id: 7d15c842-a918-4e4f-9b3d-7a2e8b0c5d4a
status: experimental
description: Detects PowerShell execution with encoded command argument
author: NET XDR
date: 2024/01/15
logsource:
    category: process_creation
    product: windows
detection:
    selection:
        CommandLine|contains:
            - '-EncodedCommand'
            - '-enc '
            - '-ec '
    filter:
        Image|endswith: '\\\\powershell_ise.exe'
    condition: selection and not filter
level: high
tags:
    - attack.execution
    - attack.t1059.001
falsepositives:
    - Legitimate administrative scripts`

// ── Status helpers ────────────────────────────────────────────────────────────

type ConversionStatus = 'converted' | 'failed' | 'pending'

function getStatus(rule: SigmaRule): ConversionStatus {
  if (rule.conversion_error) return 'failed'
  if (rule.detection_rule_id) return 'converted'
  return 'pending'
}

const STATUS_CONFIG: Record<ConversionStatus, { label: string; cls: string; Icon: React.ElementType }> = {
  converted: { label: 'Active',  cls: 'bg-green-50 text-green-700',  Icon: CheckCircle2 },
  failed:    { label: 'Failed',  cls: 'bg-red-50 text-red-700',      Icon: XCircle },
  pending:   { label: 'Pending', cls: 'bg-amber-50 text-amber-700',  Icon: AlertTriangle },
}

const SIGMA_STATUS_STYLE: Record<string, string> = {
  stable:       'bg-green-100 text-green-700',
  experimental: 'bg-amber-100 text-amber-700',
  test:         'bg-blue-100 text-blue-700',
  deprecated:   'bg-gray-100 text-gray-500',
}

// ── Import Modal (single YAML) ────────────────────────────────────────────────

function ImportModal({
  onClose,
  onImported,
}: {
  onClose: () => void
  onImported: (rule: SigmaRule) => void
}) {
  const [yaml, setYaml]       = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [imported, setImported] = useState<SigmaRule | null>(null)

  async function handleImport() {
    if (!yaml.trim()) return
    setLoading(true); setError(null)
    try {
      const rule = await uploadSigmaRule({ yaml_content: yaml.trim(), enabled: true })
      setImported(rule)
      onImported(rule)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2">
            <FileCode2 size={16} className="text-blue-600" />
            <h2 className="text-sm font-semibold text-gray-900">Import Sigma Rule</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={16} />
          </button>
        </div>

        {imported ? (
          // ── Success state
          <div className="p-8 flex flex-col items-center gap-4 text-center">
            <div className="h-14 w-14 rounded-2xl bg-green-50 flex items-center justify-center">
              <CheckCircle2 size={28} className="text-green-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Rule imported successfully</p>
              <p className="text-xs text-gray-500 mt-1">"{imported.title}"</p>
            </div>
            {imported.detection_rule_id ? (
              <div className="flex items-center gap-2 text-xs bg-green-50 text-green-700 px-4 py-2 rounded-xl border border-green-200">
                <CheckCircle2 size={12} />
                Auto-converted to detection rule #{imported.detection_rule_id}
              </div>
            ) : imported.conversion_error ? (
              <div className="flex items-start gap-2 text-xs bg-amber-50 text-amber-700 px-4 py-2 rounded-xl border border-amber-200 text-left max-w-md">
                <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                <span>Stored but not converted: {imported.conversion_error}</span>
              </div>
            ) : null}
            <button
              onClick={onClose}
              className="mt-2 px-6 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="px-5 py-4 flex-1 overflow-y-auto space-y-3">
              <div className="flex items-start gap-2 text-xs text-blue-700 bg-blue-50 px-3 py-2 rounded-lg border border-blue-200">
                <Info size={12} className="shrink-0 mt-0.5" />
                Paste a Sigma rule YAML. It will be stored and auto-converted to a detection rule.
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Sigma YAML *
                  <button
                    type="button"
                    onClick={() => setYaml(EXAMPLE_YAML)}
                    className="ml-2 text-blue-500 hover:text-blue-700 font-normal"
                  >
                    Load example
                  </button>
                </label>
                <textarea
                  value={yaml}
                  onChange={e => setYaml(e.target.value)}
                  placeholder={EXAMPLE_YAML}
                  rows={18}
                  className="w-full text-xs font-mono border border-gray-200 rounded-xl px-3 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-gray-50 text-gray-800"
                  spellCheck={false}
                />
              </div>

              {error && (
                <div className="flex items-start gap-2 text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-200">
                  <XCircle size={12} className="shrink-0 mt-0.5" />
                  {error}
                </div>
              )}
            </div>

            <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-2 shrink-0">
              <button onClick={onClose} className="text-sm px-4 py-2 text-gray-500 hover:text-gray-700">
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={loading || !yaml.trim()}
                className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
              >
                {loading ? <RefreshCw size={12} className="animate-spin" /> : <Upload size={12} />}
                {loading ? 'Importing…' : 'Import Rule'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Bulk Import Modal (multiple YAMLs separated by ---) ───────────────────────

function BulkImportModal({
  onClose,
  onDone,
}: {
  onClose: () => void
  onDone: (imported: SigmaRule[]) => void
}) {
  const [yaml, setYaml]         = useState('')
  const [running, setRunning]   = useState(false)
  const [results, setResults]   = useState<{ title: string; ok: boolean; error?: string }[]>([])
  const [done, setDone]         = useState(false)
  const fileRef                 = useRef<HTMLInputElement>(null)

  function splitYamls(raw: string): string[] {
    return raw.split(/^---$/m).map(s => s.trim()).filter(Boolean)
  }

  async function handleRun() {
    const chunks = splitYamls(yaml)
    if (chunks.length === 0) return
    setRunning(true); setResults([])

    const out: typeof results = []
    for (const chunk of chunks) {
      try {
        const rule = await uploadSigmaRule({ yaml_content: chunk, enabled: true })
        out.push({ title: rule.title, ok: true })
        onDone([rule])  // stream results as they come
      } catch (err) {
        // Extract title from YAML for error label
        const m = chunk.match(/^title:\s*(.+)$/m)
        const title = m ? m[1].trim() : 'Unknown'
        out.push({ title, ok: false, error: err instanceof Error ? err.message : 'Import failed' })
      }
      setResults([...out])
    }
    setRunning(false); setDone(true)
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setYaml(ev.target?.result as string ?? '')
    reader.readAsText(file)
    e.target.value = ''
  }

  const ok  = results.filter(r => r.ok).length
  const fail = results.filter(r => !r.ok).length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2">
            <Zap size={16} className="text-amber-500" />
            <h2 className="text-sm font-semibold text-gray-900">Bulk Import Sigma Rules</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 flex-1 overflow-y-auto space-y-3">
          <div className="flex items-start gap-2 text-xs text-blue-700 bg-blue-50 px-3 py-2 rounded-lg border border-blue-200">
            <Info size={12} className="shrink-0 mt-0.5" />
            Paste multiple Sigma YAMLs separated by <code className="bg-blue-100 px-1 rounded">---</code>, or upload a file containing one or more rules.
          </div>

          {/* File upload */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5 hover:border-blue-300 hover:text-blue-600 transition-colors"
            >
              <FileText size={12} /> Load from file
            </button>
            <span className="text-xs text-gray-400">
              {yaml ? `${splitYamls(yaml).length} rule(s) detected` : 'or paste below'}
            </span>
            <input ref={fileRef} type="file" accept=".yml,.yaml,.txt" className="hidden" onChange={handleFile} />
          </div>

          <textarea
            value={yaml}
            onChange={e => setYaml(e.target.value)}
            placeholder={"title: Rule One\ndetection:\n  ...\n---\ntitle: Rule Two\ndetection:\n  ..."}
            rows={12}
            disabled={running}
            className="w-full text-xs font-mono border border-gray-200 rounded-xl px-3 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-gray-50 text-gray-800 disabled:opacity-60"
            spellCheck={false}
          />

          {/* Progress results */}
          {results.length > 0 && (
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                <span className="text-xs font-medium text-gray-700">Import results</span>
                <div className="flex gap-3 text-xs">
                  <span className="text-green-600 font-medium">{ok} converted</span>
                  {fail > 0 && <span className="text-red-500 font-medium">{fail} failed</span>}
                  {running && <span className="text-gray-400">processing…</span>}
                </div>
              </div>
              <div className="max-h-40 overflow-y-auto divide-y divide-gray-50">
                {results.map((r, i) => (
                  <div key={i} className="flex items-start gap-2 px-3 py-2">
                    {r.ok
                      ? <CheckCircle2 size={12} className="text-green-500 shrink-0 mt-0.5" />
                      : <XCircle size={12} className="text-red-400 shrink-0 mt-0.5" />
                    }
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-800 truncate">{r.title}</p>
                      {r.error && <p className="text-[11px] text-red-500 mt-0.5">{r.error}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between shrink-0">
          <span className="text-xs text-gray-400">
            {yaml ? `${splitYamls(yaml).length} rules` : 'No rules loaded'}
          </span>
          <div className="flex gap-2">
            <button onClick={onClose} className="text-sm px-4 py-2 text-gray-500 hover:text-gray-700">
              {done ? 'Close' : 'Cancel'}
            </button>
            {!done && (
              <button
                onClick={handleRun}
                disabled={running || !yaml.trim()}
                className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-60 transition-colors"
              >
                {running ? <RefreshCw size={12} className="animate-spin" /> : <Zap size={12} />}
                {running ? `Importing ${results.length}/${splitYamls(yaml).length}…` : 'Import All'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Error detail popover ──────────────────────────────────────────────────────

function ErrorDetail({ error }: { error: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="text-xs text-red-500 underline underline-offset-2 hover:text-red-700"
      >
        View error
      </button>
      {open && (
        <div className="absolute z-20 bottom-full mb-1 left-0 w-80 bg-gray-900 text-gray-100 text-xs rounded-xl p-3 shadow-2xl font-mono whitespace-pre-wrap leading-relaxed">
          {error}
          <button
            onClick={() => setOpen(false)}
            className="absolute top-2 right-2 text-gray-400 hover:text-white"
          >
            <X size={12} />
          </button>
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SigmaRules() {
  const [rules, setRules]           = useState<SigmaRule[]>([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [statusFilter, setStatusFilter] = useState<'All' | 'converted' | 'failed' | 'pending'>('All')
  const [showImport, setShowImport] = useState(false)
  const [showBulk, setShowBulk]     = useState(false)
  const [converting, setConverting] = useState<number | null>(null)
  const [pageError, setPageError]   = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    fetchSigmaRules()
      .then(setRules)
      .catch(() => setPageError('Failed to load Sigma rules'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => rules.filter(r => {
    const matchSearch = !search ||
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      (r.author ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (r.description ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (r.sigma_id ?? '').toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'All' || getStatus(r) === statusFilter
    return matchSearch && matchStatus
  }), [rules, search, statusFilter])

  // KPI counts
  const total     = rules.length
  const converted = rules.filter(r => getStatus(r) === 'converted').length
  const failed    = rules.filter(r => getStatus(r) === 'failed').length
  const pending   = rules.filter(r => getStatus(r) === 'pending').length

  function addRule(rule: SigmaRule) {
    setRules(prev => {
      const exists = prev.some(r => r.id === rule.id)
      return exists ? prev.map(r => r.id === rule.id ? rule : r) : [rule, ...prev]
    })
  }

  async function handleConvert(rule: SigmaRule) {
    setConverting(rule.id)
    try {
      await convertSigmaRule(rule.id)
      // Reload to pick up the updated detection_rule_id
      const fresh = await fetchSigmaRules()
      setRules(fresh)
    } catch {
      // silently — the error will be visible via conversion_error
    } finally {
      setConverting(null)
    }
  }

  async function handleDelete(rule: SigmaRule) {
    await deleteSigmaRule(rule.id)
    setRules(prev => prev.filter(r => r.id !== rule.id))
  }

  return (
    <div className="space-y-6">
      <Topbar
        title="Sigma Rules"
        subtitle="Import community Sigma rules — auto-converted to the detection engine"
        onRefresh={load}
      />

      {/* Pipeline explainer */}
      <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100 rounded-2xl px-5 py-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {[
            { icon: FileCode2, label: 'Sigma YAML', color: 'text-indigo-600' },
            { label: '→' },
            { icon: RefreshCw, label: 'Parser', color: 'text-blue-600' },
            { label: '→' },
            { icon: CheckCircle2, label: 'Detection Rule', color: 'text-green-600' },
            { label: '→' },
            { icon: Zap, label: 'Rule Engine', color: 'text-amber-600' },
            { label: '→' },
            { icon: AlertTriangle, label: 'Alert', color: 'text-red-600' },
          ].map((step, i) =>
            'icon' in step && step.icon
              ? (
                <div key={i} className="flex items-center gap-1.5">
                  <div className={`h-7 w-7 rounded-lg bg-white shadow-sm border border-white/80 flex items-center justify-center ${step.color}`}>
                    <step.icon size={14} />
                  </div>
                  <span className={`font-medium text-xs ${step.color}`}>{step.label}</span>
                </div>
              )
              : <ArrowRight key={i} size={14} className="text-gray-400" />
          )}
        </div>
        <p className="mt-2 text-xs text-indigo-700/70">
          Import any Sigma rule — field mappings, modifiers, MITRE tags, and condition logic are automatically translated.
          Supports <code className="bg-white/60 px-1 rounded">contains</code>, <code className="bg-white/60 px-1 rounded">startswith</code>, <code className="bg-white/60 px-1 rounded">endswith</code>, <code className="bg-white/60 px-1 rounded">re</code>, and wildcard condition expressions.
        </p>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Imported', value: total,     color: 'bg-slate-600',  Icon: FileCode2 },
          { label: 'Converted',      value: converted, color: 'bg-green-600',  Icon: CheckCircle2 },
          { label: 'Failed',         value: failed,    color: 'bg-red-500',    Icon: XCircle },
          { label: 'Pending',        value: pending,   color: 'bg-amber-500',  Icon: AlertTriangle },
        ].map(({ label, value, color, Icon }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
            <div className={`h-10 w-10 rounded-xl ${color} flex items-center justify-center shrink-0`}>
              <Icon size={18} className="text-white" />
            </div>
            <div>
              <p className="text-xs text-gray-400">{label}</p>
              <p className="text-2xl font-bold text-gray-900">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text" placeholder="Search title, author, Sigma ID…" value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>

        {/* Status filter */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {(['All', 'converted', 'failed', 'pending'] as const).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors capitalize ${statusFilter === s ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {s}
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowBulk(true)}
          className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2.5 border border-amber-300 text-amber-700 bg-amber-50 rounded-xl hover:bg-amber-100 transition-colors whitespace-nowrap"
        >
          <Zap size={14} /> Bulk Import
        </button>

        <button
          onClick={() => setShowImport(true)}
          className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors whitespace-nowrap"
        >
          <Plus size={15} /> Import Rule
        </button>
      </div>

      {pageError && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl border border-red-200">
          <AlertTriangle size={14} /> {pageError}
        </div>
      )}

      {/* Rules table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50">
          <p className="text-xs text-gray-400">
            {filtered.length} rule{filtered.length !== 1 ? 's' : ''}
            {statusFilter !== 'All' || search ? ' (filtered)' : ''}
            {total > 0 && ` · ${converted} converted (${Math.round(converted / total * 100)}%)`}
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-gray-400">
            <RefreshCw size={16} className="animate-spin" />
            <span className="text-sm">Loading Sigma rules…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 px-4">
            <FileCode2 size={32} className="mx-auto mb-3 text-gray-300" />
            {total === 0 ? (
              <>
                <p className="text-sm font-medium text-gray-600 mb-1">No Sigma rules imported yet</p>
                <p className="text-xs text-gray-400 mb-4">
                  Import individual rules or use Bulk Import to load hundreds at once from the Sigma community repository.
                </p>
                <button
                  onClick={() => setShowImport(true)}
                  className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Upload size={13} /> Import your first rule
                </button>
              </>
            ) : (
              <p className="text-sm text-gray-400">No rules match your filters.</p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="border-b border-gray-50 text-left">
                  {['Rule Title', 'Author', 'Sigma Status', 'Conversion', 'Detection Rule', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(rule => {
                  const status = getStatus(rule)
                  const { label, cls, Icon } = STATUS_CONFIG[status]
                  return (
                    <tr key={rule.id} className="hover:bg-gray-50/50 transition-colors">

                      {/* Title */}
                      <td className="px-4 py-3.5 max-w-[280px]">
                        <div>
                          <p className="text-sm font-semibold text-gray-900 line-clamp-1">{rule.title}</p>
                          {rule.description && (
                            <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-1">{rule.description}</p>
                          )}
                          {rule.sigma_id && (
                            <p className="text-[10px] font-mono text-gray-300 mt-0.5 truncate">{rule.sigma_id}</p>
                          )}
                        </div>
                      </td>

                      {/* Author */}
                      <td className="px-4 py-3.5">
                        <span className="text-xs text-gray-600">{rule.author ?? '—'}</span>
                      </td>

                      {/* Sigma status (stable/experimental/test) */}
                      <td className="px-4 py-3.5">
                        {rule.status ? (
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize ${SIGMA_STATUS_STYLE[rule.status] ?? 'bg-gray-100 text-gray-600'}`}>
                            {rule.status}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>

                      {/* Conversion status */}
                      <td className="px-4 py-3.5">
                        <div className="flex flex-col gap-1">
                          <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full w-fit ${cls}`}>
                            <Icon size={10} />
                            {label}
                          </span>
                          {rule.conversion_error && (
                            <ErrorDetail error={rule.conversion_error} />
                          )}
                        </div>
                      </td>

                      {/* Detection rule ID */}
                      <td className="px-4 py-3.5">
                        {rule.detection_rule_id ? (
                          <span className="text-xs font-mono font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                            Rule #{rule.detection_rule_id}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">Not converted</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1">
                          {/* Re-convert button (shown if failed or to retry) */}
                          {status !== 'converted' && (
                            <button
                              onClick={() => handleConvert(rule)}
                              disabled={converting === rule.id}
                              title="Retry conversion"
                              className="inline-flex items-center gap-1 px-2 py-1.5 text-[11px] font-medium rounded-lg text-blue-600 hover:bg-blue-50 disabled:opacity-50 transition-colors"
                            >
                              {converting === rule.id
                                ? <RefreshCw size={11} className="animate-spin" />
                                : <RefreshCw size={11} />
                              }
                              Retry
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(rule)}
                            disabled={converting === rule.id}
                            title="Delete Sigma rule"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="px-5 py-2.5 border-t border-gray-50 text-xs text-gray-400 flex gap-4">
          <span>{filtered.length} of {total} rules</span>
          <span>· {converted} active · {failed} failed · {pending} pending</span>
        </div>
      </div>

      {/* Modals */}
      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onImported={rule => { addRule(rule); setShowImport(false) }}
        />
      )}
      {showBulk && (
        <BulkImportModal
          onClose={() => setShowBulk(false)}
          onDone={rules => rules.forEach(addRule)}
        />
      )}
    </div>
  )
}
