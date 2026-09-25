import { useState, useEffect, lazy, Suspense } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Plus, RefreshCw, Loader2 } from 'lucide-react'
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
  { label: 'Test Lab', color: 'bg-rose-500' },
]

export function GraphVerifier() {
  const [verificationResult, setVerificationResult] = useState<VerifyResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [graphData, setGraphData] = useState<ExportGraphResponse | null>(null)
  const [isExporting, setIsExporting] = useState(true)
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
      // empty
    } finally {
      setIsExporting(false)
    }
  }

  const handleNodeAdded = () => {
    void handleExport()
  }

  useEffect(() => {
    let cancelled = false
    exportGraph()
      .then((data) => { if (!cancelled) setGraphData(data) })
      .catch(() => {
        // empty
      })
      .finally(() => { if (!cancelled) setIsExporting(false) })
    return () => { cancelled = true }
  }, [])

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-4 border-b border-border bg-card px-6 py-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Supply Chain Graph</h2>
          <p className="text-xs text-muted-foreground">
            Verify license validity and graph topology
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleExport()}
            disabled={isExporting}
            className="rounded-md text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isExporting ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => setDrawerOpen(true)}
            className="rounded-md text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Node
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Left column */}
            <div className="space-y-6 lg:col-span-5">
              <GraphSearchCard onSearch={handleSearch} isLoading={isLoading} />
              <VerificationResultCard result={verificationResult} isLoading={isLoading} />
            </div>

            {/* Right column: graph */}
            <div className="lg:col-span-7">
              <Card className="space-y-4 border-border bg-card p-5">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                  <div className="flex items-center gap-3">
                    <h3 className="text-sm font-semibold text-foreground">Network graph</h3>
                    {graphData?.nodes && (
                      <span className="rounded-md bg-primary/10 px-2 py-0.5 font-mono text-xs font-medium text-primary">
                        {graphData.nodes.length} nodes, {graphData.edges?.length || 0} edges
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-[11px]">
                    {LEGEND_ITEMS.map((item) => (
                      <span key={item.label} className="flex items-center gap-1 font-medium text-muted-foreground">
                        <span className={`h-2 w-2 rounded-full ${item.color}`} />
                        {item.label}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="relative min-h-[480px] overflow-hidden rounded-md border border-border bg-background">
                  <Suspense
                    fallback={
                      <div className="flex h-[480px] items-center justify-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading graph
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

      <AddNodeDrawer open={drawerOpen} onOpenChange={setDrawerOpen} onSuccess={handleNodeAdded} />
    </div>
  )
}