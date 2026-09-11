import { CitationBadge } from '@/components/rag/CitationBadge'
import { User, Bot } from 'lucide-react'
import type { Citation } from '@/types'

interface ChatMessageProps {
  role: 'user' | 'assistant'
  content: string
  citations?: Citation[]
  timestamp: Date
}

interface ParsedSegment {
  type: 'text' | 'citation'
  content: string
  citation?: Citation
}

function parseContent(
  content: string,
  citations: Citation[] | undefined,
): ParsedSegment[] {
  if (!citations || citations.length === 0) {
    return [{ type: 'text', content }]
  }

  const segments: ParsedSegment[] = []
  const sorted = [...citations].sort((a, b) => {
    const pattern = (c: Citation) => `[${c.is_code} | Clause ${c.clause} | Page ${c.page}]`
    return content.indexOf(pattern(a)) - content.indexOf(pattern(b))
  })

  let remaining = content
  for (const cit of sorted) {
    const pattern = `[${cit.is_code} | Clause ${cit.clause} | Page ${cit.page}]`
    const idx = remaining.indexOf(pattern)
    if (idx === -1) continue

    if (idx > 0) {
      segments.push({ type: 'text', content: remaining.slice(0, idx) })
    }
    segments.push({ type: 'citation', content: pattern, citation: cit })
    remaining = remaining.slice(idx + pattern.length)
  }

  if (remaining) {
    segments.push({ type: 'text', content: remaining })
  }

  return segments.length > 0 ? segments : [{ type: 'text', content }]
}

export function ChatMessage({
  role,
  content,
  citations,
  timestamp,
}: ChatMessageProps) {
  const segments = parseContent(content, citations)
  const isUser = role === 'user'

  return (
    <div className={`mx-auto flex w-full max-w-4xl gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md font-semibold ${
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'border border-border bg-card text-muted-foreground'
        }`}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      {/* Message */}
      <div className={`flex max-w-[85%] flex-col ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={`px-4 py-3 text-sm leading-relaxed ${
            isUser
              ? 'rounded-lg rounded-tr-sm bg-primary text-primary-foreground'
              : 'rounded-lg rounded-tl-sm border border-border bg-card text-card-foreground'
          }`}
        >
          <div className="whitespace-pre-wrap leading-relaxed">
            {segments.map((seg, i) =>
              seg.type === 'citation' && seg.citation ? (
                <CitationBadge
                  key={i}
                  citation={seg.citation}
                  className="mx-0.5 my-0.5 align-middle"
                />
              ) : (
                <span key={i}>{seg.content}</span>
              ),
            )}
          </div>

          {citations && citations.length > 0 && (
            <div className="mt-3 space-y-1.5 border-t border-border pt-3">
              <p className="text-[11px] font-medium text-muted-foreground">
                Citations ({citations.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {citations.map((cit, i) => (
                  <CitationBadge key={i} citation={cit} />
                ))}
              </div>
            </div>
          )}
        </div>

        <time className="mt-1 px-1 font-mono text-[11px] text-muted-foreground">
          {timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </time>
      </div>
    </div>
  )
}