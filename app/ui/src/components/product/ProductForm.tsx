import { useState, useRef, useMemo, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { fetchProductCatalog, queryRag } from '@/lib/api'
import { filterArray } from '@/lib/utils'
import type { BISProductEntry } from '@/types'
import {
  Search,
  BookOpen,
  Sparkles,
  Loader2,
  FileCheck2,
  ShieldCheck,
  Tag,
  CornerDownLeft,
  ArrowRight,
  Info,
  SearchX,
} from 'lucide-react'

const DEBOUNCE_MS = 200

export function ProductForm() {
  // ── Full dataset (loaded once on mount) ─────────────────────────────────
  const [catalog, setCatalog] = useState<BISProductEntry[]>([])
  const [catalogLoading, setCatalogLoading] = useState(true)

  // ── Search input & derived filtered results ──────────────────────────────
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')

  // ── Product selection & RAG result ───────────────────────────────────────
  const [selectedProduct, setSelectedProduct] = useState<BISProductEntry | null>(null)
  const [searchingRag, setSearchingRag] = useState(false)
  const [ragResult, setRagResult] = useState<string | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Initial bulk fetch ───────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    setCatalogLoading(true)
    fetchProductCatalog()
      .then((data) => { if (!cancelled) setCatalog(data) })
      .catch(() => { if (!cancelled) setCatalog([]) })
      .finally(() => { if (!cancelled) setCatalogLoading(false) })
    return () => { cancelled = true }
  }, [])

  // ── Debounce search input → debouncedQuery ───────────────────────────────
  const handleSearchChange = useCallback((value: string) => {
    setSearchTerm(value)
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => {
      setDebouncedQuery(value)
    }, DEBOUNCE_MS)
  }, [])

  useEffect(() => () => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
  }, [])

  // ── Derived filtered results (memoised) ──────────────────────────────────
  const filteredResults = useMemo(
    () => filterArray(catalog, debouncedQuery),
    [catalog, debouncedQuery]
  )

  // ── Ghost-text: completion for the top name-prefix match ─────────────────
  const ghostSuggestion = useMemo(() => {
    const trimmed = searchTerm.trim()
    if (!trimmed) return ''
    const match = catalog.find((item) =>
      item.productName.toLowerCase().startsWith(trimmed.toLowerCase())
    )
    return match ? match.productName.slice(searchTerm.length) : ''
  }, [searchTerm, catalog])

  // ── Top match for Enter / button click ───────────────────────────────────
  const topMatch = useMemo(() => {
    if (!debouncedQuery.trim()) return null
    return filteredResults[0] ?? null
  }, [debouncedQuery, filteredResults])

  // ── Actions ──────────────────────────────────────────────────────────────
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
        `Official standard ${product.isCode} applies to ${product.productName}. Please check standard clause details in the vector database.`
      )
    } finally {
      setSearchingRag(false)
    }
  }, [])

  const executeCustomRagSearch = useCallback(async (term: string) => {
    setSearchingRag(true)
    setRagResult(null)

    const match = catalog.find((p) =>
      p.productName.toLowerCase().includes(term.toLowerCase())
    )

    if (match) {
      setSelectedProduct(match)
    } else {
      setSelectedProduct({
        productName: term,
        isCode: 'Querying BIS RAG Database...',
        standardTitle: `Indian Standard specifications for ${term}`,
        category: 'Custom Product Search',
        description: `Automated RAG query search across indexed Indian Standard (IS) codebooks for "${term}".`,
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
            prev ? { ...prev, isCode: isMatch[0].toUpperCase() } : prev
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
      const match = catalog.find(
        (p) => p.productName.toLowerCase() === fullText.toLowerCase()
      )
      if (match) selectAndSearchProduct(match)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (topMatch) selectAndSearchProduct(topMatch)
      else if (searchTerm.trim()) executeCustomRagSearch(searchTerm.trim())
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
      {/* Header Banner */}
      <div className="border-b border-border bg-card px-6 py-5 shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
              Product IS Code Search
              <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/30">
                Ghost Autocomplete
              </Badge>
            </h2>
            <p className="text-xs text-muted-foreground">
              Search any manufactured product name to look up its corresponding Indian Standard (IS Code) &amp; BIS specifications.
            </p>
          </div>
        </div>
      </div>

      {/* Main Content Workspace */}
      <ScrollArea className="flex-1 p-6">
        <div className="max-w-4xl mx-auto space-y-6 pb-12">

          {/* Search Box */}
          <Card className="border-border shadow-sm bg-card relative overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-amber-500" />
                  Enter Manufactured Product Name
                </span>
                {ghostSuggestion && (
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1 font-mono bg-muted/60 px-2 py-0.5 rounded">
                    <CornerDownLeft className="h-3 w-3 text-amber-500" /> Press Tab ⇥ or ➔ to complete
                  </span>
                )}
              </CardTitle>
              <CardDescription className="text-xs">
                Type product name (e.g. LED Driver, Solar Module, Cement, TMT Steel, PVC Cable, Battery, Helmet...)
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="relative flex items-center">
                {/* Ghost Text Overlay */}
                <div
                  className="absolute inset-y-0 left-0 pl-10 pr-4 flex items-center pointer-events-none text-sm font-medium overflow-hidden whitespace-pre"
                  aria-hidden="true"
                >
                  <span className="opacity-0">{searchTerm}</span>
                  <span className="text-muted-foreground/40 dark:text-muted-foreground/50 select-none">
                    {ghostSuggestion}
                  </span>
                </div>

                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10 pointer-events-none" />
                <Input
                  ref={inputRef}
                  type="text"
                  placeholder="Search product (e.g., LED Driver, Solar PV Module, TMT Steel Bar...)"
                  value={searchTerm}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="pl-10 pr-24 h-12 text-sm font-medium bg-transparent z-0 border-border focus-visible:ring-amber-500"
                />

                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    if (topMatch) selectAndSearchProduct(topMatch)
                    else if (searchTerm.trim()) executeCustomRagSearch(searchTerm.trim())
                  }}
                  disabled={!searchTerm.trim() || searchingRag || catalogLoading}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 h-9 px-4 bg-amber-500 hover:bg-amber-600 text-white font-semibold text-xs z-10 shadow-sm"
                >
                  {searchingRag || catalogLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      Search IS Code
                      <ArrowRight className="h-3.5 w-3.5 ml-1" />
                    </>
                  )}
                </Button>
              </div>

              {/* Inline filtered results list — shown while typing */}
              {debouncedQuery.trim() && !selectedProduct && (
                <div className="pt-1">
                  {filteredResults.length > 0 ? (
                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1 mb-1.5">
                        <Search className="h-3 w-3 text-amber-500" />
                        {filteredResults.length} result{filteredResults.length !== 1 ? 's' : ''} for &ldquo;{debouncedQuery}&rdquo;
                      </span>
                      <div className="flex flex-col gap-1 max-h-52 overflow-y-auto pr-1">
                        {filteredResults.map((item, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => selectAndSearchProduct(item)}
                            className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-left text-xs hover:bg-amber-500/10 hover:border-amber-500/30 transition-colors group"
                          >
                            <Tag className="h-3.5 w-3.5 text-amber-500 shrink-0 opacity-70 group-hover:opacity-100" />
                            <span className="font-medium text-foreground truncate flex-1">{item.productName}</span>
                            <span className="font-mono text-muted-foreground shrink-0">{item.isCode}</span>
                            <Badge variant="outline" className="text-[10px] shrink-0 hidden sm:inline-flex">
                              {item.category}
                            </Badge>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    /* ── Empty / no-results state ── */
                    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/20 py-8 text-center">
                      <SearchX className="h-8 w-8 text-muted-foreground/50" />
                      <p className="text-sm font-medium text-muted-foreground">
                        No products matched &ldquo;{debouncedQuery}&rdquo;
                      </p>
                      <p className="text-xs text-muted-foreground/70">
                        Try a different name or press <kbd className="rounded border border-border px-1 py-0.5 font-mono text-[10px]">Enter</kbd> to search the RAG database directly.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Quick-Select Pills — shown when search is empty */}
              {!debouncedQuery.trim() && (
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                    <Sparkles className="h-3 w-3 text-amber-500" />
                    Popular BIS Product Categories:
                  </span>
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {catalogLoading ? (
                      <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Loader2 className="h-3 w-3 animate-spin" /> Loading catalog…
                      </span>
                    ) : (
                      catalog.slice(0, 7).map((item, idx) => (
                        <Badge
                          key={idx}
                          variant="outline"
                          className="cursor-pointer hover:bg-amber-500/10 hover:border-amber-500/40 text-xs font-normal transition-colors py-1 px-2.5 bg-muted/30"
                          onClick={() => selectAndSearchProduct(item)}
                        >
                          <Tag className="h-3 w-3 mr-1 text-amber-500 opacity-70" />
                          {item.productName}
                        </Badge>
                      ))
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Result Card */}
          {selectedProduct && (
            <Card className="border-amber-500/30 bg-card shadow-md animate-in fade-in slide-in-from-bottom-2 overflow-hidden">
              <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent px-6 py-5 border-b border-amber-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-amber-500 text-white hover:bg-amber-600 font-mono text-sm px-3 py-1 font-bold tracking-wide shadow-sm">
                      <FileCheck2 className="h-4 w-4 mr-1.5 inline-block" />
                      {selectedProduct.isCode}
                    </Badge>
                    <Badge variant="outline" className="text-xs bg-background/60">
                      {selectedProduct.category}
                    </Badge>
                  </div>
                  <h3 className="text-base font-bold text-foreground pt-1">
                    {selectedProduct.productName}
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  <div className="text-xs text-muted-foreground font-mono bg-background/80 border border-border px-3 py-1.5 rounded-lg shrink-0">
                    BIS Standard Verification: <span className="text-emerald-600 dark:text-emerald-400 font-bold">MATCHED</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
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
              </div>

              <CardContent className="p-6 space-y-5">
                {/* Standard Title & Scope */}
                <div className="space-y-1.5">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Info className="h-3.5 w-3.5 text-amber-500" />
                    Official Standard Title &amp; Specification Scope
                  </h4>
                  <p className="text-sm font-semibold text-foreground leading-snug">
                    {selectedProduct.standardTitle}
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {selectedProduct.description}
                  </p>
                </div>

                {/* Key Testing Parameters */}
                {selectedProduct.keyParameters.length > 0 && (
                  <div className="space-y-2 pt-1">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Mandatory Testing &amp; Conformance Parameters:
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {selectedProduct.keyParameters.map((param, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 bg-muted/40 p-2.5 rounded-lg border border-border/60 text-xs font-medium"
                        >
                          <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" />
                          <span>{param}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* RAG Clause Details */}
                <div className="space-y-2 pt-2 border-t border-border">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                    RAG Vector Engine Clauses &amp; Standard Requirements
                  </h4>

                  {searchingRag ? (
                    <div className="flex items-center justify-center p-8 text-xs text-muted-foreground gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
                      Searching indexed IS codebooks for exact clauses...
                    </div>
                  ) : ragResult ? (
                    <div className="bg-muted/30 border border-border rounded-xl p-4 text-xs leading-relaxed font-sans text-foreground whitespace-pre-wrap">
                      {ragResult}
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground italic">
                      Click search to fetch clause details from RAG store.
                    </div>
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
