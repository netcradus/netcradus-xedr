import { Monitor } from 'lucide-react'
import Card from '@/components/ui/Card/Card'
import Badge from '@/components/ui/Badge/Badge'
import CardMenu from '@/components/ui/CardMenu/CardMenu'
import type { RiskyEndpoint } from '@/types/dashboard.types'

export default function TopEndpointsAtRiskList({ endpoints }: { endpoints: RiskyEndpoint[] }) {
  return (
    <Card title="Top Assets at Risk" actions={<CardMenu ariaLabel="Top Assets at Risk card actions" />}>
      <ul className="space-y-3">
        {endpoints.map((ep) => (
          <li key={ep.id} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-gray-700">
              <Monitor size={16} className="text-gray-400" />
              {ep.name}
            </span>
            <span className="flex items-center gap-3">
              <Badge severity={ep.severity} />
              <span className="text-gray-900 font-medium w-6 text-right">{ep.riskScore}</span>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  )
}