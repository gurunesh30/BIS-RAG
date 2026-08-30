import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Search, CheckCircle, XCircle } from 'lucide-react'

interface GraphSearchCardProps {
  onSearch: (licenseId: string) => void
  isLoading?: boolean
}

const sampleLicenses = [
  { id: 'CM/L-1234567', label: 'Valid License', icon: CheckCircle, iconColor: 'text-green-500' },
  { id: 'CM/L-9999999', label: 'Expired License', icon: XCircle, iconColor: 'text-red-500' },
  { id: 'HUID-0000001', label: 'Valid HUID', icon: CheckCircle, iconColor: 'text-green-500' },
  { id: 'HUID-9999999', label: 'Suspended HUID', icon: XCircle, iconColor: 'text-red-500' },
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
  }

  return (
    <Card className="m-6">
      <CardHeader>
        <CardTitle>License Verification Search</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Enter CM/L or HUID number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleKeyDown}
              className="pl-10"
              disabled={isLoading}
            />
          </div>
          <Button onClick={handleSubmit} disabled={!searchTerm.trim() || isLoading}>
            Verify
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {sampleLicenses.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSampleClick(item.id)}
                className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-foreground/80 hover:border-primary/30 hover:bg-muted/50"
              >
                <Icon className={`h-4 w-4 ${item.iconColor}`} />
                <span>{item.id}</span>
                <span className="text-muted-foreground">[{item.label}]</span>
              </button>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
