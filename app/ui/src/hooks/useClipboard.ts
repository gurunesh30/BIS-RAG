import { useCallback, useEffect, useState } from 'react'
import {
  CLIPBOARD_UPDATED_EVENT,
  addClipboardItem,
  clearClipboardItems,
  readClipboardItems,
  removeClipboardItem,
  type ClipboardItem,
} from '@/lib/clipboard-store'

export function useClipboard() {
  const [items, setItems] = useState<ClipboardItem[]>(() =>
    [...readClipboardItems()].sort((a, b) => b.createdAt - a.createdAt),
  )

  const refresh = useCallback(() => {
    setItems([...readClipboardItems()].sort((a, b) => b.createdAt - a.createdAt))
  }, [])

  useEffect(() => {
    window.addEventListener(CLIPBOARD_UPDATED_EVENT, refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener(CLIPBOARD_UPDATED_EVENT, refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [refresh])

  const add = useCallback((text: string) => {
    addClipboardItem(text)
    refresh()
  }, [refresh])

  const remove = useCallback((id: string) => {
    removeClipboardItem(id)
  }, [])

  const clear = useCallback(() => {
    clearClipboardItems()
  }, [])

  return { items, add, remove, clear }
}

export function useClipboardCapture() {
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const text = event.clipboardData?.getData('text') ?? ''
      if (text.trim()) addClipboardItem(text)
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [])
}