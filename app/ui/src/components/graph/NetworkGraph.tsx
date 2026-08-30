import { useEffect, useRef } from 'react'
import ForceGraph from 'force-graph'
import type { VerifyResponse } from '@/types'

interface GraphNode {
  id: string
  name?: string
  label?: string
  type?: string
  nodeType?: string
  status?: string
  x?: number
  y?: number
  [key: string]: unknown
}

interface GraphLink {
  source: string | GraphNode
  target: string | GraphNode
  relation?: string
  status?: string
  from?: string
  to?: string
  [key: string]: unknown
}

interface NetworkGraphProps {
  graphData: {
    nodes: Array<Record<string, unknown>>
    edges: Array<Record<string, unknown>>
  } | null
  verificationResult: VerifyResponse | null
}

const NODE_COLORS: Record<string, string> = {
  Product: '#3b82f6',
  License: '#8b5cf6',
  Manufacturer: '#10b981',
  IndianStandard: '#f59e0b',
  TestLab: '#ef4444',
}
const DEFAULT_NODE_COLOR = '#6b7280'
const TRAVERSED_NODE_COLOR = '#22c55e'
const TRAVERSED_LINK_COLOR = '#22c55e'
const DEFAULT_LINK_COLOR = '#9ca3af'

function normalizeNode(node: Record<string, unknown>): GraphNode {
  const id = String(node.id ?? node.node_id ?? node.label ?? '')
  const name = String(node.name ?? node.label ?? id)
  const type = String(node.type ?? node.nodeType ?? node.node_type ?? 'Unknown')
  return { ...node, id, name, label: name, nodeType: type, type }
}

function normalizeLink(link: Record<string, unknown>): GraphLink {
  const source = String(link.source ?? link.from ?? '')
  const target = String(link.target ?? link.to ?? '')
  const relation = String(link.relation ?? link.relation_type ?? 'links')
  return { ...link, source, target, relation }
}

function getTraversedNodeIds(result: VerifyResponse | null): Set<string> {
  if (!result?.traversed_path?.nodes) return new Set()
  return new Set(result.traversed_path.nodes.map((n) => String(n.id || n.label || '')).filter(Boolean))
}

function getTraversedLinkPairs(result: VerifyResponse | null): Set<string> {
  if (!result?.traversed_path?.edges) return new Set()
  return new Set(
    result.traversed_path.edges
      .map((e) => `${String(e.from || '')}->${String(e.to || '')}`)
      .filter((s) => s !== '->')
  )
}

export default function NetworkGraph({ graphData, verificationResult }: NetworkGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const graphRef = useRef<any>(null)

  const hasData = graphData && graphData.nodes && graphData.nodes.length > 0

  useEffect(() => {
    if (!containerRef.current || !hasData) return

    const container = containerRef.current
    const width = container.clientWidth || 800
    const height = container.clientHeight || 500

    const nodes = graphData.nodes.map(normalizeNode)
    const nodeIds = new Set(nodes.map((n) => n.id))
    const links = (graphData.edges || [])
      .map(normalizeLink)
      .filter((l) => {
        const srcId = typeof l.source === 'string' ? l.source : (l.source as GraphNode).id
        const tgtId = typeof l.target === 'string' ? l.target : (l.target as GraphNode).id
        return nodeIds.has(srcId) && nodeIds.has(tgtId)
      })

    const traversedNodeIds = getTraversedNodeIds(verificationResult)
    const traversedLinkPairs = getTraversedLinkPairs(verificationResult)

    // Destroy previous instance before creating new one
    if (graphRef.current) {
      graphRef.current._destructor?.()
      container.innerHTML = ''
    }

    const fg = new ForceGraph(container)
      .width(width)
      .height(height)
      .backgroundColor('rgba(0,0,0,0)')
      .graphData({ nodes, links })
      .nodeId('id')
      .nodeLabel((node: object) => {
        const n = node as GraphNode
        return `${n.name || n.id} (${n.nodeType || n.type || 'Unknown'})`
      })
      .nodeColor((node: object) => {
        const n = node as GraphNode
        return traversedNodeIds.has(n.id)
          ? TRAVERSED_NODE_COLOR
          : NODE_COLORS[n.nodeType || n.type || ''] || DEFAULT_NODE_COLOR
      })
      .nodeVal(6)
      .linkColor((link: object) => {
        const l = link as GraphLink
        const fromId = typeof l.source === 'string' ? l.source : (l.source as GraphNode).id
        const toId = typeof l.target === 'string' ? l.target : (l.target as GraphNode).id
        return traversedLinkPairs.has(`${fromId}->${toId}`) ? TRAVERSED_LINK_COLOR : DEFAULT_LINK_COLOR
      })
      .linkLabel((link: object) => {
        const l = link as GraphLink
        return `${l.relation || 'Connected'} — ${l.status || ''}`
      })
      .linkDirectionalArrowLength(4)
      .linkCurvature(0.1)

    graphRef.current = fg

    return () => {
      fg._destructor?.()
      container.innerHTML = ''
      graphRef.current = null
    }
  // Re-run whenever data or verification result changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphData, verificationResult])

  if (!hasData) {
    return (
      <div className="flex h-[500px] items-center justify-center text-muted-foreground text-sm">
        No graph data available. Run a verification to see the graph.
      </div>
    )
  }

  return <div ref={containerRef} className="h-[500px] w-full overflow-hidden rounded-lg" />
}
