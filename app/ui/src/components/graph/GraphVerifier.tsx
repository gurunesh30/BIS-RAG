import { useState, useEffect, lazy, Suspense } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Plus } from 'lucide-react'
import { GraphSearchCard } from '@/components/graph/GraphSearchCard'
import { VerificationResultCard } from '@/components/graph/VerificationResultCard'
import { AddNodeDrawer } from '@/components/graph/AddNodeDrawer'
import { verifyLicense, exportGraph } from '@/lib/api'
import type { VerifyResponse, ExportGraphResponse } from '@/types'

const NetworkGraph = lazy(() => import('@/components/graph/NetworkGraph'))

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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void handleExport()
  }, [])

  return (
    <div className="flex h-[calc(100vh-73px)] flex-col">
      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
          <div className="lg:col-span-1 space-y-6">
            <GraphSearchCard
              onSearch={handleSearch}
              isLoading={isLoading}
            />
            <div className="px-6">
              <Button
                variant="outline"
                onClick={() => setDrawerOpen(true)}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Graph Node
              </Button>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <VerificationResultCard
              result={verificationResult}
              isLoading={isLoading}
            />
            <Card className="m-6 p-4">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-medium">Network Graph</h3>
                {isExporting && (
                  <span className="text-xs text-muted-foreground">
                    Refreshing graph...
                  </span>
                )}
              </div>
              <Suspense
                fallback={
                  <div className="flex h-[500px] items-center justify-center text-muted-foreground">
                    Loading network graph...
                  </div>
                }
              >
                <NetworkGraph
                  graphData={graphData ? { nodes: graphData.nodes, edges: graphData.edges } : null}
                  verificationResult={verificationResult}
                />
              </Suspense>
            </Card>
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
