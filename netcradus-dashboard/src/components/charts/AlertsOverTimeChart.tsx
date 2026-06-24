
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import Card from '@/components/ui/Card/Card'
import Dropdown from '@/components/ui/Dropdown/Dropdown'
import CardMenu from '@/components/ui/CardMenu/CardMenu'
import type { AlertTrendPoint } from '@/types/dashboard.types'

export default function AlertsOverTimeChart({ data }: { data: AlertTrendPoint[] }) {
  return (
    <Card
      className="h-full"
      title="Alerts Over Time"
      actions={
        <>
          <Dropdown label="7 Days" options={['7 Days', '14 Days', '30 Days']} />
          <CardMenu ariaLabel="Alerts Over Time card actions" />
        </>
      }
    >
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="alertGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#E14D4D" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#E14D4D" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EEF1F5" />
          <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#9AA3B2' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 12, fill: '#9AA3B2' }} axisLine={false} tickLine={false} />
          <Tooltip />
          <Area
            type="monotone"
            dataKey="count"
            stroke="#E14D4D"
            strokeWidth={2}
            fill="url(#alertGradient)"
            dot={{ r: 4, fill: '#E14D4D', strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </Card>
  )
}