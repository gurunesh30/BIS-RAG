import type {
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
  // Backend uses n_results, not top_k
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

  // Normalise backend field names to match frontend types
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

  // Normalise backend field names to match frontend VerifyResponse type
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

export async function deleteIsCode(isCode: string): Promise<number> {
  const data = await apiRequest<{ deleted_chunks: number }>(`/api/rag/codes/${encodeURIComponent(isCode)}`, {
    method: 'DELETE',
  })
  return data.deleted_chunks
}
