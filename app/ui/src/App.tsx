import { Tabs, TabsContent } from '@/components/ui/tabs'
import { TabNavigation } from '@/components/layout/TabNavigation'
import { RagAssistant } from '@/components/rag/RagAssistant'
import { GraphVerifier } from '@/components/graph/GraphVerifier'

function App() {
  return (
    <div className="min-h-svh bg-background flex flex-col">
      <header className="border-b border-border bg-card/50 py-3 px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <span className="font-mono text-xs font-bold text-primary">BIS</span>
          </div>
          <div>
            <h1 className="font-heading text-lg font-semibold text-foreground">
              BIS RAG &amp; Verification Suite
            </h1>
            <p className="text-xs text-muted-foreground">
              SIH26107 &mdash; Standards Citation &amp; License Verification
            </p>
          </div>
        </div>
      </header>

      <Tabs defaultValue="rag" className="flex flex-1 flex-col">
        <div className="border-b border-border">
          <div className="px-6">
            <TabNavigation />
          </div>
        </div>

        <TabsContent value="rag" className="flex-1 border-none p-0">
          <RagAssistant />
        </TabsContent>

        <TabsContent value="graph" className="flex-1 border-none p-0">
          <GraphVerifier />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default App
