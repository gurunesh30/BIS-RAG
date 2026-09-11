import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useLiveLocation } from '@/hooks/useLiveLocation'
import { sortLabsByDistance } from '@/lib/utils'
import type { Lab, LabWithDistance } from '@/types'
import {
  MapPin, Navigation, Phone, FlaskConical, Loader2,
  LocateFixed, LocateOff, AlertTriangle, ExternalLink, ChevronRight,
} from 'lucide-react'

function buildMapUrl(userLat: number, userLon: number, labs: LabWithDistance[]): string {
  const allLats = [userLat, ...labs.map((l) => l.latitude)]
  const allLons = [userLon, ...labs.map((l) => l.longitude)]
  const minLat = Math.min(...allLats) - 0.02
  const maxLat = Math.max(...allLats) + 0.02
  const minLon = Math.min(...allLons) - 0.02
  const maxLon = Math.max(...allLons) + 0.02
  return `https://www.openstreetmap.org/export/embed.html?bbox=${minLon},${minLat},${maxLon},${maxLat}&layer=mapnik&marker=${userLat},${userLon}`
}

function googleMapsDirectionsUrl(lab: Lab, userLat: number, userLon: number): string {
  return `https://www.google.com/maps/dir/${userLat},${userLon}/${lab.latitude},${lab.longitude}`
}

function LocationBadge({ status, accuracy }: { status: string; accuracy: number | null }) {
  if (status === 'pending') {
    return (
      <span className="flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Locating
      </span>
    )
  }
  if (status === 'live') {
    return (
      <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
        <LocateFixed className="h-3 w-3" />
        GPS live{accuracy !== null ? ` ±${Math.round(accuracy)}m` : ''}
      </span>
    )
  }
  if (status === 'fallback') {
    return (
      <span className="flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
        <LocateOff className="h-3 w-3" />
        Fallback
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1.5 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
      <AlertTriangle className="h-3 w-3" />
      Location error
    </span>
  )
}

export function LabFinder() {
  const location = useLiveLocation()
  const [labs, setLabs] = useState<Lab[]>([])
  const [labsLoading, setLabsLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/labs.json')
      .then((r) => r.json())
      .then((data: Lab[]) => { if (!cancelled) setLabs(data) })
      .catch(() => { if (!cancelled) setLabs([]) })
      .finally(() => { if (!cancelled) setLabsLoading(false) })
    return () => { cancelled = true }
  }, [])

  const sortedLabs = useMemo(
    () => sortLabsByDistance(labs, location.lat, location.lon),
    [labs, location.lat, location.lon],
  )

  const mapUrl = useMemo(
    () => (sortedLabs.length > 0 ? buildMapUrl(location.lat, location.lon, sortedLabs) : null),
    [sortedLabs, location.lat, location.lon],
  )

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border bg-card px-6 py-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Nearby Testing Labs</h2>
          <p className="text-xs text-muted-foreground">
            Testing laboratories sorted by distance from your current location
          </p>
        </div>
        <LocationBadge status={location.status} accuracy={location.accuracy} />
      </div>

      <ScrollArea className="flex-1 p-6">
        <div className="mx-auto max-w-4xl space-y-6 pb-12">
          {/* Map */}
          <Card className="overflow-hidden border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Location map</CardTitle>
              <CardDescription className="text-xs">
                Blue marker = your position
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {mapUrl ? (
                <iframe
                  title="Lab locations map"
                  src={mapUrl}
                  className="h-72 w-full border-0"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="flex h-72 items-center justify-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading map
                </div>
              )}
            </CardContent>
          </Card>

          {/* Lab list */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <p className="text-[11px] font-medium text-muted-foreground">
                {labsLoading
                  ? 'Loading labs...'
                  : `${sortedLabs.length} lab${sortedLabs.length !== 1 ? 's' : ''} sorted by distance`}
              </p>
              {location.status === 'live' && (
                <span className="font-mono text-[11px] text-muted-foreground">
                  Updates automatically as you move
                </span>
              )}
            </div>

            {labsLoading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-xs text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading lab directory
              </div>
            ) : sortedLabs.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-muted/20 py-12 text-center">
                <FlaskConical className="h-7 w-7 text-muted-foreground/40" />
                <p className="text-sm font-medium text-muted-foreground">No labs found</p>
              </div>
            ) : (
              sortedLabs.map((lab, idx) => {
                const isSelected = lab.id === selectedId
                const isNearest = idx === 0
                return (
                  <button
                    key={lab.id}
                    type="button"
                    onClick={() => setSelectedId(isSelected ? null : lab.id)}
                    className={`w-full rounded-md border text-left transition-all ${
                      isSelected
                        ? 'border-primary/50 bg-primary/5 shadow-sm'
                        : 'border-border bg-card hover:border-primary/30 hover:bg-primary/5'
                    }`}
                  >
                    {/* Lab row header */}
                    <div className="flex items-center gap-3 px-4 py-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground">
                        {idx + 1}
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-medium text-foreground">{lab.name}</span>
                          {isNearest && (
                            <Badge className="bg-primary text-[10px] text-primary-foreground">Nearest</Badge>
                          )}
                        </div>
                        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{lab.address}</p>
                      </div>

                      <div className="shrink-0 text-right">
                        <p className="text-sm font-semibold tabular-nums text-foreground">
                          {lab.distanceKm < 1
                            ? `${Math.round(lab.distanceKm * 1000)} m`
                            : `${lab.distanceKm.toFixed(1)} km`}
                        </p>
                        <p className="text-[10px] text-muted-foreground">away</p>
                      </div>

                      <ChevronRight
                        className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                          isSelected ? 'rotate-90' : ''
                        }`}
                      />
                    </div>

                    {/* Expanded detail */}
                    {isSelected && (
                      <div
                        className="space-y-3 border-t border-border px-4 py-4"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex flex-wrap gap-1.5">
                          {lab.standards.map((s) => (
                            <Badge key={s} variant="outline" className="border-primary/30 bg-primary/5 text-[11px]">
                              {s}
                            </Badge>
                          ))}
                          {lab.categories.map((c) => (
                            <Badge key={c} variant="outline" className="text-[11px]">{c}</Badge>
                          ))}
                        </div>

                        <div className="flex flex-wrap items-center gap-3 pt-1">
                          <a
                            href={`tel:${lab.phone}`}
                            className="flex items-center gap-1.5 text-xs font-medium text-foreground hover:text-primary transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                            {lab.phone}
                          </a>

                          <a
                            href={googleMapsDirectionsUrl(lab, location.lat, location.lon)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Navigation className="h-3.5 w-3.5" />
                            Directions
                            <ExternalLink className="h-3 w-3" />
                          </a>

                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lab.name + ' ' + lab.address)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MapPin className="h-3.5 w-3.5" />
                            View on Maps
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      </div>
                    )}
                  </button>
                )
              })
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}