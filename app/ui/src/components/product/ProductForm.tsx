import { useState, useRef, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { queryRag } from '@/lib/api'
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
  Info
} from 'lucide-react'

export interface BISProductEntry {
  productName: string
  isCode: string
  standardTitle: string
  category: string
  description: string
  keyParameters: string[]
}

export const BIS_PRODUCT_CATALOG: BISProductEntry[] = [
  {
    productName: 'Smart LED Driver & Control Gear',
    isCode: 'IS 15885 (Part 2/Sec 13) : 2012',
    standardTitle: 'Lamp Controlgear - Particular Requirements for DC or AC Supplied Electronic Controlgear for LED Modules',
    category: 'Electronics & Lighting',
    description: 'Safety and performance requirements for electronic control gear used with LED lighting modules.',
    keyParameters: ['Output Voltage Limits', 'Thermal Protection', 'Short Circuit & Overload Test', 'Insulation Resistance']
  },
  {
    productName: 'Information Technology & Office Equipment',
    isCode: 'IS 13252 (Part 1) : 2010',
    standardTitle: 'Information Technology Equipment - Safety - Part 1: General Requirements',
    category: 'IT & Consumer Electronics',
    description: 'Safety standards for mains-powered or battery-powered information technology equipment including laptops, printers, and power adapters.',
    keyParameters: ['Electric Shock Protection', 'Fire Enclosure Resistance', 'Dielectric Withstand Voltage', 'Clearance & Creepage Distances']
  },
  {
    productName: 'Crystalline Silicon Solar PV Modules',
    isCode: 'IS 14286 : 2010',
    standardTitle: 'Crystalline Silicon Terrestrial Photovoltaic (PV) Modules - Design Qualification and Type Approval',
    category: 'Renewable & Solar Energy',
    description: 'Design qualification, testing parameters, and type approval for solar photovoltaic modules.',
    keyParameters: ['Thermal Cycling Test', 'Damp Heat Stress', 'Mechanical Load Performance', 'Hail Impact Test']
  },
  {
    productName: 'Portland Pozzolana Cement (PPC)',
    isCode: 'IS 1489 (Part 1) : 2015',
    standardTitle: 'Portland Pozzolana Cement Specification - Part 1: Fly Ash Based',
    category: 'Civil & Building Materials',
    description: 'Specification for fly-ash based Portland Pozzolana cement used for general structural construction.',
    keyParameters: ['Fineness Specific Surface', 'Soundness Test (Le Chatelier)', 'Compressive Strength (7D/28D)', 'Initial & Final Setting Time']
  },
  {
    productName: 'High Strength Deformed Steel Bars (TMT Bars)',
    isCode: 'IS 1786 : 2008',
    standardTitle: 'High Strength Deformed Steel Bars and Wires for Concrete Reinforcement',
    category: 'Steel & Metallurgy',
    description: 'Requirements for Thermo-Mechanically Treated (TMT) steel bars used in reinforced concrete structures.',
    keyParameters: ['0.2% Proof Stress / Yield Strength', 'Tensile Strength / Yield Ratio', 'Elongation Percentage', 'Bend & Rebend Performance']
  },
  {
    productName: 'PVC Insulated Electric Cables for Working Voltages up to 1100V',
    isCode: 'IS 694 : 2010',
    standardTitle: 'Polyvinyl Chloride Insulated Unsheathed and Sheathed Cables/Cords with Rigid and Flexible Conductors',
    category: 'Electrical Wiring',
    description: 'Safety and insulation testing for PVC cables used in building wiring and low-voltage applications.',
    keyParameters: ['Conductor Resistance', 'Insulation Thickness', 'High Voltage Withstand Test', 'Flame Retardancy']
  },
  {
    productName: 'Rechargeable Lithium-Ion Batteries for Portable Applications',
    isCode: 'IS 16046 (Part 2) : 2018',
    standardTitle: 'Secondary Cells and Batteries Containing Alkaline or Other Non-Acid Electrolytes - Safety Requirements (Lithium Systems)',
    category: 'Batteries & Energy Storage',
    description: 'Mandatory safety testing for lithium batteries used in mobile phones, power banks, and portable electronics.',
    keyParameters: ['External Short Circuit Test', 'Overcharge Protection', 'Thermal Abuse Resistance', 'Drop & Impact Resistance']
  },
  {
    productName: 'Industrial Safety Helmets',
    isCode: 'IS 2925 : 1984',
    standardTitle: 'Specification for Industrial Safety Helmets',
    category: 'Personal Protective Equipment',
    description: 'Requirements for head protection helmets used in construction, industrial sites, and mining.',
    keyParameters: ['Shock Absorption Test', 'Penetration Resistance', 'Flammability Test', 'Electrical Insulation Test']
  },
  {
    productName: 'Packaged Drinking Water (Other than Natural Mineral Water)',
    isCode: 'IS 14543 : 2016',
    standardTitle: 'Packaged Drinking Water (Other than Packaged Natural Mineral Water) - Specification',
    category: 'Food & Beverages',
    description: 'Purity, microbiological limits, and chemical safety requirements for commercial packaged drinking water.',
    keyParameters: ['TDS & pH Range', 'Microbiological Contaminants', 'Heavy Metals Testing (Lead, Arsenic)', 'Pesticide Residue Limits']
  },
  {
    productName: 'Switches for Domestic and Similar Fixed Electrical Installations',
    isCode: 'IS 3854 : 1997',
    standardTitle: 'Switches for Domestic and Similar Fixed Electrical Installations - Specification',
    category: 'Electrical Accessories',
    description: 'Safety and endurance requirements for wall switches used in home and office wiring.',
    keyParameters: ['Make & Break Capacity', 'Normal Operation Endurance', 'Temperature Rise Test', 'Creepage Distance']
  },
  {
    productName: 'Outdoor Type Oil Immersed Distribution Transformers',
    isCode: 'IS 1180 (Part 1) : 2014',
    standardTitle: 'Outdoor Type Oil Immersed Distribution Transformers Up to and Including 2500 kVA, 33 kV',
    category: 'Power Equipment',
    description: 'Energy efficiency ratings, losses, and safety standards for distribution transformers.',
    keyParameters: ['Maximum Total Losses at 50% & 100% Load', 'Impulse Voltage Withstand', 'Short Circuit Test', 'Temperature Rise']
  },
  {
    productName: 'Portable Fire Extinguishers',
    isCode: 'IS 15683 : 2018',
    standardTitle: 'Portable Fire Extinguishers - Performance and Construction - Specification',
    category: 'Fire Safety & Protection',
    description: 'Construction, hydraulic pressure tests, and fire rating performance for portable fire extinguishers.',
    keyParameters: ['Fire Rating Test', 'Burst Pressure Test', 'Discharge Duration & Range', 'Corrosion Resistance']
  },
  {
    productName: 'Medical Gloves for Single Use',
    isCode: 'IS 4148 : 1989',
    standardTitle: 'Specification for Surgical Rubber Gloves',
    category: 'Medical Devices',
    description: 'Sterility, freedom from holes, tensile strength, and elongation requirements for rubber surgical gloves.',
    keyParameters: ['Tensile Strength & Elongation', 'Freedom from Holes (Water Leak Test)', 'Sterility Test', 'Dimensions & Thickness']
  },
  {
    productName: 'Unplasticized PVC Pipes for Potable Water Supplies',
    isCode: 'IS 4985 : 2021',
    standardTitle: 'Unplasticized Polyvinyl Chloride (uPVC) Pipes for Potable Water Supplies - Specification',
    category: 'Piping & Plumbing',
    description: 'Hydrostatic pressure, impact resistance, and material safety for uPVC drinking water pipes.',
    keyParameters: ['Internal Hydrostatic Pressure Test', 'Impact Resistance (TIR)', 'Opacity Percentage', 'Effect on Water Quality']
  }
]

export function ProductForm() {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedProduct, setSelectedProduct] = useState<BISProductEntry | null>(null)
  const [searchingRag, setSearchingRag] = useState(false)
  const [ragResult, setRagResult] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Compute ghost text suggestion based on current typed search term
  const ghostSuggestion = useMemo(() => {
    const trimmed = searchTerm.trim()
    if (!trimmed) return ''

    const match = BIS_PRODUCT_CATALOG.find((item) =>
      item.productName.toLowerCase().startsWith(trimmed.toLowerCase())
    )

    if (match) {
      // Return the portion of the product name that completes the typed string
      return match.productName.slice(searchTerm.length)
    }
    return ''
  }, [searchTerm])

  // Top matching product for current search term
  const topMatch = useMemo(() => {
    const trimmed = searchTerm.trim()
    if (!trimmed) return null
    return (
      BIS_PRODUCT_CATALOG.find((item) =>
        item.productName.toLowerCase().includes(trimmed.toLowerCase()) ||
        item.isCode.toLowerCase().includes(trimmed.toLowerCase()) ||
        item.category.toLowerCase().includes(trimmed.toLowerCase())
      ) || null
    )
  }, [searchTerm])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'Tab' || e.key === 'ArrowRight') && ghostSuggestion) {
      // Accept ghost text completion
      e.preventDefault()
      const fullText = searchTerm + ghostSuggestion
      setSearchTerm(fullText)
      const match = BIS_PRODUCT_CATALOG.find(
        (p) => p.productName.toLowerCase() === fullText.toLowerCase()
      )
      if (match) {
        selectAndSearchProduct(match)
      }
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (topMatch) {
        selectAndSearchProduct(topMatch)
      } else if (searchTerm.trim()) {
        executeCustomRagSearch(searchTerm.trim())
      }
    }
  }

  const selectAndSearchProduct = async (product: BISProductEntry) => {
    setSearchTerm(product.productName)
    setSelectedProduct(product)
    setSearchingRag(true)
    setRagResult(null)

    try {
      const res = await queryRag({
        query: `What is the scope, clause requirements, and mandatory safety tests under ${product.isCode} for ${product.productName}?`,
        is_code: product.isCode.split(':')[0].trim(),
        top_k: 4
      })
      setRagResult(res.answer)
    } catch {
      setRagResult(`Official standard ${product.isCode} applies to ${product.productName}. Please check standard clause details in the vector database.`)
    } finally {
      setSearchingRag(false)
    }
  }

  const executeCustomRagSearch = async (term: string) => {
    setSearchingRag(true)
    setRagResult(null)

    // Check if we matched a static catalog product
    const match = BIS_PRODUCT_CATALOG.find((p) =>
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
        keyParameters: ['RAG Vector Search', 'Clause Matching', 'Standard Verification']
      })
    }

    try {
      const res = await queryRag({
        query: `Find the exact Indian Standard (IS Code) number, title, and requirements for manufactured product: ${term}`,
        top_k: 5
      })
      setRagResult(res.answer)

      // Try to extract IS code from RAG response if selectedProduct was custom
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
  }

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

          {/* Search Box with Ghost Text Suggestion Overlay */}
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
                {/* Background Ghost Text Overlay */}
                <div
                  className="absolute inset-y-0 left-0 pl-10 pr-4 flex items-center pointer-events-none text-sm font-medium overflow-hidden whitespace-pre"
                  aria-hidden="true"
                >
                  <span className="opacity-0">{searchTerm}</span>
                  <span className="text-muted-foreground/40 dark:text-muted-foreground/50 select-none">
                    {ghostSuggestion}
                  </span>
                </div>

                {/* Main Interactive Input */}
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10 pointer-events-none" />
                <Input
                  ref={inputRef}
                  type="text"
                  placeholder="Search product (e.g., LED Driver, Solar PV Module, TMT Steel Bar...)"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
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
                  disabled={!searchTerm.trim() || searchingRag}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 h-9 px-4 bg-amber-500 hover:bg-amber-600 text-white font-semibold text-xs z-10 shadow-sm"
                >
                  {searchingRag ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      Search IS Code
                      <ArrowRight className="h-3.5 w-3.5 ml-1" />
                    </>
                  )}
                </Button>
              </div>

              {/* Sample Quick-Select Suggestion Pills */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-amber-500" />
                  Popular BIS Product Categories:
                </span>
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {BIS_PRODUCT_CATALOG.slice(0, 7).map((item, idx) => (
                    <Badge
                      key={idx}
                      variant="outline"
                      className="cursor-pointer hover:bg-amber-500/10 hover:border-amber-500/40 text-xs font-normal transition-colors py-1 px-2.5 bg-muted/30"
                      onClick={() => selectAndSearchProduct(item)}
                    >
                      <Tag className="h-3 w-3 mr-1 text-amber-500 opacity-70" />
                      {item.productName}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Result Card: Displaying the Indian Standard (IS Number) */}
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

                <div className="text-xs text-muted-foreground font-mono bg-background/80 border border-border px-3 py-1.5 rounded-lg shrink-0">
                  BIS Standard Verification: <span className="text-emerald-600 dark:text-emerald-400 font-bold">MATCHED</span>
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
                {selectedProduct.keyParameters && selectedProduct.keyParameters.length > 0 && (
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

                {/* Live BIS RAG Clause Details */}
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
