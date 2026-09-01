import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Search, CheckCircle2, XCircle, ShieldCheck, Loader2 } from 'lucide-react'

interface GraphSearchCardProps {
  onSearch: (licenseId: string) => void
  isLoading?: boolean
}

const sampleLicenses = [
  { id: 'CM/L-1234567', label: 'Valid License', icon: CheckCircle2, status: 'valid' },
  { id: 'CM/L-9999999', label: 'Expired License', icon: XCircle, status: 'invalid' },
  { id: 'HUID-0000001', label: 'Valid HUID', icon: CheckCircle2, status: 'valid' },
  { id: 'HUID-9999999', label: 'Suspended HUID', icon: XCircle, status: 'invalid' },
]

export function GraphSearchCard({ onSearch, isLoading }: GraphSearchCardProps) {
  const [searchTerm, setSearchTerm] = useState('')

  const handleSubmit = () => {
    if (searchTerm.trim()) {
      void onSearch(searchTerm.trim())
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      void handleSubmit()
    }
  }

  const handleSampleClick = (id: string) => {
    setSearchTerm(id)
    void onSearch(id)
  }

  return (
    <Card className="border-border bg-card rounded-xl overflow-hidden">
      <CardHeader className="border-b border-border bg-muted/20 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-base font-bold text-foreground">
              License &amp; HUID Chain Verification
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Traverse supply chain graph nodes via BFS to detect invalid/fraud licenses.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-5 space-y-4">
        {/* Search input bar */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Enter CM/L or HUID number (e.g. CM/L-1234567)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleKeyDown}
              className="pl-10 h-11 rounded-lg border-border bg-background text-sm focus-visible:ring-primary/40"
              disabled={isLoading}
            />
          </div>
          <Button
            onClick={handleSubmit}
            disabled={!searchTerm.trim() || isLoading}
            className="h-11 px-5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 shrink-0"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
            ) : (
              <Search className="h-4 w-4 mr-1.5" />
            )}
            Verify
          </Button>
        </div>

        {/* Sample chips */}
        <div className="space-y-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
            Quick Verification Samples
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {sampleLicenses.map((item) => {
              const Icon = item.icon
              const isValid = item.status === 'valid'
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSampleClick(item.id)}
                  className="group flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-xs font-mono text-foreground hover:bg-muted/50"
                >
                  <div className="flex items-center gap-1.5 font-semibold">
                    <Icon className={`h-3.5 w-3.5 ${isValid ? 'text-emerald-500' : 'text-rose-500'}`} />
                    <span>{item.id}</span>
                  </div>
                  <span className={`text-[10px] font-sans px-1.5 py-0.5 rounded-md font-medium ${
                    isValid ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                  }`}>
                    {item.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
