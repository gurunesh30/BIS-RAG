import { CitationBadge } from '@/components/rag/CitationBadge'
import type { Citation } from '@/types'

interface ChatMessageProps {
  role: 'user' | 'assistant'
  content: string
  citations?: Citation[]
  timestamp: Date
}

const userBg = 'bg-card'
const assistantBg = 'bg-muted/30'



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
      className={`
        mx-auto max-w-[800px] px-4 py-3
        ${role === 'user' ? userBg : assistantBg}
        rounded-2xl
      `}
    >
      <div className="flex items-start gap-3">
        <span
          className={`
            mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold
            ${
  role === 'user'
    ? 'bg-primary text-primary-foreground'
    : 'bg-secondary text-secondary-foreground'
}
          `}
        >
          {role === 'user' ? 'U' : 'AI'}
        </span>
        <div className="flex-1 space-y-2">
          <div className="prose prose-sm max-w-none dark:prose-invert">
            {segments.map((seg, i) => {
              if (seg.type === 'citation' && seg.citation) {
                return (
                  <CitationBadge
                    key={i}
                    citation={seg.citation}
                    className="my-1 inline-block"
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
          {citations && citations.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {citations.map((cit, i) => (
                <CitationBadge key={i} citation={cit} />
              ))}
            </div>
          )}
        </div>
      </div>
      <time className="mt-2 block text-xs text-muted-foreground">
        {timestamp.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })}
      </time>
    </div>
  )
}
