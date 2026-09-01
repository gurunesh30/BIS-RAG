import { useState } from 'react'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { TabNavigation } from '@/components/layout/TabNavigation'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { HeaderStatsBar } from '@/components/layout/HeaderStatsBar'
import { RagAssistant } from '@/components/rag/RagAssistant'
import { GraphVerifier } from '@/components/graph/GraphVerifier'
import { Shield, Activity, Menu, X, Cpu } from 'lucide-react'
import { Button } from '@/components/ui/button'

function App() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="min-h-svh bg-background text-foreground flex flex-col md:flex-row overflow-hidden">
      <Tabs defaultValue="rag" orientation="vertical" className="flex flex-1 flex-col md:flex-row w-full h-svh overflow-hidden">
        
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between border-b border-border bg-sidebar px-4 py-3 shrink-0 z-30">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-heading text-sm font-bold tracking-tight text-sidebar-foreground">
                BIS Suite
              </h1>
              <p className="text-[10px] text-muted-foreground font-mono">
                SIH26107 Engine
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-lg"
              onClick={() => setMobileMenuOpen((v) => !v)}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </header>

        {/* Vertical Left Navigation Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-40 w-72 flex-col justify-between border-r border-sidebar-border bg-sidebar md:static md:translate-x-0 flex shrink-0 ${
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex flex-col gap-6 p-5">
            {/* Branding Header */}
            <div className="flex items-center gap-3 pb-2 border-b border-border">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Shield className="h-5 w-5" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <h1 className="font-heading text-base font-bold tracking-tight text-sidebar-foreground">
                    BIS RAG Suite
                  </h1>
                </div>
                <p className="text-[11px] font-medium text-muted-foreground">
                  SIH26107 &bull; Citation &amp; License
                </p>
              </div>
            </div>

            {/* Navigation Tabs Header Label */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold tracking-wider text-muted-foreground/70 uppercase px-1">
                Navigation Modules
              </span>
              <TabNavigation />
            </div>

            {/* System Info Box */}
            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <Cpu className="h-3.5 w-3.5 text-muted-foreground" />
                  Engine Status
                </span>
                <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                  <Activity className="h-3 w-3" /> Active
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                BIS Standard RAG &amp; License verification engine running with vector search &amp; graph verification.
              </p>
            </div>
          </div>

          {/* Sidebar Footer */}
          <div className="p-4 border-t border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ThemeToggle showLabel />
            </div>
            <span className="text-[10px] font-mono text-muted-foreground/70">
              v1.2.0
            </span>
          </div>
        </aside>

        {/* Overlay backdrop for mobile menu */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 z-30 bg-background/80 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Main Content Workspace (Right Column) */}
        <main className="flex-1 flex flex-col h-full overflow-hidden bg-background">
          <HeaderStatsBar />
          
          <TabsContent value="rag" className="flex-1 border-none p-0 h-full overflow-hidden focus-visible:outline-none">
            <RagAssistant />
          </TabsContent>

          <TabsContent value="graph" className="flex-1 border-none p-0 h-full overflow-hidden focus-visible:outline-none">
            <GraphVerifier />
          </TabsContent>
        </main>
      </Tabs>
    </div>
  )
}

export default App
