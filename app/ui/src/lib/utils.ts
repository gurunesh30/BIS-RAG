import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { BISProductEntry, Lab, LabWithDistance } from "@/types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Haversine formula — great-circle distance between two coordinates in km.
 */
export function getDistanceInKm(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371 // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * Annotates each lab with its distance from the given coordinates
 * and returns the array sorted nearest-first.
 */
export function sortLabsByDistance(
  labs: Lab[],
  userLat: number,
  userLon: number
): LabWithDistance[] {
  return labs
    .map((lab) => ({
      ...lab,
      distanceKm: getDistanceInKm(userLat, userLon, lab.latitude, lab.longitude),
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
}

/**
 * Normalises a string for comparison: lowercase + collapsed whitespace.
 */
function normalise(value: string): string {
  return value.toLowerCase().trim().replace(/\s+/g, ' ')
}

/**
 * Pure client-side filter for the BIS product catalog.
 *
 * Matches against productName, isCode, category, and each keyParameter.
 * Returns a new array (never mutates the source).
 *
 * @param data   - Full dataset loaded on mount.
 * @param query  - Raw search string typed by the user.
 * @returns Derived filtered array; empty array when nothing matches.
 */
export function filterArray(
  data: BISProductEntry[],
  query: string
): BISProductEntry[] {
  const q = normalise(query)
  if (!q) return data

  return data.filter((item) =>
    normalise(item.productName).includes(q) ||
    normalise(item.isCode).includes(q) ||
    normalise(item.category).includes(q) ||
    item.keyParameters.some((p) => normalise(p).includes(q))
  )
}
