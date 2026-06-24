import StatCard from './StatCard'
import type { StatCardData } from '@/types/dashboard.types'

export default function StatCardGrid({ items }: { items: StatCardData[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {items.map((item) => (
        <StatCard key={item.id} data={item} />
      ))}
    </div>
  )
}