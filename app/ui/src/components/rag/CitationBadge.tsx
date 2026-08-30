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
  className,
}: CitationBadgeProps) {
  return (
    <Badge
      variant="outline"
      onClick={onClick}
      className={
        className +
        ' cursor-pointer border-primary/30 bg-primary/5 text-xs font-mono font-medium text-primary hover:bg-primary/10'
      }
    >
      [{citation.is_code} | Clause {citation.clause} | Page {citation.page}]
    </Badge>
  )
}
