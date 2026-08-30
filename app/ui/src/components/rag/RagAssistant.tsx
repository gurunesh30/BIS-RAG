import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Loader2, Send, FileText, ExternalLink } from 'lucide-react'
import { ChatMessage } from '@/components/rag/ChatMessage'
import { SourceDrawer } from '@/components/rag/SourceDrawer'
import { queryRag } from '@/lib/api'
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
  'What is the minimum cement content for IS 456 Grade 20?',
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
  const textAreaRef = useRef<HTMLTextAreaElement>(null)

  const scrollAreaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector(
        '[data-slot="scroll-area-viewport"]'
      )
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight
      }
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
        top_k: 3,
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
      setLatestChunks(response.source_chunks)
      setLatestCitations(response.citations)
    } catch {
      const errorMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'Failed to query the RAG engine. Please check your backend connection.',
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
    <div className="flex h-[calc(100vh-73px)] flex-col">
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
                    Ask questions about Indian Standard (IS) codebooks.
                    Responses include inline clause and page citations
                    linked to the exact source text.
                  </p>
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
                  Retrieving clause citations...
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      <div className="border-t border-border p-4">
        <div className="mx-auto max-w-[800px]">
          {messages.length > 0 && (
            <div className="mb-2 flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDrawerOpen(true)}
                disabled={latestChunks.length === 0}
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                Show Source Chunks
              </Button>
            </div>
          )}
          <div className="flex gap-2">
            <Textarea
              ref={textAreaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about an IS standard..."
              className="min-h-[44px] max-h-32 resize-y-none"
              rows={1}
              disabled={isLoading}
            />
            <Button
              onClick={handleSubmit}
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
