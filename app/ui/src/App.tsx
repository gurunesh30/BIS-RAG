import { useState } from 'react'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { TabNavigation } from '@/components/layout/TabNavigation'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { HeaderStatsBar } from '@/components/layout/HeaderStatsBar'
import { RagAssistant } from '@/components/rag/RagAssistant'
import { GraphVerifier } from '@/components/graph/GraphVerifier'
import { ProductForm } from '@/components/product/ProductForm'
import { LabFinder } from '@/components/labs/LabFinder'
import { Shield, Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

function App() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="flex min-h-svh flex-col overflow-hidden bg-background text-foreground md:flex-row">
      <Tabs
        defaultValue="rag"
        orientation="vertical"
        className="flex h-svh w-full flex-1 flex-col overflow-hidden md:flex-row"
      >
        {/* Mobile header */}
        <header className="z-30 flex shrink-0 items-center justify-between border-b border-sidebar-border bg-sidebar px-4 py-3 md:hidden">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Shield className="h-5 w-5" />
            </div>
            <div className="flex flex-col leading-tight">
              <p className="text-sm font-semibold text-sidebar-foreground">BIS Verification Suite</p>
              <p className="text-xs text-muted-foreground">Standards · Licenses · Testing</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              className="rounded-lg"
              onClick={() => setMobileMenuOpen((v) => !v)}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </header>

        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 -translate-x-full flex-col border-r border-sidebar-border bg-sidebar transition-transform duration-200 md:static md:translate-x-0 ${
            mobileMenuOpen ? 'translate-x-0' : ''
          }`}
        >
          {/* Brand */}
          <div className="flex items-center gap-3 px-5 pb-4 pt-5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Shield className="h-5 w-5" />
            </div>
            <div className="flex flex-col leading-tight">
              <p className="font-heading text-sm font-semibold tracking-tight text-sidebar-foreground">
                BIS Verification Suite
              </p>
              <p className="text-xs text-muted-foreground">Standards · Licenses · Testing</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-2">
            <div className="space-y-1.5">
              <p className="px-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Workspace
              </p>
              <TabNavigation />
            </div>
          </nav>

          {/* Footer */}
          <div className="border-t border-sidebar-border p-3">
            <div className="flex items-center justify-between rounded-md px-2 py-1.5">
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                Engine online
              </span>
              <span className="font-mono text-[11px] text-muted-foreground/60">v1.2.0</span>
            </div>
            <div className="mt-1 px-2">
              <ThemeToggle showLabel />
            </div>
          </div>
        </aside>

        {/* Mobile backdrop */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 z-30 bg-background/80 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Main content */}
        <main className="flex h-full flex-1 flex-col overflow-hidden bg-background">
          <HeaderStatsBar />

          <TabsContent
            value="rag"
            className="h-full flex-1 overflow-hidden border-none p-0 outline-none focus-visible:outline-none"
          >
            <RagAssistant />
          </TabsContent>

          <TabsContent
            value="graph"
            className="h-full flex-1 overflow-hidden border-none p-0 outline-none focus-visible:outline-none"
          >
            <GraphVerifier />
          </TabsContent>

          <TabsContent
            value="product"
            className="h-full flex-1 overflow-hidden border-none p-0 outline-none focus-visible:outline-none"
          >
            <ProductForm />
          </TabsContent>

          <TabsContent
            value="labs"
            className="h-full flex-1 overflow-hidden border-none p-0 outline-none focus-visible:outline-none"
          >
            <LabFinder />
          </TabsContent>
        </main>
      </Tabs>
    </div>
  )
}

export default App