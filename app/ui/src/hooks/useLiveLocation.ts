import { useState, useEffect, useRef } from 'react'

// Fallback: Pollachi Bus Stand
const FALLBACK_LAT = 10.6582
const FALLBACK_LON = 77.0082

export type LocationStatus = 'pending' | 'live' | 'fallback' | 'error'

export interface LiveLocation {
  lat: number
  lon: number
  accuracy: number | null   // metres, null when using fallback
  status: LocationStatus
  errorMessage: string | null
}

/**
 * Streams the user's GPS position via watchPosition.
 * Falls back to Pollachi Bus Stand coordinates if the browser denies
 * location access or the API is unavailable.
 */
export function useLiveLocation(): LiveLocation {
  const [location, setLocation] = useState<LiveLocation>({
    lat: FALLBACK_LAT,
    lon: FALLBACK_LON,
    accuracy: null,
    status: 'pending',
    errorMessage: null,
  })

  const watchIdRef = useRef<number | null>(null)

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocation({
        lat: FALLBACK_LAT,
        lon: FALLBACK_LON,
        accuracy: null,
        status: 'fallback',
        errorMessage: 'Geolocation not supported by this browser.',
      })
      return
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setLocation({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          status: 'live',
          errorMessage: null,
        })
      },
      (err) => {
        setLocation({
          lat: FALLBACK_LAT,
          lon: FALLBACK_LON,
          accuracy: null,
          status: err.code === err.PERMISSION_DENIED ? 'fallback' : 'error',
          errorMessage: err.message,
        })
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 5_000 }
    )

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
    }
  }, [])

  return location
}
