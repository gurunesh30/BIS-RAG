export interface ClipboardItem {
  id: string
  text: string
  createdAt: number
}

const STORAGE_KEY = 'bis:clipboard:v1'

export const RETENTION_MS = 3 * 60 * 60 * 1000

const DEDUPE_WINDOW_MS = 30 * 1000

export const CLIPBOARD_UPDATED_EVENT = 'bis:clipboard-updated'

function isExpired(item: ClipboardItem): boolean {
  return Date.now() - item.createdAt > RETENTION_MS
}

export function readClipboardItems(): ClipboardItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const items = parsed.filter(
      (entry): entry is ClipboardItem =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as ClipboardItem).id === 'string' &&
        typeof (entry as ClipboardItem).text === 'string' &&
        typeof (entry as ClipboardItem).createdAt === 'number',
    )
    const valid = items.filter((entry) => !isExpired(entry))
    if (valid.length !== items.length) persistClipboardItems(valid)
    return valid
  } catch {
    return []
  }
}

function persistClipboardItems(items: ClipboardItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch {
    // storage unavailable or full — ignore
  }
}

function notifyUpdated(): void {
  window.dispatchEvent(new Event(CLIPBOARD_UPDATED_EVENT))
}

export function addClipboardItem(text: string): void {
  const clean = text.trim()
  if (!clean) return

  const items = readClipboardItems()
  const newest = items[0]
  if (
    newest &&
    newest.text === clean &&
    Date.now() - newest.createdAt < DEDUPE_WINDOW_MS
  ) {
    return
  }

  items.unshift({
    id: crypto.randomUUID(),
    text: clean,
    createdAt: Date.now(),
  })
  persistClipboardItems(items)
  notifyUpdated()
}

export function removeClipboardItem(id: string): void {
  const items = readClipboardItems().filter((entry) => entry.id !== id)
  persistClipboardItems(items)
  notifyUpdated()
}

export function clearClipboardItems(): void {
  persistClipboardItems([])
  notifyUpdated()
}