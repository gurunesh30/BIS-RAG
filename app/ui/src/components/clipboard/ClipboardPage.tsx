import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useClipboard } from '@/hooks/useClipboard'
import { RETENTION_MS } from '@/lib/clipboard-store'
import {
  Clipboard, Clock3, Copy, Check, Trash2, Eraser, Inbox,
} from 'lucide-react'

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000))
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ${minutes % 60}m ago`
  return new Date(timestamp).toLocaleString()
}

function formatExpiresIn(timestamp: number): string {
  const ms = Math.max(0, timestamp + RETENTION_MS - Date.now())
  const minutes = Math.ceil(ms / 60_000)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ${minutes % 60}m`
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      return true
    } catch {
      return false
    }
  }
}

export function ClipboardPage() {
  const { items, remove, clear } = useClipboard()
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const handleCopy = async (itemId: string, text: string) => {
    const ok = await copyText(text)
    if (ok) {
      setCopiedId(itemId)
      window.setTimeout(() => setCopiedId((id) => (id === itemId ? null : id)), 1500)
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-6 py-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">Clipboard</h2>
          <p className="max-w-xl truncate text-xs text-muted-foreground">
            Everything you paste across this app is captured here for 3 hours
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant="outline" className="gap-1 text-[11px]">
            <Clock3 className="size-3" />
            {items.length} item{items.length !== 1 ? 's' : ''} · expires in 3h
          </Badge>
          {items.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={clear}
              className="rounded-md text-xs"
            >
              <Eraser className="h-3.5 w-3.5" />
              Clear all
            </Button>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="mx-auto max-w-4xl space-y-3 p-6 pb-12">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-muted/20 py-20 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card">
                <Clipboard className="h-5 w-5 text-muted-foreground" />
              </span>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">No clipped content yet</p>
                <p className="mx-auto max-w-xs text-xs leading-relaxed text-muted-foreground">
                  Paste anything into this app (e.g. queries in the RAG Assistant) and it will appear here automatically.
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/70">
                <Clock3 className="h-3 w-3" />
                Clipped items are kept for 3 hours
              </div>
            </div>
          ) : (
            items.map((item) => {
              const isExpanded = expandedId === item.id
              const isCopied = copiedId === item.id
              const preview = item.text.split('\n').filter((line) => line.trim())
              return (
                <div
                  key={item.id}
                  className="group rounded-xl border border-border bg-card transition-colors hover:border-primary/30"
                >
                  <div className="px-4 pt-3">
                    <div className="rounded-lg bg-muted/40 px-3 py-2.5">
                      <p
                        className={`text-sm leading-relaxed whitespace-pre-wrap break-words text-foreground ${
                          isExpanded ? '' : 'line-clamp-6'
                        }`}
                      >
                        {item.text}
                      </p>
                      {!isExpanded && preview.length > 6 && (
                        <button
                          type="button"
                          onClick={() => setExpandedId(item.id)}
                          className="mt-1 text-xs font-medium text-primary hover:underline"
                        >
                          Show more
                        </button>
                      )}
                      {isExpanded && (
                        <button
                          type="button"
                          onClick={() => setExpandedId(null)}
                          className="mt-1 text-xs font-medium text-primary hover:underline"
                        >
                          Show less
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 px-4 py-2.5">
                    <div className="flex min-w-0 items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="truncate">{formatTimeAgo(item.createdAt)}</span>
                      <span className="truncate font-mono text-muted-foreground/60">
                        {item.text.length.toLocaleString()} chars
                      </span>
                      <span className="flex shrink-0 items-center gap-1 text-muted-foreground/70">
                        <Clock3 className="size-3" />
                        {formatExpiresIn(item.createdAt)}
                      </span>
                    </div>

                    <div className="flex shrink-0 items-center gap-1 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-md text-xs"
                        onClick={() => void handleCopy(item.id, item.text)}
                      >
                        {isCopied ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-emerald-500" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" />
                            Copy
                          </>
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="rounded-md text-muted-foreground hover:text-destructive"
                        onClick={() => remove(item.id)}
                        aria-label="Delete item"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })
          )}

          {items.length > 0 && (
            <div className="flex items-center justify-center gap-1.5 pt-4 text-[11px] text-muted-foreground/70">
              <Inbox className="h-3 w-3" />
              Items older than 3 hours are removed automatically
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}