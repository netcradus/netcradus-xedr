import type { Severity } from '@/types/dashboard.types'

export const severityColor: Record<Severity, { bg: string; text: string; dot: string }> = {
  High: { bg: 'bg-red-100', text: 'text-red-600', dot: '#E14D4D' },
  Medium: { bg: 'bg-amber-100', text: 'text-amber-600', dot: '#F2A93C' },
  Low: { bg: 'bg-green-100', text: 'text-green-600', dot: '#2FB870' },
  Informational: { bg: 'bg-gray-100', text: 'text-gray-500', dot: '#9AA3B2' },
}
