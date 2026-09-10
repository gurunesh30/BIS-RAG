import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { addNode, queryRag } from '@/lib/api'
import {
  Factory,
  Package,
  FileCheck,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Loader2,
  Send,
  Building2,
  FileBadge2,
  FlaskConical,
  RotateCcw,
  CheckCircle2,
  AlertCircle
} from 'lucide-react'

export interface ProductFormData {
  // Product Details
  productId: string
  productName: string
  modelNumber: string
  category: string
  description: string

  // Indian Standard
  isCode: string
  standardTitle: string
  conformanceStatus: string

  // Manufacturer Info
  manufacturerId: string
  manufacturerName: string
  factoryAddress: string
  factoryRegistrationActive: boolean

  // License Details
  licenseId: string
  licenseStatus: 'ACTIVE' | 'SUSPENDED' | 'EXPIRED'
  expiryDate: string

  // Testing Lab
  labId: string
  labName: string
  labAccreditation: 'VALID' | 'INVALID'
  testReportNo: string
}

const INITIAL_FORM_DATA: ProductFormData = {
  productId: 'PROD-LED-50W',
  productName: 'Smart Modular LED Driver 50W',
  modelNumber: 'LD-50W-V2',
  category: 'Electronics & IT Equipment',
  description: 'Constant current electronic control gear for LED modules rated up to 50W',
  isCode: 'IS 13252',
  standardTitle: 'Information Technology Equipment - Safety',
  conformanceStatus: 'Compliant with Part 1: General Requirements',
  manufacturerId: 'MFG-9021',
  manufacturerName: 'Apex Electronics Pvt Ltd',
  factoryAddress: 'Plot 42, Electronics Complex, Sector 18, Gurugram, Haryana',
  factoryRegistrationActive: true,
  licenseId: 'CM/L-8765432',
  licenseStatus: 'ACTIVE',
  expiryDate: '2027-12-31',
  labId: 'LAB-NABL-01',
  labName: 'Central Electronics Testing Laboratory',
  labAccreditation: 'VALID',
  testReportNo: 'TR-2026-9021-A'
}

const PRESETS = [
  {
    name: 'Smart LED Driver (Electronics)',
    data: {
      productId: 'PROD-LED-50W',
      productName: 'Smart Modular LED Driver 50W',
      modelNumber: 'LD-50W-V2',
      category: 'Electronics & IT Equipment',
      description: 'Constant current electronic control gear for LED modules rated up to 50W',
      isCode: 'IS 13252',
      standardTitle: 'Information Technology Equipment - Safety',
      conformanceStatus: 'Compliant with Part 1: General Requirements',
      manufacturerId: 'MFG-9021',
      manufacturerName: 'Apex Electronics Pvt Ltd',
      factoryAddress: 'Plot 42, Electronics Complex, Sector 18, Gurugram, Haryana',
      factoryRegistrationActive: true,
      licenseId: 'CM/L-8765432',
      licenseStatus: 'ACTIVE' as const,
      expiryDate: '2027-12-31',
      labId: 'LAB-NABL-01',
      labName: 'Central Electronics Testing Laboratory',
      labAccreditation: 'VALID' as const,
      testReportNo: 'TR-2026-9021-A'
    }
  },
  {
    name: 'Crystalline Solar Module',
    data: {
      productId: 'PROD-SOLAR-400W',
      productName: 'Mono PERC Solar PV Module 400W',
      modelNumber: 'SPV-MP-400',
      category: 'Renewable & Solar Energy',
      description: 'High efficiency 144 half-cell monocrystalline solar photovoltaic module',
      isCode: 'IS 14286',
      standardTitle: 'Crystalline Silicon Terrestrial Photovoltaic (PV) Modules - Design Qualification',
      conformanceStatus: 'Full Conformance under Mechanical and Electrical Load Stress',
      manufacturerId: 'MFG-SOLAR-88',
      manufacturerName: 'SunPower Manufacturing India Ltd',
      factoryAddress: 'Industrial Zone Phase III, Ahmedabad, Gujarat',
      factoryRegistrationActive: true,
      licenseId: 'CM/L-7654321',
      licenseStatus: 'ACTIVE' as const,
      expiryDate: '2028-06-30',
      labId: 'LAB-SOLAR-09',
      labName: 'National Solar Testing Institute',
      labAccreditation: 'VALID' as const,
      testReportNo: 'TR-PV-400W-88'
    }
  },
  {
    name: 'Portland Cement (Construction)',
    data: {
      productId: 'PROD-CEMENT-PPC',
      productName: 'Portland Pozzolana Cement Grade 53',
      modelNumber: 'PPC-B53',
      category: 'Building Materials',
      description: 'High strength fly-ash based Portland Pozzolana Cement for structural applications',
      isCode: 'IS 1489',
      standardTitle: 'Portland Pozzolana Cement Specification',
      conformanceStatus: 'Compliant with Part 1: Fly Ash Based Cement',
      manufacturerId: 'MFG-CEMENT-01',
      manufacturerName: 'UltraTech Cement Works Unit 4',
      factoryAddress: 'Cement Nagar, Chandrapur, Maharashtra',
      factoryRegistrationActive: true,
      licenseId: 'CM/L-1122334',
      licenseStatus: 'ACTIVE' as const,
      expiryDate: '2026-11-15',
      labId: 'LAB-MAT-04',
      labName: 'NABL Accredited Civil Materials Lab',
      labAccreditation: 'VALID' as const,
      testReportNo: 'TR-CEM-53-09'
    }
  }
]

export function ProductForm() {
  const [formData, setFormData] = useState<ProductFormData>(INITIAL_FORM_DATA)
  const [submittingGraph, setSubmittingGraph] = useState(false)
  const [checkingRag, setCheckingRag] = useState(false)
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error' | 'info'
    text: string
    details?: string
  } | null>(null)
  const [ragComplianceAnswer, setRagComplianceAnswer] = useState<string | null>(null)

  const handleChange = (field: keyof ProductFormData, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const applyPreset = (presetIndex: number) => {
    setFormData(PRESETS[presetIndex].data)
    setStatusMessage({
      type: 'info',
      text: `Loaded preset: "${PRESETS[presetIndex].name}"`
    })
    setRagComplianceAnswer(null)
  }

  const resetForm = () => {
    setFormData(INITIAL_FORM_DATA)
    setStatusMessage(null)
    setRagComplianceAnswer(null)
  }

  const handleRegisterProductGraph = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmittingGraph(true)
    setStatusMessage(null)

    try {
      // 1. Add Product node
      const prodRes = await addNode({
        node_id: formData.productId,
        node_type: 'Product',
        name: formData.productName,
        model: formData.modelNumber,
        category: formData.category,
        description: formData.description,
        edge_to: formData.licenseId,
        edge_type: 'COVERS'
      })

      // 2. Add License node linked to Manufacturer & Standard
      const licRes = await addNode({
        node_id: formData.licenseId,
        node_type: 'License',
        status: formData.licenseStatus,
        expiry_date: formData.expiryDate,
        edge_to: formData.manufacturerId,
        edge_type: 'ISSUED_TO'
      })

      // 3. Add Manufacturer node
      await addNode({
        node_id: formData.manufacturerId,
        node_type: 'Manufacturer',
        name: formData.manufacturerName,
        factory_address: formData.factoryAddress,
        factory_registration_active: formData.factoryRegistrationActive
      })

      // 4. Add IndianStandard node linked from Product
      await addNode({
        node_id: formData.isCode,
        node_type: 'IndianStandard',
        title: formData.standardTitle,
        active: true
      })

      // Link Product to Standard
      await addNode({
        node_id: formData.productId,
        node_type: 'Product',
        edge_to: formData.isCode,
        edge_type: 'CONFORMS_TO'
      })

      // 5. Add TestLab node linked from Product
      await addNode({
        node_id: formData.labId,
        node_type: 'TestLab',
        name: formData.labName,
        lab_accreditation: formData.labAccreditation,
        test_report: formData.testReportNo
      })

      await addNode({
        node_id: formData.productId,
        node_type: 'Product',
        edge_to: formData.labId,
        edge_type: 'TESTED_BY'
      })

      if (prodRes.success && licRes.success) {
        setStatusMessage({
          type: 'success',
          text: `Product "${formData.productName}" (${formData.productId}) registered successfully in Knowledge Graph!`,
          details: `Linked License: ${formData.licenseId} | Standard: ${formData.isCode} | Manufacturer: ${formData.manufacturerName}`
        })
      } else {
        setStatusMessage({
          type: 'info',
          text: `Graph nodes updated. Response: ${prodRes.warning || licRes.warning || 'Nodes created'}`
        })
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      setStatusMessage({
        type: 'error',
        text: 'Failed to register product in Knowledge Graph.',
        details: errorMsg
      })
    } finally {
      setSubmittingGraph(false)
    }
  }

  const handleVerifyRagCompliance = async () => {
    setCheckingRag(true)
    setRagComplianceAnswer(null)

    try {
      const query = `Check mandatory compliance requirements and clauses in ${formData.isCode} for ${formData.productName} (${formData.category}). What are the key safety or testing standards?`
      const res = await queryRag({
        query,
        is_code: formData.isCode,
        top_k: 4
      })

      setRagComplianceAnswer(res.answer)
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      setStatusMessage({
        type: 'error',
        text: 'Failed to query BIS RAG engine for standard compliance check.',
        details: errorMsg
      })
    } finally {
      setCheckingRag(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
      {/* View Header */}
      <div className="border-b border-border bg-card px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <Factory className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
              Product Manufacturing Entry
              <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/30">
                BIS Specification Form
              </Badge>
            </h2>
            <p className="text-xs text-muted-foreground">
              Register product specifications, manufacturing licenses, Indian Standards (IS Code), and testing lab details.
            </p>
          </div>
        </div>

        {/* Action Controls & Presets */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-muted-foreground hidden lg:inline">Presets:</span>
          {PRESETS.map((p, idx) => (
            <Button
              key={idx}
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs font-medium bg-muted/30 hover:bg-muted"
              onClick={() => applyPreset(idx)}
            >
              <Sparkles className="h-3 w-3 mr-1 text-amber-500" />
              {p.name.split(' ')[0]}
            </Button>
          ))}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-muted-foreground hover:text-foreground"
            onClick={resetForm}
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1" />
            Reset
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <ScrollArea className="flex-1 p-6">
        <div className="max-w-5xl mx-auto space-y-6 pb-12">

          {/* Alert / Notification Banner */}
          {statusMessage && (
            <div
              className={`p-4 rounded-xl border flex items-start gap-3 transition-all animate-in fade-in slide-in-from-top-2 ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-200'
                  : statusMessage.type === 'error'
                  ? 'bg-destructive/10 border-destructive/30 text-destructive'
                  : 'bg-blue-500/10 border-blue-500/30 text-blue-900 dark:text-blue-200'
              }`}
            >
              {statusMessage.type === 'success' && <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />}
              {statusMessage.type === 'error' && <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />}
              {statusMessage.type === 'info' && <Sparkles className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />}
              <div className="flex-1 text-sm">
                <p className="font-semibold">{statusMessage.text}</p>
                {statusMessage.details && (
                  <p className="text-xs opacity-80 mt-1 font-mono">{statusMessage.details}</p>
                )}
              </div>
            </div>
          )}

          <form onSubmit={handleRegisterProductGraph} className="space-y-6">
            
            {/* Section 1: Product Basic Details */}
            <Card className="border-border shadow-sm">
              <CardHeader className="pb-3 border-b border-border/50">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-primary" />
                  <CardTitle className="text-base font-semibold">1. Product Identification &amp; Details</CardTitle>
                </div>
                <CardDescription className="text-xs">
                  Specify manufacturing product ID, brand name, model numbers, and general category.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="productId" className="text-xs font-semibold">Product ID / SKU Code *</Label>
                  <Input
                    id="productId"
                    placeholder="e.g. PROD-LED-50W"
                    value={formData.productId}
                    onChange={(e) => handleChange('productId', e.target.value)}
                    required
                    className="font-mono text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="productName" className="text-xs font-semibold">Product Name / Title *</Label>
                  <Input
                    id="productName"
                    placeholder="e.g. Smart Modular LED Driver 50W"
                    value={formData.productName}
                    onChange={(e) => handleChange('productName', e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="modelNumber" className="text-xs font-semibold">Model / Type Designation</Label>
                  <Input
                    id="modelNumber"
                    placeholder="e.g. LD-50W-V2"
                    value={formData.modelNumber}
                    onChange={(e) => handleChange('modelNumber', e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="category" className="text-xs font-semibold">Product Category</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(val) => handleChange('category', val)}
                  >
                    <SelectTrigger id="category">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Electronics & IT Equipment">Electronics &amp; IT Equipment</SelectItem>
                      <SelectItem value="Renewable & Solar Energy">Renewable &amp; Solar Energy</SelectItem>
                      <SelectItem value="Building Materials">Building Materials</SelectItem>
                      <SelectItem value="Electrical Appliances">Electrical Appliances</SelectItem>
                      <SelectItem value="Automotive Components">Automotive Components</SelectItem>
                      <SelectItem value="Chemicals & Fertilizers">Chemicals &amp; Fertilizers</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="description" className="text-xs font-semibold">Product Description &amp; Technical Scope</Label>
                  <Textarea
                    id="description"
                    rows={2}
                    placeholder="Describe technical ratings, operating voltage, materials, and intended application..."
                    value={formData.description}
                    onChange={(e) => handleChange('description', e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Section 2: Indian Standard (IS Code) & BIS Conformance */}
            <Card className="border-border shadow-sm">
              <CardHeader className="pb-3 border-b border-border/50">
                <div className="flex items-center gap-2">
                  <FileBadge2 className="h-4 w-4 text-amber-500" />
                  <CardTitle className="text-base font-semibold">2. Indian Standard (IS Code) &amp; Compliance</CardTitle>
                </div>
                <CardDescription className="text-xs">
                  Link the mandatory or voluntary Indian Standard applicable to this manufactured product.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="isCode" className="text-xs font-semibold">Indian Standard Code (IS Code) *</Label>
                  <Input
                    id="isCode"
                    placeholder="e.g. IS 13252"
                    value={formData.isCode}
                    onChange={(e) => handleChange('isCode', e.target.value)}
                    required
                    className="font-mono font-bold text-amber-600 dark:text-amber-400"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="standardTitle" className="text-xs font-semibold">Standard Title / Specification</Label>
                  <Input
                    id="standardTitle"
                    placeholder="e.g. Information Technology Equipment - Safety"
                    value={formData.standardTitle}
                    onChange={(e) => handleChange('standardTitle', e.target.value)}
                  />
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="conformanceStatus" className="text-xs font-semibold">Conformance Status &amp; Clause Coverage</Label>
                  <Input
                    id="conformanceStatus"
                    placeholder="e.g. Compliant with Part 1: General Requirements"
                    value={formData.conformanceStatus}
                    onChange={(e) => handleChange('conformanceStatus', e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Section 3: Manufacturer & License Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* Manufacturer Card */}
              <Card className="border-border shadow-sm">
                <CardHeader className="pb-3 border-b border-border/50">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-blue-500" />
                    <CardTitle className="text-base font-semibold">3. Manufacturing Unit</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="manufacturerId" className="text-xs font-semibold">Manufacturer ID *</Label>
                    <Input
                      id="manufacturerId"
                      placeholder="e.g. MFG-9021"
                      value={formData.manufacturerId}
                      onChange={(e) => handleChange('manufacturerId', e.target.value)}
                      required
                      className="font-mono text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="manufacturerName" className="text-xs font-semibold">Company / Manufacturer Name *</Label>
                    <Input
                      id="manufacturerName"
                      placeholder="e.g. Apex Electronics Pvt Ltd"
                      value={formData.manufacturerName}
                      onChange={(e) => handleChange('manufacturerName', e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="factoryAddress" className="text-xs font-semibold">Factory Unit Address</Label>
                    <Textarea
                      id="factoryAddress"
                      rows={2}
                      placeholder="Enter full physical factory location..."
                      value={formData.factoryAddress}
                      onChange={(e) => handleChange('factoryAddress', e.target.value)}
                    />
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <Label htmlFor="factoryActive" className="text-xs font-semibold">Factory Registration Active</Label>
                    <Select
                      value={formData.factoryRegistrationActive ? 'true' : 'false'}
                      onValueChange={(val) => handleChange('factoryRegistrationActive', val === 'true')}
                    >
                      <SelectTrigger className="w-32 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Active (Yes)</SelectItem>
                        <SelectItem value="false">Inactive (No)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {/* License Details Card */}
              <Card className="border-border shadow-sm">
                <CardHeader className="pb-3 border-b border-border/50">
                  <div className="flex items-center gap-2">
                    <FileCheck className="h-4 w-4 text-emerald-500" />
                    <CardTitle className="text-base font-semibold">4. BIS License (CM/L)</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="licenseId" className="text-xs font-semibold">BIS License Number (CM/L) *</Label>
                    <Input
                      id="licenseId"
                      placeholder="e.g. CM/L-8765432"
                      value={formData.licenseId}
                      onChange={(e) => handleChange('licenseId', e.target.value)}
                      required
                      className="font-mono text-sm font-semibold text-emerald-600 dark:text-emerald-400"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="licenseStatus" className="text-xs font-semibold">License Status</Label>
                    <Select
                      value={formData.licenseStatus}
                      onValueChange={(val) => handleChange('licenseStatus', val as ProductFormData['licenseStatus'])}
                    >
                      <SelectTrigger id="licenseStatus">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ACTIVE">ACTIVE (Valid)</SelectItem>
                        <SelectItem value="SUSPENDED">SUSPENDED</SelectItem>
                        <SelectItem value="EXPIRED">EXPIRED</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="expiryDate" className="text-xs font-semibold">License Expiry Date</Label>
                    <Input
                      id="expiryDate"
                      type="date"
                      value={formData.expiryDate}
                      onChange={(e) => handleChange('expiryDate', e.target.value)}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Section 4: Testing Lab & Quality Certification */}
            <Card className="border-border shadow-sm">
              <CardHeader className="pb-3 border-b border-border/50">
                <div className="flex items-center gap-2">
                  <FlaskConical className="h-4 w-4 text-purple-500" />
                  <CardTitle className="text-base font-semibold">5. Quality Control &amp; NABL Test Lab</CardTitle>
                </div>
                <CardDescription className="text-xs">
                  Lab accreditation details for product sample testing and certification compliance.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="labId" className="text-xs font-semibold">Testing Lab ID</Label>
                  <Input
                    id="labId"
                    placeholder="e.g. LAB-NABL-01"
                    value={formData.labId}
                    onChange={(e) => handleChange('labId', e.target.value)}
                    className="font-mono text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="labName" className="text-xs font-semibold">Assigned Lab Name</Label>
                  <Input
                    id="labName"
                    placeholder="e.g. Central Electronics Testing Lab"
                    value={formData.labName}
                    onChange={(e) => handleChange('labName', e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="labAccreditation" className="text-xs font-semibold">Lab Accreditation</Label>
                  <Select
                    value={formData.labAccreditation}
                    onValueChange={(val) => handleChange('labAccreditation', val as ProductFormData['labAccreditation'])}
                  >
                    <SelectTrigger id="labAccreditation">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="VALID">VALID (Accredited)</SelectItem>
                      <SelectItem value="INVALID">INVALID / Expired</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5 md:col-span-3">
                  <Label htmlFor="testReportNo" className="text-xs font-semibold">Test Report Reference Number</Label>
                  <Input
                    id="testReportNo"
                    placeholder="e.g. TR-2026-9021-A"
                    value={formData.testReportNo}
                    onChange={(e) => handleChange('testReportNo', e.target.value)}
                    className="font-mono text-xs"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Submission & RAG Analysis Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
              <Button
                type="button"
                variant="secondary"
                disabled={checkingRag}
                onClick={handleVerifyRagCompliance}
                className="w-full sm:w-auto h-11 px-5 border border-border"
              >
                {checkingRag ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin text-amber-500" />
                    Querying BIS RAG...
                  </>
                ) : (
                  <>
                    <ShieldAlert className="h-4 w-4 mr-2 text-amber-500" />
                    Verify Standard in RAG ({formData.isCode || 'IS Code'})
                  </>
                )}
              </Button>

              <Button
                type="submit"
                disabled={submittingGraph}
                className="w-full sm:w-auto h-11 px-6 bg-primary text-primary-foreground font-semibold shadow-md hover:opacity-90"
              >
                {submittingGraph ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Submitting Graph Nodes...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Register Product &amp; Sync Knowledge Graph
                  </>
                )}
              </Button>
            </div>
          </form>

          {/* RAG Verification Results Section */}
          {ragComplianceAnswer && (
            <Card className="border-amber-500/30 bg-amber-500/5 shadow-md animate-in fade-in slide-in-from-bottom-2">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  <CardTitle className="text-base font-bold text-amber-900 dark:text-amber-200">
                    BIS Standard RAG Analysis ({formData.isCode})
                  </CardTitle>
                </div>
                <CardDescription className="text-xs">
                  Automated vector chunk synthesis for standard compliance rules applicable to {formData.productName}.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="bg-background/80 rounded-lg p-4 border border-amber-500/20 text-sm leading-relaxed whitespace-pre-wrap font-sans text-foreground">
                  {ragComplianceAnswer}
                </div>
              </CardContent>
            </Card>
          )}

        </div>
      </ScrollArea>
    </div>
  )
}
