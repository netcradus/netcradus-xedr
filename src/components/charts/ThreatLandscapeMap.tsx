import Card from '@/components/ui/Card/Card'
import CardMenu from '@/components/ui/CardMenu/CardMenu'
import type { ThreatItem } from '@/types/dashboard.types'

interface Hotspot {
  id: string
  x: number
  y: number
  intensity: number
}

export default function ThreatLandscapeMap({
  threats,
  hotspots,
}: {
  threats: ThreatItem[]
  hotspots: Hotspot[]
}) {
  return (
    <Card title="Threat Landscape" actions={<CardMenu ariaLabel="Threat Landscape card actions" />}>
      <div className="flex flex-col lg:flex-row gap-6">
        {/* World map placeholder with hotspot dots */}
        <div className="relative flex-1 h-[180px] rounded-lg bg-gray-50 overflow-hidden">
          <svg viewBox="0 0 100 60" className="w-full h-full opacity-40">
            <rect width="100" height="60" fill="#EEF1F5" />
          </svg>
          {hotspots.map((h) => (
            <span
              key={h.id}
              className="absolute rounded-full bg-red-400"
              style={{
                left: `${h.x}%`,
                top: `${h.y}%`,
                width: `${10 + h.intensity * 14}px`,
                height: `${10 + h.intensity * 14}px`,
                opacity: 0.4 + h.intensity * 0.4,
                transform: 'translate(-50%, -50%)',
              }}
            />
          ))}
        </div>

        {/* Top threats list */}
        <div className="lg:w-56 shrink-0">
          <p className="text-xs text-gray-400 mb-2">Top Threats</p>
          <ul className="space-y-2.5">
            {threats.map((t) => (
              <li key={t.id}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-gray-700">{t.name}</span>
                  <span className="text-gray-900 font-medium">{t.percent}%</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-red-400 rounded-full"
                    style={{ width: `${t.percent}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <a href="#" className="inline-block mt-4 text-sm text-brand-blue hover:underline">
        View full threat landscape →
      </a>
    </Card>
  )
}