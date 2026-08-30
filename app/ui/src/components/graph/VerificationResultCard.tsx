import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react'
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

export function VerificationResultCard({
  result,
  isLoading,
}: VerificationResultCardProps) {
  if (isLoading) {
    return (
      <Card className="m-6">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <div className="text-center text-muted-foreground">
              Running BFS verification...
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!result) {
    return (
      <Card className="m-6">
        <CardHeader>
          <CardTitle>Verification Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="py-8 text-center text-muted-foreground">
            Enter a license or HUID number to verify.
          </div>
        </CardContent>
      </Card>
    )
  }

  const isVerified = result.is_valid

  return (
    <Card
      className={`
        m-6 border-2
        ${isVerified
          ? 'border-green-500/30 bg-green-50/50 dark:bg-green-950/20'
          : 'border-red-500/30 bg-red-50/50 dark:bg-red-950/20'}
      `}
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {isVerified ? (
            <CheckCircle className="h-6 w-6 text-green-500" />
          ) : (
            <XCircle className="h-6 w-6 text-red-500" />
          )}
          {isVerified ? 'VERIFIED / LEGITIMATE' : 'FRAUD / INVALID'}
          <Badge variant={isVerified ? 'default' : 'destructive'}>
            {result.license_id}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isVerified ? (
          <div className="space-y-3">
            <p className="text-sm text-foreground/90">
              The license chain has been verified through {result.traversed_path.nodes.length} hops.
            </p>
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase text-muted-foreground">
                Traversed Path
              </p>
              <div className="flex flex-col gap-1.5">
                {result.traversed_path.nodes.map((node, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <Badge variant="outline" className="text-xs">
                      Hop {i}
                    </Badge>
                    <span className="font-medium">
                      {getNodeLabel(node)}
                    </span>
                    <Badge variant="secondary" className="text-xs">
                      {node.type}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-lg border border-red-500/20 bg-red-50/50 p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 text-red-500" />
                <div>
                  <p className="text-sm font-medium text-red-700 dark:text-red-300">
                    Verification Failed
                  </p>
                  <p className="mt-1 text-sm text-red-700/80 dark:text-red-300/80">
                    {result.failure_reason || 'Unknown failure reason'}
                  </p>
                </div>
              </div>
            </div>
            {result.traversed_path &&
              result.traversed_path.nodes &&
              result.traversed_path.nodes.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase text-muted-foreground">
                    Partial Traversal
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {result.traversed_path.nodes.map((node, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <Badge variant="outline" className="text-xs">
                          Hop {i}
                        </Badge>
                        <span className="font-medium">
                          {getNodeLabel(node)}
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          {node.type}
                        </Badge>
                      </div>
                    ))}
                    {result.traversed_path.edges &&
                      result.traversed_path.edges.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {result.traversed_path.edges.map((edge, i) => (
                            <div
                              key={i}
                              className="flex items-center gap-2 text-xs text-muted-foreground"
                            >
                              <span>
                                {getEdgeLabel(edge as TraversalEdge)}:
                              </span>
                              <span className="text-red-500/70">
                                Status: {edge.status}
                              </span>
                              {edge.expiry_date && (
                                <>
                                  <span>Expiry:</span>
                                  <span className="text-red-500/70">
                                    {edge.expiry_date}
                                  </span>
                                </>
                              )}
                              {edge.lab_accreditation && (
                                <>
                                  <span>Lab:</span>
                                  <span className="text-red-500/70">
                                    {edge.lab_accreditation}
                                  </span>
                                </>
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