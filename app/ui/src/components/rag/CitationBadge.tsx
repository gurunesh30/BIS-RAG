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
      className={`inline-flex items-center gap-1.5 cursor-pointer rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-mono font-semibold text-primary transition-all duration-200 hover:bg-primary/20 hover:border-primary/50 hover:shadow-xs active:scale-95 ${className}`}
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
