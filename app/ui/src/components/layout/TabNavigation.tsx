import { TabsList, TabsTrigger } from '@/components/ui/tabs'

export function TabNavigation() {
  return (
    <TabsList
      variant="line"
      className="border-b border-border bg-background/80 backdrop-blur-sm"
    >
      <TabsTrigger value="rag" className="gap-2">
        Standards Assistant (RAG)
      </TabsTrigger>
      <TabsTrigger value="graph" className="gap-2">
        License Graph Verifier
      </TabsTrigger>
    </TabsList>
  )
}
