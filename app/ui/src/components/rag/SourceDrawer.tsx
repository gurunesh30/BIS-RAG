import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from '@/components/ui/drawer'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { FileText, Layers } from 'lucide-react'
import type { SourceChunk, Citation } from '@/types'

interface SourceDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  chunks: SourceChunk[]
  citations?: Citation[]
}

export function SourceDrawer({
  open,
  onOpenChange,
  chunks,
  citations,
}: SourceDrawerProps) {
  const relevantCitations = citations ?? []

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="h-[85dvh] max-w-3xl border-border bg-card">
        <DrawerHeader className="border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-muted-foreground" />
            <div>
              <DrawerTitle className="text-sm font-semibold text-foreground">
                Retrieved Source Chunks
              </DrawerTitle>
              <DrawerDescription className="text-xs text-muted-foreground">
                Exact text segments retrieved from indexed IS standards with similarity scores.
              </DrawerDescription>
            </div>
          </div>
        </DrawerHeader>

        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="space-y-4 p-5">
              {relevantCitations.length > 0 && (
                <div className="space-y-2 rounded-md border border-border bg-muted/40 p-3">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Layers className="h-3.5 w-3.5" />
                    Citations ({relevantCitations.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {relevantCitations.map((cit, i) => (
                      <Badge
                        key={i}
                        variant="outline"
                        className="rounded-md border-border bg-background px-2.5 py-1 text-xs font-mono font-medium text-foreground"
                      >
                        {cit.is_code} | Cl. {cit.clause} | Pg {cit.page}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {relevantCitations.length > 0 && <Separator />}

              {chunks.map((chunk, idx) => {
                const match = Math.round(chunk.similarity * 100)
                return (
                  <div
                    key={chunk.id || idx}
                    className="rounded-md border border-border bg-card p-4"
                  >
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge className="border-border bg-muted text-foreground text-xs font-mono">
                          {chunk.metadata.is_code}
                        </Badge>
                        <Badge variant="outline" className="font-mono text-xs">
                          Cl. {chunk.metadata.clause}
                        </Badge>
                        <Badge variant="outline" className="font-mono text-xs">
                          Pg {chunk.metadata.page}
                        </Badge>
                      </div>
                      <Badge
                        variant={match >= 80 ? 'default' : 'secondary'}
                        className="font-mono text-xs"
                      >
                        {match}% match
                      </Badge>
                    </div>

                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                      {chunk.text}
                    </p>
                  </div>
                )
              })}

              {chunks.length === 0 && (
                <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-muted-foreground">
                  <FileText className="h-7 w-7 opacity-40" />
                  <p className="text-sm">No source chunks retrieved yet.</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </DrawerContent>
    </Drawer>
  )
}