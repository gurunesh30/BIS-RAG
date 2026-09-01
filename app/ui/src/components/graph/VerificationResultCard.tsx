import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, AlertTriangle, ArrowRight, ShieldCheck, ShieldAlert, Loader2, GitCommit } from 'lucide-react'
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

export function VerificationResultCard({
  result,
  isLoading,
}: VerificationResultCardProps) {
  if (isLoading) {
    return (
      <Card className="border-border bg-card rounded-xl p-6">
        <div className="flex flex-col items-center justify-center py-10 space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="text-sm font-semibold text-foreground">Executing BFS Supply Chain Graph Traversal…</span>
          <span className="text-xs text-muted-foreground">Checking license status, lab accreditation &amp; manufacturer validity</span>
        </div>
      </Card>
    )
  }

  if (!result) {
    return (
      <Card className="border-border bg-card rounded-xl p-6">
        <div className="flex flex-col items-center justify-center py-8 text-center space-y-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <GitCommit className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-bold text-foreground">No Verification Query Active</h3>
          <p className="text-xs text-muted-foreground max-w-sm">
            Enter a CM/L license or HUID standard code in the search box to analyze the supply chain graph path.
          </p>
        </div>
      </Card>
    )
  }

  const isVerified = result.is_valid

  return (
    <Card
      className={`border rounded-xl overflow-hidden ${
        isVerified
          ? 'border-emerald-500/40 bg-card'
          : 'border-rose-500/40 bg-card'
      }`}
    >
      <CardHeader className="border-b border-border pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2.5 text-lg font-bold">
            {isVerified ? (
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 text-white">
                <ShieldCheck className="h-5 w-5" />
              </div>
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500 text-white">
                <ShieldAlert className="h-5 w-5" />
              </div>
            )}
            <span className={isVerified ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
              {isVerified ? 'VERIFIED / LEGITIMATE' : 'FRAUD / INVALID LICENSE'}
            </span>
          </CardTitle>
          <Badge
            className={`font-mono text-xs px-3 py-1 rounded-md ${
              isVerified
                ? 'bg-emerald-500 text-white'
                : 'bg-rose-500 text-white'
            }`}
          >
            {result.license_id}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-5">
        {isVerified ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 p-3 text-xs font-medium text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
              <span>
                Chain verified successfully through <strong>{result.traversed_path.nodes.length} BFS graph hops</strong> without broken or expired relationships.
              </span>
            </div>

            <div className="space-y-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                Graph Traversal Sequence
              </span>
              <div className="flex flex-col gap-2">
                {result.traversed_path.nodes.map((node, i) => {
                  const nodeTypeClass = NODE_TYPE_CLASSES[node.type] || 'bg-muted text-foreground'
                  return (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-lg border border-border bg-background p-3"
                    >
                      <div className="flex items-center gap-2.5">
                        <Badge variant="outline" className="text-[10px] font-mono px-2 py-0.5">
                          Hop #{i + 1}
                        </Badge>
                        <span className="text-sm font-semibold text-foreground">
                          {getNodeLabel(node)}
                        </span>
                      </div>
                      <Badge className={`text-xs font-mono border ${nodeTypeClass}`}>
                        {node.type}
                      </Badge>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 space-y-1.5">
              <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold text-sm">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>Verification Failure Detected</span>
              </div>
              <p className="text-xs text-rose-700 dark:text-rose-300 leading-relaxed font-medium">
                {result.failure_reason || 'License chain path contains suspended, expired, or non-accredited node edges.'}
              </p>
            </div>

            {result.traversed_path && result.traversed_path.nodes && result.traversed_path.nodes.length > 0 && (
              <div className="space-y-2.5">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                  Partial Traversal Hops Before Failure
                </span>
                <div className="flex flex-col gap-2">
                  {result.traversed_path.nodes.map((node, i) => (
                    <div key={i} className="flex items-center justify-between rounded-lg border border-border bg-background p-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] font-mono">
                          Hop #{i + 1}
                        </Badge>
                        <span className="text-sm font-semibold text-foreground">
                          {getNodeLabel(node)}
                        </span>
                      </div>
                      <Badge variant="secondary" className="text-xs font-mono">
                        {node.type}
                      </Badge>
                    </div>
                  ))}

                  {result.traversed_path.edges && result.traversed_path.edges.length > 0 && (
                    <div className="mt-2 space-y-1.5 pt-2 border-t border-border">
                      <span className="text-[11px] font-semibold text-muted-foreground">Broken Edges Details:</span>
                      {result.traversed_path.edges.map((edge, i) => (
                        <div
                          key={i}
                          className="flex flex-wrap items-center gap-2 rounded-md bg-rose-500/5 border border-border p-2.5 text-xs"
                        >
                          <span className="font-semibold text-foreground">{getEdgeLabel(edge as TraversalEdge)}</span>
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          <Badge variant="destructive" className="text-[10px]">
                            Status: {edge.status}
                          </Badge>
                          {edge.expiry_date && (
                            <span className="text-rose-500 font-mono text-[11px]">
                              Expiry: {edge.expiry_date}
                            </span>
                          )}
                          {edge.lab_accreditation && (
                            <span className="text-rose-500 font-mono text-[11px]">
                              Lab Accreditation: {edge.lab_accreditation}
                            </span>
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