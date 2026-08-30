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
} from '@/components/ui/drawer'
import { Separator } from '@/components/ui/separator'
import { Save, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
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

    // Build flat payload matching the backend's add_graph_node expectations
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload: Record<string, any> = {
      node_id: form.nodeId.trim(),
      node_type: form.nodeType,
    }

    // Node-type-specific attributes
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

    // Edge connection (optional)
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
            : `Node "${res.node_id}" added successfully.`,
        })
        onSuccess?.()
        // Reset form but keep drawer open so user can add more nodes
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
      <DrawerContent className="max-w-md mx-auto">
        <DrawerHeader>
          <DrawerTitle>Add Graph Node</DrawerTitle>
        </DrawerHeader>

        <ScrollableBody>
          <div className="space-y-4 p-4">

            {/* ── Node type ── */}
            <div className="space-y-1.5">
              <Label htmlFor="node-type">Node Type</Label>
              <Select
                value={form.nodeType}
                onValueChange={(v) => set('nodeType', v as NodeType)}
              >
                <SelectTrigger id="node-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(NODE_TYPE_LABELS) as NodeType[]).map((t) => (
                    <SelectItem key={t} value={t}>
                      {NODE_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* ── Node ID ── */}
            <div className="space-y-1.5">
              <Label htmlFor="node-id">
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
              />
            </div>

            {/* ── Type-specific fields ── */}
            {form.nodeType === 'License' && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="license-status">Status</Label>
                  <Select
                    value={form.licenseStatus}
                    onValueChange={(v) => set('licenseStatus', v as typeof form.licenseStatus)}
                  >
                    <SelectTrigger id="license-status">
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
                  <Label htmlFor="expiry-date">Expiry Date <span className="text-muted-foreground">(optional)</span></Label>
                  <Input
                    id="expiry-date"
                    type="date"
                    value={form.expiryDate}
                    onChange={(e) => set('expiryDate', e.target.value)}
                  />
                </div>
              </>
            )}

            {(form.nodeType === 'Product' || form.nodeType === 'Manufacturer') && (
              <div className="space-y-1.5">
                <Label htmlFor="name">
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
                />
              </div>
            )}

            {form.nodeType === 'Manufacturer' && (
              <div className="space-y-1.5">
                <Label htmlFor="factory-reg">Factory Registration</Label>
                <Select
                  value={form.factoryActive ? 'active' : 'inactive'}
                  onValueChange={(v) => set('factoryActive', v === 'active')}
                >
                  <SelectTrigger id="factory-reg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {form.nodeType === 'IndianStandard' && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="std-title">Title <span className="text-muted-foreground">(optional)</span></Label>
                  <Input
                    id="std-title"
                    placeholder="e.g. Plain and Reinforced Concrete"
                    value={form.standardTitle}
                    onChange={(e) => set('standardTitle', e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="std-active">Standard Status</Label>
                  <Select
                    value={form.standardActive ? 'active' : 'inactive'}
                    onValueChange={(v) => set('standardActive', v === 'active')}
                  >
                    <SelectTrigger id="std-active">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Superseded / Withdrawn</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {form.nodeType === 'TestLab' && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="lab-name">Lab Name</Label>
                  <Input
                    id="lab-name"
                    placeholder="e.g. National Test House Mumbai"
                    value={form.labName}
                    onChange={(e) => set('labName', e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lab-accred">Accreditation</Label>
                  <Select
                    value={form.labAccreditation}
                    onValueChange={(v) => set('labAccreditation', v as 'VALID' | 'INVALID')}
                  >
                    <SelectTrigger id="lab-accred">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="VALID">VALID</SelectItem>
                      <SelectItem value="INVALID">INVALID</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {/* ── Edge connection ── */}
            <Separator />
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => set('connectEdge', !form.connectEdge)}
                className="flex items-center gap-2 text-sm font-medium text-foreground/80 hover:text-foreground"
              >
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${
                    form.connectEdge
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border'
                  }`}
                >
                  {form.connectEdge && <span className="text-[10px] leading-none">✓</span>}
                </span>
                Connect to existing node
              </button>

              {form.connectEdge && (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="edge-to">Target Node ID</Label>
                    <Input
                      id="edge-to"
                      placeholder="e.g. MFR001"
                      value={form.edgeTo}
                      onChange={(e) => set('edgeTo', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="edge-type">Edge Type</Label>
                    <Select
                      value={form.edgeType}
                      onValueChange={(v) => set('edgeType', v as EdgeType)}
                    >
                      <SelectTrigger id="edge-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {EDGE_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </div>

            {/* ── Result feedback ── */}
            {result && (
              <div
                className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${
                  result.ok
                    ? 'border-green-500/20 bg-green-50/50 text-green-700 dark:bg-green-950/20 dark:text-green-400'
                    : 'border-destructive/20 bg-destructive/5 text-destructive'
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

        <DrawerFooter>
          <Button onClick={() => void handleSubmit()} disabled={!canSubmit} className="w-full">
            {isSubmitting ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" />Adding…</>
            ) : (
              <><Save className="h-4 w-4 mr-2" />Add Node</>
            )}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

// Simple scrollable wrapper since DrawerContent doesn't scroll by itself
function ScrollableBody({ children }: { children: React.ReactNode }) {
  return <div className="flex-1 overflow-y-auto">{children}</div>
}
