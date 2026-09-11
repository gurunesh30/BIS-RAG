import { useState, useEffect } from 'react'
import { Cpu } from 'lucide-react'
import { listIsCodes, exportGraph } from '@/lib/api'

export function HeaderStatsBar() {
  const [codesCount, setCodesCount] = useState<number | null>(null)
  const [nodesCount, setNodesCount] = useState<number | null>(null)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const codes = await listIsCodes()
        setCodesCount(codes.length)
      } catch {
        setCodesCount(null)
      }
      try {
        const graph = await exportGraph()
        setNodesCount(graph.nodes.length)
      } catch {
        setNodesCount(null)
      }
    }
    void fetchStats()
  }, [])

  return (
    <div className="hidden shrink-0 items-center justify-between border-b border-border bg-sidebar/50 px-6 py-2 text-xs lg:flex">
      <div className="flex items-center gap-4">
        <span className="flex items-center gap-1.5 font-medium text-foreground">
          <Cpu className="h-3.5 w-3.5 text-muted-foreground" />
          BIS Verification Suite
        </span>

        <span className="h-3 w-px bg-border" aria-hidden="true" />

        <span className="text-muted-foreground">
          <span className="font-semibold text-foreground">
            {codesCount ?? '—'}
          </span>{' '}
          indexed standards
        </span>

        <span className="text-muted-foreground">
          <span className="font-semibold text-foreground">
            {nodesCount ?? '—'}
          </span>{' '}
          graph nodes
        </span>
      </div>

      <div className="flex items-center gap-4">
        <span className="flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
          API operational
        </span>
        <span className="font-mono text-[11px] text-muted-foreground/60">
          ChromaDB · BFS Graph
        </span>
      </div>
    </div>
  )
}