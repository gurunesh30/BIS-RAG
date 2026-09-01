import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  Loader2, Send, FileText, ExternalLink,
  Upload, X, BookOpen, ChevronDown, ChevronUp, Filter, CheckCircle2, AlertCircle, Trash2
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
    <div className="flex flex-col h-full overflow-hidden bg-background">

      {/* ── Ingest panel ── */}
      <div className="border-b border-border bg-card shrink-0">
        <button
          type="button"
          onClick={() => setIngestOpen((v) => !v)}
          className="flex w-full items-center justify-between px-6 py-3 text-sm font-semibold text-foreground hover:bg-muted/30"
        >
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <BookOpen className="h-4 w-4" />
            </div>
            <span>Manage IS Codebooks</span>
            <Badge variant="secondary" className="rounded-full px-2.5 py-0.5 text-xs font-mono">
              {indexedCodes.length} indexed
            </Badge>
          </div>
          {ingestOpen ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        {ingestOpen && (
          <div className="px-6 pb-4 pt-1 space-y-4 border-t border-border bg-muted/10">
            {/* Upload row */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <label
                htmlFor="pdf-upload"
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border bg-background px-4 py-2 text-sm text-foreground hover:border-primary"
              >
                <Upload className="h-4 w-4 text-primary" />
                <span className="font-medium">
                  {ingestFile ? ingestFile.name : 'Choose IS Codebook PDF…'}
                </span>
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
                className="rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {isIngesting ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Indexing PDF…</>
                ) : (
                  <><Upload className="h-3.5 w-3.5 mr-1.5" />Ingest &amp; Vectorize</>
                )}
              </Button>
              {ingestFile && !isIngesting && (
                <button
                  type="button"
                  onClick={() => {
                    setIngestFile(null)
                    if (fileInputRef.current) fileInputRef.current.value = ''
                  }}
                  className="rounded-lg p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Feedback */}
            {ingestResult && (
              <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                Successfully indexed <strong>{ingestResult.filename}</strong> &mdash; {ingestResult.chunks} chunks vector embeddings added.
              </div>
            )}
            {ingestError && (
              <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {ingestError}
              </div>
            )}

            {/* Indexed codes list */}
            {indexedCodes.length > 0 && (
              <div className="pt-2 space-y-2">
                <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                  <span>Active Indexed Standards</span>
                  <span>Click trash to purge index</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {indexedCodes.map((code) => (
                    <span
                      key={code}
                      className="group flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1 text-xs font-mono font-semibold text-foreground"
                    >
                      <BookOpen className="h-3.5 w-3.5 text-primary" />
                      {code}
                      <button
                        type="button"
                        onClick={() => void handleDeleteCode(code)}
                        className="ml-1 rounded p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        title={`Purge ${code} from collection`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Chat area ── */}
      <div className="flex-1 overflow-hidden relative">
        <ScrollArea ref={scrollAreaRef} className="h-full">
          <div className="space-y-6 p-6 pb-24">
            {messages.length === 0 ? (
              <div className="mx-auto flex h-full min-h-[440px] max-w-2xl flex-col items-center justify-center text-center p-6 space-y-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <BookOpen className="h-6 w-6" />
                </div>

                <div className="space-y-2">
                  <h2 className="font-heading text-2xl font-bold tracking-tight text-foreground">
                    BIS Standards Citation Assistant
                  </h2>
                  <p className="max-w-md text-sm text-muted-foreground leading-relaxed">
                    Ask technical standards questions on Indian Standard (IS) codes. Get exact clause, section, and page level citations backed by vector search.
                  </p>
                </div>

                {indexedCodes.length === 0 ? (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-600 dark:text-amber-400 max-w-md flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>No IS codebooks indexed yet. Click "Manage IS Codebooks" above to upload PDF documents.</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-500/10 px-3 py-1.5 rounded-full">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Ready &mdash; {indexedCodes.length} IS standard codebooks indexed
                  </div>
                )}

                <div className="w-full pt-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-3">
                    Suggested Standard Queries
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-left">
                    {samplePrompts.map((prompt, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handlePromptClick(prompt)}
                        className="group flex items-start gap-2.5 rounded-lg border border-border bg-card p-3 text-xs text-foreground/90 hover:bg-muted/50"
                      >
                        <FileText className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <span className="font-medium leading-snug">{prompt}</span>
                      </button>
                    ))}
                  </div>
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
              <div className="mx-auto max-w-4xl px-4 py-3">
                <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  <span className="font-medium">Searching indexed vector chunks &amp; generating cited response</span>
                  {selectedCode !== 'all' && (
                    <Badge variant="secondary" className="text-xs font-mono ml-auto">
                      Filter: {selectedCode}
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* ── Input bar ── */}
      <div className="border-t border-border bg-card p-4 shrink-0">
        <div className="mx-auto max-w-4xl space-y-2.5">
          {/* Controls bar */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">Filter Standard:</span>
              <Select value={selectedCode} onValueChange={(v) => setSelectedCode(v as string)}>
                <SelectTrigger className="h-8 w-[170px] text-xs font-mono rounded-xl bg-background border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Standards ({indexedCodes.length})</SelectItem>
                  {indexedCodes.map((code) => (
                    <SelectItem key={code} value={code} className="font-mono text-xs">
                      {code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {messages.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDrawerOpen(true)}
                disabled={latestChunks.length === 0}
                className="h-8 text-xs gap-1.5 rounded-lg border-border text-foreground hover:bg-muted"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Source Chunks ({latestChunks.length})
              </Button>
            )}
          </div>

          {/* Textarea + Send button */}
          <div className="flex items-end gap-2.5">
            <div className="relative flex-1">
              <Textarea
                ref={textAreaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  selectedCode !== 'all'
                    ? `Ask technical question on ${selectedCode}… (Press Enter to send)`
                    : 'Ask technical question on IS standards… (Press Enter to send)'
                }
                className="min-h-[50px] max-h-36 resize-none rounded-lg border-border bg-background px-4 py-3 text-sm focus-visible:ring-primary/40"
                rows={1}
                disabled={isLoading}
              />
            </div>
            <Button
              onClick={() => void handleSubmit()}
              disabled={!input.trim() || isLoading}
              className="h-[50px] px-5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 shrink-0"
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
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
