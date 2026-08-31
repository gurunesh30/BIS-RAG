import { TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Sparkles, Network, BookMarked, ShieldCheck } from 'lucide-react'

export function TabNavigation() {
  return (
    <TabsList
      variant="default"
      className="flex w-full flex-col gap-1.5 bg-transparent p-0"
    >
      <TabsTrigger
        value="rag"
        className="group relative flex w-full items-center justify-start gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-sidebar-foreground/70 transition-all duration-200 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground data-active:bg-primary/10 data-active:text-primary dark:data-active:bg-primary/20 dark:data-active:text-primary-foreground"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:scale-105 group-data-active:bg-primary group-data-active:text-primary-foreground shadow-xs">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="flex flex-col text-left">
          <span className="font-semibold leading-tight">RAG Assistant</span>
          <span className="text-[11px] text-muted-foreground group-data-active:text-primary/80 dark:group-data-active:text-primary-foreground/80 font-normal">
            Standards Citation AI
          </span>
        </div>
        <BookMarked className="ml-auto h-4 w-4 opacity-0 transition-opacity group-data-active:opacity-100 text-primary" />
      </TabsTrigger>

      <TabsTrigger
        value="graph"
        className="group relative flex w-full items-center justify-start gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-sidebar-foreground/70 transition-all duration-200 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground data-active:bg-primary/10 data-active:text-primary dark:data-active:bg-primary/20 dark:data-active:text-primary-foreground"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary/10 text-secondary transition-colors group-hover:scale-105 group-data-active:bg-secondary group-data-active:text-secondary-foreground shadow-xs">
          <Network className="h-4 w-4" />
        </div>
        <div className="flex flex-col text-left">
          <span className="font-semibold leading-tight">Graph Verifier</span>
          <span className="text-[11px] text-muted-foreground group-data-active:text-primary/80 dark:group-data-active:text-primary-foreground/80 font-normal">
            License & Graph Verification
          </span>
        </div>
        <ShieldCheck className="ml-auto h-4 w-4 opacity-0 transition-opacity group-data-active:opacity-100 text-secondary" />
      </TabsTrigger>
    </TabsList>
  )
}
