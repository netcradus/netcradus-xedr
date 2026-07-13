import { useEffect, useState, useMemo, useCallback } from 'react'
import {
  ShieldAlert, Plus, Search, RefreshCw, Edit2, Trash2,
  AlertTriangle, Lock, X, ChevronDown,
} from 'lucide-react'
import Topbar from '@/components/layout/Topbar/Topbar'
import {
  fetchRules, createRule, updateRule, toggleRule, deleteRule,
} from '@/api/detectionRulesApi'
import type { DetectionRule, RulePayload } from '@/api/detectionRulesApi'

// ── Field options per telemetry type ─────────────────────────────────────────

const FIELDS_BY_TYPE: Record<string, { value: string; label: string }[]> = {
  process: [
    { value: 'process_name',        label: 'Process Name'   },
    { value: 'cmdline',             label: 'Command Line'   },
    { value: 'exe_path',            label: 'Executable Path' },
    { value: 'username',            label: 'Username'       },
    { value: 'parent_process_name', label: 'Parent Process' },
    { value: 'sha256',              label: 'SHA256 Hash'    },
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
  log: [
    { value: 'log_source',   label: 'Log Source'   },
    { value: 'log_message',  label: 'Log Message'  },
    { value: 'severity',     label: 'Severity'     },
    { value: 'username',     label: 'Username'     },
    { value: 'source_ip',    label: 'Source IP'    },
    { value: 'hostname',     label: 'Hostname'     },
    { value: 'process_name', label: 'Process Name' },
    { value: 'event_id',     label: 'Event ID'     },
  ],
  dns: [
    { value: 'query_name',   label: 'Query Name'  },
    { value: 'query_type',   label: 'Query Type'  },
    { value: 'response',     label: 'Response'    },
    { value: 'direction',    label: 'Direction'   },
    { value: 'process_name', label: 'Process'     },
    { value: 'username',     label: 'Username'    },
  ],
  registry: [
    { value: 'event_type',   label: 'Event Type'   },
    { value: 'registry_key', label: 'Registry Key' },
    { value: 'value_name',   label: 'Value Name'   },
    { value: 'value_data',   label: 'Value Data'   },
    { value: 'process_name', label: 'Process Name' },
    { value: 'username',     label: 'Username'     },
  ],
  usb: [
    { value: 'event_type',  label: 'Event Type'  },
    { value: 'device_id',   label: 'Device ID'   },
    { value: 'device_name', label: 'Device Name' },
    { value: 'vendor_id',   label: 'Vendor ID'   },
    { value: 'file_path',   label: 'File Path'   },
    { value: 'username',    label: 'Username'    },
  ],
  browser_extension: [
    { value: 'event_type',     label: 'Event Type'     },
    { value: 'browser',        label: 'Browser'        },
    { value: 'extension_id',   label: 'Extension ID'   },
    { value: 'extension_name', label: 'Extension Name' },
    { value: 'permissions',    label: 'Permissions'    },
    { value: 'username',       label: 'Username'       },
  ],
  cloud: [
    { value: 'provider',      label: 'Provider'      },
    { value: 'event_type',    label: 'Event Type'    },
    { value: 'resource_type', label: 'Resource Type' },
    { value: 'actor',         label: 'Actor'         },
    { value: 'source_ip',     label: 'Source IP'     },
    { value: 'action',        label: 'Action'        },
    { value: 'outcome',       label: 'Outcome'       },
  ],
  k8s: [
    { value: 'event_type',    label: 'Event Type'    },
    { value: 'cluster',       label: 'Cluster'       },
    { value: 'namespace',     label: 'Namespace'     },
    { value: 'resource_kind', label: 'Resource Kind' },
    { value: 'actor',         label: 'Actor'         },
    { value: 'image',         label: 'Image'         },
    { value: 'outcome',       label: 'Outcome'       },
  ],
  email: [
    { value: 'event_type',        label: 'Event Type'       },
    { value: 'direction',         label: 'Direction'        },
    { value: 'sender',            label: 'Sender'           },
    { value: 'recipient',         label: 'Recipient'        },
    { value: 'subject',           label: 'Subject'          },
    { value: 'verdict',           label: 'Verdict'          },
    { value: 'attachment_sha256', label: 'Attachment Hash'  },
  ],
}

const OPERATORS = [
  { value: 'contains',     label: 'contains'         },
  { value: 'not_contains', label: 'does not contain' },
  { value: 'equals',       label: 'equals'           },
  { value: 'not_equals',   label: 'does not equal'   },
  { value: 'starts_with',  label: 'starts with'      },
  { value: 'ends_with',    label: 'ends with'        },
  { value: 'regex',        label: 'matches regex'    },
  { value: 'in_list',      label: 'in list'          },
  { value: 'greater_than', label: 'greater than'     },
  { value: 'less_than',    label: 'less than'        },
]

const SEVERITIES = ['Low', 'Medium', 'High', 'Critical'] as const

const RULE_TYPES = [
  { value: 'process',           label: 'Process'           },
  { value: 'network',           label: 'Network'           },
  { value: 'file',              label: 'File'              },
  { value: 'persistence',       label: 'Persistence'       },
  { value: 'log',               label: 'Log'               },
  { value: 'dns',               label: 'DNS'               },
  { value: 'registry',          label: 'Registry'          },
  { value: 'usb',               label: 'USB'               },
  { value: 'browser_extension', label: 'Browser Extension' },
  { value: 'cloud',             label: 'Cloud'             },
  { value: 'k8s',               label: 'Kubernetes'        },
  { value: 'email',             label: 'Email'             },
]

// ── Style helpers ─────────────────────────────────────────────────────────────

const SEV_STYLE: Record<string, string> = {
  Low:      'bg-gray-100 text-gray-600',
  Medium:   'bg-blue-50 text-blue-700',
  High:     'bg-amber-50 text-amber-700',
  Critical: 'bg-red-100 text-red-700 font-semibold',
}

const TYPE_COLOR: Record<string, string> = {
  process:           'bg-indigo-50 text-indigo-700',
  network:           'bg-cyan-50 text-cyan-700',
  file:              'bg-emerald-50 text-emerald-700',
  persistence:       'bg-purple-50 text-purple-700',
  log:               'bg-slate-100 text-slate-700',
  dns:               'bg-teal-50 text-teal-700',
  registry:          'bg-orange-50 text-orange-700',
  usb:               'bg-pink-50 text-pink-700',
  browser_extension: 'bg-yellow-50 text-yellow-700',
  cloud:             'bg-sky-50 text-sky-700',
  k8s:               'bg-blue-50 text-blue-700',
  email:             'bg-rose-50 text-rose-700',
}

// ── Form state ────────────────────────────────────────────────────────────────

interface Condition {
  field: string
  operator: string
  value: string
}

interface FormState {
  id?: number
  name: string
  description: string
  rule_type: string
  logic: 'AND' | 'OR'
  conditions: Condition[]
  severity: string
  mitre_tactic: string
  mitre_technique: string
  enabled: boolean
}

const EMPTY_RULE: FormState = {
  name: '',
  description: '',
  rule_type: 'process',
  logic: 'AND',
  conditions: [{ field: 'process_name', operator: 'contains', value: '' }],
  severity: 'Medium',
  mitre_tactic: '',
  mitre_technique: '',
  enabled: true,
}

function ruleToForm(rule: DetectionRule): FormState {
  const fields = FIELDS_BY_TYPE[rule.rule_type] ?? []
  return {
    id:             rule.id,
    name:           rule.name,
    description:    rule.description ?? '',
    rule_type:      rule.rule_type,
    logic:          (rule.logic as 'AND' | 'OR') ?? 'OR',
    conditions:     rule.conditions.length > 0
      ? rule.conditions.map(c => ({ field: c.field, operator: c.operator, value: c.value }))
      : [{ field: fields[0]?.value ?? 'process_name', operator: 'contains', value: '' }],
    severity:       rule.severity,
    mitre_tactic:   rule.mitre_tactic ?? '',
    mitre_technique: rule.mitre_technique ?? '',
    enabled:        rule.enabled,
  }
}

// ── Rule Builder Modal ────────────────────────────────────────────────────────

function RuleModal({
  initial,
  isSystem,
  onClose,
  onSave,
}: {
  initial: FormState
  isSystem?: boolean
  onClose: () => void
  onSave: (form: FormState) => Promise<void>
}) {
  const [form, setForm]     = useState<FormState>(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  const isEdit = !!initial.id

  function handleTypeChange(newType: string) {
    const fields = FIELDS_BY_TYPE[newType] ?? []
    const defaultField = fields[0]?.value ?? ''
    setForm(f => ({
      ...f,
      rule_type: newType,
      conditions: f.conditions.map(c => ({ ...c, field: defaultField })),
    }))
  }

  function updateCondition(i: number, key: keyof Condition, val: string) {
    setForm(f => {
      const next = [...f.conditions]
      next[i] = { ...next[i], [key]: val }
      return { ...f, conditions: next }
    })
  }

  function addCondition() {
    const fields = FIELDS_BY_TYPE[form.rule_type] ?? []
    setForm(f => ({
      ...f,
      conditions: [...f.conditions, { field: fields[0]?.value ?? '', operator: 'contains', value: '' }],
    }))
  }

  function removeCondition(i: number) {
    setForm(f => ({ ...f, conditions: f.conditions.filter((_, idx) => idx !== i) }))
  }

  const validCount = form.conditions.filter(c => c.value.trim()).length

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || validCount === 0) return
    setSaving(true); setError(null)
    try {
      await onSave({ ...form, conditions: form.conditions.filter(c => c.value.trim()) })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save rule')
    } finally {
      setSaving(false)
    }
  }

  const fieldOptions = FIELDS_BY_TYPE[form.rule_type] ?? []
  const dropSel = 'text-xs border-0 bg-transparent focus:outline-none appearance-none cursor-pointer pr-4 w-full'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[92vh] flex flex-col">

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
              Built-in system rule — only the enabled state can be changed.
            </div>
          )}

          {/* Name + Description */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Rule Name *</label>
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Suspicious PowerShell Encoded Command"
                disabled={isSystem} required
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
              <input
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="What does this rule detect?"
                disabled={isSystem}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
              />
            </div>
          </div>

          {/* Telemetry type + Logic toggle */}
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-700 mb-1">Telemetry Source</label>
              <div className="relative">
                <select
                  value={form.rule_type}
                  onChange={e => handleTypeChange(e.target.value)}
                  disabled={isSystem}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 pr-8 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:bg-gray-50"
                >
                  {RULE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Condition Logic</label>
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5 h-[38px]">
                {(['AND', 'OR'] as const).map(l => (
                  <button
                    key={l} type="button"
                    onClick={() => !isSystem && setForm(f => ({ ...f, logic: l }))}
                    disabled={isSystem}
                    className={`text-xs font-bold px-4 py-1.5 rounded-md transition-all ${
                      form.logic === l
                        ? l === 'AND' ? 'bg-blue-600 text-white shadow-sm' : 'bg-amber-500 text-white shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    } disabled:cursor-not-allowed`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── IF block ──────────────────────────────────────────────────── */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between bg-blue-50 border-b border-blue-100 px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold tracking-widest text-blue-600 uppercase">IF</span>
                <span className="text-xs text-blue-500">
                  {form.logic === 'AND' ? 'all conditions match' : 'any condition matches'}
                </span>
              </div>
              {!isSystem && (
                <button
                  type="button"
                  onClick={addCondition}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  <Plus size={11} /> Add
                </button>
              )}
            </div>

            <div className="divide-y divide-gray-100">
              {form.conditions.map((cond, i) => (
                <div key={i}>
                  {/* AND/OR connector between rows */}
                  {i > 0 && (
                    <div className="flex items-center px-3 py-1 bg-gray-50 border-b border-gray-100">
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                        form.logic === 'AND' ? 'bg-blue-100 text-blue-600' : 'bg-amber-100 text-amber-600'
                      }`}>{form.logic}</span>
                    </div>
                  )}

                  <div className="group flex items-center gap-0 px-3 py-2.5">
                    <span className="text-[10px] text-gray-300 font-mono w-4 shrink-0 mr-2 select-none">{i + 1}</span>

                    {/* Field */}
                    <div className="relative flex-1 min-w-0">
                      <select
                        value={cond.field}
                        onChange={e => updateCondition(i, 'field', e.target.value)}
                        disabled={isSystem}
                        className={`${dropSel} font-medium text-gray-800 disabled:cursor-not-allowed`}
                      >
                        {fieldOptions.map(f => (
                          <option key={f.value} value={f.value}>{f.label}</option>
                        ))}
                      </select>
                      <ChevronDown size={10} className="absolute right-0 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" />
                    </div>

                    <div className="w-px h-5 bg-gray-200 mx-2 shrink-0" />

                    {/* Operator */}
                    <div className="relative" style={{ minWidth: 128 }}>
                      <select
                        value={cond.operator}
                        onChange={e => updateCondition(i, 'operator', e.target.value)}
                        disabled={isSystem}
                        className={`${dropSel} text-gray-500 italic disabled:cursor-not-allowed`}
                      >
                        {OPERATORS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                      <ChevronDown size={10} className="absolute right-0 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" />
                    </div>

                    <div className="w-px h-5 bg-gray-200 mx-2 shrink-0" />

                    {/* Value */}
                    <input
                      value={cond.value}
                      onChange={e => updateCondition(i, 'value', e.target.value)}
                      disabled={isSystem}
                      placeholder={cond.operator === 'in_list' ? 'val1, val2, val3' : 'value…'}
                      className="flex-1 text-xs text-gray-700 bg-transparent border-0 focus:outline-none font-mono min-w-0 disabled:cursor-not-allowed"
                    />

                    {/* Remove button — visible on row hover */}
                    {!isSystem && form.conditions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeCondition(i)}
                        className="ml-2 shrink-0 text-gray-200 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                        title="Remove condition"
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {!isSystem && (
              <div className="border-t border-dashed border-gray-200">
                <button
                  type="button"
                  onClick={addCondition}
                  className="w-full flex items-center gap-2 px-5 py-2 text-xs text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                >
                  <Plus size={11} />
                  Add another condition
                </button>
              </div>
            )}
          </div>

          {/* ── THEN block ────────────────────────────────────────────────── */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="bg-red-50 border-b border-red-100 px-3 py-2 flex items-center gap-2">
              <span className="text-[10px] font-bold tracking-widest text-red-500 uppercase">THEN</span>
              <span className="text-xs text-red-400">generate an alert with severity</span>
            </div>
            <div className="px-3 py-3">
              <div className="flex gap-2">
                {SEVERITIES.map(s => (
                  <button
                    key={s} type="button" disabled={isSystem}
                    onClick={() => setForm(f => ({ ...f, severity: s }))}
                    className={`flex-1 text-xs font-semibold py-2 rounded-lg border transition-all ${
                      form.severity === s
                        ? SEV_STYLE[s] + ' border-transparent ring-2 ring-offset-1 ring-current'
                        : 'border-gray-200 text-gray-400 hover:border-gray-300'
                    } disabled:opacity-60 disabled:cursor-not-allowed`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* MITRE */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">MITRE Tactic</label>
              <input
                value={form.mitre_tactic}
                onChange={e => setForm(f => ({ ...f, mitre_tactic: e.target.value }))}
                placeholder="e.g. Execution" disabled={isSystem}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">MITRE Technique</label>
              <input
                value={form.mitre_technique}
                onChange={e => setForm(f => ({ ...f, mitre_technique: e.target.value }))}
                placeholder="e.g. T1059.001" disabled={isSystem}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
              />
            </div>
          </div>

          {/* Enabled toggle */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, enabled: !f.enabled }))}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${form.enabled ? 'bg-blue-600' : 'bg-gray-300'}`}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${form.enabled ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
            </button>
            <span className="text-sm text-gray-700">
              {form.enabled ? 'Rule enabled — will fire alerts' : 'Rule disabled (will not fire)'}
            </span>
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-200">{error}</p>
          )}
        </form>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between shrink-0">
          <span className="text-xs text-gray-400">
            {validCount} condition{validCount !== 1 ? 's' : ''} · {form.logic} logic
          </span>
          <div className="flex gap-2">
            <button onClick={onClose} className="text-sm px-4 py-2 text-gray-500 hover:text-gray-700 transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              form=""
              onClick={handleSubmit as unknown as React.MouseEventHandler}
              disabled={saving || !form.name.trim() || validCount === 0}
              className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
            >
              {saving && <RefreshCw size={12} className="animate-spin" />}
              {isEdit ? 'Save Changes' : 'Create Rule'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Delete confirmation ───────────────────────────────────────────────────────

function DeleteConfirm({
  rule,
  onClose,
  onDelete,
}: {
  rule: DetectionRule
  onClose: () => void
  onDelete: () => Promise<void>
}) {
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
  const [rules, setRules]               = useState<DetectionRule[]>([])
  const [loading, setLoading]           = useState(true)
  const [search, setSearch]             = useState('')
  const [typeFilter, setTypeFilter]     = useState('All')
  const [sevFilter, setSevFilter]       = useState('All')
  const [enabledFilter, setEnabledFilter] = useState<'All' | 'Enabled' | 'Disabled'>('All')
  const [showModal, setShowModal]       = useState(false)
  const [editing, setEditing]           = useState<DetectionRule | null>(null)
  const [deleting, setDeleting]         = useState<DetectionRule | null>(null)
  const [error, setError]               = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    fetchRules()
      .then(setRules)
      .catch(() => setError('Failed to load detection rules'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => rules.filter((r) => {
    const condText = (r.conditions ?? []).map(c => `${c.field} ${c.value}`).join(' ')
    const matchSearch = !search ||
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      (r.description ?? '').toLowerCase().includes(search.toLowerCase()) ||
      condText.toLowerCase().includes(search.toLowerCase())
    const matchType    = typeFilter === 'All' || r.rule_type === typeFilter
    const matchSev     = sevFilter === 'All' || r.severity === sevFilter
    const matchEnabled = enabledFilter === 'All' || (enabledFilter === 'Enabled' ? r.enabled : !r.enabled)
    return matchSearch && matchType && matchSev && matchEnabled
  }), [rules, search, typeFilter, sevFilter, enabledFilter])

  const total   = rules.length
  const enabled = rules.filter(r => r.enabled).length
  const system  = rules.filter(r => r.is_system).length
  const custom  = rules.filter(r => !r.is_system).length

  async function handleSave(form: FormState) {
    const payload: RulePayload = {
      name:            form.name.trim(),
      description:     form.description.trim() || undefined,
      rule_type:       form.rule_type,
      logic:           form.logic,
      conditions:      form.conditions.filter(c => c.field && c.value.trim()),
      severity:        form.severity,
      mitre_tactic:    form.mitre_tactic.trim() || undefined,
      mitre_technique: form.mitre_technique.trim() || undefined,
      enabled:         form.enabled,
    }
    if (form.id) {
      const updated = await updateRule(form.id, payload)
      setRules(prev => prev.map(r => r.id === form.id ? updated : r))
    } else {
      const created = await createRule(payload)
      setRules(prev => [created, ...prev])
    }
  }

  async function handleToggle(rule: DetectionRule) {
    const result = await toggleRule(rule.id)
    setRules(prev => prev.map(r => r.id === rule.id ? { ...r, enabled: result.enabled } : r))
  }

  async function handleDelete(rule: DetectionRule) {
    await deleteRule(rule.id)
    setRules(prev => prev.filter(r => r.id !== rule.id))
    setDeleting(null)
  }

  return (
    <div className="space-y-6">
      <Topbar
        title="Detection Rules"
        subtitle="Visual rule builder — define IF / AND / OR / THEN conditions without writing code"
        onRefresh={load}
      />

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Rules', value: total,   color: 'bg-slate-600' },
          { label: 'Active',      value: enabled, color: 'bg-green-600' },
          { label: 'Built-in',    value: system,  color: 'bg-indigo-500' },
          { label: 'Custom',      value: custom,  color: 'bg-blue-500' },
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
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text" placeholder="Search rules, fields, values…" value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>

        {/* Type dropdown */}
        <div className="relative">
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="text-sm border border-gray-200 rounded-xl px-3 py-2.5 pr-8 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="All">All Types</option>
            {RULE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>

        {/* Severity filter */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {['All', ...SEVERITIES].map(s => (
            <button key={s} onClick={() => setSevFilter(s)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${sevFilter === s ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {s}
            </button>
          ))}
        </div>

        {/* Enabled filter */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {(['All', 'Enabled', 'Disabled'] as const).map(e => (
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

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl border border-red-200">
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      {/* Rules table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50">
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
            <table className="w-full min-w-[960px]">
              <thead>
                <tr className="border-b border-gray-50 text-left">
                  {['Rule Name', 'Type', 'Conditions', 'Logic', 'Severity', 'MITRE', 'Status', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(rule => (
                  <tr key={rule.id} className={`hover:bg-gray-50/50 transition-colors ${!rule.enabled ? 'opacity-50' : ''}`}>

                    {/* Name */}
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

                    {/* Type */}
                    <td className="px-4 py-3.5">
                      <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full capitalize ${TYPE_COLOR[rule.rule_type] ?? 'bg-gray-100 text-gray-600'}`}>
                        {RULE_TYPES.find(t => t.value === rule.rule_type)?.label ?? rule.rule_type}
                      </span>
                    </td>

                    {/* Conditions */}
                    <td className="px-4 py-3.5 max-w-[260px]">
                      <div className="space-y-1">
                        {(rule.conditions ?? []).slice(0, 2).map((cond, i) => (
                          <div key={i} className="flex items-center gap-1 flex-wrap">
                            <code className="text-[11px] bg-gray-100 rounded px-1.5 py-0.5 text-gray-700">{cond.field}</code>
                            <span className="text-[10px] text-gray-400 italic">{cond.operator.replace(/_/g, ' ')}</span>
                            <code className="text-[11px] bg-gray-100 rounded px-1.5 py-0.5 text-gray-700 max-w-[80px] truncate">{cond.value}</code>
                          </div>
                        ))}
                        {(rule.conditions ?? []).length > 2 && (
                          <span className="text-[10px] text-gray-400">
                            +{rule.conditions.length - 2} more
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Logic */}
                    <td className="px-4 py-3.5">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        (rule.logic ?? 'OR') === 'AND'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}>{rule.logic ?? 'OR'}</span>
                    </td>

                    {/* Severity */}
                    <td className="px-4 py-3.5">
                      <span className={`text-xs px-2.5 py-0.5 rounded-full ${SEV_STYLE[rule.severity] ?? 'bg-gray-100 text-gray-600'}`}>
                        {rule.severity}
                      </span>
                    </td>

                    {/* MITRE */}
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

                    {/* Status toggle */}
                    <td className="px-4 py-3.5">
                      <button
                        onClick={() => handleToggle(rule)}
                        className="flex items-center gap-1.5"
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

                    {/* Actions */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => { setEditing(rule); setShowModal(true) }}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          title={rule.is_system ? 'View / toggle' : 'Edit rule'}
                        >
                          <Edit2 size={13} />
                        </button>
                        {!rule.is_system ? (
                          <button
                            onClick={() => setDeleting(rule)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Delete rule"
                          >
                            <Trash2 size={13} />
                          </button>
                        ) : (
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
          initial={editing ? ruleToForm(editing) : EMPTY_RULE}
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
