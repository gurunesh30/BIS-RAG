import type {
  AddNodeRequest,
  AddNodeResponse,
  ExportGraphResponse,
  RagQueryRequest,
  RagQueryResponse,
  VerifyResponse,
} from '@/types'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
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
  return apiRequest<RagQueryResponse>('/api/rag/query', {
    method: 'POST',
    body: JSON.stringify(request),
  })
}

export async function ingestPdf(
  file: File
): Promise<{ chunks_ingested: number; is_code: string; status: string }> {
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch(`${API_BASE}/api/rag/ingest`, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`API error: ${response.status} - ${error}`)
  }

  return response.json() as Promise<{
    chunks_ingested: number
    is_code: string
    status: string
  }>
}

export async function verifyLicense(
  licenseId: string
): Promise<VerifyResponse> {
  return apiRequest<VerifyResponse>('/api/graph/verify', {
    method: 'POST',
    body: JSON.stringify({ license_id: licenseId }),
  })
}

export async function addNode(request: AddNodeRequest): Promise<AddNodeResponse> {
  return apiRequest<AddNodeResponse>('/api/graph/nodes/add', {
    method: 'POST',
    body: JSON.stringify(request),
  })
}

export async function exportGraph(): Promise<ExportGraphResponse> {
  return apiRequest<ExportGraphResponse>('/api/graph/export')
}
