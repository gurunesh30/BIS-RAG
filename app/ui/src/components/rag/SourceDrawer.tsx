import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from '@/components/ui/drawer'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { BookOpen, FileText, Layers } from 'lucide-react'
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
      <DrawerContent className="h-[85dvh] max-w-3xl border-border bg-card/95 backdrop-blur-xl">
        <DrawerHeader className="border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Layers className="h-4 w-4" />
            </div>
            <div>
              <DrawerTitle className="text-base font-bold text-foreground">
                Retrieved Source Chunks &amp; Contexts
              </DrawerTitle>
              <DrawerDescription className="text-xs text-muted-foreground">
                Exact text segments retrieved from indexed IS standards with similarity scores.
              </DrawerDescription>
            </div>
          </div>
        </DrawerHeader>

        <div className="flex-1 overflow-hidden p-0">
          <ScrollArea className="h-full">
            <div className="p-6 space-y-4">
              {relevantCitations.length > 0 && (
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 space-y-2">
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                    <BookOpen className="h-3.5 w-3.5" />
                    Cited Standards &amp; Clauses ({relevantCitations.length})
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {relevantCitations.map((cit, i) => (
                      <Badge
                        key={i}
                        variant="secondary"
                        className="rounded-lg border border-primary/20 bg-background/80 px-2.5 py-1 text-xs font-mono font-medium text-foreground"
                      >
                        {cit.is_code} | Clause {cit.clause} | Page {cit.page}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {relevantCitations.length > 0 && <Separator className="my-2" />}

              {chunks.map((chunk, idx) => {
                const similarityPercent = Math.round(chunk.similarity * 100)
                return (
                  <div
                    key={chunk.id || idx}
                    className="rounded-xl border border-border/80 bg-muted/20 p-4 transition-all hover:border-primary/40 hover:bg-muted/40 shadow-2xs"
                  >
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge className="bg-primary/10 text-primary hover:bg-primary/20 border-primary/20 text-xs font-mono">
                          {chunk.metadata.is_code}
                        </Badge>
                        <Badge variant="outline" className="text-xs font-mono">
                          Clause {chunk.metadata.clause}
                        </Badge>
                        <Badge variant="outline" className="text-xs font-mono">
                          Page {chunk.metadata.page}
                        </Badge>
                      </div>
                      <Badge
                        className={`text-xs font-medium ${
                          similarityPercent >= 80
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                            : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {similarityPercent}% Match
                      </Badge>
                    </div>

                    <p className="text-sm font-sans leading-relaxed text-foreground/90 whitespace-pre-wrap">
                      {chunk.text}
                    </p>
                  </div>
                )
              })}

              {chunks.length === 0 && (
                <div className="py-12 text-center text-muted-foreground space-y-2">
                  <FileText className="mx-auto h-8 w-8 opacity-40" />
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
