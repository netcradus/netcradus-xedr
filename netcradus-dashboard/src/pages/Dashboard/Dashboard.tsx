// import Topbar from '@/components/layout/Topbar/Topbar'
// import StatCardGrid from '@/components/stats/StatCardGrid'
// import AlertsOverTimeChart from '@/components/charts/AlertsOverTimeChart'
// import AlertsBySeverityChart from '@/components/charts/AlertsBySeverityChart'
// import ThreatLandscapeMap from '@/components/charts/ThreatLandscapeMap'
// import RecentAlertsTable from '@/components/tables/RecentAlertsTable'
// import TopEndpointsAtRiskList from '@/components/tables/TopEndpointsAtRiskList'
// import StatusBanner from '@/components/status/StatusBanner'
// import { useDashboardData } from '@/hooks/useDashboardData'
// import { mapHotspots } from '@/api/dashboardApi'

// export default function Dashboard() {
//   const { data, loading, refresh } = useDashboardData()

//   if (loading || !data) {
//     return (
//       <div className="p-8 text-gray-400 text-sm">Loading dashboard…</div>
//     )
//   }

//   return (
//     <div className="pb-8">
//       <Topbar title="Dashboard" subtitle="Hybrid SIEM + SOAR overview — detection, response & exposure" onRefresh={refresh} />

//       <div className="px-4 sm:px-6 lg:px-8 space-y-6">
//         <StatCardGrid items={data.statCards} />

//         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
//           <div className="lg:col-span-1">
//             <AlertsOverTimeChart data={data.alertsOverTime} />
//           </div>
//           <div className="lg:col-span-1">
//             <AlertsBySeverityChart data={data.severityBreakdown} />
//           </div>
//           <div className="md:col-span-2 lg:col-span-1">
//             <TopEndpointsAtRiskList endpoints={data.riskyEndpoints} />
//           </div>
//         </div>

//         <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
//           <div className="lg:col-span-3">
//             <RecentAlertsTable alerts={data.recentAlerts} />
//           </div>
//           <div className="lg:col-span-2">
//             <ThreatLandscapeMap threats={data.topThreats} hotspots={mapHotspots} />
//           </div>
//         </div>

//         <StatusBanner />
//       </div>
//     </div>
//   )
// }
import Topbar from '@/components/layout/Topbar/Topbar'
import StatCardGrid from '@/components/stats/StatCardGrid'
import AlertsOverTimeChart from '@/components/charts/AlertsOverTimeChart'
import AlertsBySeverityChart from '@/components/charts/AlertsBySeverityChart'
import ThreatLandscapeMap from '@/components/charts/ThreatLandscapeMap'
import RecentAlertsTable from '@/components/tables/RecentAlertsTable'
import TopEndpointsAtRiskList from '@/components/tables/TopEndpointsAtRiskList'
import StatusBanner from '@/components/status/StatusBanner'
import { useDashboardData } from '@/hooks/useDashboardData'
import { mapHotspots } from '@/api/dashboardApi'

export default function Dashboard() {
  const { data, loading, refresh } = useDashboardData()

  if (loading || !data) {
    return (
      <div className="p-8 text-gray-400 text-sm">Loading dashboard…</div>
    )
  }

  return (
    <div className="pb-8">
      <Topbar title="Dashboard" subtitle="Hybrid SIEM + SOAR overview — detection, response & exposure" onRefresh={refresh} />

      <div className="px-4 sm:px-6 lg:px-8 space-y-6">
        <StatCardGrid items={data.statCards} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <AlertsOverTimeChart data={data.alertsOverTime} />
          </div>
          <div className="lg:col-span-1">
            <AlertsBySeverityChart data={data.severityBreakdown} />
          </div>
          <div className="lg:col-span-1">
            <TopEndpointsAtRiskList endpoints={data.riskyEndpoints} />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3">
            <RecentAlertsTable alerts={data.recentAlerts} />
          </div>
          <div className="lg:col-span-2">
            <ThreatLandscapeMap threats={data.topThreats} hotspots={mapHotspots} />
          </div>
        </div>

        <StatusBanner />
      </div>
    </div>
  )
}