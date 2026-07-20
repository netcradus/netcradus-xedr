import { useState, useRef, useCallback, useEffect } from 'react'
import {
  Search, Loader2, AlertTriangle, Clock, Terminal, Hash, Globe,
  User, Cpu, ChevronRight, Copy, CheckCheck, DownloadCloud,
  Crosshair, Filter, ArrowRight, Monitor, X, Info,
} from 'lucide-react'
import Topbar from '@/components/layout/Topbar/Topbar'
import {
  parseHuntQuery, executeHunt,
  type ParsedQuery, type HuntResult, type HuntHit, type HuntKey,
} from '@/api/huntApi'

// ── Search categories ──────────────────────────────────────────────────────────

interface Category {
  key: HuntKey
  label: string
  icon: React.ElementType
  placeholder: string
  examples: string[]
  color: string
}

const CATEGORIES: Category[] = [
  {
    key: 'hash',
    label: 'Hash',
    icon: Hash,
    placeholder: 'hash:e3b0c44298fc1c149afbf4c…',
    examples: ['hash:e3b0c44298fc', 'hash:44d88612fea8a8f36de82e'],
    color: 'text-violet-600 bg-violet-50 border-violet-200',
  },
  {
    key: 'ip',
    label: 'IP Address',
    icon: Globe,
    placeholder: 'ip:185.220.101.42',
    examples: ['ip:185.220.101.42', 'ip:10.0.0'],
    color: 'text-blue-600 bg-blue-50 border-blue-200',
  },
  {
    key: 'domain',
    label: 'Domain',
    icon: Globe,
    placeholder: 'domain:malicious-c2.com',
    examples: ['domain:pastebin.com', 'domain:.onion'],
    color: 'text-sky-600 bg-sky-50 border-sky-200',
  },
  {
    key: 'username',
    label: 'Username',
    icon: User,
    placeholder: 'username:admin',
    examples: ['username:SYSTEM', 'username:administrator'],
    color: 'text-green-600 bg-green-50 border-green-200',
  },
  {
    key: 'process',
    label: 'Process',
    icon: Cpu,
    placeholder: 'process:powershell',
    examples: ['process:mimikatz', 'process:mshta.exe'],
    color: 'text-orange-600 bg-orange-50 border-orange-200',
  },
  {
    key: 'parent_process',
    label: 'Parent Process',
    icon: ArrowRight,
    placeholder: 'parent_process:winword.exe',
    examples: ['parent_process:winword.exe', 'parent_process:excel.exe'],
    color: 'text-amber-600 bg-amber-50 border-amber-200',
  },
  {
    key: 'cmdline',
    label: 'Command Line',
    icon: Terminal,
    placeholder: 'cmdline:-enc',
    examples: ['cmdline:-enc', 'cmdline:DownloadString'],
    color: 'text-slate-600 bg-slate-50 border-slate-200',
  },
  {
    key: 'mitre',
    label: 'MITRE',
    icon: Crosshair,
    placeholder: 'mitre:T1059',
    examples: ['mitre:T1059.001', 'mitre:T1003'],
    color: 'text-red-600 bg-red-50 border-red-200',
  },
  {
    key: 'country',
    label: 'Country',
    icon: Globe,
    placeholder: 'country:Russia',
    examples: ['country:RU', 'country:China', 'country:KP'],
    color: 'text-indigo-600 bg-indigo-50 border-indigo-200',
  },
  {
    key: 'persistence',
    label: 'Persistence',
    icon: Filter,
    placeholder: 'persistence:registry',
    examples: ['persistence:registry', 'persistence:service'],
    color: 'text-rose-600 bg-rose-50 border-rose-200',
  },
]

const CAT_MAP = Object.fromEntries(CATEGORIES.map(c => [c.key, c]))

// ── Helpers ────────────────────────────────────────────────────────────────────

const DAYS_OPTIONS = [
  { label: '1d', value: 1 },
  { label: '7d', value: 7 },
  { label: '30d', value: 30 },
  { label: '90d', value: 90 },
]

function relTime(iso: string | null | undefined) {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function highlight(text: string | null | undefined, term: string) {
  if (!text || !term) return <span>{text ?? '—'}</span>
  const idx = text.toLowerCase().indexOf(term.toLowerCase())
  if (idx === -1) return <span className="font-mono text-xs">{text}</span>
  return (
    <span className="font-mono text-xs">
      {text.slice(0, idx)}
      <mark className="bg-yellow-200 text-yellow-900 rounded px-0.5">{text.slice(idx, idx + term.length)}</mark>
      {text.slice(idx + term.length)}
    </span>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={async e => {
        e.stopPropagation()
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
      className="ml-1 inline-flex items-center text-gray-300 hover:text-gray-500 transition-colors"
    >
      {copied ? <CheckCheck size={11} className="text-green-500" /> : <Copy size={11} />}
    </button>
  )
}

function Pill({ value, onClick }: { value: string; onClick: (v: string) => void }) {
  return (
    <button
      onClick={() => onClick(value)}
      className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 bg-gray-50 border border-gray-200 rounded-full text-gray-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors font-mono"
    >
      {value}
      <ChevronRight size={9} />
    </button>
  )
}

// ── Column definitions per hunt type ──────────────────────────────────────────

function cols(key: HuntKey, term: string, pivot: (v: string) => void) {
  const hl = (v: string | null | undefined) => highlight(v, term)

  const HOST = (h: HuntHit) => (
    <td className="px-3 py-2.5 whitespace-nowrap">
      <div className="flex items-center gap-1.5">
        <Monitor size={11} className="text-gray-300 shrink-0" />
        <span className="text-xs text-gray-700 font-medium">{h.agent_hostname ?? '—'}</span>
      </div>
    </td>
  )
  const TS = (h: HuntHit) => (
    <td className="px-3 py-2.5 whitespace-nowrap text-right">
      <span className="text-[11px] text-gray-400" title={h.timestamp ?? ''}>
        {relTime(h.timestamp)}
      </span>
    </td>
  )

  switch (key) {
    case 'hash':
      return {
        headers: ['Host', 'Source', 'Process', 'Path / File', 'SHA-256', 'Time'],
        row: (h: HuntHit, i: number) => (
          <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
            {HOST(h)}
            <td className="px-3 py-2.5"><SourceBadge source={h.source} /></td>
            <td className="px-3 py-2.5 text-xs text-gray-600">{hl(h.process_name)}</td>
            <td className="px-3 py-2.5 max-w-[220px] truncate text-[11px] text-gray-500">
              {h.file_path ?? h.exe_path ?? '—'}
            </td>
            <td className="px-3 py-2.5">
              <span className="font-mono text-[10px] text-gray-500">{(h.sha256 ?? h.md5 ?? '—').slice(0, 16)}…</span>
              {(h.sha256 ?? h.md5) && <CopyButton text={h.sha256 ?? h.md5 ?? ''} />}
            </td>
            {TS(h)}
          </tr>
        ),
      }

    case 'ip':
      return {
        headers: ['Host', 'Local IP', 'Remote IP', 'Port', 'Protocol', 'Time'],
        row: (h: HuntHit, i: number) => (
          <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
            {HOST(h)}
            <td className="px-3 py-2.5 font-mono text-[11px] text-gray-500">{h.local_ip ?? '—'}</td>
            <td className="px-3 py-2.5">
              <Pill value={`ip:${h.remote_ip}`} onClick={pivot} />
            </td>
            <td className="px-3 py-2.5 text-xs text-gray-600">{h.remote_port ?? '—'}</td>
            <td className="px-3 py-2.5 text-xs text-gray-500">{h.protocol ?? '—'}</td>
            {TS(h)}
          </tr>
        ),
      }

    case 'country':
      return {
        headers: ['Host', 'Remote IP', 'Country', 'ISP', 'Abuse Score', 'Port', 'Time'],
        row: (h: HuntHit, i: number) => (
          <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
            {HOST(h)}
            <td className="px-3 py-2.5">
              <Pill value={`ip:${h.remote_ip}`} onClick={pivot} />
            </td>
            <td className="px-3 py-2.5">
              <span className="text-xs font-semibold text-gray-700">{h.country_code ?? '—'}</span>
            </td>
            <td className="px-3 py-2.5 text-xs text-gray-500 max-w-[160px] truncate">{h.isp ?? '—'}</td>
            <td className="px-3 py-2.5">
              {h.abuse_score != null ? (
                <span className={`text-xs font-bold ${h.abuse_score >= 70 ? 'text-red-600' : h.abuse_score >= 30 ? 'text-amber-600' : 'text-green-600'}`}>
                  {h.abuse_score}%
                </span>
              ) : '—'}
            </td>
            <td className="px-3 py-2.5 text-xs text-gray-500">{h.remote_port ?? '—'}</td>
            {TS(h)}
          </tr>
        ),
      }

    case 'process':
    case 'parent_process':
    case 'cmdline':
      return {
        headers: ['Host', 'Process', 'Parent', 'User', 'Command Line', 'Time'],
        row: (h: HuntHit, i: number) => (
          <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
            {HOST(h)}
            <td className="px-3 py-2.5">
              {h.process_name
                ? <Pill value={`process:${h.process_name}`} onClick={pivot} />
                : <span className="text-gray-400 text-xs">—</span>}
            </td>
            <td className="px-3 py-2.5">
              {h.parent_process_name
                ? <Pill value={`parent_process:${h.parent_process_name}`} onClick={pivot} />
                : <span className="text-gray-400 text-xs">—</span>}
            </td>
            <td className="px-3 py-2.5">
              {h.username
                ? <Pill value={`username:${h.username}`} onClick={pivot} />
                : <span className="text-gray-400 text-xs">—</span>}
            </td>
            <td className="px-3 py-2.5 max-w-[300px]">{hl(h.cmdline)}</td>
            {TS(h)}
          </tr>
        ),
      }

    case 'username':
      return {
        headers: ['Host', 'Source', 'Username', 'Process', 'Command / Log', 'Time'],
        row: (h: HuntHit, i: number) => (
          <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
            {HOST(h)}
            <td className="px-3 py-2.5"><SourceBadge source={h.source} /></td>
            <td className="px-3 py-2.5">
              {h.username ? <Pill value={`username:${h.username}`} onClick={pivot} /> : '—'}
            </td>
            <td className="px-3 py-2.5">
              {h.process_name
                ? <Pill value={`process:${h.process_name}`} onClick={pivot} />
                : <span className="text-gray-400 text-xs">—</span>}
            </td>
            <td className="px-3 py-2.5 max-w-[300px]">{hl(h.cmdline ?? h.log_message)}</td>
            {TS(h)}
          </tr>
        ),
      }

    case 'domain':
      return {
        headers: ['Host', 'Source', 'Process', 'User', 'Match Context', 'Time'],
        row: (h: HuntHit, i: number) => (
          <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
            {HOST(h)}
            <td className="px-3 py-2.5"><SourceBadge source={h.source} /></td>
            <td className="px-3 py-2.5">
              {h.process_name
                ? <Pill value={`process:${h.process_name}`} onClick={pivot} />
                : <span className="text-gray-400 text-xs">—</span>}
            </td>
            <td className="px-3 py-2.5">
              {h.username ? <Pill value={`username:${h.username}`} onClick={pivot} /> : '—'}
            </td>
            <td className="px-3 py-2.5 max-w-[300px]">
              {hl(h.cmdline ?? h.file_path ?? h.log_message)}
            </td>
            {TS(h)}
          </tr>
        ),
      }

    case 'persistence':
      return {
        headers: ['Host', 'Type', 'Entry Name', 'Path', 'Time'],
        row: (h: HuntHit, i: number) => (
          <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
            {HOST(h)}
            <td className="px-3 py-2.5">
              <span className="text-xs font-mono text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                {hl(h.persistence_type)}
              </span>
            </td>
            <td className="px-3 py-2.5 text-xs text-gray-600">{hl(h.entry_name)}</td>
            <td className="px-3 py-2.5 max-w-[280px] font-mono text-[11px] text-gray-500">{hl(h.entry_path)}</td>
            {TS(h)}
          </tr>
        ),
      }

    case 'mitre':
    default:
      return {
        headers: ['Host', 'Alert / Rule', 'Severity', 'Technique', 'Occurrences', 'Time'],
        row: (h: HuntHit, i: number) => (
          <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
            {HOST(h)}
            <td className="px-3 py-2.5 max-w-[240px]">
              <p className="text-xs font-medium text-gray-700 truncate">{h.title ?? '—'}</p>
            </td>
            <td className="px-3 py-2.5">
              {h.severity
                ? <SeverityBadge sev={h.severity} />
                : <span className="text-gray-400 text-xs">—</span>}
            </td>
            <td className="px-3 py-2.5">
              {h.mitre_technique
                ? <Pill value={`mitre:${h.mitre_technique}`} onClick={pivot} />
                : '—'}
            </td>
            <td className="px-3 py-2.5 text-xs text-gray-500 text-center">{h.occurrence_count ?? '—'}</td>
            {TS(h)}
          </tr>
        ),
      }
  }
}

function SourceBadge({ source }: { source?: string | null }) {
  const map: Record<string, string> = {
    process:         'text-blue-600 bg-blue-50 border-blue-200',
    file:            'text-green-600 bg-green-50 border-green-200',
    log:             'text-gray-600 bg-gray-50 border-gray-200',
    process_cmdline: 'text-amber-600 bg-amber-50 border-amber-200',
    file_path:       'text-emerald-600 bg-emerald-50 border-emerald-200',
  }
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${map[source ?? ''] ?? 'text-gray-500 bg-gray-50 border-gray-200'}`}>
      {source ?? '—'}
    </span>
  )
}

const SEV_CLS: Record<string, string> = {
  Critical: 'bg-purple-50 text-purple-700 border-purple-200',
  High:     'bg-red-50 text-red-600 border-red-200',
  Medium:   'bg-amber-50 text-amber-700 border-amber-200',
  Low:      'bg-green-50 text-green-700 border-green-200',
}
function SeverityBadge({ sev }: { sev: string }) {
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${SEV_CLS[sev] ?? 'bg-gray-50 text-gray-500 border-gray-200'}`}>
      {sev}
    </span>
  )
}

// ── MITRE result — two sub-tables ──────────────────────────────────────────────

function MitreResult({ result, pivot }: { result: HuntResult; pivot: (v: string) => void }) {
  const alerts = result.alerts ?? []
  const rules  = result.detection_rules ?? []
  const sev    = (result.summary as { severity_breakdown?: Record<string, number> })?.severity_breakdown ?? {}

  return (
    <div className="space-y-6">
      {/* Severity summary */}
      {Object.keys(sev).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(sev).map(([s, n]) => (
            <div key={s} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold ${SEV_CLS[s] ?? 'bg-gray-50 text-gray-500 border-gray-200'}`}>
              {s}: {n}
            </div>
          ))}
        </div>
      )}

      {/* Alerts */}
      {alerts.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Alerts ({alerts.length})
          </p>
          <ResultTable
            headers={['Host', 'Alert Title', 'Severity', 'Technique', 'Occurrences', 'Time']}
            rows={alerts.map((h, i) =>
              cols('mitre', '', pivot).row(h, i)
            )}
          />
        </div>
      )}

      {/* Detection rules */}
      {rules.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Detection Rules ({rules.length})
          </p>
          <ResultTable
            headers={['Name', 'Rule Type', 'Severity', 'Technique', 'Tactic', 'Enabled']}
            rows={rules.map((r, i) => (
              <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/60">
                <td className="px-3 py-2.5 text-xs font-medium text-gray-700">{r.name ?? '—'}</td>
                <td className="px-3 py-2.5 text-xs text-gray-500 font-mono">{r.rule_type ?? '—'}</td>
                <td className="px-3 py-2.5">{r.severity ? <SeverityBadge sev={r.severity} /> : '—'}</td>
                <td className="px-3 py-2.5">
                  {r.mitre_technique
                    ? <Pill value={`mitre:${r.mitre_technique}`} onClick={pivot} />
                    : '—'}
                </td>
                <td className="px-3 py-2.5 text-xs text-gray-500">{r.mitre_tactic ?? '—'}</td>
                <td className="px-3 py-2.5">
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${r.enabled ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                    {r.enabled ? 'On' : 'Off'}
                  </span>
                </td>
              </tr>
            ))}
          />
        </div>
      )}

      {alerts.length === 0 && rules.length === 0 && (
        <Empty />
      )}
    </div>
  )
}

function ResultTable({ headers, rows }: { headers: string[]; rows: React.ReactNode[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50/80">
            {headers.map(h => (
              <th key={h} className="px-3 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{rows}</tbody>
      </table>
    </div>
  )
}

function Empty() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Search size={32} className="text-gray-200 mb-3" />
      <p className="text-sm font-medium text-gray-400">No hits found</p>
      <p className="text-xs text-gray-300 mt-1">Try a different search term or extend the time range</p>
    </div>
  )
}

// ── Export CSV ─────────────────────────────────────────────────────────────────

function exportCSV(hits: HuntHit[], filename: string) {
  if (!hits.length) return
  const keys = Object.keys(hits[0]) as (keyof HuntHit)[]
  const header = keys.join(',')
  const rows = hits.map(h =>
    keys.map(k => {
      const v = h[k]
      if (v == null) return ''
      const s = String(v)
      return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s
    }).join(',')
  )
  const csv = [header, ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ThreatHunting() {
  const [query, setQuery]       = useState('')
  const [parsed, setParsed]     = useState<ParsedQuery | null>(null)
  const [days, setDays]         = useState(7)
  const [result, setResult]     = useState<HuntResult | null>(null)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [history, setHistory]   = useState<string[]>([])
  const [histIdx, setHistIdx]   = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)

  // Parse the query reactively
  useEffect(() => {
    setParsed(parseHuntQuery(query))
  }, [query])

  const runSearch = useCallback(async (raw: string, d: number) => {
    const p = parseHuntQuery(raw)
    if (!p) {
      setError('Use format  key:value  — e.g.  process:powershell  or  ip:1.2.3.4')
      return
    }
    setError(null)
    setResult(null)
    setLoading(true)
    setHistory(prev => [raw, ...prev.filter(x => x !== raw)].slice(0, 20))
    setHistIdx(-1)
    try {
      const r = await executeHunt(p, d)
      setResult(r)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed')
    } finally {
      setLoading(false)
    }
  }, [])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (query.trim()) runSearch(query.trim(), days)
  }

  function pivot(value: string) {
    setQuery(value)
    runSearch(value, days)
    inputRef.current?.focus()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!history.length) return
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      const idx = Math.min(histIdx + 1, history.length - 1)
      setHistIdx(idx)
      setQuery(history[idx])
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      const idx = Math.max(histIdx - 1, -1)
      setHistIdx(idx)
      setQuery(idx === -1 ? '' : history[idx])
    }
  }

  const cat = parsed ? CAT_MAP[parsed.key] : null
  const hits = result?.hits ?? []
  const isMitre = parsed?.key === 'mitre'

  const colDef = parsed && !isMitre
    ? cols(parsed.key, parsed.value, pivot)
    : null

  return (
    <div className="flex flex-col min-h-screen bg-[#F3F5F9]">
      <Topbar title="Threat Hunting" subtitle="Search across telemetry with structured queries" />

      <div className="flex-1 px-6 py-5 space-y-5">

        {/* ── Search bar ────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <form onSubmit={handleSubmit} className="flex items-center gap-3">
            <div className="relative flex-1">
              {/* Category icon */}
              {cat && (
                <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <cat.icon size={14} className={cat.color.split(' ')[0]} />
                </div>
              )}
              {!cat && (
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              )}
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="hash:… · ip:… · process:powershell · username:admin · mitre:T1059"
                spellCheck={false}
                autoComplete="off"
                className={`w-full pl-9 pr-4 py-3 text-sm font-mono border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                  cat
                    ? `${cat.color} border-opacity-60`
                    : 'border-gray-200 bg-gray-50 text-gray-800'
                }`}
              />
              {query && (
                <button
                  type="button"
                  onClick={() => { setQuery(''); setResult(null); setError(null) }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Time range */}
            <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl overflow-hidden shrink-0">
              {DAYS_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setDays(opt.value)
                    if (query.trim()) runSearch(query.trim(), opt.value)
                  }}
                  className={`px-3 py-2.5 text-xs font-medium transition-colors ${
                    days === opt.value
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <button
              type="submit"
              disabled={!query.trim() || loading}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl shadow hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              Hunt
            </button>
          </form>

          {/* Category chips */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {CATEGORIES.map(c => {
              const Icon = c.icon
              const isActive = parsed?.key === c.key
              return (
                <button
                  key={c.key}
                  onClick={() => {
                    const prefix = `${c.key}:`
                    setQuery(prefix)
                    inputRef.current?.focus()
                  }}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-colors ${
                    isActive
                      ? c.color + ' font-semibold'
                      : 'text-gray-500 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <Icon size={11} />
                  {c.label}
                </button>
              )
            })}
          </div>

          {/* Examples for the active category */}
          {cat && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-[11px] text-gray-400">Examples:</span>
              {cat.examples.map(ex => (
                <button
                  key={ex}
                  onClick={() => { setQuery(ex); inputRef.current?.focus() }}
                  className="text-[11px] font-mono text-blue-600 hover:underline"
                >
                  {ex}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Error ─────────────────────────────────────────────────────── */}
        {error && (
          <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
            <AlertTriangle size={14} className="shrink-0" />
            {error}
          </div>
        )}

        {/* ── Loading ───────────────────────────────────────────────────── */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <Loader2 size={28} className="animate-spin text-blue-500 mx-auto mb-3" />
              <p className="text-sm text-gray-400">Hunting across telemetry…</p>
            </div>
          </div>
        )}

        {/* ── Results ───────────────────────────────────────────────────── */}
        {result && !loading && (
          <div className="space-y-3">
            {/* Stats bar */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-800">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold ${
                    (isMitre ? (result.summary as { alert_count?: number })?.alert_count ?? 0 : hits.length) > 0
                      ? 'bg-red-50 text-red-600 border border-red-200'
                      : 'bg-green-50 text-green-600 border border-green-200'
                  }`}>
                    {isMitre ? (result.summary as { alert_count?: number })?.alert_count ?? 0 : hits.length} hits
                  </span>
                </div>

                {result.unique_agents != null && (
                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    <Monitor size={11} />
                    {result.unique_agents} agent{result.unique_agents !== 1 ? 's' : ''}
                  </span>
                )}
                {result.unique_hosts && result.unique_hosts.length > 0 && (
                  <span className="text-xs text-gray-500">{result.unique_hosts.join(', ')}</span>
                )}
                {result.country_code && (
                  <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                    {result.country_code} · {result.attributed_ips?.length ?? 0} attributed IPs
                  </span>
                )}
                <span className="flex items-center gap-1 text-[11px] text-gray-400">
                  <Clock size={10} />
                  Last {days}d
                </span>
              </div>

              {hits.length > 0 && (
                <button
                  onClick={() => exportCSV(hits, `hunt-${parsed?.key}-${Date.now()}.csv`)}
                  className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <DownloadCloud size={12} />
                  Export CSV
                </button>
              )}
            </div>

            {/* Country attribution notice */}
            {parsed?.key === 'country' && result.attributed_ips && result.attributed_ips.length === 0 && (
              <div className="flex items-start gap-2 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700">
                <Info size={14} className="shrink-0 mt-0.5" />
                No IPs attributed to <strong>{parsed.value}</strong> found in IOC enrichment data.
                Enrich your IOCs with AbuseIPDB to enable country-based hunting.
              </div>
            )}

            {/* MITRE result */}
            {isMitre && (
              <MitreResult result={result} pivot={pivot} />
            )}

            {/* Standard table */}
            {!isMitre && colDef && (
              hits.length > 0
                ? <ResultTable
                    headers={colDef.headers}
                    rows={hits.map((h, i) => colDef.row(h, i))}
                  />
                : <Empty />
            )}
          </div>
        )}

        {/* ── Empty state ───────────────────────────────────────────────── */}
        {!result && !loading && !error && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
            <div className="px-5 py-4 border-b border-gray-50">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Quick Reference</p>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-px bg-gray-100">
              {CATEGORIES.map(c => {
                const Icon = c.icon
                return (
                  <button
                    key={c.key}
                    onClick={() => { setQuery(`${c.key}:`); inputRef.current?.focus() }}
                    className="bg-white p-4 text-left hover:bg-blue-50/40 transition-colors group"
                  >
                    <div className={`inline-flex items-center gap-1.5 text-xs font-semibold mb-2 ${c.color.split(' ')[0]}`}>
                      <Icon size={12} />
                      {c.key}:
                    </div>
                    <p className="text-xs text-gray-500 mb-2.5">{c.placeholder}</p>
                    <div className="space-y-1">
                      {c.examples.map(ex => (
                        <div
                          key={ex}
                          onClick={e => { e.stopPropagation(); pivot(ex) }}
                          className="text-[11px] font-mono text-gray-400 hover:text-blue-600 transition-colors cursor-pointer"
                        >
                          {ex}
                        </div>
                      ))}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
