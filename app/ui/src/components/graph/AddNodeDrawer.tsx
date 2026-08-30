import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from '@/components/ui/drawer'
import { Save } from 'lucide-react'
import { addNode } from '@/lib/api'
import type { AddNodeRequest, AddNodeResponse } from '@/types'

interface AddNodeDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (result: AddNodeResponse) => void
}

export function AddNodeDrawer({ open, onOpenChange, onSuccess }: AddNodeDrawerProps) {
  const [nodeType, setNodeType] = useState<'License' | 'Product' | 'Manufacturer' | 'IndianStandard' | 'TestLab'>('License')
  const [label, setLabel] = useState('')
  const [licenseNumber, setLicenseNumber] = useState('')
  const [productName, setProductName] = useState('')
  const [manufacturer, setManufacturer] = useState('')
  const [status, setStatus] = useState<'ACTIVE' | 'SUSPENDED'>('ACTIVE')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!label && !licenseNumber) return

    setIsSubmitting(true)
    try {
      const request: AddNodeRequest = {
        node_type: nodeType,
        label: licenseNumber || productName || label,
        properties: {
          status: status,
          ...(licenseNumber && { license_number: licenseNumber }),
          ...(productName && { product_name: productName }),
          ...(manufacturer && { manufacturer_name: manufacturer }),
        },
      }

      const result = await addNode(request)
      onSuccess?.(result)
      handleReset()
      onOpenChange(false)
    } catch {
      // Error handling is done via toast or similar
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleReset = () => {
    setNodeType('License')
    setLabel('')
    setLicenseNumber('')
    setProductName('')
    setManufacturer('')
    setStatus('ACTIVE')
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      handleReset()
    }
    onOpenChange(open)
  }

  const renderFields = () => {
    switch (nodeType) {
      case 'License':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="license-number">License Number</Label>
              <Input
                id="license-number"
                placeholder="e.g., CM/L-1234567"
                value={licenseNumber}
                onChange={(e) => {
                  setLicenseNumber(e.target.value)
                  setLabel(e.target.value)
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as 'ACTIVE' | 'SUSPENDED')}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="SUSPENDED">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        )
      case 'Product':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="product-name">Product Name</Label>
              <Input
                id="product-name"
                placeholder="e.g., TMT Steel Bars"
                value={productName}
                onChange={(e) => {
                  setProductName(e.target.value)
                  setLabel(e.target.value)
                }}
              />
            </div>
          </>
        )
      case 'Manufacturer':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="manufacturer">Manufacturer Name</Label>
              <Input
                id="manufacturer"
                placeholder="e.g., XYZ Steels Ltd."
                value={manufacturer}
                onChange={(e) => {
                  setManufacturer(e.target.value)
                  setLabel(e.target.value)
                }}
              />
            </div>
          </>
        )
      case 'IndianStandard':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="is-code">IS Code</Label>
              <Input
                id="is-code"
                placeholder="e.g., IS 1786:2008"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>
          </>
        )
      case 'TestLab':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="lab-name">Lab Name</Label>
              <Input
                id="lab-name"
                placeholder="e.g., BIS Test Lab"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lab-status">Accreditation</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as 'ACTIVE' | 'SUSPENDED')}>
                <SelectTrigger id="lab-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">VALID</SelectItem>
                  <SelectItem value="SUSPENDED">INVALID</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        )
      default:
        return null
    }
  }

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerContent className="max-w-md">
        <DrawerHeader>
          <DrawerTitle>Add Graph Node</DrawerTitle>
        </DrawerHeader>
        <div className="p-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="node-type">Node Type</Label>
              <Select
                value={nodeType}
                onValueChange={(v) => setNodeType(v as typeof nodeType)}
              >
                <SelectTrigger id="node-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="License">License</SelectItem>
                  <SelectItem value="Product">Product</SelectItem>
                  <SelectItem value="Manufacturer">Manufacturer</SelectItem>
                  <SelectItem value="IndianStandard">Indian Standard</SelectItem>
                  <SelectItem value="TestLab">Test Lab</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {renderFields()}
          </div>
        </div>
        <DrawerFooter>
          <Button onClick={handleSubmit} disabled={isSubmitting || !label} className="w-full">
            {isSubmitting ? (
              <>Saving...</>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Add Node
              </>
            )}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
