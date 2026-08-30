export interface Citation {
  is_code: string
  clause: string
  page: number
}

export interface SourceChunk {
  id: string
  text: string
  metadata: {
    is_code: string
    clause: string
    page: number
  }
  similarity: number
}

export interface RagQueryRequest {
  query: string
  is_code?: string
  top_k?: number
}

export interface RagQueryResponse {
  answer: string
  citations: Citation[]
  source_chunks: SourceChunk[]
}

export interface RagIngestResponse {
  chunks_ingested: number
  is_code: string
  status: string
}

export type EdgeStatus = 'ACTIVE' | 'SUSPENDED'

export interface TraversalEdge {
  from: string
  to: string
  relation: string
  status: EdgeStatus
  expiry_date: string
  lab_accreditation: 'VALID' | 'INVALID'
  scope_matches: boolean
}

export interface TraversalNode {
  id: string
  label: string
  type: 'Product' | 'License' | 'Manufacturer' | 'IndianStandard' | 'TestLab'
}

export interface VerifyResponse {
  is_valid: boolean
  traversed_path: {
    nodes: TraversalNode[]
    edges: TraversalEdge[]
  }
  failure_reason: string | null
  license_id: string
}

export interface AddNodeRequest {
  node_type: 'License' | 'Product' | 'Manufacturer' | 'IndianStandard' | 'TestLab'
  id?: string
  label: string
  properties?: Record<string, unknown>
  edges_from?: Array<{
    to: string
    relation: string
    status?: EdgeStatus
    expiry_date?: string
    lab_accreditation?: 'VALID' | 'INVALID'
    scope_matches?: boolean
  }>
}

export interface AddNodeResponse {
  success: boolean
  node_id: string
  message: string
}

export interface ExportGraphResponse {
  nodes: Array<Record<string, unknown>>
  edges: Array<Record<string, unknown>>
}
