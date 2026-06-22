import { severityColor } from '@/utils/severityColors'
import type { Severity } from '@/types/dashboard.types'

interface BadgeProps {
  severity: Severity
}

export default function Badge({ severity }: BadgeProps) {
  const c = severityColor[severity]
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${c.bg} ${c.text}`}
    >
      {severity}
    </span>
  )
}
