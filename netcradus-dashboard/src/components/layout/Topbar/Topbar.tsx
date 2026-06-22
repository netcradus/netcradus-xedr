import { Bell, RefreshCw } from 'lucide-react'
import Dropdown from '@/components/ui/Dropdown/Dropdown'
import Button from '@/components/ui/Button/Button'

interface TopbarProps {
  title: string
  subtitle: string
  onRefresh?: () => void
  alertCount?: number
}

export default function Topbar({ title, subtitle, onRefresh, alertCount = 12 }: TopbarProps) {
  return (
    <header className="flex items-center justify-between px-8 py-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
        <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>
      </div>

      <div className="flex items-center gap-3">
        <Dropdown label="May 20 – May 26, 2024" options={['Last 7 Days', 'Last 30 Days', 'This Month']} />
        <Button onClick={onRefresh}>
          <RefreshCw size={16} />
          Refresh
        </Button>
        <button className="relative h-10 w-10 flex items-center justify-center rounded-lg bg-white border border-gray-200 hover:bg-gray-50">
          <Bell size={18} className="text-gray-600" />
          {alertCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 text-[10px] bg-red-500 text-white rounded-full h-5 w-5 flex items-center justify-center">
              {alertCount}
            </span>
          )}
        </button>
      </div>
    </header>
  )
}
