import { useEffect, useState } from 'react'
import { fetchDashboardData } from '@/api/dashboardApi'
import type {
  AlertTrendPoint,
  RecentAlert,
  RiskyEndpoint,
  SeverityBreakdown,
  StatCardData,
  ThreatItem,
} from '@/types/dashboard.types'

interface DashboardData {
  statCards: StatCardData[]
  alertsOverTime: AlertTrendPoint[]
  severityBreakdown: SeverityBreakdown[]
  recentAlerts: RecentAlert[]
  riskyEndpoints: RiskyEndpoint[]
  topThreats: ThreatItem[]
}

export function useDashboardData() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchDashboardData().then((result) => {
      if (!cancelled) {
        setData(result)
        setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [refreshKey])

  const refresh = () => setRefreshKey((k) => k + 1)

  return { data, loading, refresh }
}
