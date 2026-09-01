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
  fullMatch?: string
}

function parseContent(
  content: string,
  citations: Citation[] | undefined
): ParsedSegment[] {
  if (!citations || citations.length === 0) {
    return [{ type: 'text', content }]
  }

  const segments: ParsedSegment[] = []

  const sortedCitations = [...citations].sort((a, b) => {
    const aIdx = content.indexOf(
      `[${a.is_code} | Clause ${a.clause} | Page ${a.page}]`
    )
    const bIdx = content.indexOf(
      `[${b.is_code} | Clause ${b.clause} | Page ${b.page}]`
    )
    return aIdx - bIdx
  })

  let remaining = content
  for (const cit of sortedCitations) {
    const pattern = `[${cit.is_code} | Clause ${cit.clause} | Page ${cit.page}]`
    const idx = remaining.indexOf(pattern)
    if (idx === -1) continue

    if (idx > 0) {
      segments.push({ type: 'text', content: remaining.slice(0, idx) })
    }
    segments.push({
      type: 'citation',
      content: pattern,
      citation: cit,
      fullMatch: pattern,
    })
    remaining = remaining.slice(idx + pattern.length)
  }

  if (remaining) {
    segments.push({ type: 'text', content: remaining })
  }

  if (segments.length === 0) {
    return [{ type: 'text', content }]
  }

  return segments
}

export function ChatMessage({
  role,
  content,
  citations,
  timestamp,
}: ChatMessageProps) {
  const segments = parseContent(content, citations)

  return (
    <div
      className={`mx-auto flex w-full max-w-4xl gap-3 ${
        role === 'user' ? 'flex-row-reverse' : 'flex-row'
      }`}
    >
      {/* Avatar */}
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-bold ${
          role === 'user'
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-muted-foreground'
        }`}
      >
        {role === 'user' ? (
          <User className="h-4 w-4" />
        ) : (
          <Bot className="h-4 w-4" />
        )}
      </div>

      {/* Message Content Container */}
      <div className={`flex flex-col max-w-[85%] ${role === 'user' ? 'items-end' : 'items-start'}`}>
        <div
          className={`p-4 ${
            role === 'user'
              ? 'rounded-2xl rounded-tr-xs bg-primary text-primary-foreground'
              : 'rounded-2xl rounded-tl-xs bg-card border border-border text-card-foreground'
          }`}
        >
          <div className="prose prose-sm max-w-none leading-relaxed text-inherit">
            {segments.map((seg, i) => {
              if (seg.type === 'citation' && seg.citation) {
                return (
                  <CitationBadge
                    key={i}
                    citation={seg.citation}
                    className="mx-1 my-0.5 align-middle"
                  />
                )
              }
              return (
                <span key={i} className="whitespace-pre-wrap">
                  {seg.content}
                </span>
              )
            })}
          </div>

          {/* Citations Footer */}
          {citations && citations.length > 0 && (
            <div className="mt-3.5 pt-3 border-t border-border flex flex-col gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Verified Clause Citations ({citations.length}):
              </span>
              <div className="flex flex-wrap gap-1.5">
                {citations.map((cit, i) => (
                  <CitationBadge key={i} citation={cit} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Timestamp */}
        <time className="mt-1 px-1 text-[11px] font-medium text-muted-foreground/80">
          {timestamp.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </time>
      </div>
    </div>
  )
}
