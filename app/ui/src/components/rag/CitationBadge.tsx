import { Badge } from '@/components/ui/badge'
import { Bookmark } from 'lucide-react'
import type { Citation } from '@/types'

interface CitationBadgeProps {
  citation: Citation
  onClick?: () => void
  className?: string
}

export function CitationBadge({
  citation,
  onClick,
  className = '',
}: CitationBadgeProps) {
  return (
    <Badge
      variant="outline"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 cursor-pointer rounded-md border border-border bg-muted px-2.5 py-1 text-xs font-mono font-semibold text-foreground hover:bg-muted/80 ${className}`}
      title={`IS Code: ${citation.is_code}, Clause: ${citation.clause}, Page: ${citation.page}`}
    >
      <Bookmark className="h-3 w-3 text-primary/80" />
      <span>{citation.is_code}</span>
      <span className="opacity-40">|</span>
      <span>Cl. {citation.clause}</span>
      <span className="opacity-40">|</span>
      <span className="opacity-80">Pg {citation.page}</span>
    </Badge>
  )
}
