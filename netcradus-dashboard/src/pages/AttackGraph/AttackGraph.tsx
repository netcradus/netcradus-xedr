import { useState, useCallback, useRef, useEffect } from 'react'
import {
  Network, Search, ChevronRight, Loader2, Lock, ArrowUpRight,
  AlertTriangle, RefreshCw, Info, ZoomIn, ZoomOut, Maximize2,
  Mail, Terminal, Globe, Database, Shield, File, Cpu, Wifi,
  X,
} from 'lucide-react'
import Topbar from '@/components/layout/Topbar/Topbar'
import { fetchAlerts } from '@/api/alertsApi'
import { fetchAttackGraph } from '@/api/attackGraphApi'
import type { BackendAlert } from '@/types/api.types'
import type { AttackGraph as AttackGraphData, GraphNode, GraphEdge } from '@/api/attackGraphApi'

// ── Constants ──────────────────────────────────────────────────────────────────

const NODE_W = 168
const NODE_H = 56
const V_GAP  = 80   // vertical gap between levels
const H_GAP  = 40   // horizontal gap between siblings
const PAD    = 48

// ── Node visual config ─────────────────────────────────────────────────────────

const NODE_CONFIG: Record<string, {
  bg: string; border: string; text: string; dot: string; Icon: React.ElementType
}> = {
  attacker:     { bg: '#fef2f2', border: '#ef4444', text: '#b91c1c', dot: '#ef4444', Icon: Shield },
  email:        { bg: '#fffbeb', border: '#f59e0b', text: '#92400e', dot: '#f59e0b', Icon: Mail },
  process:      { bg: '#f0f9ff', border: '#0ea5e9', text: '#0369a1', dot: '#0ea5e9', Icon: Terminal },
  file:         { bg: '#f0fdf4', border: '#22c55e', text: '#15803d', dot: '#22c55e', Icon: File },
  network:      { bg: '#f5f3ff', border: '#8b5cf6', text: '#6d28d9', dot: '#8b5cf6', Icon: Wifi },
  dns:          { bg: '#ecfdf5', border: '#14b8a6', text: '#0f766e', dot: '#14b8a6', Icon: Globe },
  c2:           { bg: '#fff1f2', border: '#e11d48', text: '#9f1239', dot: '#e11d48', Icon: Cpu },
  exfiltration: { bg: '#fdf4ff', border: '#a855f7', text: '#7e22ce', dot: '#a855f7', Icon: Database },
}
const DEFAULT_CONFIG = NODE_CONFIG.process

// ── Layout engine ──────────────────────────────────────────────────────────────

interface LayoutNode extends GraphNode {
  x: number
  y: number
  level: number
}

function computeLayout(nodes: GraphNode[], edges: GraphEdge[]): LayoutNode[] {
  if (!nodes.length) return []

  // Build adjacency
  const outgoing = new Map<string, string[]>()
  const incoming = new Map<string, string[]>()
  for (const n of nodes) { outgoing.set(n.id, []); incoming.set(n.id, []) }
  for (const e of edges) {
    outgoing.get(e.from)?.push(e.to)
    incoming.get(e.to)?.push(e.from)
  }

  // Assign levels via BFS from roots
  const level = new Map<string, number>()
  const roots = nodes.filter(n => (incoming.get(n.id)?.length ?? 0) === 0).map(n => n.id)
  const queue = roots.map(id => ({ id, lv: 0 }))
  if (!queue.length) queue.push({ id: nodes[0].id, lv: 0 })
  while (queue.length) {
    const { id, lv } = queue.shift()!
    if (level.has(id) && level.get(id)! >= lv) continue
    level.set(id, lv)
    for (const child of outgoing.get(id) ?? []) {
      queue.push({ id: child, lv: lv + 1 })
    }
  }

  // Group nodes by level
  const byLevel = new Map<number, string[]>()
  for (const n of nodes) {
    const lv = level.get(n.id) ?? 0
    if (!byLevel.has(lv)) byLevel.set(lv, [])
    byLevel.get(lv)!.push(n.id)
  }
  const maxLevel = Math.max(...byLevel.keys())
  const maxPerLevel = Math.max(...[...byLevel.values()].map(arr => arr.length))

  const svgWidth = Math.max(maxPerLevel * (NODE_W + H_GAP), NODE_W + 2 * PAD)
  const nodeById = new Map(nodes.map(n => [n.id, n]))

  // Position each node
  return nodes.map(n => {
    const lv = level.get(n.id) ?? 0
    const siblings = byLevel.get(lv) ?? [n.id]
    const idx = siblings.indexOf(n.id)
    const totalW = siblings.length * NODE_W + (siblings.length - 1) * H_GAP
    const startX = (svgWidth - totalW) / 2
    const x = startX + idx * (NODE_W + H_GAP)
    const y = PAD + lv * (NODE_H + V_GAP)
    return { ...nodeById.get(n.id)!, x, y, level: lv }
  })
}

function graphDimensions(laid: LayoutNode[]) {
  if (!laid.length) return { w: 600, h: 400 }
  const w = Math.max(...laid.map(n => n.x + NODE_W)) + PAD
  const h = Math.max(...laid.map(n => n.y + NODE_H)) + PAD
  return { w, h }
}

// ── SVG components ─────────────────────────────────────────────────────────────

function EdgePath({ from, to, label }: { from: LayoutNode; to: LayoutNode; label: string }) {
  const x1 = from.x + NODE_W / 2
  const y1 = from.y + NODE_H
  const x2 = to.x + NODE_W / 2
  const y2 = to.y
  const midY = (y1 + y2) / 2

  const path = `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`

  return (
    <g>
      <defs>
        <marker id={`arr-${from.id}-${to.id}`} markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill="#94a3b8" />
        </marker>
      </defs>
      <path
        d={path}
        fill="none"
        stroke="#cbd5e1"
        strokeWidth={1.5}
        strokeDasharray="none"
        markerEnd={`url(#arr-${from.id}-${to.id})`}
      />
      {label && (
        <text
          x={(x1 + x2) / 2}
          y={midY}
          textAnchor="middle"
          fontSize={10}
          fill="#94a3b8"
          fontFamily="system-ui"
          dy={-4}
        >
          {label}
        </text>
      )}
    </g>
  )
}

function NodeBox({
  node,
  isSelected,
  onClick,
}: {
  node: LayoutNode
  isSelected: boolean
  onClick: (n: LayoutNode) => void
}) {
  const cfg = NODE_CONFIG[node.type] ?? DEFAULT_CONFIG
  const { Icon } = cfg
  const borderColor = isSelected ? '#2563eb' : (node.is_malicious ? cfg.border : '#e2e8f0')
  const bgColor = node.is_malicious ? cfg.bg : '#ffffff'

  return (
    <g
      transform={`translate(${node.x}, ${node.y})`}
      onClick={() => onClick(node)}
      style={{ cursor: 'pointer' }}
      role="button"
      aria-label={node.label}
    >
      {/* Drop shadow */}
      <rect
        x={2} y={2}
        width={NODE_W} height={NODE_H}
        rx={8}
        fill="rgba(0,0,0,0.06)"
      />
      {/* Main box */}
      <rect
        width={NODE_W} height={NODE_H}
        rx={8}
        fill={bgColor}
        stroke={borderColor}
        strokeWidth={isSelected ? 2 : 1.5}
      />
      {/* Colored left accent bar */}
      <rect
        width={4} height={NODE_H}
        rx={2}
        fill={cfg.border}
        opacity={node.is_malicious ? 1 : 0.5}
      />
      {/* Icon */}
      <foreignObject x={12} y={16} width={24} height={24}>
        <Icon size={16} color={cfg.text} />
      </foreignObject>
      {/* Label */}
      <text
        x={38} y={22}
        fontSize={11}
        fontWeight={600}
        fill={cfg.text}
        fontFamily="system-ui"
        clipPath={`url(#clip-${node.id})`}
      >
        {node.label.length > 16 ? node.label.slice(0, 15) + '…' : node.label}
      </text>
      {/* Detail */}
      <text
        x={38} y={38}
        fontSize={9.5}
        fill="#94a3b8"
        fontFamily="system-ui"
      >
        {node.detail.length > 22 ? node.detail.slice(0, 21) + '…' : node.detail}
      </text>
      {/* Risk badge */}
      {node.is_malicious && (
        <g transform={`translate(${NODE_W - 30}, 8)`}>
          <rect width={24} height={14} rx={7} fill={cfg.border} opacity={0.15} />
          <text x={12} y={10} textAnchor="middle" fontSize={8} fill={cfg.border} fontWeight={700} fontFamily="system-ui">
            {node.risk_score}
          </text>
        </g>
      )}
    </g>
  )
}

// ── Detail panel ──────────────────────────────────────────────────────────────

function NodeDetail({ node, onClose }: { node: LayoutNode; onClose: () => void }) {
  const cfg = NODE_CONFIG[node.type] ?? DEFAULT_CONFIG
  const { Icon } = cfg
  const meta = node.metadata as Record<string, string | number | boolean>

  return (
    <div className="absolute right-4 top-4 bottom-4 w-72 bg-white rounded-xl shadow-xl border border-gray-100 flex flex-col overflow-hidden z-10">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Icon size={14} color={cfg.text} />
          <span className="text-sm font-semibold text-gray-800">{node.label}</span>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs">
        <Row label="Type" value={node.type.toUpperCase()} />
        <Row label="Risk Score" value={
          <span className={`font-bold ${node.risk_score >= 70 ? 'text-red-600' : node.risk_score >= 40 ? 'text-amber-600' : 'text-green-600'}`}>
            {node.risk_score} / 100
          </span>
        } />
        <Row label="Verdict" value={
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
            node.is_malicious ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
          }`}>
            {node.is_malicious ? 'Malicious' : 'Benign'}
          </span>
        } />
        {node.detail && <Row label="Detail" value={node.detail} />}
        {node.timestamp && <Row label="Time" value={new Date(node.timestamp).toLocaleString()} />}
        {Object.entries(meta).filter(([k]) => k !== 'synthetic').map(([k, v]) => (
          <Row key={k} label={k} value={String(v)} />
        ))}
        {meta.synthetic && (
          <div className="mt-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-[10px]">
            This node was generated from MITRE technique mapping. Deploy the endpoint agent to collect real telemetry.
          </div>
        )}
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="w-20 shrink-0 text-gray-400 font-medium capitalize">{label}</span>
      <span className="text-gray-700 break-all">{value}</span>
    </div>
  )
}

// ── Graph canvas ──────────────────────────────────────────────────────────────

function GraphCanvas({ graph }: { graph: AttackGraphData }) {
  const [selected, setSelected] = useState<LayoutNode | null>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const dragStart = useRef<{ mx: number; my: number; px: number; py: number } | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const laid = computeLayout(graph.nodes, graph.edges)
  const nodeMap = new Map(laid.map(n => [n.id, n]))
  const { w, h } = graphDimensions(laid)

  function handleMouseDown(e: React.MouseEvent) {
    if ((e.target as SVGElement).closest('g[role="button"]')) return
    setDragging(true)
    dragStart.current = { mx: e.clientX, my: e.clientY, px: pan.x, py: pan.y }
  }
  function handleMouseMove(e: React.MouseEvent) {
    if (!dragging || !dragStart.current) return
    setPan({
      x: dragStart.current.px + (e.clientX - dragStart.current.mx),
      y: dragStart.current.py + (e.clientY - dragStart.current.my),
    })
  }
  function handleMouseUp() { setDragging(false); dragStart.current = null }
  function handleWheel(e: React.WheelEvent) {
    e.preventDefault()
    setZoom(z => Math.min(2, Math.max(0.4, z - e.deltaY * 0.001)))
  }
  function resetView() { setZoom(1); setPan({ x: 0, y: 0 }) }

  return (
    <div className="relative flex-1 min-h-0 bg-[#f8fafc] overflow-hidden rounded-xl border border-gray-100">
      {/* Toolbar */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-1">
        <button onClick={() => setZoom(z => Math.min(2, z + 0.15))}
          className="p-1.5 bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50 text-gray-600 transition-colors">
          <ZoomIn size={14} />
        </button>
        <button onClick={() => setZoom(z => Math.max(0.4, z - 0.15))}
          className="p-1.5 bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50 text-gray-600 transition-colors">
          <ZoomOut size={14} />
        </button>
        <button onClick={resetView}
          className="p-1.5 bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50 text-gray-600 transition-colors">
          <Maximize2 size={14} />
        </button>
        <span className="ml-1 text-[11px] text-gray-400 bg-white border border-gray-200 rounded-lg px-2 py-1 shadow-sm">
          {Math.round(zoom * 100)}%
        </span>
      </div>

      {/* Synthetic notice */}
      {graph.is_synthetic && (
        <div className="absolute bottom-3 left-3 right-3 z-10 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
          <Info size={12} className="shrink-0" />
          Graph generated from MITRE {graph.mitre_technique} mapping — deploy the agent to collect real telemetry.
        </div>
      )}

      {/* SVG canvas */}
      <svg
        ref={svgRef}
        className="w-full h-full"
        style={{ cursor: dragging ? 'grabbing' : 'grab' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        {/* Subtle dot grid */}
        <defs>
          <pattern id="grid" width={24} height={24} patternUnits="userSpaceOnUse">
            <circle cx={1} cy={1} r={0.8} fill="#e2e8f0" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />

        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {/* Edges first (under nodes) */}
          {graph.edges.map(edge => {
            const fromNode = nodeMap.get(edge.from)
            const toNode   = nodeMap.get(edge.to)
            if (!fromNode || !toNode) return null
            return (
              <EdgePath
                key={`${edge.from}-${edge.to}`}
                from={fromNode}
                to={toNode}
                label={edge.label}
              />
            )
          })}
          {/* Nodes */}
          {laid.map(node => (
            <NodeBox
              key={node.id}
              node={node}
              isSelected={selected?.id === node.id}
              onClick={n => setSelected(prev => prev?.id === n.id ? null : n)}
            />
          ))}
        </g>
      </svg>

      {/* Detail panel */}
      {selected && (
        <NodeDetail node={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}

// ── Legend ────────────────────────────────────────────────────────────────────

function Legend() {
  const items = [
    { type: 'attacker',     label: 'Attacker' },
    { type: 'email',        label: 'Email / Phish' },
    { type: 'process',      label: 'Process' },
    { type: 'file',         label: 'File' },
    { type: 'network',      label: 'Network' },
    { type: 'dns',          label: 'DNS' },
    { type: 'c2',           label: 'C2 Server' },
    { type: 'exfiltration', label: 'Exfiltration' },
  ]
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-2.5 bg-white border-t border-gray-100 text-[11px]">
      {items.map(({ type, label }) => {
        const cfg = NODE_CONFIG[type] ?? DEFAULT_CONFIG
        return (
          <div key={type} className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: cfg.border }} />
            <span className="text-gray-500">{label}</span>
          </div>
        )
      })}
    </div>
  )
}

// ── Premium gate ──────────────────────────────────────────────────────────────

function PremiumGate() {
  const items = ['Full kill chain visualization', 'Process parent tree', 'C2 beaconing detection', 'MITRE-mapped attack stages']
  return (
    <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="text-center max-w-sm px-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-lg mb-5">
          <Lock size={28} className="text-white" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Attack Graph</h2>
        <p className="text-sm text-gray-500 mb-5">
          Visualize the full kill chain — from initial access to data exfiltration — as an interactive graph.
          Available on Professional and Enterprise plans.
        </p>
        <ul className="text-left space-y-2 mb-6">
          {items.map(item => (
            <li key={item} className="flex items-center gap-2 text-sm text-gray-600">
              <span className="w-4 h-4 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                <ChevronRight size={10} className="text-blue-600" />
              </span>
              {item}
            </li>
          ))}
        </ul>
        <a
          href="/settings"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl shadow hover:opacity-90 transition-opacity"
        >
          Upgrade Plan <ArrowUpRight size={14} />
        </a>
      </div>
    </div>
  )
}

// ── Alert selector ────────────────────────────────────────────────────────────

const SEV_COLORS: Record<string, string> = {
  Critical: 'bg-purple-50 text-purple-700',
  High:     'bg-red-50 text-red-600',
  Medium:   'bg-amber-50 text-amber-700',
  Low:      'bg-green-50 text-green-700',
}

function AlertSelector({
  onSelect,
}: {
  onSelect: (alert: BackendAlert) => void
}) {
  const [search, setSearch] = useState('')
  const [alerts, setAlerts] = useState<BackendAlert[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async (q: string) => {
    setLoading(true)
    try {
      const res = await fetchAlerts({ limit: 30, search: q || undefined, sort_by: 'timestamp', sort_dir: 'desc' })
      setAlerts(Array.isArray(res) ? res : (res as { items?: BackendAlert[] }).items ?? [])
    } catch {
      setAlerts([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load('') }, [load])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    load(search)
  }

  return (
    <div className="w-80 shrink-0 bg-white border-r border-gray-100 flex flex-col">
      <div className="px-4 pt-4 pb-3 border-b border-gray-100">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2.5">Select Alert</p>
        <form onSubmit={handleSearch} className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search alerts…"
            className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
          />
        </form>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={16} className="animate-spin text-gray-400" />
          </div>
        )}
        {!loading && alerts.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-8">No alerts found</p>
        )}
        {!loading && alerts.map(alert => (
          <button
            key={alert.id}
            onClick={() => onSelect(alert)}
            className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors group"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-medium text-gray-800 line-clamp-2 leading-snug group-hover:text-blue-700 transition-colors">
                {alert.title}
              </p>
              <span className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${SEV_COLORS[alert.severity] ?? 'bg-gray-100 text-gray-500'}`}>
                {alert.severity}
              </span>
            </div>
            {alert.mitre_technique && (
              <p className="mt-0.5 text-[10px] text-gray-400">{alert.mitre_technique}</p>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AttackGraph() {
  const [selectedAlert, setSelectedAlert] = useState<BackendAlert | null>(null)
  const [graph, setGraph] = useState<AttackGraphData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPremiumError, setIsPremiumError] = useState(false)

  async function loadGraph(alert: BackendAlert) {
    setSelectedAlert(alert)
    setGraph(null)
    setError(null)
    setIsPremiumError(false)
    setLoading(true)
    try {
      const data = await fetchAttackGraph(alert.id)
      setGraph(data)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load attack graph'
      if (msg.toLowerCase().includes('professional') || msg.toLowerCase().includes('enterprise')) {
        setIsPremiumError(true)
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Topbar title="Attack Graph" subtitle="Visualize the full attacker kill chain" />

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left: alert list */}
        <AlertSelector onSelect={loadGraph} />

        {/* Right: graph area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header bar */}
          {selectedAlert && (
            <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <Network size={16} className="text-blue-600 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{selectedAlert.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${SEV_COLORS[selectedAlert.severity] ?? 'bg-gray-100 text-gray-500'}`}>
                      {selectedAlert.severity}
                    </span>
                    {selectedAlert.mitre_technique && (
                      <span className="text-[10px] text-gray-400">{selectedAlert.mitre_technique}</span>
                    )}
                    {graph && (
                      <span className="text-[10px] text-gray-400">
                        {graph.nodes.length} nodes · {graph.edges.length} edges
                        {graph.is_synthetic && ' · MITRE-synthesized'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => loadGraph(selectedAlert)}
                disabled={loading}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-50"
              >
                <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>
          )}

          {/* Graph or states */}
          <div className="flex-1 min-h-0 flex flex-col p-4 gap-4">
            {!selectedAlert && !loading && (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <Network size={40} className="mx-auto text-gray-200 mb-3" />
                  <p className="text-sm font-medium text-gray-400">Select an alert to visualize its attack graph</p>
                  <p className="text-xs text-gray-300 mt-1">Kill chain · Process tree · C2 connections</p>
                </div>
              </div>
            )}

            {isPremiumError && <PremiumGate />}

            {loading && (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <Loader2 size={28} className="mx-auto animate-spin text-blue-500 mb-3" />
                  <p className="text-sm text-gray-400">Building attack graph…</p>
                </div>
              </div>
            )}

            {error && !loading && (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <AlertTriangle size={28} className="mx-auto text-amber-400 mb-3" />
                  <p className="text-sm font-medium text-gray-600 mb-1">Could not load graph</p>
                  <p className="text-xs text-gray-400 mb-3">{error}</p>
                  <button
                    onClick={() => selectedAlert && loadGraph(selectedAlert)}
                    className="text-xs px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
                  >
                    Retry
                  </button>
                </div>
              </div>
            )}

            {graph && !loading && !error && (
              <>
                <GraphCanvas graph={graph} />
                <Legend />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
