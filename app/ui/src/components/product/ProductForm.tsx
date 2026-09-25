import { useState, useRef, useMemo, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { fetchProductCatalog, queryRag } from '@/lib/api'
import { filterArray } from '@/lib/utils'
import type { BISProductEntry } from '@/types'
import { Search, ArrowRight, Loader2 } from 'lucide-react'

const DEBOUNCE_MS = 200

export function ProductForm() {
  const [catalog, setCatalog] = useState<BISProductEntry[]>([])
  const [catalogLoading, setCatalogLoading] = useState(true)

  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')

  const [selectedProduct, setSelectedProduct] = useState<BISProductEntry | null>(null)
  const [searchingRag, setSearchingRag] = useState(false)
  const [ragResult, setRagResult] = useState<string | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchProductCatalog()
      .then((data) => { if (!cancelled) setCatalog(data) })
      .catch(() => { if (!cancelled) setCatalog([]) })
      .finally(() => { if (!cancelled) setCatalogLoading(false) })
    return () => { cancelled = true }
  }, [])

  const handleSearchChange = useCallback((value: string) => {
    setSearchTerm(value)
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => setDebouncedQuery(value), DEBOUNCE_MS)
  }, [])

  useEffect(() => () => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
  }, [])

  const filteredResults = useMemo(
    () => filterArray(catalog, debouncedQuery),
    [catalog, debouncedQuery],
  )

  const ghostSuggestion = useMemo(() => {
    const trimmed = searchTerm.trim()
    if (!trimmed) return ''

    const byName = catalog.find((item) =>
      item.productName.toLowerCase().startsWith(trimmed.toLowerCase()),
    )
    if (byName) return byName.productName.slice(searchTerm.length)

    const byCode = catalog.find((item) =>
      item.isCode.toLowerCase().startsWith(trimmed.toLowerCase()),
    )
    if (byCode) return byCode.isCode.slice(searchTerm.length)

    return ''
  }, [searchTerm, catalog])

  const topMatch = useMemo(() => {
    if (!debouncedQuery.trim()) return null
    return filteredResults[0] ?? null
  }, [debouncedQuery, filteredResults])

  const selectAndSearchProduct = useCallback(async (product: BISProductEntry) => {
    setSearchTerm(product.productName)
    setDebouncedQuery(product.productName)
    setSelectedProduct(product)
    setSearchingRag(true)
    setRagResult(null)

    try {
      const res = await queryRag({
        query: `What is the scope, clause requirements, and mandatory safety tests under ${product.isCode} for ${product.productName}?`,
        is_code: product.isCode.split(':')[0].trim(),
        top_k: 4,
      })
      setRagResult(res.answer)
    } catch {
      setRagResult(
        `Official standard ${product.isCode} applies to ${product.productName}. Check standard clause details in the vector database.`,
      )
    } finally {
      setSearchingRag(false)
    }
  }, [])

  const executeCustomRagSearch = useCallback(async (term: string) => {
    setSearchingRag(true)
    setRagResult(null)

    const match = catalog.find((p) =>
      p.productName.toLowerCase().includes(term.toLowerCase()),
    )

    if (match) {
      setSelectedProduct(match)
    } else {
      setSelectedProduct({
        productName: term,
        isCode: 'Querying RAG...',
        standardTitle: `Indian Standard specifications for ${term}`,
        category: 'Custom Search',
        description: `RAG query across indexed Indian Standard (IS) codebooks for "${term}".`,
        keyParameters: ['RAG Vector Search', 'Clause Matching', 'Standard Verification'],
      })
    }

    try {
      const res = await queryRag({
        query: `Find the exact Indian Standard (IS Code) number, title, and requirements for manufactured product: ${term}`,
        top_k: 5,
      })
      setRagResult(res.answer)

      if (!match && res.answer) {
        const isMatch = res.answer.match(/IS\s+\d+(?:\s*\([^)]*\))?(?:\s*:\s*\d+)?/i)
        if (isMatch) {
          setSelectedProduct((prev) =>
            prev ? { ...prev, isCode: isMatch[0].toUpperCase() } : prev,
          )
        }
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      setRagResult(`Error querying BIS database: ${errorMsg}`)
    } finally {
      setSearchingRag(false)
    }
  }, [catalog])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'Tab' || e.key === 'ArrowRight') && ghostSuggestion) {
      e.preventDefault()
      const fullText = searchTerm + ghostSuggestion
      handleSearchChange(fullText)
      const match =
        catalog.find((p) => p.productName.toLowerCase() === fullText.toLowerCase()) ??
        catalog.find((p) => p.isCode.toLowerCase() === fullText.toLowerCase())
      if (match) selectAndSearchProduct(match)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (topMatch) selectAndSearchProduct(topMatch)
      else if (searchTerm.trim()) executeCustomRagSearch(searchTerm.trim())
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border bg-card px-6 py-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Product IS Code Search</h2>
          <p className="text-xs text-muted-foreground">
            Look up the corresponding Indian Standard for any manufactured product
          </p>
        </div>
      </div>

      <ScrollArea className="flex-1 p-6">
        <div className="mx-auto max-w-4xl space-y-6 pb-12">
          {/* Search */}
          <Card className="relative overflow-hidden border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Search product name or IS code</CardTitle>
              <CardDescription className="text-xs">
                Type a product name or standard number (e.g., LED Driver, IS 1786, Solar PV Module)
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="relative flex items-center">
                <div
                  className="pointer-events-none absolute inset-y-0 left-0 flex items-center overflow-hidden pl-10 pr-4 whitespace-pre text-sm font-medium"
                  aria-hidden="true"
                >
                  <span className="opacity-0">{searchTerm}</span>
                  <span className="select-none text-muted-foreground/30">{ghostSuggestion}</span>
                </div>

                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  ref={inputRef}
                  type="text"
                  placeholder="LED Driver, IS 1786, Solar PV Module..."
                  value={searchTerm}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="h-11 rounded-md border-border bg-background pl-9 pr-24 text-sm"
                />

                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    if (topMatch) selectAndSearchProduct(topMatch)
                    else if (searchTerm.trim()) executeCustomRagSearch(searchTerm.trim())
                  }}
                  disabled={!searchTerm.trim() || searchingRag || catalogLoading}
                  className="absolute right-1.5 top-1/2 z-10 h-8 -translate-y-1/2 rounded-md text-xs"
                >
                  {searchingRag || catalogLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      Search
                      <ArrowRight className="h-3.5 w-3.5" />
                    </>
                  )}
                </Button>
              </div>

              {/* Filtered results while typing */}
              {debouncedQuery.trim() && !selectedProduct && (
                <div className="pt-1">
                  {filteredResults.length > 0 ? (
                    <div className="space-y-1">
                      <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">
                        {filteredResults.length} result{filteredResults.length !== 1 ? 's' : ''} for &ldquo;{debouncedQuery}&rdquo;
                      </p>
                      <div className="max-h-52 space-y-1 overflow-y-auto pr-1">
                        {filteredResults.map((item, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => selectAndSearchProduct(item)}
                            className="flex w-full items-center gap-3 rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-left text-xs transition-colors hover:border-primary/30 hover:bg-primary/5"
                          >
                            <span className="flex-1 truncate font-medium text-foreground">{item.productName}</span>
                            <span className="shrink-0 font-mono text-muted-foreground">{item.isCode}</span>
                            <Badge variant="outline" className="hidden shrink-0 text-[10px] sm:inline-flex">
                              {item.category}
                            </Badge>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border bg-muted/20 py-8 text-center">
                      <p className="text-sm font-medium text-muted-foreground">
                        No products match &ldquo;{debouncedQuery}&rdquo;
                      </p>
                      <p className="text-xs text-muted-foreground/70">
                        Press <kbd className="rounded border border-border px-1 py-0.5 font-mono text-[10px]">Enter</kbd> to search the RAG database.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Quick picks when empty */}
              {!debouncedQuery.trim() && (
                <div className="space-y-2">
                  <p className="text-[11px] font-medium text-muted-foreground">
                    {catalogLoading ? 'Loading catalog...' : 'Popular products'}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {!catalogLoading &&
                      catalog.slice(0, 7).map((item) => (
                        <Badge
                          key={item.isCode}
                          variant="outline"
                          className="cursor-pointer bg-muted/30 px-2.5 py-1 text-xs font-normal transition-colors hover:border-primary/40 hover:bg-primary/5"
                          onClick={() => selectAndSearchProduct(item)}
                        >
                          {item.productName}
                        </Badge>
                      ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Result card */}
          {selectedProduct && (
            <Card className="overflow-hidden border border-primary/30 bg-card">
              <div className="flex flex-col gap-3 border-b border-border px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="bg-primary font-mono text-sm font-semibold text-primary-foreground">
                      {selectedProduct.isCode}
                    </Badge>
                    <Badge variant="outline" className="text-xs">{selectedProduct.category}</Badge>
                  </div>
                  <h3 className="text-sm font-semibold text-foreground">{selectedProduct.productName}</h3>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-md text-xs"
                  onClick={() => {
                    setSelectedProduct(null)
                    setRagResult(null)
                    setSearchTerm('')
                    setDebouncedQuery('')
                  }}
                >
                  Clear
                </Button>
              </div>

              <CardContent className="space-y-5 p-6">
                {/* Standard details */}
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">Standard title</p>
                  <p className="text-sm font-semibold leading-snug text-foreground">
                    {selectedProduct.standardTitle}
                  </p>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {selectedProduct.description}
                  </p>
                </div>

                {/* Testing parameters */}
                {selectedProduct.keyParameters.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Testing parameters</p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {selectedProduct.keyParameters.map((param, i) => (
                        <div
                          key={i}
                          className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs font-medium text-foreground"
                        >
                          {param}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* RAG clause results */}
                <div className="space-y-2 border-t border-border pt-4">
                  <p className="text-xs font-medium text-muted-foreground">RAG clause details</p>
                  {searchingRag ? (
                    <div className="flex items-center justify-center gap-2 py-8 text-xs text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Searching indexed IS codebooks
                    </div>
                  ) : ragResult ? (
                    <div className="rounded-md border border-border bg-muted/30 p-4 text-xs leading-relaxed whitespace-pre-wrap text-foreground">
                      {ragResult}
                    </div>
                  ) : (
                    <p className="text-xs italic text-muted-foreground">
                      Click search to fetch clause details from RAG store.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}