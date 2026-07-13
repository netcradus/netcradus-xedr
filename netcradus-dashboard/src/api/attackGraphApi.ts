import { apiFetch } from '@/api/client'

export interface GraphNode {
  id: string
  type: 'attacker' | 'email' | 'process' | 'file' | 'network' | 'dns' | 'c2' | 'exfiltration'
  label: string
  detail: string
  timestamp: string | null
  risk_score: number
  is_malicious: boolean
  metadata: Record<string, unknown>
}

export interface GraphEdge {
  from: string
  to: string
  label: string
  type: string
}

export interface AttackGraph {
  alert_id: number
  alert_title: string
  alert_severity: string
  mitre_technique: string | null
  hostname: string
  is_synthetic: boolean
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export async function fetchAttackGraph(alertId: number): Promise<AttackGraph> {
  return apiFetch<AttackGraph>(`/attack-graph/alerts/${alertId}`)
}
