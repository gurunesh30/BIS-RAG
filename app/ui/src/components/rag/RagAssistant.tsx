import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import {
  Loader2, Send, FileText, ExternalLink,
  Upload, X, BookOpen, ChevronDown, ChevronUp,
} from 'lucide-react'
import { ChatMessage } from '@/components/rag/ChatMessage'
import { SourceDrawer } from '@/components/rag/SourceDrawer'
import { queryRag, ingestPdf, listIsCodes, deleteIsCode } from '@/lib/api'
import type { Citation, SourceChunk } from '@/types'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  citations?: Citation[]
  sourceChunks?: SourceChunk[]
  timestamp: Date
}

const samplePrompts = [
  'What are the mandatory tensile tests for IS 1786 steel?',
  'What is the minimum cement content for IS 456 Grade M20?',
  'What are the fire resistance requirements in IS 14544?',
  'What is the yield strength specified in IS 1786?',
]

export function RagAssistant() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [latestChunks, setLatestChunks] = useState<SourceChunk[]>([])
  const [latestCitations, setLatestCitations] = useState<Citation[]>([])

  // IS code filter
  const [selectedCode, setSelectedCode] = useState<string>('all')
  const [indexedCodes, setIndexedCodes] = useState<string[]>([])

  // PDF ingest
  const [ingestOpen, setIngestOpen] = useState(false)
  const [ingestFile, setIngestFile] = useState<File | null>(null)
  const [isIngesting, setIsIngesting] = useState(false)
  const [ingestResult, setIngestResult] = useState<{ filename: string; chunks: number } | null>(null)
  const [ingestError, setIngestError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const textAreaRef = useRef<HTMLTextAreaElement>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  const fetchCodes = async () => {
    try {
      const codes = await listIsCodes()
      setIndexedCodes(codes)
    } catch {
      // silently ignore — backend may not be up yet
    }
  }

  useEffect(() => {
    void fetchCodes()
  }, [])

  useEffect(() => {
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector('[data-slot="scroll-area-viewport"]')
      if (viewport) viewport.scrollTop = viewport.scrollHeight
    }
  }, [messages])

  // ── RAG query ──────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const response = await queryRag({
        query: userMessage.content,
        top_k: 5,
        is_code: selectedCode !== 'all' ? selectedCode : undefined,
      })

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response.answer,
        citations: response.citations,
        sourceChunks: response.source_chunks,
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, assistantMessage])
      setLatestChunks(response.source_chunks ?? [])
      setLatestCitations(response.citations ?? [])
    } catch (err) {
      const errorMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Failed to query the RAG engine. ${err instanceof Error ? err.message : 'Please check your backend connection.'}`,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMsg])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSubmit()
    }
  }

  const handlePromptClick = (prompt: string) => {
    setInput(prompt)
    textAreaRef.current?.focus()
  }

  // ── PDF ingest ─────────────────────────────────────────────────────────────

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    setIngestFile(file)
    setIngestResult(null)
    setIngestError(null)
  }

  const handleIngest = async () => {
    if (!ingestFile) return
    setIsIngesting(true)
    setIngestResult(null)
    setIngestError(null)
    try {
      const res = await ingestPdf(ingestFile)
      setIngestResult({ filename: ingestFile.name, chunks: res.chunks_ingested ?? (res as unknown as Record<string, number>).chunks_added ?? 0 })
      setIngestFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      await fetchCodes()
    } catch (err) {
      setIngestError(err instanceof Error ? err.message : 'Ingest failed.')
    } finally {
      setIsIngesting(false)
    }
  }

  const handleDeleteCode = async (code: string) => {
    try {
      await deleteIsCode(code)
      await fetchCodes()
      if (selectedCode === code) setSelectedCode('all')
    } catch {
      // ignore
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-[calc(100vh-73px)] flex-col">

      {/* ── Ingest panel ── */}
      <div className="border-b border-border bg-card/40">
        <button
          type="button"
          onClick={() => setIngestOpen((v) => !v)}
          className="flex w-full items-center gap-2 px-6 py-2.5 text-sm font-medium text-foreground/80 hover:text-foreground"
        >
          <BookOpen className="h-4 w-4" />
          Manage IS Codebooks
          <span className="ml-1 text-xs text-muted-foreground">
            ({indexedCodes.length} indexed)
          </span>
          {ingestOpen ? (
            <ChevronUp className="ml-auto h-4 w-4" />
          ) : (
            <ChevronDown className="ml-auto h-4 w-4" />
          )}
        </button>

        {ingestOpen && (
          <div className="px-6 pb-4 space-y-4">
            {/* Upload row */}
            <div className="flex items-center gap-3">
              <label
                htmlFor="pdf-upload"
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-4 py-2.5 text-sm text-muted-foreground hover:border-primary/50 hover:text-foreground"
              >
                <Upload className="h-4 w-4" />
                {ingestFile ? ingestFile.name : 'Choose IS codebook PDF…'}
              </label>
              <input
                id="pdf-upload"
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                className="sr-only"
                onChange={handleFileChange}
              />
              <Button
                size="sm"
                disabled={!ingestFile || isIngesting}
                onClick={handleIngest}
              >
                {isIngesting ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Indexing…</>
                ) : (
                  <><Upload className="h-3.5 w-3.5 mr-1.5" />Ingest</>
                )}
              </Button>
              {ingestFile && !isIngesting && (
                <button
                  type="button"
                  onClick={() => {
                    setIngestFile(null)
                    if (fileInputRef.current) fileInputRef.current.value = ''
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Feedback */}
            {ingestResult && (
              <p className="text-xs text-green-600 dark:text-green-400">
                ✓ Ingested <strong>{ingestResult.filename}</strong> — {ingestResult.chunks} chunks indexed.
              </p>
            )}
            {ingestError && (
              <p className="text-xs text-destructive">{ingestError}</p>
            )}

            {/* Indexed codes */}
            {indexedCodes.length > 0 && (
              <>
                <Separator />
                <div className="flex flex-wrap gap-1.5">
                  <span className="text-xs text-muted-foreground self-center">Indexed:</span>
                  {indexedCodes.map((code) => (
                    <span
                      key={code}
                      className="flex items-center gap-1 rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium"
                    >
                      {code}
                      <button
                        type="button"
                        onClick={() => void handleDeleteCode(code)}
                        className="ml-0.5 text-muted-foreground hover:text-destructive"
                        title={`Remove ${code}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Chat area ── */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea ref={scrollAreaRef} className="h-full">
          <div className="space-y-4 p-6">
            {messages.length === 0 ? (
              <div className="flex h-full min-h-[400px] flex-col items-center justify-center gap-4">
                <div className="text-center">
                  <FileText className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
                  <h2 className="font-heading text-xl font-semibold text-foreground">
                    Standards Assistant (RAG)
                  </h2>
                  <p className="mt-2 max-w-md text-sm text-muted-foreground">
                    Ask questions about Indian Standard (IS) codebooks. Responses include
                    inline clause and page citations linked to the exact source text.
                  </p>
                  {indexedCodes.length === 0 && (
                    <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">
                      No codebooks indexed yet — use the panel above to upload IS PDFs first.
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 justify-center">
                  {samplePrompts.map((prompt, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handlePromptClick(prompt)}
                      className="rounded-lg border border-border bg-card px-3 py-2 text-left text-sm text-foreground/80 hover:border-primary/30 hover:bg-muted/50"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <ChatMessage
                  key={msg.id}
                  role={msg.role}
                  content={msg.content}
                  citations={msg.citations}
                  timestamp={msg.timestamp}
                />
              ))
            )}
            {isLoading && (
              <div className="mx-auto max-w-[800px] px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Retrieving clause citations
                  {selectedCode !== 'all' && (
                    <Badge variant="secondary" className="text-xs">{selectedCode}</Badge>
                  )}
                  …
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* ── Input bar ── */}
      <div className="border-t border-border p-4">
        <div className="mx-auto max-w-[800px] space-y-2">
          {/* Filter + source chunks row */}
          <div className="flex items-center gap-2">
            {/* IS code filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground whitespace-nowrap">Filter by:</span>
              <Select value={selectedCode} onValueChange={(v) => setSelectedCode(v as string)}>
                <SelectTrigger className="h-7 w-[160px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All standards</SelectItem>
                  {indexedCodes.map((code) => (
                    <SelectItem key={code} value={code}>{code}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDrawerOpen(true)}
                disabled={latestChunks.length === 0}
                className="ml-auto h-7 text-xs"
              >
                <ExternalLink className="h-3.5 w-3.5 mr-1" />
                Show Source Chunks
              </Button>
            )}
          </div>

          {/* Textarea + send */}
          <div className="flex gap-2">
            <Textarea
              ref={textAreaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                selectedCode !== 'all'
                  ? `Ask about ${selectedCode}…`
                  : 'Ask about an IS standard…'
              }
              className="min-h-[44px] max-h-32 resize-none"
              rows={1}
              disabled={isLoading}
            />
            <Button
              onClick={() => void handleSubmit()}
              disabled={!input.trim() || isLoading}
              className="h-[44px] shrink-0"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>

      <SourceDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        chunks={latestChunks}
        citations={latestCitations}
      />
    </div>
  )
}
