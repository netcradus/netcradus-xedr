import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import Card from '@/components/ui/Card/Card'
import { severityColor } from '@/utils/severityColors'
import type { SeverityBreakdown } from '@/types/dashboard.types'

export default function AlertsBySeverityChart({ data }: { data: SeverityBreakdown[] }) {
  const total = data.reduce((sum, d) => sum + d.count, 0)

  return (
    <Card>
      <h3 className="font-semibold text-gray-900 mb-4">Alerts by Severity</h3>
      <div className="flex items-center gap-4">
        <div className="relative w-[150px] h-[150px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="count"
                nameKey="severity"
                innerRadius={48}
                outerRadius={70}
                paddingAngle={2}
                stroke="none"
              >
                {data.map((entry) => (
                  <Cell key={entry.severity} fill={severityColor[entry.severity].dot} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-semibold text-gray-900">{total}</span>
            <span className="text-[11px] text-gray-400">Total</span>
          </div>
        </div>

        <ul className="flex-1 space-y-2">
          {data.map((entry) => (
            <li key={entry.severity} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-gray-600">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: severityColor[entry.severity].dot }}
                />
                {entry.severity}
              </span>
              <span className="text-gray-900 font-medium">
                {entry.count} ({entry.percent.toFixed(1)}%)
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  )
}
