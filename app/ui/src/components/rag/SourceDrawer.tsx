import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
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
      <DrawerContent className="h-[90dvh] max-w-2xl">
        <DrawerHeader>
          <DrawerTitle>Retrieved Source Chunks</DrawerTitle>
        </DrawerHeader>
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-4">
              {relevantCitations.length > 0 && (
                <>
                  <div className="mb-4 flex flex-wrap gap-1.5">
                    <span className="text-xs font-medium text-muted-foreground">
                      Cited sources:
                    </span>
                    {relevantCitations.map((cit, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {cit.is_code} | Clause {cit.clause} | Page {cit.page}
                      </Badge>
                    ))}
                  </div>
                  <Separator className="mb-4" />
                </>
              )}
              {chunks.map((chunk) => (
                <div
                  key={chunk.id}
                  className="mb-4 rounded-lg border border-border p-3"
                >
                  <div className="mb-2 flex flex-wrap gap-1">
                    <Badge variant="outline" className="text-xs">
                      {chunk.metadata.is_code}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      Clause {chunk.metadata.clause}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      Page {chunk.metadata.page}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      Similarity: {Math.round(chunk.similarity * 100)}%
                    </Badge>
                  </div>
                  <p className="text-sm text-foreground/90">
                    {chunk.text}
                  </p>
                </div>
              ))}
              {chunks.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No source chunks available.
                </p>
              )}
            </div>
          </ScrollArea>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
