import { Badge } from '@/components/ui/badge'
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
      className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-muted/60 px-2 py-0.5 font-mono text-[11px] font-medium text-foreground transition-colors hover:bg-muted ${className}`}
      title={`${citation.is_code}, Clause ${citation.clause}, Page ${citation.page}`}
    >
      {citation.is_code}
      <span className="text-muted-foreground/50">|</span>
      Cl. {citation.clause}
      <span className="text-muted-foreground/50">|</span>
      Pg {citation.page}
    </Badge>
  )
}