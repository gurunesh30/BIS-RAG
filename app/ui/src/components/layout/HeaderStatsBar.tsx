import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Database, Network, Cpu, CheckCircle2 } from 'lucide-react'
import { listIsCodes, exportGraph } from '@/lib/api'

export function HeaderStatsBar() {
  const [codesCount, setCodesCount] = useState<number>(0)
  const [nodesCount, setNodesCount] = useState<number>(0)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const codes = await listIsCodes()
        setCodesCount(codes.length)
      } catch {
        // silently fallback
      }
      try {
        const graph = await exportGraph()
        setNodesCount(graph.nodes.length)
      } catch {
        // fallback
      }
    }
    void fetchStats()
  }, [])

  return (
    <div className="hidden lg:flex items-center justify-between border-b border-border/80 bg-sidebar/50 backdrop-blur-md px-6 py-2 text-xs shrink-0 z-10">
      {/* Left side: System status pills */}
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1.5 font-semibold text-foreground">
          <Cpu className="h-3.5 w-3.5 text-primary" />
          BIS Verification Suite
        </span>

        <div className="h-3 w-px bg-border/60" />

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1 bg-background/80 text-[11px] font-medium border-border/70">
            <Database className="h-3 w-3 text-indigo-500" />
            <span className="text-muted-foreground">Indexed Standards:</span>
            <span className="font-bold text-foreground font-mono">{codesCount}</span>
          </Badge>

          <Badge variant="outline" className="gap-1 bg-background/80 text-[11px] font-medium border-border/70">
            <Network className="h-3 w-3 text-teal-500" />
            <span className="text-muted-foreground">Graph Nodes:</span>
            <span className="font-bold text-foreground font-mono">{nodesCount}</span>
          </Badge>
        </div>
      </div>

      {/* Right side: Model & engine pills */}
      <div className="flex items-center gap-2.5">
        <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[11px] font-medium gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Engine API Operational
        </Badge>
        <span className="text-[11px] font-mono text-muted-foreground">
          Vector: ChromaDB &bull; BFS Graph
        </span>
      </div>
    </div>
  )
}
