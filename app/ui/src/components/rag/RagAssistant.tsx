import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  Loader2, Send, ArrowRight, Upload, X, BookOpen,
  ChevronDown, CheckCircle2, AlertCircle, Trash2, Layers,
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

  const [selectedCode, setSelectedCode] = useState<string>('all')
  const [indexedCodes, setIndexedCodes] = useState<string[]>([])

  const [ingestOpen, setIngestOpen] = useState(false)
  const [ingestFile, setIngestFile] = useState<File | null>(null)
  const [isIngesting, setIsIngesting] = useState(false)
  const [ingestResult, setIngestResult] = useState<{ filename: string; chunks: number; isDelete?: boolean } | null>(null)
  const [ingestError, setIngestError] = useState<string | null>(null)
  const [deletingCode, setDeletingCode] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const textAreaRef = useRef<HTMLTextAreaElement>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  const fetchCodes = async () => {
    try {
      const codes = await listIsCodes()
      setIndexedCodes(codes)
    } catch {
      // backend may not be up yet
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
      setIngestResult({
        filename: ingestFile.name,
        chunks: res.chunks_ingested ?? (res as unknown as Record<string, number>).chunks_added ?? 0,
      })
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
    setDeletingCode(code)
    setIngestResult(null)
    setIngestError(null)
    try {
      const deletedChunks = await deleteIsCode(code)
      await fetchCodes()
      if (selectedCode === code) setSelectedCode('all')
      setIngestResult({ filename: code, chunks: deletedChunks, isDelete: true })
    } catch (err) {
      setIngestError(err instanceof Error ? err.message : `Failed to remove ${code}`)
    } finally {
      setDeletingCode(null)
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      {/* Codebook management panel */}
      <div className="shrink-0 border-b border-border bg-card">
        <button
          type="button"
          onClick={() => setIngestOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-3 px-5 py-3 text-sm transition-colors hover:bg-muted/40"
        >
          <span className="flex items-center gap-2 font-medium text-foreground">
            <BookOpen className="h-4 w-4 text-muted-foreground" />
            Manage IS Codebooks
            <Badge variant="secondary" className="font-mono text-xs">
              {indexedCodes.length} indexed
            </Badge>
          </span>
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform ${ingestOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {ingestOpen && (
          <div className="space-y-4 border-t border-border px-5 py-4">
            <div className="flex flex-wrap items-center gap-3">
              <label
                htmlFor="pdf-upload"
                className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border bg-background px-3 py-2 text-sm text-foreground transition-colors hover:border-primary/50"
              >
                <Upload className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">
                  {ingestFile ? ingestFile.name : 'Choose IS codebook PDF'}
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
                onClick={() => void handleIngest()}
                className="rounded-md"
              >
                {isIngesting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Indexing
                  </>
                ) : (
                  <>
                    <Upload className="h-3.5 w-3.5" />
                    Ingest
                  </>
                )}
              </Button>
              {ingestFile && !isIngesting && (
                <button
                  type="button"
                  onClick={() => {
                    setIngestFile(null)
                    if (fileInputRef.current) fileInputRef.current.value = ''
                  }}
                  className="rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {ingestResult && (
              <div className="flex items-center gap-2 rounded-md bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                {ingestResult.isDelete ? (
                  <>Removed <strong>{ingestResult.filename}</strong>. {ingestResult.chunks} chunks purged.</>
                ) : (
                  <>Indexed <strong>{ingestResult.filename}</strong>. {ingestResult.chunks} chunks added.</>
                )}
              </div>
            )}
            {ingestError && (
              <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {ingestError}
              </div>
            )}

            {indexedCodes.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Indexed standards
                </p>
                <div className="flex flex-wrap gap-2">
                  {indexedCodes.map((code) => (
                    <span
                      key={code}
                      className="group flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-mono font-medium text-foreground"
                    >
                      {code}
                      <button
                        type="button"
                        disabled={deletingCode === code}
                        onClick={() => void handleDeleteCode(code)}
                        className="rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100 disabled:opacity-50"
                        title={`Remove ${code}`}
                      >
                        {deletingCode === code ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Trash2 className="h-3 w-3" />
                        )}
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Chat area */}
      <div className="relative flex-1 overflow-hidden">
        <ScrollArea ref={scrollAreaRef} className="h-full">
          <div className="space-y-6 p-6 pb-24">
            {messages.length === 0 ? (
              <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center gap-8 px-6 py-8 text-center">
                <div className="space-y-3">
                  <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card">
                    <BookOpen className="h-5 w-5 text-primary" />
                  </div>
                  <h2 className="font-heading text-xl font-semibold tracking-tight text-foreground">
                    BIS Standards Assistant
                  </h2>
                  <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">
                    Ask questions about Indian Standard (IS) codes and get answers with exact clause, section, and page citations from indexed documents.
                  </p>
                </div>

                {indexedCodes.length === 0 ? (
                  <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    No codebooks indexed. Upload a PDF from Manage IS Codebooks above.
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {indexedCodes.length} codebooks indexed and ready
                  </div>
                )}

                <div className="w-full space-y-2">
                  {samplePrompts.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => handlePromptClick(prompt)}
                      className="flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3 text-left text-sm text-foreground transition-colors hover:border-primary/40 hover:bg-muted/50"
                    >
                      <span className="font-medium">{prompt}</span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
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
              <div className="mx-auto flex max-w-4xl items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Searching standard clauses</span>
                {selectedCode !== 'all' && (
                  <Badge variant="secondary" className="ml-auto font-mono text-xs">
                    {selectedCode}
                  </Badge>
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Input bar */}
      <div className="shrink-0 border-t border-border bg-card p-4">
        <div className="mx-auto max-w-4xl space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">Standard</span>
              <Select value={selectedCode} onValueChange={(v) => setSelectedCode(v as string)}>
                <SelectTrigger className="h-8 w-[200px] rounded-md border-border bg-background font-mono text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All standards ({indexedCodes.length})</SelectItem>
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
                className="rounded-md"
              >
                <Layers className="h-3.5 w-3.5" />
                Sources ({latestChunks.length})
              </Button>
            )}
          </div>

          <div className="flex items-end gap-2">
            <Textarea
              ref={textAreaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                selectedCode !== 'all'
                  ? `Ask a question on ${selectedCode}`
                  : 'Ask a question on IS standards'
              }
              className="max-h-36 min-h-[48px] resize-none rounded-lg border-border bg-background px-4 py-3 text-sm"
              rows={1}
              disabled={isLoading}
            />
            <Button
              onClick={() => void handleSubmit()}
              disabled={!input.trim() || isLoading}
              size="icon-lg"
              className="shrink-0 rounded-lg"
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