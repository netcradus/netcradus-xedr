export type Severity = 'High' | 'Medium' | 'Low' | 'Informational'

export interface StatCardData {
  id: string
  label: string
  value: string
  trendValue: string
  trendDirection: 'up' | 'down'
  trendPositive: boolean
  comparisonLabel: string
  icon: string
}

export interface AlertTrendPoint {
  date: string
  count: number
}

export interface SeverityBreakdown {
  severity: Severity
  count: number
  percent: number
}

export interface RecentAlert {
  id: string
  title: string
  description: string
  endpoint: string
  severity: Severity
  time: string
  icon: string
}

export interface RiskyEndpoint {
  id: string
  name: string
  severity: Severity
  riskScore: number
}

export interface ThreatItem {
  id: string
  name: string
  percent: number
}

export interface MapHotspot {
  id: string
  x: number
  y: number
  intensity: number
}
