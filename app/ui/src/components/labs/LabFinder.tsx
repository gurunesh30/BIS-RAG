import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useLiveLocation } from '@/hooks/useLiveLocation'
import { sortLabsByDistance } from '@/lib/utils'
import type { Lab, LabWithDistance } from '@/types'
import {
  MapPin,
  Navigation,
  Phone,
  FlaskConical,
  Loader2,
  LocateFixed,
  LocateOff,
  AlertTriangle,
  ExternalLink,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react'

// ── OSM iframe map URL builder ───────────────────────────────────────────────
function buildMapUrl(userLat: number, userLon: number, labs: LabWithDistance[]): string {
  // Use OpenStreetMap embed centered on user with bounding box covering all labs
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

// ── Location status pill ─────────────────────────────────────────────────────
function LocationBadge({ status, accuracy }: { status: string; accuracy: number | null }) {
  if (status === 'pending') {
    return (
      <span className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
        <Loader2 className="h-3 w-3 animate-spin" /> Locating…
      </span>
    )
  }
  if (status === 'live') {
    return (
      <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
        <LocateFixed className="h-3 w-3" />
        GPS Live{accuracy !== null ? ` · ±${Math.round(accuracy)}m` : ''}
      </span>
    )
  }
  if (status === 'fallback') {
    return (
      <span className="flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
        <LocateOff className="h-3 w-3" /> Fallback · Pollachi Bus Stand
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1 text-[11px] font-medium text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">
      <AlertTriangle className="h-3 w-3" /> Location error
    </span>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export function LabFinder() {
  const location = useLiveLocation()
  const [labs, setLabs] = useState<Lab[]>([])
  const [labsLoading, setLabsLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Fetch labs once on mount
  useEffect(() => {
    let cancelled = false
    fetch('/labs.json')
      .then((r) => r.json())
      .then((data: Lab[]) => { if (!cancelled) setLabs(data) })
      .catch(() => { if (!cancelled) setLabs([]) })
      .finally(() => { if (!cancelled) setLabsLoading(false) })
    return () => { cancelled = true }
  }, [])

  // Re-sort every time user position changes
  const sortedLabs = useMemo(
    () => sortLabsByDistance(labs, location.lat, location.lon),
    [labs, location.lat, location.lon]
  )

  const selectedLab = sortedLabs.find((l) => l.id === selectedId) ?? null

  const mapUrl = useMemo(
    () => (sortedLabs.length > 0 ? buildMapUrl(location.lat, location.lon, sortedLabs) : null),
    [sortedLabs, location.lat, location.lon]
  )

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card px-6 py-5 shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <FlaskConical className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
              Nearby BIS Testing Labs
              <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                Live Proximity
              </Badge>
            </h2>
            <p className="text-xs text-muted-foreground">
              Testing laboratories near Pollachi sorted by real-time distance from your location.
            </p>
          </div>
        </div>
        <LocationBadge status={location.status} accuracy={location.accuracy} />
      </div>

      <ScrollArea className="flex-1 p-6">
        <div className="max-w-4xl mx-auto space-y-6 pb-12">

          {/* Map iframe */}
          <Card className="border-border shadow-sm overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <MapPin className="h-4 w-4 text-emerald-500" />
                Live Map — Your Location &amp; Lab Markers
              </CardTitle>
              <CardDescription className="text-xs">
                Blue marker = your position · Click a lab in the list to highlight it
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {mapUrl ? (
                <iframe
                  title="Pollachi Labs Map"
                  src={mapUrl}
                  className="w-full h-72 border-0"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="flex items-center justify-center h-72 text-xs text-muted-foreground gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading map…
                </div>
              )}
            </CardContent>
          </Card>

          {/* Lab list */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">
                {labsLoading ? 'Loading labs…' : `${sortedLabs.length} lab${sortedLabs.length !== 1 ? 's' : ''} · sorted by distance`}
              </span>
              {location.status === 'live' && (
                <span className="text-[11px] text-muted-foreground font-mono">
                  Updates automatically as you move
                </span>
              )}
            </div>

            {labsLoading ? (
              <div className="flex items-center justify-center py-16 text-xs text-muted-foreground gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
                Loading lab directory…
              </div>
            ) : sortedLabs.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/20 py-12 text-center">
                <FlaskConical className="h-8 w-8 text-muted-foreground/40" />
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
                    className={`w-full text-left rounded-xl border transition-all duration-150 ${
                      isSelected
                        ? 'border-emerald-500/50 bg-emerald-500/5 shadow-sm'
                        : 'border-border bg-card hover:border-emerald-500/30 hover:bg-emerald-500/5'
                    }`}
                  >
                    {/* Row header */}
                    <div className="flex items-center gap-3 px-4 py-3">
                      {/* Rank circle */}
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        isNearest
                          ? 'bg-emerald-500 text-white'
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {idx + 1}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-foreground truncate">
                            {lab.name}
                          </span>
                          {isNearest && (
                            <Badge className="text-[10px] bg-emerald-500 text-white hover:bg-emerald-600 shrink-0">
                              Nearest
                            </Badge>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                          {lab.address}
                        </p>
                      </div>

                      {/* Distance */}
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                          {lab.distanceKm < 1
                            ? `${Math.round(lab.distanceKm * 1000)} m`
                            : `${lab.distanceKm.toFixed(1)} km`}
                        </p>
                        <p className="text-[10px] text-muted-foreground">away</p>
                      </div>

                      <ChevronRight className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${isSelected ? 'rotate-90' : ''}`} />
                    </div>

                    {/* Expanded detail panel */}
                    {isSelected && (
                      <div
                        className="border-t border-border/60 px-4 py-4 space-y-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* Standards & categories */}
                        <div className="flex flex-wrap gap-1.5">
                          {lab.standards.map((s) => (
                            <Badge key={s} variant="outline" className="text-[11px] bg-emerald-500/5 border-emerald-500/30 text-emerald-700 dark:text-emerald-400">
                              <ShieldCheck className="h-3 w-3 mr-1" />{s}
                            </Badge>
                          ))}
                          {lab.categories.map((c) => (
                            <Badge key={c} variant="outline" className="text-[11px]">
                              {c}
                            </Badge>
                          ))}
                        </div>

                        {/* Contact & actions */}
                        <div className="flex flex-wrap items-center gap-3 pt-1">
                          <a
                            href={`tel:${lab.phone}`}
                            className="flex items-center gap-1.5 text-xs font-medium text-foreground hover:text-emerald-600 transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Phone className="h-3.5 w-3.5 text-emerald-500" />
                            {lab.phone}
                          </a>

                          <a
                            href={googleMapsDirectionsUrl(lab, location.lat, location.lon)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Navigation className="h-3.5 w-3.5" />
                            Get Directions
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
