import { useEffect, useState, useCallback } from 'react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts'
import {
  Shield, AlertTriangle, Activity, Monitor, Zap, Clock,
  RefreshCw, Download, FileJson, CheckCircle2,
} from 'lucide-react'
import Topbar from '@/components/layout/Topbar/Topbar'
import Card from '@/components/ui/Card/Card'
import { fetchReportSummary } from '@/api/reportsApi'
import type { ReportSummary } from '@/types/api.types'

// ── Compliance framework data ─────────────────────────────────────────────────
// Coverage is based on which detection categories NetcradXDR actively monitors.

const FRAMEWORKS = [
  {
    name: 'NIST CSF',
    controls: [
      { area: 'Identify (ID)',   covered: true,  note: 'Asset inventory via agent registration' },
      { area: 'Protect (PR)',    covered: true,  note: 'Firewall rules via SOAR block-IP / isolate' },
      { area: 'Detect (DE)',     covered: true,  note: 'Real-time process, network & file monitoring' },
      { area: 'Respond (RS)',    covered: true,  note: 'Automated SOAR playbooks' },
      { area: 'Recover (RC)',    covered: false, note: 'Backup & recovery not yet implemented' },
    ],
  },
  {
    name: 'ISO 27001',
    controls: [
      { area: 'A.8 Asset Management',          covered: true,  note: 'Agent-based endpoint inventory' },
      { area: 'A.12 Operations Security',      covered: true,  note: 'Process & persistence monitoring' },
      { area: 'A.13 Communications Security',  covered: true,  note: 'Network telemetry collection' },
      { area: 'A.16 Incident Management',      covered: true,  note: 'Incident correlation & SOAR' },
      { area: 'A.18 Compliance',               covered: false, note: 'Formal audit trail in progress' },
    ],
  },
  {
    name: 'PCI DSS v4',
    controls: [
      { area: 'Req 5 — Malware Protection',     covered: true,  note: 'File & process anomaly detection' },
      { area: 'Req 6 — Secure Systems',         covered: true,  note: 'Vulnerability monitoring via alerts' },
      { area: 'Req 10 — Logging & Monitoring',  covered: true,  note: 'Audit log + alert history' },
      { area: 'Req 11 — Security Testing',      covered: false, note: 'Pen-test module not yet active' },
      { area: 'Req 12 — Security Policies',     covered: false, note: 'Policy engine not yet implemented' },
    ],
  },
  {
    name: 'HIPAA',
    controls: [
      { area: '§164.308 — Admin Safeguards',   covered: true,  note: 'RBAC + audit logging' },
      { area: '§164.312 — Technical Safeguards', covered: true, note: 'Endpoint monitoring + isolation' },
      { area: '§164.314 — Org Requirements',   covered: false, note: 'BAA workflows not implemented' },
      { area: '§164.316 — Policies',           covered: false, note: 'Policy documentation module pending' },
    ],
  },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'compliance' | 'export'

const SEV_COLOUR: Record<string, string> = {
  Critical: '#7C3AED',
  High:     '#DC2626',
  Medium:   '#D97706',
  Low:      '#2563EB',
  Informational: '#6B7280',
}

function StatCard({
  label, value, sub, Icon, colour,
}: { label: string; value: string | number; sub?: string; Icon: React.ElementType; colour: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
      <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${colour}`}>
        <Icon size={20} />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-xs text-gray-500">{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

// ── Download helpers ──────────────────────────────────────────────────────────

function downloadCSV(data: ReportSummary) {
  const rows: string[][] = [
    ['NetcradXDR Security Report', '', ''],
    ['Generated', new Date().toISOString(), ''],
    ['Period', 'Last 30 days', ''],
    ['', '', ''],
    ['SUMMARY', '', ''],
    ['Metric', 'Value', ''],
    ['Total Alerts', String(data.alerts.total), ''],
    ['Open Alerts', String(data.alerts.open), ''],
    ['Resolved Alerts', String(data.alerts.resolved), ''],
    ['Total Incidents', String(data.incidents.total), ''],
    ['Resolved Incidents', String(data.incidents.resolved), ''],
    ['MTTR (hours)', data.incidents.mttr_hours != null ? String(data.incidents.mttr_hours) : '—', ''],
    ['Total Endpoints', String(data.agents.total), ''],
    ['Online Endpoints', String(data.agents.online), ''],
    ['SOAR Actions', String(data.commands.total), ''],
    ['SOAR Completed', String(data.commands.completed), ''],
    ['', '', ''],
    ['ALERTS BY SEVERITY', '', ''],
    ['Severity', 'Count', ''],
    ...Object.entries(data.alerts.by_severity).map(([k, v]) => [k, String(v), '']),
    ['', '', ''],
    ['TOP MITRE TECHNIQUES', '', ''],
    ['Technique', 'Count', ''],
    ...data.top_mitre.slice(0, 10).map((m) => [m.technique, String(m.count), '']),
    ['', '', ''],
    ['30-DAY ALERT TREND', '', ''],
    ['Date', 'Alert Count', ''],
    ...data.trend_30d.map((d) => [d.date, String(d.count), '']),
  ]
  const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `netcradxdr-report-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function downloadJSON(data: ReportSummary) {
  const report = { generated_at: new Date().toISOString(), period: 'Last 30 days', ...data }
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `netcradxdr-report-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Overview tab ──────────────────────────────────────────────────────────────

function OverviewTab({ data }: { data: ReportSummary }) {
  const { alerts, incidents, agents, commands, trend_30d, top_mitre } = data

  const mttr = incidents.mttr_hours != null
    ? incidents.mttr_hours < 1
      ? `${Math.round(incidents.mttr_hours * 60)}m`
      : `${incidents.mttr_hours}h`
    : '—'

  const sevData = Object.entries(alerts.by_severity)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({ name: k, count: v, fill: SEV_COLOUR[k] ?? '#6B7280' }))

  const mitreData = top_mitre.slice(0, 8).map((m) => ({
    name: m.technique.length > 14 ? m.technique.slice(0, 14) + '…' : m.technique,
    full: m.technique,
    count: m.count,
  }))

  return (
    <div className="space-y-4">
      {/* Download bar */}
      <div className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
        <div className="flex items-center gap-2">
          <Download size={15} className="text-blue-600" />
          <span className="text-sm font-medium text-blue-800">Download this report</span>
          <span className="text-xs text-blue-500">· Last 30 days · {new Date().toLocaleDateString()}</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => downloadCSV(data)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-white border border-blue-200 text-blue-700 hover:bg-blue-50 transition-colors"
          >
            <Download size={12} /> CSV
          </button>
          <button
            onClick={() => downloadJSON(data)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-white border border-blue-200 text-blue-700 hover:bg-blue-50 transition-colors"
          >
            <FileJson size={12} /> JSON
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            <Download size={12} /> PDF
          </button>
        </div>
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Alerts" value={alerts.total}
          sub={`${alerts.open} open · ${alerts.resolved} resolved`}
          Icon={AlertTriangle} colour="bg-red-50 text-red-600" />
        <StatCard label="Incidents" value={incidents.total}
          sub={`MTTR ${mttr}`}
          Icon={Activity} colour="bg-amber-50 text-amber-600" />
        <StatCard label="Endpoints" value={agents.total}
          sub={`${agents.online} online`}
          Icon={Monitor} colour="bg-blue-50 text-blue-600" />
        <StatCard label="SOAR Actions" value={commands.total}
          sub={`${commands.completed} completed`}
          Icon={Zap} colour="bg-purple-50 text-purple-600" />
      </div>

      {/* 30-day trend */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Activity size={15} className="text-blue-600" />
          <h3 className="text-sm font-semibold text-gray-800">Alert Volume — Last 30 Days</h3>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={trend_30d} margin={{ top: 0, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="alertGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#3B82F6" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
            <XAxis dataKey="date" tickFormatter={formatDate}
              tick={{ fontSize: 10, fill: '#9CA3AF' }} interval={4} />
            <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} allowDecimals={false} />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E5E7EB' }}
              formatter={(v: number) => [v, 'Alerts']}
              labelFormatter={(l: string) => new Date(l).toLocaleDateString()}
            />
            <Area type="monotone" dataKey="count" stroke="#3B82F6"
              strokeWidth={2} fill="url(#alertGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Severity distribution */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Shield size={15} className="text-gray-500" />
            <h3 className="text-sm font-semibold text-gray-800">Severity Distribution</h3>
          </div>
          {sevData.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">No alerts yet</p>
          ) : (
            <div className="space-y-2.5">
              {sevData.map((s) => (
                <div key={s.name}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-600">{s.name}</span>
                    <span className="font-medium text-gray-800">{s.count}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.round((s.count / alerts.total) * 100)}%`,
                        backgroundColor: s.fill,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Top MITRE techniques */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={15} className="text-gray-500" />
            <h3 className="text-sm font-semibold text-gray-800">Top MITRE Techniques</h3>
          </div>
          {mitreData.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">No MITRE data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={mitreData} layout="vertical"
                margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                <XAxis type="number" tick={{ fontSize: 10, fill: '#9CA3AF' }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={90}
                  tick={{ fontSize: 10, fill: '#6B7280' }} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E5E7EB' }}
                  formatter={(v: number, _: string, p: { payload: typeof mitreData[0] }) =>
                    [v, p.payload.full]}
                />
                <Bar dataKey="count" fill="#3B82F6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* MTTR & incident resolution */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Clock size={15} className="text-gray-500" />
          <h3 className="text-sm font-semibold text-gray-800">Incident Resolution</h3>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total Incidents',    value: incidents.total },
            { label: 'Resolved',           value: incidents.resolved },
            { label: 'Mean Time to Resolve', value: mttr },
          ].map(({ label, value }) => (
            <div key={label} className="text-center p-4 bg-gray-50 rounded-xl">
              <p className="text-2xl font-bold text-gray-900">{value}</p>
              <p className="text-xs text-gray-500 mt-1">{label}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

// ── Compliance tab ────────────────────────────────────────────────────────────

function ComplianceTab() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Coverage is derived from NetcradXDR's active monitoring capabilities. Green = monitored and covered. Gray = capability gap.
      </p>
      {FRAMEWORKS.map((fw) => {
        const covered = fw.controls.filter((c) => c.covered).length
        const pct = Math.round((covered / fw.controls.length) * 100)
        return (
          <Card key={fw.name}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">{fw.name}</h3>
              <div className="flex items-center gap-3">
                <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-green-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className={`text-sm font-semibold ${pct >= 70 ? 'text-green-600' : pct >= 40 ? 'text-amber-600' : 'text-red-500'}`}>
                  {pct}%
                </span>
              </div>
            </div>
            <div className="divide-y divide-gray-50">
              {fw.controls.map((ctrl) => (
                <div key={ctrl.area} className="flex items-start gap-3 py-2.5">
                  <div className={`mt-0.5 h-4 w-4 rounded-full flex items-center justify-center shrink-0 ${
                    ctrl.covered ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
                  }`}>
                    <CheckCircle2 size={11} />
                  </div>
                  <div>
                    <p className={`text-sm font-medium ${ctrl.covered ? 'text-gray-900' : 'text-gray-400'}`}>
                      {ctrl.area}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{ctrl.note}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )
      })}
    </div>
  )
}

// ── Export tab ────────────────────────────────────────────────────────────────

function ExportTab({ data }: { data: ReportSummary }) {
  return (
    <div className="space-y-4 max-w-lg">
      <Card>
        <div className="flex items-center gap-3 mb-5">
          <div className="h-10 w-10 rounded-xl bg-green-50 flex items-center justify-center">
            <Download size={20} className="text-green-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">CSV Export</h3>
            <p className="text-xs text-gray-400">Spreadsheet-ready summary — open in Excel or Google Sheets</p>
          </div>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Downloads a CSV with all key metrics: alert counts by severity, incident MTTR, endpoint stats, SOAR action summary, top MITRE techniques, and the 30-day alert trend.
        </p>
        <button
          onClick={() => downloadCSV(data)}
          className="flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors"
        >
          <Download size={15} /> Download CSV Report
        </button>
      </Card>

      <Card>
        <div className="flex items-center gap-3 mb-5">
          <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center">
            <FileJson size={20} className="text-blue-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">JSON Export</h3>
            <p className="text-xs text-gray-400">Full machine-readable security report</p>
          </div>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Downloads a structured JSON file with all metrics — suitable for importing into external dashboards or SIEM tools.
        </p>
        <button
          onClick={() => downloadJSON(data)}
          className="flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-lg bg-gray-900 text-white hover:bg-gray-700 transition-colors"
        >
          <Download size={15} /> Download JSON Report
        </button>
      </Card>

      <Card>
        <div className="flex items-center gap-3 mb-5">
          <div className="h-10 w-10 rounded-xl bg-gray-50 flex items-center justify-center">
            <FileJson size={20} className="text-gray-500" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Print / Save as PDF</h3>
            <p className="text-xs text-gray-400">Use browser print dialog</p>
          </div>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Use your browser's print function (Ctrl+P / ⌘P) and choose "Save as PDF" for a printable compliance report.
        </p>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <Download size={15} /> Print / Save PDF
        </button>
      </Card>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview',    label: 'Overview'   },
  { id: 'compliance',  label: 'Compliance' },
  { id: 'export',      label: 'Export'     },
]

export default function Reports() {
  const [tab, setTab]       = useState<Tab>('overview')
  const [data, setData]     = useState<ReportSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try { setData(await fetchReportSummary()) }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed to load report') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div className="pb-8">
      <Topbar title="Reports & Compliance" subtitle="Security posture, compliance coverage, and export"
        onRefresh={load} />

      <div className="px-4 sm:px-6 lg:px-8 space-y-4">
        {/* Tab bar */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
          {TABS.map(({ id, label }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`text-sm font-medium px-5 py-2 rounded-lg transition-colors ${
                tab === id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-32 gap-2 text-gray-400">
            <RefreshCw size={16} className="animate-spin" />
            <span className="text-sm">Generating report…</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-32 gap-2 text-red-500">
            <AlertTriangle size={20} />
            <p className="text-sm">{error}</p>
          </div>
        ) : data ? (
          <>
            {tab === 'overview'   && <OverviewTab data={data} />}
            {tab === 'compliance' && <ComplianceTab />}
            {tab === 'export'     && <ExportTab data={data} />}
          </>
        ) : null}
      </div>
    </div>
  )
}
