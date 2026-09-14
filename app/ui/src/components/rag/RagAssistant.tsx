import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  Loader2, Send, ArrowRight, BookOpen,
  CheckCircle2, Layers,
} from 'lucide-react'
import { ChatMessage } from '@/components/rag/ChatMessage'
import { SourceDrawer } from '@/components/rag/SourceDrawer'
import { queryRag, listIsCodes } from '@/lib/api'
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

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
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

                <div className="flex items-center gap-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {indexedCodes.length} codebooks indexed and ready
                </div>

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
