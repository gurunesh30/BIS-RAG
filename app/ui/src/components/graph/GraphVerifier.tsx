import { useState, useEffect, lazy, Suspense } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Plus, RefreshCw, Network, Layers, Loader2 } from 'lucide-react'
import { GraphSearchCard } from '@/components/graph/GraphSearchCard'
import { VerificationResultCard } from '@/components/graph/VerificationResultCard'
import { AddNodeDrawer } from '@/components/graph/AddNodeDrawer'
import { verifyLicense, exportGraph } from '@/lib/api'
import type { VerifyResponse, ExportGraphResponse } from '@/types'

const NetworkGraph = lazy(() => import('@/components/graph/NetworkGraph'))

const LEGEND_ITEMS = [
  { label: 'License', color: 'bg-purple-500' },
  { label: 'Product', color: 'bg-blue-500' },
  { label: 'Manufacturer', color: 'bg-emerald-500' },
  { label: 'Standard', color: 'bg-amber-500' },
  { label: 'TestLab', color: 'bg-rose-500' },
]

export function GraphVerifier() {
  const [verificationResult, setVerificationResult] = useState<VerifyResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [graphData, setGraphData] = useState<ExportGraphResponse | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const handleSearch = async (licenseId: string) => {
    setIsLoading(true)
    try {
      const result = await verifyLicense(licenseId)
      setVerificationResult(result)
    } catch {
      setVerificationResult(null)
    } finally {
      setIsLoading(false)
    }
  }

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const data = await exportGraph()
      setGraphData(data)
    } catch {
      // Graph export failed - will show empty state
    } finally {
      setIsExporting(false)
    }
  }

  const handleNodeAdded = () => {
    void handleExport()
  }

  useEffect(() => {
    void handleExport()
  }, [])

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">

      {/* Top Controls / Quick Action Bar */}
      <div className="border-b border-border bg-card px-6 py-3 shrink-0 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Network className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground leading-tight">Supply Chain Graph Workspace</h2>
            <p className="text-[11px] text-muted-foreground">Verify license validity &amp; graph topology</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleExport()}
            disabled={isExporting}
            className="h-9 text-xs rounded-lg border-border hover:bg-muted"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isExporting ? 'animate-spin' : ''}`} />
            Refresh Graph
          </Button>

          <Button
            size="sm"
            onClick={() => setDrawerOpen(true)}
            className="h-9 text-xs rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add Graph Node
          </Button>
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left Column: Search & Action (4 cols) */}
            <div className="lg:col-span-5 space-y-6">
              <GraphSearchCard
                onSearch={handleSearch}
                isLoading={isLoading}
              />

              <VerificationResultCard
                result={verificationResult}
                isLoading={isLoading}
              />
            </div>

            {/* Right Column: Network Graph Canvas (7 cols) */}
            <div className="lg:col-span-7">
              <Card className="border-border bg-card rounded-xl p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-bold text-foreground">Interactive Force Graph</h3>
                    {graphData?.nodes && (
                      <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-mono font-medium text-primary">
                        {graphData.nodes.length} nodes &bull; {graphData.edges?.length || 0} edges
                      </span>
                    )}
                  </div>

                  {/* Graph Color Legend */}
                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    {LEGEND_ITEMS.map((item) => (
                      <span key={item.label} className="flex items-center gap-1 font-medium text-muted-foreground">
                        <span className={`h-2.5 w-2.5 rounded-full ${item.color}`} />
                        {item.label}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="relative rounded-lg border border-border bg-background overflow-hidden min-h-[480px]">
                  <Suspense
                    fallback={
                      <div className="flex h-[480px] items-center justify-center text-muted-foreground text-sm space-y-2">
                        <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
                        <span>Rendering force layout network graph…</span>
                      </div>
                    }
                  >
                    <NetworkGraph
                      graphData={graphData ? { nodes: graphData.nodes, edges: graphData.edges } : null}
                      verificationResult={verificationResult}
                    />
                  </Suspense>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>

      <AddNodeDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onSuccess={handleNodeAdded}
      />
    </div>
  )
}
