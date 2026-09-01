import { TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BookOpen, Network, BookMarked, ShieldCheck } from 'lucide-react'

export function TabNavigation() {
  return (
    <TabsList
      variant="default"
      className="flex w-full flex-col gap-1.5 bg-transparent p-0"
    >
      <TabsTrigger
        value="rag"
        className="group relative flex w-full items-center justify-start gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground data-active:bg-muted data-active:text-foreground"
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-muted-foreground group-data-active:bg-primary group-data-active:text-primary-foreground">
          <BookOpen className="h-4 w-4" />
        </div>
        <div className="flex flex-col text-left">
          <span className="font-semibold leading-tight">RAG Assistant</span>
          <span className="text-[11px] text-muted-foreground font-normal">
            Standards Citation &amp; Query
          </span>
        </div>
        <BookMarked className="ml-auto h-4 w-4 opacity-0 group-data-active:opacity-100 text-primary" />
      </TabsTrigger>

      <TabsTrigger
        value="graph"
        className="group relative flex w-full items-center justify-start gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground data-active:bg-muted data-active:text-foreground"
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-muted-foreground group-data-active:bg-secondary group-data-active:text-secondary-foreground">
          <Network className="h-4 w-4" />
        </div>
        <div className="flex flex-col text-left">
          <span className="font-semibold leading-tight">Graph Verifier</span>
          <span className="text-[11px] text-muted-foreground font-normal">
            License &amp; Graph Verification
          </span>
        </div>
        <ShieldCheck className="ml-auto h-4 w-4 opacity-0 group-data-active:opacity-100 text-secondary" />
      </TabsTrigger>
    </TabsList>
  )
}
