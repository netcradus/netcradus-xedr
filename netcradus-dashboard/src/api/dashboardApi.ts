import type {
  AlertTrendPoint,
  RecentAlert,
  RiskyEndpoint,
  SeverityBreakdown,
  StatCardData,
  ThreatItem,
} from '@/types/dashboard.types'

export const statCards: StatCardData[] = [
  {
    id: 'total-endpoints',
    label: 'Total Endpoints',
    value: '1,256',
    trendValue: '4.3%',
    trendDirection: 'up',
    trendPositive: true,
    comparisonLabel: 'vs May 13 – May 19',
    icon: 'shield',
  },
  {
    id: 'active-alerts',
    label: 'Active Alerts',
    value: '12',
    trendValue: '33.3%',
    trendDirection: 'up',
    trendPositive: false,
    comparisonLabel: 'vs May 13 – May 19',
    icon: 'alert',
  },
  {
    id: 'open-incidents',
    label: 'Open Incidents',
    value: '5',
    trendValue: '25%',
    trendDirection: 'up',
    trendPositive: false,
    comparisonLabel: 'vs May 13 – May 19',
    icon: 'target',
  },
  {
    id: 'endpoints-protected',
    label: 'Endpoints Protected',
    value: '98.7%',
    trendValue: '1.2%',
    trendDirection: 'up',
    trendPositive: true,
    comparisonLabel: 'vs May 13 – May 19',
    icon: 'monitor',
  },
]

export const alertsOverTime: AlertTrendPoint[] = [
  { date: 'May 20', count: 14 },
  { date: 'May 21', count: 22 },
  { date: 'May 22', count: 12 },
  { date: 'May 23', count: 9 },
  { date: 'May 24', count: 24 },
  { date: 'May 25', count: 33 },
  { date: 'May 26', count: 18 },
]

export const severityBreakdown: SeverityBreakdown[] = [
  { severity: 'High', count: 5, percent: 41.7 },
  { severity: 'Medium', count: 4, percent: 33.3 },
  { severity: 'Low', count: 2, percent: 16.7 },
  { severity: 'Informational', count: 1, percent: 8.3 },
]

export const recentAlerts: RecentAlert[] = [
  {
    id: '1',
    title: 'Suspicious PowerShell Execution',
    description: 'Potential credential access via PowerShell',
    endpoint: 'FIN-WIN-0123',
    severity: 'High',
    time: '10m ago',
    icon: 'shield-alert',
  },
  {
    id: '2',
    title: 'Malicious File Detected',
    description: 'Trojan.Win32.Agent detected',
    endpoint: 'ENG-MAC-0456',
    severity: 'High',
    time: '30m ago',
    icon: 'shield-alert',
  },
  {
    id: '3',
    title: 'Registry Persistence Attempt',
    description: 'Suspicious registry key modification',
    endpoint: 'HR-WIN-0078',
    severity: 'Medium',
    time: '1h ago',
    icon: 'grid',
  },
  {
    id: '4',
    title: 'Suspicious Network Connection',
    description: 'Connection to known malicious IP',
    endpoint: 'SALES-LAP-0032',
    severity: 'Medium',
    time: '2h ago',
    icon: 'globe',
  },
  {
    id: '5',
    title: 'Unauthorized Process Execution',
    description: 'Process executed from temp directory',
    endpoint: 'ENG-WIN-0211',
    severity: 'Low',
    time: '3h ago',
    icon: 'flag',
  },
]

export const riskyEndpoints: RiskyEndpoint[] = [
  { id: '1', name: 'FIN-WIN-0123', severity: 'High', riskScore: 90 },
  { id: '2', name: 'ENG-MAC-0456', severity: 'High', riskScore: 87 },
  { id: '3', name: 'HR-WIN-0078', severity: 'Medium', riskScore: 65 },
  { id: '4', name: 'SALES-LAP-0032', severity: 'Medium', riskScore: 61 },
  { id: '5', name: 'ENG-WIN-0211', severity: 'Low', riskScore: 34 },
]

export const topThreats: ThreatItem[] = [
  { id: '1', name: 'Lumma Stealer', percent: 32 },
  { id: '2', name: 'AsyncRAT', percent: 18 },
  { id: '3', name: 'Agent Tesla', percent: 14 },
  { id: '4', name: 'Remcos RAT', percent: 9 },
  { id: '5', name: 'Others', percent: 27 },
]

export const mapHotspots = [
  { id: '1', x: 18, y: 38, intensity: 0.8 },
  { id: '2', x: 48, y: 42, intensity: 0.5 },
  { id: '3', x: 78, y: 30, intensity: 0.9 },
  { id: '4', x: 80, y: 70, intensity: 0.4 },
]

// Simulated API call — swap with real fetch/axios call later.
export async function fetchDashboardData() {
  await new Promise((resolve) => setTimeout(resolve, 400))
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
