import type {
  BISProductEntry,
  ExportGraphResponse,
  RagQueryRequest,
  RagQueryResponse,
  VerifyResponse,
} from '@/types'

const RAW_API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  'http://localhost:8001'
const API_BASE = RAW_API_BASE.replace(/\/+$/, '')

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  const response = await fetch(`${API_BASE}${cleanPath}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`API error: ${response.status} - ${error}`)
  }

  return response.json() as Promise<T>
}

export async function queryRag(
  request: RagQueryRequest
): Promise<RagQueryResponse> {
  const backendRequest = {
    query: request.query,
    is_code: request.is_code,
    n_results: request.top_k ?? 5,
  }

  const raw = await apiRequest<{
    answer: string
    citations: Array<{ is_code: string; clause_num: string; page_num: number; table_ref?: string; text?: string }>
    contexts: Array<{ text: string; metadata: Record<string, unknown>; score: number }>
  }>('/api/rag/query', {
    method: 'POST',
    body: JSON.stringify(backendRequest),
  })

  return {
    answer: raw.answer,
    citations: (raw.citations ?? []).map((c) => ({
      is_code: c.is_code,
      clause: c.clause_num,
      page: c.page_num,
    })),
    source_chunks: (raw.contexts ?? []).map((ctx, i) => ({
      id: String(i),
      text: ctx.text,
      metadata: {
        is_code: String(ctx.metadata?.is_code ?? ''),
        clause: String(ctx.metadata?.clause_num ?? ''),
        page: Number(ctx.metadata?.page_num ?? 0),
      },
      similarity: ctx.score,
    })),
  }
}

export async function verifyLicense(
  licenseId: string
): Promise<VerifyResponse> {
  const raw = await apiRequest<{
    license_id: string
    is_legitimate: boolean
    status: string
    path: Array<{ node_id: string; node_type: string; status: string; details: string }>
    broken_edges: string[]
    details: Record<string, unknown>
  }>('/api/graph/verify', {
    method: 'POST',
    body: JSON.stringify({ license_id: licenseId }),
  })

  return {
    license_id: raw.license_id,
    is_valid: raw.is_legitimate,
    failure_reason: raw.broken_edges?.length > 0 ? raw.broken_edges.join(' | ') : null,
    traversed_path: {
      nodes: (raw.path ?? []).map((p) => ({
        id: p.node_id,
        label: p.node_id,
        type: p.node_type as VerifyResponse['traversed_path']['nodes'][number]['type'],
      })),
      edges: [],
    },
  }
}

export async function addNode(payload: Record<string, unknown>): Promise<{ success: boolean; node_id?: string; warning?: string; error?: string }> {
  return apiRequest('/api/graph/nodes/add', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function exportGraph(): Promise<ExportGraphResponse> {
  return apiRequest<ExportGraphResponse>('/api/graph/export')
}

export async function listIsCodes(): Promise<string[]> {
  const data = await apiRequest<{ codes: string[] }>('/api/rag/codes')
  return data.codes ?? []
}

// ---------------------------------------------------------------------------
// Product Catalog
// ---------------------------------------------------------------------------

const PRODUCT_CATALOG_DATA: BISProductEntry[] = [
  {
    productName: 'Smart LED Driver & Control Gear',
    isCode: 'IS 15885 (Part 2/Sec 13) : 2012',
    standardTitle: 'Lamp Controlgear - Particular Requirements for DC or AC Supplied Electronic Controlgear for LED Modules',
    category: 'Electronics & Lighting',
    description: 'Safety and performance requirements for electronic control gear used with LED lighting modules.',
    keyParameters: ['Output Voltage Limits', 'Thermal Protection', 'Short Circuit & Overload Test', 'Insulation Resistance'],
  },
  {
    productName: 'Information Technology & Office Equipment',
    isCode: 'IS 13252 (Part 1) : 2010',
    standardTitle: 'Information Technology Equipment - Safety - Part 1: General Requirements',
    category: 'IT & Consumer Electronics',
    description: 'Safety standards for mains-powered or battery-powered information technology equipment including laptops, printers, and power adapters.',
    keyParameters: ['Electric Shock Protection', 'Fire Enclosure Resistance', 'Dielectric Withstand Voltage', 'Clearance & Creepage Distances'],
  },
  {
    productName: 'Crystalline Silicon Solar PV Modules',
    isCode: 'IS 14286 : 2010',
    standardTitle: 'Crystalline Silicon Terrestrial Photovoltaic (PV) Modules - Design Qualification and Type Approval',
    category: 'Renewable & Solar Energy',
    description: 'Design qualification, testing parameters, and type approval for solar photovoltaic modules.',
    keyParameters: ['Thermal Cycling Test', 'Damp Heat Stress', 'Mechanical Load Performance', 'Hail Impact Test'],
  },
  {
    productName: 'Portland Pozzolana Cement (PPC)',
    isCode: 'IS 1489 (Part 1) : 2015',
    standardTitle: 'Portland Pozzolana Cement Specification - Part 1: Fly Ash Based',
    category: 'Civil & Building Materials',
    description: 'Specification for fly-ash based Portland Pozzolana cement used for general structural construction.',
    keyParameters: ['Fineness Specific Surface', 'Soundness Test (Le Chatelier)', 'Compressive Strength (7D/28D)', 'Initial & Final Setting Time'],
  },
  {
    productName: 'High Strength Deformed Steel Bars (TMT Bars)',
    isCode: 'IS 1786 : 2008',
    standardTitle: 'High Strength Deformed Steel Bars and Wires for Concrete Reinforcement',
    category: 'Steel & Metallurgy',
    description: 'Requirements for Thermo-Mechanically Treated (TMT) steel bars used in reinforced concrete structures.',
    keyParameters: ['0.2% Proof Stress / Yield Strength', 'Tensile Strength / Yield Ratio', 'Elongation Percentage', 'Bend & Rebend Performance'],
  },
  {
    productName: 'PVC Insulated Electric Cables for Working Voltages up to 1100V',
    isCode: 'IS 694 : 2010',
    standardTitle: 'Polyvinyl Chloride Insulated Unsheathed and Sheathed Cables/Cords with Rigid and Flexible Conductors',
    category: 'Electrical Wiring',
    description: 'Safety and insulation testing for PVC cables used in building wiring and low-voltage applications.',
    keyParameters: ['Conductor Resistance', 'Insulation Thickness', 'High Voltage Withstand Test', 'Flame Retardancy'],
  },
  {
    productName: 'Rechargeable Lithium-Ion Batteries for Portable Applications',
    isCode: 'IS 16046 (Part 2) : 2018',
    standardTitle: 'Secondary Cells and Batteries Containing Alkaline or Other Non-Acid Electrolytes - Safety Requirements (Lithium Systems)',
    category: 'Batteries & Energy Storage',
    description: 'Mandatory safety testing for lithium batteries used in mobile phones, power banks, and portable electronics.',
    keyParameters: ['External Short Circuit Test', 'Overcharge Protection', 'Thermal Abuse Resistance', 'Drop & Impact Resistance'],
  },
  {
    productName: 'Industrial Safety Helmets',
    isCode: 'IS 2925 : 1984',
    standardTitle: 'Specification for Industrial Safety Helmets',
    category: 'Personal Protective Equipment',
    description: 'Requirements for head protection helmets used in construction, industrial sites, and mining.',
    keyParameters: ['Shock Absorption Test', 'Penetration Resistance', 'Flammability Test', 'Electrical Insulation Test'],
  },
  {
    productName: 'Packaged Drinking Water (Other than Natural Mineral Water)',
    isCode: 'IS 14543 : 2016',
    standardTitle: 'Packaged Drinking Water (Other than Packaged Natural Mineral Water) - Specification',
    category: 'Food & Beverages',
    description: 'Purity, microbiological limits, and chemical safety requirements for commercial packaged drinking water.',
    keyParameters: ['TDS & pH Range', 'Microbiological Contaminants', 'Heavy Metals Testing (Lead, Arsenic)', 'Pesticide Residue Limits'],
  },
  {
    productName: 'Switches for Domestic and Similar Fixed Electrical Installations',
    isCode: 'IS 3854 : 1997',
    standardTitle: 'Switches for Domestic and Similar Fixed Electrical Installations - Specification',
    category: 'Electrical Accessories',
    description: 'Safety and endurance requirements for wall switches used in home and office wiring.',
    keyParameters: ['Make & Break Capacity', 'Normal Operation Endurance', 'Temperature Rise Test', 'Creepage Distance'],
  },
  {
    productName: 'Outdoor Type Oil Immersed Distribution Transformers',
    isCode: 'IS 1180 (Part 1) : 2014',
    standardTitle: 'Outdoor Type Oil Immersed Distribution Transformers Up to and Including 2500 kVA, 33 kV',
    category: 'Power Equipment',
    description: 'Energy efficiency ratings, losses, and safety standards for distribution transformers.',
    keyParameters: ['Maximum Total Losses at 50% & 100% Load', 'Impulse Voltage Withstand', 'Short Circuit Test', 'Temperature Rise'],
  },
  {
    productName: 'Portable Fire Extinguishers',
    isCode: 'IS 15683 : 2018',
    standardTitle: 'Portable Fire Extinguishers - Performance and Construction - Specification',
    category: 'Fire Safety & Protection',
    description: 'Construction, hydraulic pressure tests, and fire rating performance for portable fire extinguishers.',
    keyParameters: ['Fire Rating Test', 'Burst Pressure Test', 'Discharge Duration & Range', 'Corrosion Resistance'],
  },
  {
    productName: 'Medical Gloves for Single Use',
    isCode: 'IS 4148 : 1989',
    standardTitle: 'Specification for Surgical Rubber Gloves',
    category: 'Medical Devices',
    description: 'Sterility, freedom from holes, tensile strength, and elongation requirements for rubber surgical gloves.',
    keyParameters: ['Tensile Strength & Elongation', 'Freedom from Holes (Water Leak Test)', 'Sterility Test', 'Dimensions & Thickness'],
  },
  {
    productName: 'Unplasticized PVC Pipes for Potable Water Supplies',
    isCode: 'IS 4985 : 2021',
    standardTitle: 'Unplasticized Polyvinyl Chloride (uPVC) Pipes for Potable Water Supplies - Specification',
    category: 'Piping & Plumbing',
    description: 'Hydrostatic pressure, impact resistance, and material safety for uPVC drinking water pipes.',
    keyParameters: ['Internal Hydrostatic Pressure Test', 'Impact Resistance (TIR)', 'Opacity Percentage', 'Effect on Water Quality'],
  },
]

export async function fetchProductCatalog(): Promise<BISProductEntry[]> {
  return Promise.resolve(PRODUCT_CATALOG_DATA)
}
