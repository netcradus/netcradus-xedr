import { useEffect, useState, useCallback } from 'react'
import {
  Plus, RefreshCw, AlertTriangle, Trash2, Shield, X,
  Eye, EyeOff, Search, Zap, CheckCircle, XCircle,
  Clock, Loader2, Settings2, Globe, Hash,
} from 'lucide-react'
import Topbar from '@/components/layout/Topbar/Topbar'
import Card from '@/components/ui/Card/Card'
import Badge from '@/components/ui/Badge/Badge'
import { fetchIOCs, createIOC, deleteIOC } from '@/api/iocApi'
import { fetchFeedConfig, updateFeedConfig, lookupIndicator, enrichIOC } from '@/api/threatFeedsApi'
import type {
  BackendIOC, CreateIOCPayload, BackendSeverity,
  ThreatFeedConfig, LookupResult, FeedResult,
} from '@/types/api.types'
import type { Severity } from '@/types/dashboard.types'
import { useAuthStore } from '@/store/authStore'

const IOC_TYPES = ['SHA256', 'MD5', 'IPv4', 'IPv6', 'Domain', 'URL', 'Email', 'Filename', 'Registry']
const SEVERITIES: BackendSeverity[] = ['Critical', 'High', 'Medium', 'Low', 'Informational']

// ── Helpers ───────────────────────────────────────────────────────────────────

function typeColor(type: string): string {
  const map: Record<string, string> = {
    SHA256: 'bg-purple-100 text-purple-700',
    MD5: 'bg-purple-100 text-purple-700',
    IPv4: 'bg-blue-100 text-blue-700',
    IPv6: 'bg-blue-100 text-blue-700',
    Domain: 'bg-amber-100 text-amber-700',
    URL: 'bg-amber-100 text-amber-700',
    Email: 'bg-pink-100 text-pink-700',
    Filename: 'bg-green-100 text-green-700',
    Registry: 'bg-gray-100 text-gray-700',
  }
  return map[type] ?? 'bg-gray-100 text-gray-600'
}

function ScoreBadge({ score, status }: { score?: number | null; status?: string | null }) {
  if (status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-gray-400">
        <Clock size={11} /> Pending
      </span>
    )
  }
  if (status === 'failed') {
    return <span className="text-xs text-red-400">Error</span>
  }
  if (score == null) return <span className="text-xs text-gray-300">—</span>

  if (score === 0)
    return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-700">Clean</span>
  if (score <= 30)
    return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-700">{score}% risk</span>
  if (score <= 70)
    return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">{score}% risk</span>
  return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-700">{score}% malicious</span>
}

const EMPTY_FORM: CreateIOCPayload = {
  type: 'SHA256', value: '', description: '', category: 'Malware',
  severity: 'High', source: '', expires_at: null, is_active: true,
}

// ── Feed result card ──────────────────────────────────────────────────────────

function FeedResultCard({ result }: { result: FeedResult }) {
  const isVT  = result.source === 'VirusTotal'
  const isOTX = result.source === 'AlienVault OTX'

  if (result.error) {
    return (
      <div className="rounded-lg border border-red-100 bg-red-50 p-4">
        <div className="flex items-center gap-2 mb-1">
          <XCircle size={14} className="text-red-500" />
          <span className="text-sm font-medium text-red-700">{result.source}</span>
        </div>
        <p className="text-xs text-red-500">{result.error}</p>
      </div>
    )
  }

  if (result.status === 'not found' || (isOTX && result.pulse_count === 0)) {
    return (
      <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
        <div className="flex items-center gap-2 mb-1">
          <Shield size={14} className="text-gray-400" />
          <span className="text-sm font-medium text-gray-600">{result.source}</span>
        </div>
        <p className="text-xs text-gray-400">Not found in database</p>
      </div>
    )
  }

  // OTX result card
  if (isOTX) {
    return (
      <div className="rounded-lg border border-orange-100 bg-white p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe size={14} className="text-orange-500" />
            <span className="text-sm font-semibold text-gray-800">{result.source}</span>
          </div>
          <span className={`text-sm font-bold ${result.is_malicious ? 'text-red-600' : 'text-green-600'}`}>
            {result.is_malicious ? 'Malicious' : 'Clean'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <span className="text-gray-400">Threat pulses</span>
          <span className="text-gray-700 font-medium">{result.pulse_count ?? 0}</span>
        </div>

        {result.adversaries && result.adversaries.length > 0 && (
          <div>
            <p className="text-xs text-gray-400 mb-1">Adversaries</p>
            <div className="flex flex-wrap gap-1">
              {result.adversaries.map((a) => (
                <span key={a} className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full">{a}</span>
              ))}
            </div>
          </div>
        )}

        {result.malware_families && result.malware_families.length > 0 && (
          <div>
            <p className="text-xs text-gray-400 mb-1">Malware families</p>
            <div className="flex flex-wrap gap-1">
              {result.malware_families.map((m) => (
                <span key={m} className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full">{m}</span>
              ))}
            </div>
          </div>
        )}

        {result.pulses && result.pulses.length > 0 && (
          <div>
            <p className="text-xs text-gray-400 mb-1">Top pulses</p>
            <ul className="space-y-0.5">
              {result.pulses.map((p) => (
                <li key={p} className="text-xs text-gray-600 truncate">• {p}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    )
  }

  const score = isVT ? result.score_pct : result.confidence
  const scoreColor = score == null ? '' : score === 0 ? 'text-green-600' : score <= 30 ? 'text-green-600' : score <= 70 ? 'text-amber-600' : 'text-red-600'

  return (
    <div className="rounded-lg border border-gray-100 bg-white p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe size={14} className="text-blue-500" />
          <span className="text-sm font-semibold text-gray-800">{result.source}</span>
        </div>
        {score != null && (
          <span className={`text-lg font-bold ${scoreColor}`}>{score}%</span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        {isVT && result.malicious != null && (
          <>
            <span className="text-gray-400">Malicious engines</span>
            <span className="text-gray-700 font-medium">{result.malicious} / {result.total_engines}</span>
            {result.reputation != null && (
              <>
                <span className="text-gray-400">Reputation score</span>
                <span className="text-gray-700 font-medium">{result.reputation}</span>
              </>
            )}
          </>
        )}
        {!isVT && (
          <>
            {result.country && (
              <>
                <span className="text-gray-400">Country</span>
                <span className="text-gray-700 font-medium">{result.country}</span>
              </>
            )}
            {result.isp && (
              <>
                <span className="text-gray-400">ISP</span>
                <span className="text-gray-700 font-medium truncate">{result.isp}</span>
              </>
            )}
            {result.total_reports != null && (
              <>
                <span className="text-gray-400">Total reports</span>
                <span className="text-gray-700 font-medium">{result.total_reports}</span>
              </>
            )}
            {result.is_tor && (
              <>
                <span className="text-gray-400">TOR exit node</span>
                <span className="text-red-600 font-medium">Yes</span>
              </>
            )}
          </>
        )}
      </div>

      {isVT && result.tags && result.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {result.tags.map((t) => (
            <span key={t} className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full">{t}</span>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Feed config card ──────────────────────────────────────────────────────────

function FeedsTab({ canWrite }: { canWrite: boolean }) {
  const [config, setConfig] = useState<ThreatFeedConfig | null>(null)
  const [vtKey,  setVtKey]  = useState('')
  const [abKey,  setAbKey]  = useState('')
  const [otxKey, setOtxKey] = useState('')
  const [showVt,  setShowVt]  = useState(false)
  const [showAb,  setShowAb]  = useState(false)
  const [showOtx, setShowOtx] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [cfgError, setCfgError] = useState<string | null>(null)

  const [lookupType, setLookupType] = useState('IPv4')
  const [lookupValue, setLookupValue] = useState('')
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null)
  const [lookupError, setLookupError] = useState<string | null>(null)

  useEffect(() => {
    if (!canWrite) return
    fetchFeedConfig()
      .then((c) => {
        setConfig(c)
        setVtKey(c.virustotal_api_key ?? '')
        setAbKey(c.abuseipdb_api_key ?? '')
        setOtxKey(c.otx_api_key ?? '')
      })
      .catch(() => {})
  }, [canWrite])

  async function handleSave() {
    setSaving(true)
    setCfgError(null)
    try {
      const updated = await updateFeedConfig({
        virustotal_api_key: vtKey || null,
        abuseipdb_api_key: abKey || null,
        otx_api_key: otxKey || null,
      })
      setConfig(updated)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e: unknown) {
      setCfgError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleLookup() {
    if (!lookupValue.trim()) return
    setLookupLoading(true)
    setLookupResult(null)
    setLookupError(null)
    try {
      const r = await lookupIndicator(lookupType, lookupValue.trim())
      setLookupResult(r)
    } catch (e: unknown) {
      setLookupError(e instanceof Error ? e.message : 'Lookup failed')
    } finally {
      setLookupLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Status strip */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { name: 'VirusTotal',     active: config?.has_virustotal ?? false, desc: 'Hash, IP, domain & URL reputation' },
          { name: 'AbuseIPDB',      active: config?.has_abuseipdb  ?? false, desc: 'IP address abuse confidence scoring' },
          { name: 'AlienVault OTX', active: config?.has_otx         ?? false, desc: 'IP, domain, hash & URL threat pulse data' },
        ].map(({ name, active, desc }) => (
          <div key={name} className={`rounded-xl border p-4 flex items-center gap-3 ${
            active ? 'border-green-200 bg-green-50' : 'border-gray-100 bg-gray-50'
          }`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              active ? 'bg-green-100' : 'bg-gray-200'
            }`}>
              {active
                ? <CheckCircle size={16} className="text-green-600" />
                : <XCircle size={16} className="text-gray-400" />}
            </div>
            <div>
              <p className={`text-sm font-semibold ${active ? 'text-green-800' : 'text-gray-500'}`}>{name}</p>
              <p className="text-xs text-gray-400">{desc}</p>
            </div>
            <span className={`ml-auto text-xs font-medium px-2 py-0.5 rounded-full ${
              active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-400'
            }`}>
              {active ? 'Configured' : 'Not set'}
            </span>
          </div>
        ))}
      </div>

      {/* API key config */}
      {canWrite ? (
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Settings2 size={16} className="text-gray-500" />
            <h3 className="text-sm font-semibold text-gray-800">Feed API Keys</h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1.5">
                VirusTotal API Key
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type={showVt ? 'text' : 'password'}
                    value={vtKey}
                    onChange={(e) => setVtKey(e.target.value)}
                    placeholder="Enter your VirusTotal API key"
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowVt((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showVt ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-1">Free tier: 4 requests/min. Supports hashes, IPs, domains, URLs.</p>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1.5">
                AbuseIPDB API Key
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type={showAb ? 'text' : 'password'}
                    value={abKey}
                    onChange={(e) => setAbKey(e.target.value)}
                    placeholder="Enter your AbuseIPDB API key"
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAb((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showAb ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-1">Free tier: 1,000 checks/day. IPv4 and IPv6 only.</p>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1.5">
                AlienVault OTX API Key
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type={showOtx ? 'text' : 'password'}
                    value={otxKey}
                    onChange={(e) => setOtxKey(e.target.value)}
                    placeholder="Enter your OTX API key"
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowOtx((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showOtx ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-1">Free account at otx.alienvault.com. Supports hashes, IPs, domains, URLs.</p>
            </div>
          </div>

          {cfgError && (
            <p className="text-xs text-red-500 mt-3 flex items-center gap-1">
              <AlertTriangle size={12} /> {cfgError}
            </p>
          )}

          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : 'Save Keys'}
            </button>
            {saved && (
              <span className="text-xs text-green-600 flex items-center gap-1">
                <CheckCircle size={12} /> Saved
              </span>
            )}
          </div>
        </Card>
      ) : (
        <Card>
          <p className="text-sm text-gray-400 text-center py-4">Admin access required to configure feed API keys.</p>
        </Card>
      )}

      {/* Manual lookup */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Search size={16} className="text-gray-500" />
          <h3 className="text-sm font-semibold text-gray-800">Manual Indicator Lookup</h3>
        </div>

        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Type</label>
            <select
              value={lookupType}
              onChange={(e) => setLookupType(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {IOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[240px]">
            <label className="text-xs font-medium text-gray-600 block mb-1">Indicator value</label>
            <input
              type="text"
              value={lookupValue}
              onChange={(e) => setLookupValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
              placeholder="e.g. 8.8.8.8, malicious.com, abc123…hash"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={handleLookup}
            disabled={lookupLoading || !lookupValue.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {lookupLoading
              ? <><Loader2 size={14} className="animate-spin" /> Looking up…</>
              : <><Search size={14} /> Lookup</>}
          </button>
        </div>

        {lookupError && (
          <p className="text-sm text-red-500 mt-4 flex items-center gap-1">
            <AlertTriangle size={14} /> {lookupError}
          </p>
        )}

        {lookupResult && !lookupLoading && (
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-2">
              <Hash size={13} className="text-gray-400" />
              <span className="text-xs text-gray-500 font-mono truncate">{lookupValue}</span>
              {lookupResult.vt_score != null && (
                <ScoreBadge score={lookupResult.vt_score} status="done" />
              )}
            </div>
            {lookupResult.feeds.length === 0 ? (
              <p className="text-sm text-gray-400">No feeds configured or type not supported. Add API keys above.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {lookupResult.feeds.map((r, i) => (
                  <FeedResultCard key={i} result={r} />
                ))}
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ThreatIntelligence() {
  const user = useAuthStore((s) => s.user)
  const canWrite = user?.role === 'SuperAdmin' || user?.role === 'Admin'

  const [tab, setTab] = useState<'iocs' | 'feeds'>('iocs')

  const [iocs, setIocs] = useState<BackendIOC[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState<string>('All')
  const [search, setSearch] = useState('')
  const [activeOnly, setActiveOnly] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<CreateIOCPayload>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [enrichingId, setEnrichingId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchIOCs({
        ioc_type: typeFilter !== 'All' ? typeFilter : undefined,
        search: search || undefined,
        active_only: activeOnly || undefined,
      })
      setIocs(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load IOCs')
    } finally {
      setLoading(false)
    }
  }, [typeFilter, search, activeOnly])

  useEffect(() => { load() }, [load])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.value.trim()) { setFormError('Value is required'); return }
    setSubmitting(true)
    setFormError(null)
    try {
      const created = await createIOC(form)
      setIocs((prev) => [created, ...prev])
      setShowForm(false)
      setForm(EMPTY_FORM)
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Failed to create IOC')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: number) {
    setDeletingId(id)
    try {
      await deleteIOC(id)
      setIocs((prev) => prev.filter((i) => i.id !== id))
    } catch {
      // keep state
    } finally {
      setDeletingId(null)
    }
  }

  async function handleEnrich(ioc: BackendIOC) {
    setEnrichingId(ioc.id)
    try {
      await enrichIOC(ioc.id)
      setIocs((prev) =>
        prev.map((i) => i.id === ioc.id ? { ...i, enrichment_status: 'pending' } : i)
      )
      // Poll for result after 4s
      setTimeout(async () => {
        try {
          const refreshed = await fetchIOCs({})
          setIocs(refreshed)
        } catch { /* ignore */ }
      }, 4000)
    } catch { /* ignore */ } finally {
      setEnrichingId(null)
    }
  }

  const activeCount = iocs.filter((i) => i.is_active).length

  return (
    <div className="pb-8">
      <Topbar
        title="Threat Intelligence"
        subtitle={`${iocs.length} indicators · ${activeCount} active`}
        onRefresh={tab === 'iocs' ? load : undefined}
      />

      <div className="px-4 sm:px-6 lg:px-8 space-y-4">
        {/* Tab switcher */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
          {(['iocs', 'feeds'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                tab === t
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === 'iocs' ? 'Indicators (IOCs)' : 'External Feeds'}
            </button>
          ))}
        </div>

        {tab === 'feeds' ? (
          <FeedsTab canWrite={canWrite} />
        ) : (
          <>
            {/* Summary by type */}
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
              {[
                { label: 'Hash (SHA256/MD5)', types: ['SHA256', 'MD5'], color: 'bg-purple-50 border-purple-200 text-purple-700' },
                { label: 'IP Address', types: ['IPv4', 'IPv6'], color: 'bg-blue-50 border-blue-200 text-blue-700' },
                { label: 'Domain/URL', types: ['Domain', 'URL'], color: 'bg-amber-50 border-amber-200 text-amber-700' },
                { label: 'Email', types: ['Email'], color: 'bg-pink-50 border-pink-200 text-pink-700' },
                { label: 'File/Registry', types: ['Filename', 'Registry'], color: 'bg-green-50 border-green-200 text-green-700' },
              ].map(({ label, types, color }) => (
                <div key={label} className={`rounded-lg border p-3 ${color}`}>
                  <p className="text-xl font-bold">
                    {iocs.filter((i) => types.includes(i.type)).length}
                  </p>
                  <p className="text-xs mt-0.5 opacity-80">{label}</p>
                </div>
              ))}
            </div>

            {/* Controls */}
            <div className="flex flex-wrap gap-3 items-center">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="All">All Types</option>
                {IOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>

              <input
                type="text"
                placeholder="Search value or description…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 w-56 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={activeOnly}
                  onChange={(e) => setActiveOnly(e.target.checked)}
                  className="rounded"
                />
                Active only
              </label>

              <span className="text-sm text-gray-400">{iocs.length} results</span>

              {canWrite && (
                <button
                  onClick={() => setShowForm(true)}
                  className="ml-auto inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus size={15} />
                  Add IOC
                </button>
              )}
            </div>

            {/* Add IOC modal */}
            {showForm && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-900">Add Indicator of Compromise</h3>
                    <button onClick={() => { setShowForm(false); setFormError(null) }} className="text-gray-400 hover:text-gray-600">
                      <X size={18} />
                    </button>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-gray-600 block mb-1">Type</label>
                        <select
                          value={form.type}
                          onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {IOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-600 block mb-1">Severity</label>
                        <select
                          value={form.severity}
                          onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value as BackendSeverity }))}
                          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-gray-600 block mb-1">Value *</label>
                      <input
                        type="text"
                        value={form.value}
                        onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                        placeholder="e.g. abc123...hash, 1.2.3.4, malicious.com"
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-medium text-gray-600 block mb-1">Description</label>
                      <input
                        type="text"
                        value={form.description}
                        onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                        placeholder="Brief description of the threat"
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-gray-600 block mb-1">Category</label>
                        <input
                          type="text"
                          value={form.category}
                          onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                          placeholder="Malware, Phishing, C2…"
                          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-600 block mb-1">Source</label>
                        <input
                          type="text"
                          value={form.source}
                          onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
                          placeholder="VirusTotal, manual…"
                          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="is_active"
                        checked={form.is_active}
                        onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                        className="rounded"
                      />
                      <label htmlFor="is_active" className="text-sm text-gray-600">Active (matched against telemetry)</label>
                    </div>

                    {formError && (
                      <p className="text-sm text-red-500 flex items-center gap-1">
                        <AlertTriangle size={14} /> {formError}
                      </p>
                    )}

                    <div className="flex gap-3 pt-1">
                      <button
                        type="button"
                        onClick={() => { setShowForm(false); setFormError(null) }}
                        className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={submitting}
                        className="flex-1 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                      >
                        {submitting ? 'Adding…' : 'Add IOC'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* IOC Table */}
            <Card>
              {loading ? (
                <div className="flex items-center justify-center py-16 gap-2 text-gray-400">
                  <RefreshCw size={16} className="animate-spin" />
                  <span className="text-sm">Loading indicators…</span>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center py-16 gap-2 text-red-500">
                  <AlertTriangle size={20} />
                  <p className="text-sm">{error}</p>
                  <button onClick={load} className="text-xs underline mt-1">Retry</button>
                </div>
              ) : iocs.length === 0 ? (
                <div className="py-16 text-center">
                  <Shield size={32} className="mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-400 text-sm">No indicators found. Add your first IOC.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                        <th className="font-medium py-2 pr-4">Type</th>
                        <th className="font-medium py-2 pr-4">Value</th>
                        <th className="font-medium py-2 pr-4">Severity</th>
                        <th className="font-medium py-2 pr-4">Category</th>
                        <th className="font-medium py-2 pr-4">Source</th>
                        <th className="font-medium py-2 pr-4">VT Score</th>
                        <th className="font-medium py-2 pr-4">Status</th>
                        <th className="font-medium py-2 pr-4">Added By</th>
                        {canWrite && <th className="font-medium py-2">Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {iocs.map((ioc) => (
                        <tr key={ioc.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
                          <td className="py-3 pr-4">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded ${typeColor(ioc.type)}`}>
                              {ioc.type}
                            </span>
                          </td>
                          <td className="py-3 pr-4 max-w-[180px]">
                            <p className="font-mono text-xs text-gray-800 truncate" title={ioc.value}>
                              {ioc.value}
                            </p>
                            {ioc.description && (
                              <p className="text-xs text-gray-400 truncate">{ioc.description}</p>
                            )}
                          </td>
                          <td className="py-3 pr-4">
                            <Badge severity={ioc.severity as Severity} />
                          </td>
                          <td className="py-3 pr-4 text-gray-500 text-xs">{ioc.category || '—'}</td>
                          <td className="py-3 pr-4 text-gray-500 text-xs">{ioc.source || '—'}</td>
                          <td className="py-3 pr-4">
                            <ScoreBadge score={ioc.vt_score} status={ioc.enrichment_status} />
                          </td>
                          <td className="py-3 pr-4">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                              ioc.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-400'
                            }`}>
                              {ioc.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="py-3 pr-4 text-gray-400 text-xs">{ioc.created_by || '—'}</td>
                          {canWrite && (
                            <td className="py-3">
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleEnrich(ioc)}
                                  disabled={enrichingId === ioc.id || ioc.enrichment_status === 'pending'}
                                  title="Re-enrich via external feeds"
                                  className="inline-flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg text-blue-500 hover:bg-blue-50 disabled:opacity-40 transition-colors"
                                >
                                  {enrichingId === ioc.id
                                    ? <Loader2 size={12} className="animate-spin" />
                                    : <Zap size={12} />}
                                </button>
                                <button
                                  onClick={() => handleDelete(ioc.id)}
                                  disabled={deletingId === ioc.id}
                                  className="inline-flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg text-red-500 hover:bg-red-50 disabled:opacity-40 transition-colors"
                                >
                                  <Trash2 size={12} />
                                  {deletingId === ioc.id ? '…' : ''}
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </>
        )}
      </div>
    </div>
  )
}
