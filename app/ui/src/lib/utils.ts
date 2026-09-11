import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { BISProductEntry } from "@/types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
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
