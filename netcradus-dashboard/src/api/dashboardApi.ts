import { fetchAlerts, fetchAlertStats } from '@/api/alertsApi'
import { fetchAgents } from '@/api/agentsApi'
import type {
  AlertTrendPoint,
  RecentAlert,
  RiskyEndpoint,
  SeverityBreakdown,
  StatCardData,
  ThreatItem,
} from '@/types/dashboard.types'
import type { BackendAlert, BackendAgent } from '@/types/api.types'

export const mapHotspots = [
  { id: '1', x: 18, y: 38, intensity: 0.8 },
  { id: '2', x: 48, y: 42, intensity: 0.5 },
  { id: '3', x: 78, y: 30, intensity: 0.9 },
  { id: '4', x: 80, y: 70, intensity: 0.4 },
]

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function severityToIcon(severity: string): string {
  if (severity === 'Critical' || severity === 'High') return 'shield-alert'
  if (severity === 'Medium') return 'globe'
  return 'flag'
}

function buildAlertsOverTime(alerts: BackendAlert[]): AlertTrendPoint[] {
  const buckets: Record<string, number> = {}
  const now = new Date()
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    buckets[label] = 0
  }
  for (const a of alerts) {
    const d = new Date(a.timestamp)
    const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    if (label in buckets) buckets[label]++
  }
  return Object.entries(buckets).map(([date, count]) => ({ date, count }))
}

function buildRiskyEndpoints(alerts: BackendAlert[], agents: BackendAgent[]): RiskyEndpoint[] {
  const agentMap = new Map(agents.map((a) => [a.id, a]))
  const counts: Record<number, { count: number; severity: string }> = {}

  for (const a of alerts) {
    if (a.status !== 'Open') continue
    if (!counts[a.agent_id]) counts[a.agent_id] = { count: 0, severity: 'Low' }
    counts[a.agent_id].count++
    const sev = a.severity
    const cur = counts[a.agent_id].severity
    const order = ['Critical', 'High', 'Medium', 'Low', 'Informational']
    if (order.indexOf(sev) < order.indexOf(cur)) counts[a.agent_id].severity = sev
  }

  return Object.entries(counts)
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 5)
    .map(([agentId, { count, severity }]) => {
      const agent = agentMap.get(Number(agentId))
      return {
        id: agentId,
        name: agent?.hostname ?? `Agent #${agentId}`,
        severity: severity as RiskyEndpoint['severity'],
        riskScore: Math.min(100, count * 10),
      }
    })
}

export async function fetchDashboardData() {
  const [stats, alerts, agents] = await Promise.all([
    fetchAlertStats(),
    fetchAlerts(),
    fetchAgents(),
  ])

  const onlineCount = agents.filter((a) => a.status === 'Online').length
  const totalAgents = agents.length

  const statCards: StatCardData[] = [
    {
      id: 'total-endpoints',
      label: 'Total Endpoints',
      value: String(totalAgents),
      trendValue: `${onlineCount} online`,
      trendDirection: 'up',
      trendPositive: true,
      comparisonLabel: 'registered agents',
      icon: 'shield',
    },
    {
      id: 'active-alerts',
      label: 'Active Alerts',
      value: String(stats.open),
      trendValue: String(stats.critical + stats.high),
      trendDirection: stats.open > 0 ? 'up' : 'down',
      trendPositive: false,
      comparisonLabel: 'critical/high severity',
      icon: 'alert',
    },
    {
      id: 'critical-alerts',
      label: 'Critical Alerts',
      value: String(stats.critical),
      trendValue: String(stats.high),
      trendDirection: stats.critical > 0 ? 'up' : 'down',
      trendPositive: false,
      comparisonLabel: 'high severity alongside',
      icon: 'target',
    },
    {
      id: 'resolved',
      label: 'Resolved',
      value: String(stats.resolved),
      trendValue: stats.open + stats.resolved > 0
        ? `${Math.round((stats.resolved / (stats.open + stats.resolved)) * 100)}%`
        : '0%',
      trendDirection: 'up',
      trendPositive: true,
      comparisonLabel: 'resolution rate',
      icon: 'monitor',
    },
  ]

  const severityBreakdown: SeverityBreakdown[] = (() => {
    const total = stats.critical + stats.high + stats.medium + stats.low
    if (total === 0) return []
    return [
      { severity: 'Critical' as SeverityBreakdown['severity'], count: stats.critical, percent: Math.round((stats.critical / total) * 100) },
      { severity: 'High', count: stats.high, percent: Math.round((stats.high / total) * 100) },
      { severity: 'Medium', count: stats.medium, percent: Math.round((stats.medium / total) * 100) },
      { severity: 'Low', count: stats.low, percent: Math.round((stats.low / total) * 100) },
    ].filter((s) => s.count > 0)
  })()

  const agentMap = new Map(agents.map((a) => [a.id, a]))
  const recentAlerts: RecentAlert[] = [...alerts]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 5)
    .map((a) => ({
      id: String(a.id),
      title: a.title,
      description: a.description,
      endpoint: agentMap.get(a.agent_id)?.hostname ?? `Agent #${a.agent_id}`,
      severity: a.severity as RecentAlert['severity'],
      time: formatRelativeTime(a.timestamp),
      icon: severityToIcon(a.severity),
    }))

  const alertsOverTime: AlertTrendPoint[] = buildAlertsOverTime(alerts)
  const riskyEndpoints: RiskyEndpoint[] = buildRiskyEndpoints(alerts, agents)

  const topThreats: ThreatItem[] = [
    { id: '1', name: 'Encoded PowerShell', percent: 0 },
    { id: '2', name: 'LSASS Dump', percent: 0 },
    { id: '3', name: 'Reverse Shell', percent: 0 },
    { id: '4', name: 'Registry Persist', percent: 0 },
    { id: '5', name: 'File IOC Match', percent: 0 },
  ]

  return {
    statCards,
    alertsOverTime,
    severityBreakdown,
    recentAlerts,
    riskyEndpoints,
    topThreats,
    mapHotspots,
  }
}
