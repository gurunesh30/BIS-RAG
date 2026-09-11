import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Search, CheckCircle2, XCircle, Loader2 } from 'lucide-react'

interface GraphSearchCardProps {
  onSearch: (licenseId: string) => void
  isLoading?: boolean
}

const sampleLicenses = [
  { id: 'CM/L-1234567', label: 'Valid', valid: true },
  { id: 'CM/L-9999999', label: 'Expired', valid: false },
  { id: 'HUID-0000001', label: 'Valid', valid: true },
  { id: 'HUID-9999999', label: 'Suspended', valid: false },
]

export function GraphSearchCard({ onSearch, isLoading }: GraphSearchCardProps) {
  const [searchTerm, setSearchTerm] = useState('')

  const handleSubmit = () => {
    if (searchTerm.trim()) void onSearch(searchTerm.trim())
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
    <Card className="overflow-hidden border-border bg-card">
      <CardHeader className="border-b border-border pb-4">
        <CardTitle className="text-sm font-semibold text-foreground">
          License & HUID Verification
        </CardTitle>
        <CardDescription className="text-xs">
          Enter a CM/L or HUID number to verify the supply chain path.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4 p-5">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="CM/L-1234567 or HUID-0000001"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleKeyDown}
              className="h-10 rounded-md border-border bg-background pl-9 text-sm"
              disabled={isLoading}
            />
          </div>
          <Button
            onClick={() => void handleSubmit()}
            disabled={!searchTerm.trim() || isLoading}
            className="shrink-0 rounded-md text-xs"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Search className="h-4 w-4" />
                Verify
              </>
            )}
          </Button>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Sample IDs</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {sampleLicenses.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSampleClick(item.id)}
                className="group flex items-center justify-between rounded-md border border-border bg-card px-3 py-2 text-xs transition-colors hover:bg-muted/50"
              >
                <span className="flex items-center gap-1.5 font-mono font-medium text-foreground">
                  {item.valid ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-rose-500" />
                  )}
                  {item.id}
                </span>
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                    item.valid
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {item.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}