import { useEffect, useState, useMemo, useCallback } from 'react'
import {
  ShieldAlert, Plus, Search, RefreshCw, Edit2, Trash2,
  AlertTriangle, CheckCircle2, Lock, X, ChevronDown,
} from 'lucide-react'
import Topbar from '@/components/layout/Topbar/Topbar'
import {
  fetchRules, createRule, updateRule, toggleRule, deleteRule,
} from '@/api/detectionRulesApi'
import type { DetectionRule, RulePayload } from '@/api/detectionRulesApi'

// ── Field options per rule type ───────────────────────────────────────────────

const FIELDS_BY_TYPE: Record<string, { value: string; label: string }[]> = {
  process: [
    { value: 'process_name',        label: 'Process Name'        },
    { value: 'cmdline',             label: 'Command Line'        },
    { value: 'exe_path',            label: 'Executable Path'     },
    { value: 'username',            label: 'Username'            },
    { value: 'parent_process_name', label: 'Parent Process Name' },
    { value: 'sha256',              label: 'SHA256 Hash'         },
  ],
  network: [
    { value: 'remote_ip',   label: 'Remote IP'   },
    { value: 'remote_port', label: 'Remote Port' },
    { value: 'local_ip',    label: 'Local IP'    },
    { value: 'protocol',    label: 'Protocol'    },
  ],
  file: [
    { value: 'file_path',  label: 'File Path'   },
    { value: 'event_type', label: 'Event Type'  },
    { value: 'sha256',     label: 'SHA256 Hash' },
    { value: 'md5',        label: 'MD5 Hash'    },
  ],
  persistence: [
    { value: 'entry_name',       label: 'Entry Name'       },
    { value: 'entry_path',       label: 'Entry Path'       },
    { value: 'persistence_type', label: 'Persistence Type' },
  ],
}

const OPERATORS = [
  { value: 'contains',     label: 'Contains'     },
  { value: 'not_contains', label: 'Does not contain' },
  { value: 'equals',       label: 'Equals'       },
  { value: 'not_equals',   label: 'Does not equal'  },
  { value: 'starts_with',  label: 'Starts with'  },
  { value: 'ends_with',    label: 'Ends with'    },
  { value: 'regex',        label: 'Regex match'  },
  { value: 'in_list',      label: 'In list (comma-separated)' },
  { value: 'greater_than', label: 'Greater than' },
  { value: 'less_than',    label: 'Less than'    },
]

const SEVERITIES = ['Low', 'Medium', 'High', 'Critical']

const RULE_TYPES = [
  { value: 'process',     label: 'Process'     },
  { value: 'network',     label: 'Network'     },
  { value: 'file',        label: 'File'        },
  { value: 'persistence', label: 'Persistence' },
]

// ── Style helpers ─────────────────────────────────────────────────────────────

const SEV_STYLE: Record<string, string> = {
  Low:      'bg-gray-100 text-gray-600',
  Medium:   'bg-blue-50 text-blue-700',
  High:     'bg-amber-50 text-amber-700',
  Critical: 'bg-red-100 text-red-700 font-semibold',
}

const TYPE_STYLE: Record<string, string> = {
  process:     'bg-indigo-50 text-indigo-700',
  network:     'bg-cyan-50 text-cyan-700',
  file:        'bg-emerald-50 text-emerald-700',
  persistence: 'bg-purple-50 text-purple-700',
}

// ── Rule Form Modal ───────────────────────────────────────────────────────────

const EMPTY: RulePayload = {
  name: '', description: '', rule_type: 'process', field: 'process_name',
  operator: 'contains', value: '', severity: 'Medium', mitre_tactic: '', mitre_technique: '',
  enabled: true,
}

function RuleModal({
  initial,
  isSystem,
  onClose,
  onSave,
}: {
  initial: RulePayload & { id?: number }
  isSystem?: boolean
  onClose: () => void
  onSave: (payload: RulePayload, id?: number) => Promise<void>
}) {
  const [form, setForm] = useState<RulePayload>({ ...initial })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  const isEdit = !!initial.id

  function set<K extends keyof RulePayload>(k: K, v: RulePayload[K]) {
    setForm((f) => {
      const next = { ...f, [k]: v }
      // Reset field when rule_type changes
      if (k === 'rule_type') {
        const fields = FIELDS_BY_TYPE[v as string] ?? []
        next.field = fields[0]?.value ?? ''
      }
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.value.trim()) return
    setSaving(true); setError(null)
    try {
      await onSave(form, initial.id)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save rule')
    } finally {
      setSaving(false)
    }
  }

  const fieldOptions = FIELDS_BY_TYPE[form.rule_type] ?? []

  const inputCls = "w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
  const labelCls = "block text-xs font-medium text-gray-700 mb-1"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2">
            <ShieldAlert size={16} className="text-blue-600" />
            <h2 className="text-sm font-semibold text-gray-900">
              {isEdit ? 'Edit Detection Rule' : 'New Detection Rule'}
            </h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
          {isSystem && (
            <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded-lg border border-amber-200">
              <Lock size={12} className="shrink-0" />
              This is a built-in system rule. Only the enabled state can be changed.
            </div>
          )}

          {/* Name */}
          <div>
            <label className={labelCls}>Rule Name *</label>
            <input
              value={form.name} onChange={(e) => set('name', e.target.value)}
              placeholder="e.g. Suspicious PowerShell Encoded Command"
              disabled={isSystem} required className={inputCls}
            />
          </div>

          {/* Description */}
          <div>
            <label className={labelCls}>Description</label>
            <textarea
              value={form.description ?? ''} onChange={(e) => set('description', e.target.value)}
              placeholder="What does this rule detect and why is it significant?"
              rows={2} disabled={isSystem}
              className={`${inputCls} resize-none`}
            />
          </div>

          {/* Rule Type + Field in a row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Telemetry Type *</label>
              <div className="relative">
                <select
                  value={form.rule_type} onChange={(e) => set('rule_type', e.target.value as RulePayload['rule_type'])}
                  disabled={isSystem} className={`${inputCls} pr-8 appearance-none`}
                >
                  {RULE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className={labelCls}>Field *</label>
              <div className="relative">
                <select
                  value={form.field} onChange={(e) => set('field', e.target.value)}
                  disabled={isSystem} className={`${inputCls} pr-8 appearance-none`}
                >
                  {fieldOptions.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
                <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Operator + Value in a row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Operator *</label>
              <div className="relative">
                <select
                  value={form.operator} onChange={(e) => set('operator', e.target.value)}
                  disabled={isSystem} className={`${inputCls} pr-8 appearance-none`}
                >
                  {OPERATORS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className={labelCls}>Value *</label>
              <input
                value={form.value} onChange={(e) => set('value', e.target.value)}
                placeholder={form.operator === 'in_list' ? 'val1,val2,val3' : 'Match value'}
                disabled={isSystem} required className={inputCls}
              />
            </div>
          </div>

          {/* Severity */}
          <div>
            <label className={labelCls}>Severity *</label>
            <div className="flex gap-2">
              {SEVERITIES.map((s) => (
                <button
                  key={s} type="button" disabled={isSystem}
                  onClick={() => set('severity', s as RulePayload['severity'])}
                  className={`flex-1 text-xs font-semibold py-2 rounded-lg border transition-all ${
                    form.severity === s
                      ? SEV_STYLE[s] + ' border-transparent ring-2 ring-offset-1 ring-current'
                      : 'border-gray-200 text-gray-400 hover:border-gray-300'
                  } ${isSystem ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* MITRE */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>MITRE Tactic</label>
              <input
                value={form.mitre_tactic ?? ''} onChange={(e) => set('mitre_tactic', e.target.value)}
                placeholder="e.g. Execution" disabled={isSystem} className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>MITRE Technique</label>
              <input
                value={form.mitre_technique ?? ''} onChange={(e) => set('mitre_technique', e.target.value)}
                placeholder="e.g. T1059.001" disabled={isSystem} className={inputCls}
              />
            </div>
          </div>

          {/* Enabled */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => set('enabled', !form.enabled)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${form.enabled ? 'bg-blue-600' : 'bg-gray-300'}`}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${form.enabled ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
            </button>
            <span className="text-sm text-gray-700">{form.enabled ? 'Rule enabled' : 'Rule disabled (will not fire alerts)'}</span>
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-200">{error}</p>
          )}
        </form>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-2 shrink-0">
          <button onClick={onClose} className="text-sm px-4 py-2 text-gray-500 hover:text-gray-700 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSubmit as any}
            disabled={saving || (!form.name.trim() || !form.value.trim())}
            className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
          >
            {saving && <RefreshCw size={12} className="animate-spin" />}
            {isEdit ? 'Save Changes' : 'Create Rule'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Delete confirmation ───────────────────────────────────────────────────────

function DeleteConfirm({ rule, onClose, onDelete }: { rule: DetectionRule; onClose: () => void; onDelete: () => Promise<void> }) {
  const [loading, setLoading] = useState(false)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
            <Trash2 size={18} className="text-red-500" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Delete rule?</p>
            <p className="text-xs text-gray-500 mt-0.5">"{rule.name}" will be permanently removed.</p>
          </div>
        </div>
        <div className="flex gap-2 justify-end pt-2">
          <button onClick={onClose} className="text-sm px-4 py-2 text-gray-500 hover:text-gray-700">Cancel</button>
          <button
            onClick={async () => { setLoading(true); await onDelete(); setLoading(false) }}
            disabled={loading}
            className="text-sm font-medium px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-60 transition-colors"
          >
            {loading ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function DetectionRules() {
  const [rules, setRules]             = useState<DetectionRule[]>([])
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState('')
  const [typeFilter, setTypeFilter]   = useState('All')
  const [sevFilter, setSevFilter]     = useState('All')
  const [enabledFilter, setEnabledFilter] = useState<'All' | 'Enabled' | 'Disabled'>('All')
  const [showModal, setShowModal]     = useState(false)
  const [editing, setEditing]         = useState<DetectionRule | null>(null)
  const [deleting, setDeleting]       = useState<DetectionRule | null>(null)
  const [error, setError]             = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    fetchRules()
      .then(setRules)
      .catch(() => setError('Failed to load detection rules'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => rules.filter((r) => {
    const matchSearch  = !search || r.name.toLowerCase().includes(search.toLowerCase()) ||
      (r.description ?? '').toLowerCase().includes(search.toLowerCase()) ||
      r.value.toLowerCase().includes(search.toLowerCase())
    const matchType    = typeFilter === 'All' || r.rule_type === typeFilter
    const matchSev     = sevFilter === 'All' || r.severity === sevFilter
    const matchEnabled = enabledFilter === 'All' || (enabledFilter === 'Enabled' ? r.enabled : !r.enabled)
    return matchSearch && matchType && matchSev && matchEnabled
  }), [rules, search, typeFilter, sevFilter, enabledFilter])

  // Stats
  const total   = rules.length
  const enabled = rules.filter((r) => r.enabled).length
  const system  = rules.filter((r) => r.is_system).length
  const custom  = rules.filter((r) => !r.is_system).length

  async function handleSave(payload: RulePayload, id?: number) {
    if (id) {
      const updated = await updateRule(id, payload)
      setRules((prev) => prev.map((r) => r.id === id ? updated : r))
    } else {
      const created = await createRule(payload)
      setRules((prev) => [created, ...prev])
    }
  }

  async function handleToggle(rule: DetectionRule) {
    const result = await toggleRule(rule.id)
    setRules((prev) => prev.map((r) => r.id === rule.id ? { ...r, enabled: result.enabled } : r))
  }

  async function handleDelete(rule: DetectionRule) {
    await deleteRule(rule.id)
    setRules((prev) => prev.filter((r) => r.id !== rule.id))
    setDeleting(null)
  }

  return (
    <div className="space-y-6">
      <Topbar
        title="Detection Rules"
        subtitle="Database-driven threat detection — add rules without changing code"
        onRefresh={load}
      />

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Rules',   value: total,   color: 'bg-slate-600' },
          { label: 'Active',        value: enabled, color: 'bg-green-600' },
          { label: 'Built-in',      value: system,  color: 'bg-indigo-500' },
          { label: 'Custom',        value: custom,  color: 'bg-blue-500' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
            <div className={`h-10 w-10 rounded-xl ${color} flex items-center justify-center shrink-0`}>
              <ShieldAlert size={18} className="text-white" />
            </div>
            <div>
              <p className="text-xs text-gray-400">{label}</p>
              <p className="text-2xl font-bold text-gray-900">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text" placeholder="Search rules, values…" value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>

        {/* Type filter */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {['All', 'process', 'network', 'file', 'persistence'].map((t) => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors capitalize ${typeFilter === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {t}
            </button>
          ))}
        </div>

        {/* Severity filter */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {['All', ...SEVERITIES].map((s) => (
            <button key={s} onClick={() => setSevFilter(s)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${sevFilter === s ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {s}
            </button>
          ))}
        </div>

        {/* Enabled filter */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {(['All', 'Enabled', 'Disabled'] as const).map((e) => (
            <button key={e} onClick={() => setEnabledFilter(e)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${enabledFilter === e ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {e}
            </button>
          ))}
        </div>

        <button
          onClick={() => { setEditing(null); setShowModal(true) }}
          className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors whitespace-nowrap"
        >
          <Plus size={15} /> New Rule
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl border border-red-200">
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      {/* Rules table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
          <p className="text-xs text-gray-400">
            {filtered.length} rule{filtered.length !== 1 ? 's' : ''} shown
            {typeFilter !== 'All' || sevFilter !== 'All' || enabledFilter !== 'All' || search ? ' (filtered)' : ''}
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-gray-400">
            <RefreshCw size={16} className="animate-spin" />
            <span className="text-sm">Loading rules…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <ShieldAlert size={32} className="mx-auto mb-3 text-gray-300" />
            <p className="text-sm text-gray-400">No rules match your filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="border-b border-gray-50 text-left">
                  {['Rule Name', 'Type', 'Condition', 'Severity', 'MITRE', 'Status', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((rule) => (
                  <tr key={rule.id} className={`hover:bg-gray-50/50 transition-colors ${!rule.enabled ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        {rule.is_system && (
                          <Lock size={11} className="text-gray-400 shrink-0" title="Built-in system rule" />
                        )}
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{rule.name}</p>
                          {rule.description && (
                            <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-1 max-w-xs">{rule.description}</p>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full capitalize ${TYPE_STYLE[rule.rule_type] ?? 'bg-gray-100 text-gray-600'}`}>
                        {rule.rule_type}
                      </span>
                    </td>

                    <td className="px-4 py-3.5">
                      <code className="text-xs bg-gray-100 rounded px-2 py-0.5 text-gray-700">
                        {rule.field}
                      </code>
                      <span className="text-xs text-gray-400 mx-1.5">{rule.operator.replace('_', ' ')}</span>
                      <code className="text-xs bg-gray-100 rounded px-2 py-0.5 text-gray-700 max-w-[120px] truncate inline-block align-middle">
                        {rule.value}
                      </code>
                    </td>

                    <td className="px-4 py-3.5">
                      <span className={`text-xs px-2.5 py-0.5 rounded-full ${SEV_STYLE[rule.severity] ?? 'bg-gray-100 text-gray-600'}`}>
                        {rule.severity}
                      </span>
                    </td>

                    <td className="px-4 py-3.5">
                      {rule.mitre_technique ? (
                        <div>
                          <p className="text-xs font-mono font-semibold text-indigo-700">{rule.mitre_technique}</p>
                          {rule.mitre_tactic && (
                            <p className="text-[11px] text-gray-400">{rule.mitre_tactic}</p>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>

                    <td className="px-4 py-3.5">
                      <button
                        onClick={() => handleToggle(rule)}
                        className="flex items-center gap-1.5 group"
                        title={rule.enabled ? 'Click to disable' : 'Click to enable'}
                      >
                        <span className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${rule.enabled ? 'bg-green-500' : 'bg-gray-300'}`}>
                          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${rule.enabled ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                        </span>
                        <span className={`text-xs font-medium ${rule.enabled ? 'text-green-700' : 'text-gray-400'}`}>
                          {rule.enabled ? 'Active' : 'Off'}
                        </span>
                      </button>
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => { setEditing(rule); setShowModal(true) }}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          title={rule.is_system ? 'View / toggle' : 'Edit rule'}
                        >
                          <Edit2 size={13} />
                        </button>
                        {!rule.is_system && (
                          <button
                            onClick={() => setDeleting(rule)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Delete rule"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                        {rule.is_system && (
                          <span className="p-1.5 text-gray-200" title="System rules cannot be deleted">
                            <Lock size={13} />
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="px-5 py-2.5 border-t border-gray-50 text-xs text-gray-400 flex gap-4">
          <span>{filtered.length} of {rules.length} rules</span>
          <span>· {enabled} active · {rules.length - enabled} disabled</span>
        </div>
      </div>

      {/* Modals */}
      {showModal && (
        <RuleModal
          initial={editing ? { ...editing } : EMPTY}
          isSystem={editing?.is_system}
          onClose={() => { setShowModal(false); setEditing(null) }}
          onSave={handleSave}
        />
      )}
      {deleting && (
        <DeleteConfirm
          rule={deleting}
          onClose={() => setDeleting(null)}
          onDelete={() => handleDelete(deleting)}
        />
      )}
    </div>
  )
}
