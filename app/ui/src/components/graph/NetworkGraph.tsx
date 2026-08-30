import { useRef } from 'react'
import { ForceGraph2D } from 'react-force-graph'
import type { GraphData, NodeObject, LinkObject } from 'react-force-graph'
import type { VerifyResponse } from '@/types'

interface NetworkGraphProps {
  graphData: {
    nodes: Array<Record<string, unknown>>
    edges: Array<Record<string, unknown>>
  } | null
  verificationResult: VerifyResponse | null
}

interface GraphNode extends NodeObject {
  id: string
  name?: string
  label?: string
  type?: string
  nodeType?: string
  status?: string
  [key: string]: unknown
}

interface GraphLink extends LinkObject {
  source: string | GraphNode
  target: string | GraphNode
  relation?: string
  status?: string
  [key: string]: unknown
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
  return {
    ...node,
    id,
    name,
    label: name,
    nodeType: type,
    type,
  } as GraphNode
}

function normalizeLink(link: Record<string, unknown>): GraphLink {
  const source = String(link.source ?? link.from ?? '')
  const target = String(link.target ?? link.to ?? '')
  const relation = String(link.relation ?? link.relation_type ?? 'links')
  return {
    ...link,
    source,
    target,
    relation,
  } as GraphLink
}

function buildGraphData(
  data: {
    nodes: Array<Record<string, unknown>>
    edges: Array<Record<string, unknown>>
  } | null
): GraphData<GraphNode, GraphLink> | null {
  if (!data?.nodes?.length) return null

  const nodes = data.nodes.map(normalizeNode)
  const nodeIds = new Set(nodes.map((n) => n.id))

  const links = (data.edges || [])
    .map(normalizeLink)
    .filter(
      (l) =>
        nodeIds.has(typeof l.source === 'string' ? l.source : l.source.id || '') &&
        nodeIds.has(typeof l.target === 'string' ? l.target : l.target.id || '')
    )

  return { nodes, links }
}

function getTraversedNodeIds(result: VerifyResponse | null): Set<string> {
  if (!result?.traversed_path?.nodes) return new Set()
  return new Set(
    result.traversed_path.nodes
      .map((n) => String(n.id || n.label || ''))
      .filter(Boolean)
  )
}

function getTraversedLinkPairs(result: VerifyResponse | null): Set<string> {
  if (!result?.traversed_path?.edges) return new Set()
  return new Set(
    result.traversed_path.edges
      .map((e) => {
        const from = String(e.from || e.source || '')
        const to = String(e.to || e.target || '')
        return `${from}->${to}`
      })
      .filter(Boolean)
  )
}

export function NetworkGraph({ graphData, verificationResult }: NetworkGraphProps) {
  const fgRef = useRef<Record<string, unknown> | null>(null)

  const normalizedData = graphData ? buildGraphData(graphData) : null
  const traversedNodeIds = getTraversedNodeIds(verificationResult)
  const traversedLinkPairs = getTraversedLinkPairs(verificationResult)

  if (!normalizedData) {
    return (
      <div className="flex h-full min-h-[300px] items-center justify-center text-muted-foreground">
        No graph data available. Run a verification to see the graph.
      </div>
    )
  }

  return (
    <ForceGraph2D
      ref={fgRef as unknown as React.MutableRefObject<Record<string, unknown> | null>}
      graphData={normalizedData}
      width={800}
      height={500}
      nodeAutoColorBy="type"
      nodeColor={(node: GraphNode) =>
        traversedNodeIds.has(node.id)
          ? TRAVERSED_NODE_COLOR
          : NODE_COLORS[node.nodeType || node.type || ''] || DEFAULT_NODE_COLOR
      }
      nodeLabel={(node: GraphNode) =>
        `${node.name || node.id}\nType: ${node.nodeType || node.type || 'Unknown'}`
      }
      nodeVal={6}
      linkColor={(link: GraphLink) => {
        const fromId =
          typeof link.source === 'string'
            ? link.source
            : (link.source as GraphNode).id
        const toId =
          typeof link.target === 'string'
            ? link.target
            : (link.target as GraphNode).id
        return traversedLinkPairs.has(`${fromId}->${toId}`)
          ? TRAVERSED_LINK_COLOR
          : DEFAULT_LINK_COLOR
      }}
      linkLabel={(link: GraphLink) => {
        const relation = link.relation || 'Connected'
        const status = link.status || 'unknown'
        return `${relation}\nStatus: ${status}`
      }}
      linkDirectionalWidth={3}
      linkCurvature={0.1}
      fontSize={10}
      fontColor="#6b7280"
      backgroundColor="transparent"
    />
  )
}
