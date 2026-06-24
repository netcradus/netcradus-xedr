
import { ShieldAlert, Grid3x3, Globe, Flag } from 'lucide-react'
import Card from '@/components/ui/Card/Card'
import Badge from '@/components/ui/Badge/Badge'
import CardMenu from '@/components/ui/CardMenu/CardMenu'
import type { RecentAlert } from '@/types/dashboard.types'

const ICONS: Record<string, React.ElementType> = {
  'shield-alert': ShieldAlert,
  grid: Grid3x3,
  globe: Globe,
  flag: Flag,
}

const ICON_BG: Record<string, string> = {
  High: 'bg-red-50 text-red-500',
  Medium: 'bg-amber-50 text-amber-500',
  Low: 'bg-green-50 text-green-500',
  Informational: 'bg-gray-100 text-gray-500',
}

export default function RecentAlertsTable({ alerts }: { alerts: RecentAlert[] }) {
  return (
    <Card title="Recent Alerts" actions={<CardMenu ariaLabel="Recent Alerts card actions" />}>
      {/*
        overflow-x-auto here is intentionally scoped to the scrollable table
        body only — not the Card itself — and only clips horizontally. The
        per-row CardMenu renders through a portal, so it is unaffected by
        this scroll container and is never cut off even when a row scrolls
        out toward the edge.
      */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
              <th className="font-medium py-2">Alert</th>
              <th className="font-medium py-2">Endpoint</th>
              <th className="font-medium py-2">Severity</th>
              <th className="font-medium py-2">Time</th>
              <th className="font-medium py-2 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {alerts.map((alert) => {
              const Icon = ICONS[alert.icon]
              return (
                <tr key={alert.id} className="border-b border-gray-50 last:border-0">
                  <td className="py-3 pr-4">
                    <div className="flex items-start gap-3">
                      <span className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${ICON_BG[alert.severity]}`}>
                        <Icon size={16} />
                      </span>
                      <div>
                        <p className="font-medium text-gray-900">{alert.title}</p>
                        <p className="text-xs text-gray-400">{alert.description}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-gray-600">{alert.endpoint}</td>
                  <td className="py-3 pr-4">
                    <Badge severity={alert.severity} />
                  </td>
                  <td className="py-3 pr-4 text-gray-400 whitespace-nowrap">{alert.time}</td>
                  <td className="py-3 text-right">
                    <CardMenu ariaLabel={`${alert.title} row actions`} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <a href="#" className="inline-block mt-4 text-sm text-brand-blue hover:underline">
        View all alerts →
      </a>
    </Card>
  )
}