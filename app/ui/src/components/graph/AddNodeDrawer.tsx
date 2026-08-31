import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
  DrawerDescription,
} from '@/components/ui/drawer'
import { Separator } from '@/components/ui/separator'
import { Save, Loader2, AlertCircle, CheckCircle2, PlusCircle, Network } from 'lucide-react'
import { addNode } from '@/lib/api'

type NodeType = 'License' | 'Product' | 'Manufacturer' | 'IndianStandard' | 'TestLab'
type EdgeType = 'COVERS' | 'ISSUED_TO' | 'CONFORMS_TO' | 'TESTED_BY'

interface AddNodeDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

const NODE_TYPE_LABELS: Record<NodeType, string> = {
  License: 'License (CM/L)',
  Product: 'Product',
  Manufacturer: 'Manufacturer',
  IndianStandard: 'Indian Standard',
  TestLab: 'Test Lab',
}

const EDGE_OPTIONS: { value: EdgeType; label: string }[] = [
  { value: 'COVERS', label: 'COVERS (Product → License)' },
  { value: 'ISSUED_TO', label: 'ISSUED_TO (License → Manufacturer)' },
  { value: 'CONFORMS_TO', label: 'CONFORMS_TO (License → Standard)' },
  { value: 'TESTED_BY', label: 'TESTED_BY (Product → Lab)' },
]

const defaultState = () => ({
  nodeType: 'License' as NodeType,
  nodeId: '',
  // License fields
  licenseStatus: 'ACTIVE' as 'ACTIVE' | 'SUSPENDED' | 'EXPIRED',
  expiryDate: '',
  // Manufacturer fields
  factoryActive: true,
  // IndianStandard fields
  standardActive: true,
  standardTitle: '',
  // TestLab fields
  labAccreditation: 'VALID' as 'VALID' | 'INVALID',
  labName: '',
  // Product / Manufacturer / generic name
  name: '',
  // Edge connection
  connectEdge: false,
  edgeTo: '',
  edgeType: 'ISSUED_TO' as EdgeType,
})

export function AddNodeDrawer({ open, onOpenChange, onSuccess }: AddNodeDrawerProps) {
  const [form, setForm] = useState(defaultState())
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  const set = <K extends keyof ReturnType<typeof defaultState>>(
    key: K,
    value: ReturnType<typeof defaultState>[K]
  ) => setForm((prev) => ({ ...prev, [key]: value }))

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      setForm(defaultState())
      setResult(null)
    }
    onOpenChange(v)
  }

  const handleSubmit = async () => {
    if (!form.nodeId.trim()) return
    setIsSubmitting(true)
    setResult(null)

    // Build flat payload matching backend expectations
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload: Record<string, any> = {
      node_id: form.nodeId.trim(),
      node_type: form.nodeType,
    }

    switch (form.nodeType) {
      case 'License':
        payload.status = form.licenseStatus
        if (form.expiryDate) payload.expiry_date = form.expiryDate
        break
      case 'Manufacturer':
        payload.name = form.name.trim()
        payload.factory_registration_active = form.factoryActive
        break
      case 'Product':
        payload.name = form.name.trim()
        break
      case 'IndianStandard':
        payload.active = form.standardActive
        if (form.standardTitle.trim()) payload.title = form.standardTitle.trim()
        break
      case 'TestLab':
        payload.name = form.labName.trim() || form.nodeId.trim()
        payload.lab_accreditation = form.labAccreditation
        break
    }

    if (form.connectEdge && form.edgeTo.trim()) {
      payload.edge_to = form.edgeTo.trim()
      payload.edge_type = form.edgeType
    }

    try {
      const res = await addNode(payload)
      if (res.error) {
        setResult({ ok: false, message: res.error })
      } else {
        setResult({
          ok: true,
          message: res.warning
            ? `Node added. Warning: ${res.warning}`
            : `Node "${res.node_id}" added successfully to graph.`,
        })
        onSuccess?.()
        setForm(defaultState())
      }
    } catch (err) {
      setResult({ ok: false, message: err instanceof Error ? err.message : 'Request failed.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const canSubmit = form.nodeId.trim().length > 0 && !isSubmitting

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerContent className="max-w-lg mx-auto bg-card/95 backdrop-blur-xl border-border">
        <DrawerHeader className="border-b border-border/60 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <PlusCircle className="h-5 w-5" />
            </div>
            <div>
              <DrawerTitle className="text-base font-bold text-foreground">
                Add Supply Chain Graph Node
              </DrawerTitle>
              <DrawerDescription className="text-xs text-muted-foreground">
                Inject custom licenses, manufacturers, standards, products, or test labs into the graph topology.
              </DrawerDescription>
            </div>
          </div>
        </DrawerHeader>

        <ScrollableBody>
          <div className="space-y-4 p-5">

            {/* Node type selection */}
            <div className="space-y-1.5">
              <Label htmlFor="node-type" className="text-xs font-semibold">Node Type</Label>
              <Select
                value={form.nodeType}
                onValueChange={(v) => set('nodeType', v as NodeType)}
              >
                <SelectTrigger id="node-type" className="h-10 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(NODE_TYPE_LABELS) as NodeType[]).map((t) => (
                    <SelectItem key={t} value={t} className="text-xs font-medium">
                      {NODE_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Node ID */}
            <div className="space-y-1.5">
              <Label htmlFor="node-id" className="text-xs font-semibold">
                {form.nodeType === 'License' ? 'License Number' :
                 form.nodeType === 'IndianStandard' ? 'IS Code (e.g. IS456:2000)' :
                 'Node ID'}
              </Label>
              <Input
                id="node-id"
                placeholder={
                  form.nodeType === 'License' ? 'e.g. CM/L-1234567' :
                  form.nodeType === 'IndianStandard' ? 'e.g. IS456:2000' :
                  form.nodeType === 'TestLab' ? 'e.g. LAB001' :
                  form.nodeType === 'Manufacturer' ? 'e.g. MFR001' :
                  'e.g. PROD001'
                }
                value={form.nodeId}
                onChange={(e) => set('nodeId', e.target.value)}
                className="h-10 rounded-xl"
              />
            </div>

            {/* Type-specific inputs */}
            {form.nodeType === 'License' && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="license-status" className="text-xs font-semibold">Status</Label>
                  <Select
                    value={form.licenseStatus}
                    onValueChange={(v) => set('licenseStatus', v as typeof form.licenseStatus)}
                  >
                    <SelectTrigger id="license-status" className="h-10 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">ACTIVE</SelectItem>
                      <SelectItem value="SUSPENDED">SUSPENDED</SelectItem>
                      <SelectItem value="EXPIRED">EXPIRED</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="expiry-date" className="text-xs font-semibold">
                    Expiry Date <span className="text-muted-foreground font-normal">(optional)</span>
                  </Label>
                  <Input
                    id="expiry-date"
                    type="date"
                    value={form.expiryDate}
                    onChange={(e) => set('expiryDate', e.target.value)}
                    className="h-10 rounded-xl"
                  />
                </div>
              </>
            )}

            {(form.nodeType === 'Product' || form.nodeType === 'Manufacturer') && (
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs font-semibold">
                  {form.nodeType === 'Manufacturer' ? 'Manufacturer Name' : 'Product Name'}
                </Label>
                <Input
                  id="name"
                  placeholder={
                    form.nodeType === 'Manufacturer'
                      ? 'e.g. ABC Steel Ltd'
                      : 'e.g. TMT Bar Fe500'
                  }
                  value={form.name}
                  onChange={(e) => set('name', e.target.value)}
                  className="h-10 rounded-xl"
                />
              </div>
            )}

            {form.nodeType === 'Manufacturer' && (
              <div className="space-y-1.5">
                <Label htmlFor="factory-reg" className="text-xs font-semibold">Factory Registration Status</Label>
                <Select
                  value={form.factoryActive ? 'active' : 'inactive'}
                  onValueChange={(v) => set('factoryActive', v === 'active')}
                >
                  <SelectTrigger id="factory-reg" className="h-10 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active Registration</SelectItem>
                    <SelectItem value="inactive">Inactive / Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {form.nodeType === 'IndianStandard' && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="std-title" className="text-xs font-semibold">
                    Standard Title <span className="text-muted-foreground font-normal">(optional)</span>
                  </Label>
                  <Input
                    id="std-title"
                    placeholder="e.g. Plain and Reinforced Concrete"
                    value={form.standardTitle}
                    onChange={(e) => set('standardTitle', e.target.value)}
                    className="h-10 rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="std-active" className="text-xs font-semibold">Standard Status</Label>
                  <Select
                    value={form.standardActive ? 'active' : 'inactive'}
                    onValueChange={(v) => set('standardActive', v === 'active')}
                  >
                    <SelectTrigger id="std-active" className="h-10 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active Standard</SelectItem>
                      <SelectItem value="inactive">Superseded / Withdrawn</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {form.nodeType === 'TestLab' && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="lab-name" className="text-xs font-semibold">Test Lab Name</Label>
                  <Input
                    id="lab-name"
                    placeholder="e.g. National Test House Mumbai"
                    value={form.labName}
                    onChange={(e) => set('labName', e.target.value)}
                    className="h-10 rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lab-accred" className="text-xs font-semibold">NABL Accreditation</Label>
                  <Select
                    value={form.labAccreditation}
                    onValueChange={(v) => set('labAccreditation', v as 'VALID' | 'INVALID')}
                  >
                    <SelectTrigger id="lab-accred" className="h-10 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="VALID">VALID Accreditation</SelectItem>
                      <SelectItem value="INVALID">INVALID / Expired Accreditation</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {/* Edge Connection Section */}
            <Separator className="my-2" />

            <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-3.5">
              <button
                type="button"
                onClick={() => set('connectEdge', !form.connectEdge)}
                className="flex items-center gap-2 text-xs font-bold text-foreground"
              >
                <div
                  className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${
                    form.connectEdge
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background'
                  }`}
                >
                  {form.connectEdge && <span className="text-[10px] leading-none">✓</span>}
                </div>
                <Network className="h-3.5 w-3.5 text-primary" />
                Connect to Existing Node Edge
              </button>

              {form.connectEdge && (
                <div className="space-y-3 pt-2">
                  <div className="space-y-1">
                    <Label htmlFor="edge-to" className="text-[11px] font-semibold">Target Node ID</Label>
                    <Input
                      id="edge-to"
                      placeholder="e.g. MFR001 or IS456:2000"
                      value={form.edgeTo}
                      onChange={(e) => set('edgeTo', e.target.value)}
                      className="h-9 text-xs rounded-lg bg-background"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="edge-type" className="text-[11px] font-semibold">Edge Relationship Type</Label>
                    <Select
                      value={form.edgeType}
                      onValueChange={(v) => set('edgeType', v as EdgeType)}
                    >
                      <SelectTrigger id="edge-type" className="h-9 text-xs rounded-lg bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {EDGE_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value} className="text-xs">
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>

            {/* Feedback */}
            {result && (
              <div
                className={`flex items-start gap-2 rounded-xl border p-3 text-xs font-medium ${
                  result.ok
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : 'border-destructive/30 bg-destructive/10 text-destructive'
                }`}
              >
                {result.ok ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                ) : (
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                )}
                <span>{result.message}</span>
              </div>
            )}
          </div>
        </ScrollableBody>

        <DrawerFooter className="border-t border-border/60 p-4">
          <Button
            onClick={() => void handleSubmit()}
            disabled={!canSubmit}
            className="w-full h-11 rounded-xl bg-gradient-to-r from-primary to-indigo-600 text-primary-foreground shadow-md hover:opacity-95"
          >
            {isSubmitting ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" />Adding Node to Graph…</>
            ) : (
              <><Save className="h-4 w-4 mr-2" />Add Node to Supply Chain Graph</>
            )}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

function ScrollableBody({ children }: { children: React.ReactNode }) {
  return <div className="flex-1 overflow-y-auto max-h-[70vh]">{children}</div>
}
