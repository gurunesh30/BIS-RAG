import { TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BookOpen, Clipboard, FileSearch, FlaskConical, Network } from 'lucide-react'

const TABS = [
  {
    value: 'rag',
    icon: BookOpen,
    label: 'RAG Assistant',
    description: 'Standards citation & query',
  },
  {
    value: 'graph',
    icon: Network,
    label: 'Graph Verifier',
    description: 'License & graph verification',
  },
  {
    value: 'product',
    icon: FileSearch,
    label: 'IS Code Finder',
    description: 'Product to IS number lookup',
  },
  {
    value: 'labs',
    icon: FlaskConical,
    label: 'Nearby Labs',
    description: 'Testing labs & proximity',
  },
  {
    value: 'clipboard',
    icon: Clipboard,
    label: 'Clipboard',
    description: 'Paste history (3h)',
  },
]

export function TabNavigation() {
  return (
    <TabsList
      variant="default"
      className="flex w-full flex-col gap-1 bg-transparent p-0"
    >
      {TABS.map((tab) => {
        const Icon = tab.icon
        return (
          <TabsTrigger
            key={tab.value}
            value={tab.value}
            className="group relative flex h-12 w-full items-center gap-3 rounded-md px-3 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground data-active:bg-muted data-active:text-foreground"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors group-data-active:border-primary/30 group-data-active:bg-primary/10 group-data-active:text-primary">
              <Icon className="h-4 w-4" />
            </span>
            <span className="flex flex-1 flex-col leading-tight">
              <span className="text-sm font-medium">{tab.label}</span>
              <span className="text-xs text-muted-foreground">
                {tab.description}
              </span>
            </span>
            <span
              className="h-5 w-0.5 rounded-full bg-primary opacity-0 transition-opacity group-data-active:opacity-100"
              aria-hidden="true"
            />
          </TabsTrigger>
        )
      })}
    </TabsList>
  )
}