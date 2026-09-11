import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, AlertTriangle, ArrowRight, Loader2 } from 'lucide-react'
import type { VerifyResponse, TraversalEdge, TraversalNode } from '@/types'

interface VerificationResultCardProps {
  result: VerifyResponse | null
  isLoading?: boolean
}

function getNodeLabel(node: TraversalNode): string {
  if (typeof node.label === 'string') return node.label
  if (typeof node === 'string') return node
  return node.id || 'Unknown'
}

function getEdgeLabel(edge: TraversalEdge): string {
  return edge.relation || 'Connected'
}

const NODE_TYPE_CLASSES: Record<string, string> = {
  License: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30',
  Product: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30',
  Manufacturer: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  IndianStandard: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
  TestLab: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30',
}

export function VerificationResultCard({ result, isLoading }: VerificationResultCardProps) {
  if (isLoading) {
    return (
      <Card className="border-border bg-card p-6">
        <div className="flex flex-col items-center justify-center gap-2 py-10">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="text-sm font-medium text-foreground">Verifying chain</span>
          <span className="text-xs text-muted-foreground">
            Checking license, lab accreditation, and manufacturer validity
          </span>
        </div>
      </Card>
    )
  }

  if (!result) {
    return (
      <Card className="border-border bg-card p-6">
        <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
          <p className="text-sm font-medium text-foreground">No verification active</p>
          <p className="text-xs text-muted-foreground max-w-sm">
            Enter a CM/L license or HUID number in the search above to analyze the supply chain path.
          </p>
        </div>
      </Card>
    )
  }

  const isVerified = result.is_valid

  return (
    <Card
      className={`overflow-hidden border bg-card ${
        isVerified ? 'border-emerald-500/40' : 'border-rose-500/40'
      }`}
    >
      <CardHeader className="border-b border-border pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            {isVerified ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-rose-500" />
            )}
            <span className={isVerified ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
              {isVerified ? 'License verified' : 'License invalid'}
            </span>
          </CardTitle>
          <Badge variant="secondary" className="font-mono text-xs">
            {result.license_id}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 p-6">
        {isVerified ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-md bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
              Chain verified through {result.traversed_path.nodes.length} hop{result.traversed_path.nodes.length !== 1 ? 's' : ''} with no broken relationships.
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Traversal path</p>
              <div className="flex flex-col gap-2">
                {result.traversed_path.nodes.map((node, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-md border border-border bg-background p-3"
                  >
                    <div className="flex items-center gap-2.5">
                      <Badge variant="outline" className="w-12 justify-center font-mono text-[10px]">
                        #{i + 1}
                      </Badge>
                      <span className="text-sm font-medium text-foreground">{getNodeLabel(node)}</span>
                    </div>
                    <Badge className={`border font-mono text-xs ${NODE_TYPE_CLASSES[node.type] || 'bg-muted text-foreground'}`}>
                      {node.type}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5 rounded-md border border-rose-500/30 bg-rose-500/10 p-3">
              <p className="flex items-center gap-2 text-sm font-semibold text-rose-600 dark:text-rose-400">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Verification failed
              </p>
              <p className="text-xs font-medium leading-relaxed text-rose-700 dark:text-rose-300">
                {result.failure_reason || 'License chain path contains suspended, expired, or non-accredited edges.'}
              </p>
            </div>

            {result.traversed_path?.nodes?.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Partial traversal before failure</p>
                <div className="flex flex-col gap-2">
                  {result.traversed_path.nodes.map((node, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-md border border-border bg-background p-3"
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="w-12 justify-center font-mono text-[10px]">
                          #{i + 1}
                        </Badge>
                        <span className="text-sm font-medium text-foreground">{getNodeLabel(node)}</span>
                      </div>
                      <Badge variant="secondary" className="font-mono text-xs">{node.type}</Badge>
                    </div>
                  ))}

                  {result.traversed_path.edges?.length > 0 && (
                    <div className="space-y-1.5 border-t border-border pt-2">
                      <p className="text-[11px] font-medium text-muted-foreground">Broken edges</p>
                      {result.traversed_path.edges.map((edge, i) => (
                        <div
                          key={i}
                          className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-rose-500/5 p-2.5 text-xs"
                        >
                          <span className="font-medium text-foreground">{getEdgeLabel(edge as TraversalEdge)}</span>
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          <Badge variant="destructive" className="text-[10px]">
                            {edge.status}
                          </Badge>
                          {edge.expiry_date && (
                            <span className="font-mono text-[11px] text-rose-500">Expiry: {edge.expiry_date}</span>
                          )}
                          {edge.lab_accreditation && (
                            <span className="font-mono text-[11px] text-rose-500">Lab: {edge.lab_accreditation}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}