import { ArrowUp, ArrowDown, ShieldCheck, ShieldAlert, Target, Monitor } from 'lucide-react'
import Card from '@/components/ui/Card/Card'
import type { StatCardData } from '@/types/dashboard.types'

const ICONS: Record<string, React.ElementType> = {
  shield: ShieldCheck,
  alert: ShieldAlert,
  target: Target,
  monitor: Monitor,
}

const ICON_BG: Record<string, string> = {
  shield: 'bg-blue-50 text-blue-600',
  alert: 'bg-red-50 text-red-600',
  target: 'bg-amber-50 text-amber-600',
  monitor: 'bg-green-50 text-green-600',
}

export default function StatCard({ data }: { data: StatCardData }) {
  const Icon = ICONS[data.icon]
  const TrendIcon = data.trendDirection === 'up' ? ArrowUp : ArrowDown
  const trendColor = data.trendPositive ? 'text-green-600' : 'text-red-500'

  return (
    <Card className="flex flex-col gap-4">
      <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${ICON_BG[data.icon]}`}>
        <Icon size={20} />
      </div>
      <div>
        <p className="text-sm text-gray-500">{data.label}</p>
        <p className="text-2xl font-semibold text-gray-900 mt-1">{data.value}</p>
        <div className="flex items-center gap-1 mt-1 text-xs">
          <span className={`flex items-center gap-0.5 font-medium ${trendColor}`}>
            <TrendIcon size={12} />
            {data.trendValue}
          </span>
          <span className="text-gray-400">{data.comparisonLabel}</span>
        </div>
      </div>
    </Card>
  )
}
