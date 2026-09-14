import os
from datetime import datetime
from typing import Optional, List
from pathlib import Path

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .rag.ingestion import PDFIngestionEngine, Chunk
from .rag.vectorstore import VectorStore, VectorStoreConfig
from .rag.synthesizer import CitationSynthesizer, SynthesisResult
from .graph.engine import KnowledgeGraphEngine
from .graph.schema import NodeType, EdgeType
from .services.translator import translate_query


from dotenv import load_dotenv
load_dotenv()

app = FastAPI(
    title="BIS RAG & Graph Verification Engine",
    description="Backend API for citation-based RAG and NetworkX knowledge graph license verification.",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Standards PDFs are placed in data/standards/ and ingested automatically
# on startup. The uploads scratch directory is kept for any future use.
STANDARDS_DIR = Path("./data/standards")
STANDARDS_DIR.mkdir(parents=True, exist_ok=True)

ingestion_engine = PDFIngestionEngine()
vector_store = VectorStore()
synthesizer = CitationSynthesizer(
    openrouter_api_key=os.getenv("OPENROUTER_API_KEY") or os.getenv("OPENROUTER_API"),
    openrouter_model=os.getenv("OPENROUTER_MODEL", "qwen/qwen3-8b")
)
graph_engine = KnowledgeGraphEngine(backup_path="./graph_backup.json")


def _ingest_standards_dir() -> None:
    """
    Scans data/standards/ for PDF files and ingests any that are not yet
    present in the vector store. Runs once at startup — safe to re-run
    because add_chunks is idempotent per IS code (the seed guard in
    VectorStore._seed_initial_standards already handles deduplication at
    the code level, and this function skips codes already indexed).
    """
    pdf_files = sorted(STANDARDS_DIR.glob("*.pdf"))
    if not pdf_files:
        return

    already_indexed = set(vector_store.get_all_codes())

    for pdf_path in pdf_files:
        chunks = ingestion_engine.ingest_pdf(str(pdf_path), pdf_path.name)
        if not chunks:
            continue

        # Determine the IS code from the first chunk's metadata
        is_code = chunks[0].metadata.get("is_code", "")
        if is_code in already_indexed:
            continue

        added = vector_store.add_chunks(chunks)
        print(f"[startup] Ingested {pdf_path.name} → {added} chunks ({is_code})")


# Auto-ingest all PDFs in data/standards/ before the server starts
# accepting requests.
@app.on_event("startup")
async def startup_ingest():
    _ingest_standards_dir()


class RAGQueryRequest(BaseModel):
    query: str
    is_code: Optional[str] = None
    n_results: int = Field(default=5, ge=1, le=20)


class RAGQueryResponse(BaseModel):
    answer: str
    citations: List[dict]
    contexts: List[dict]


class GraphVerifyRequest(BaseModel):
    license_id: Optional[str] = None
    product_id: Optional[str] = None


class GraphAddNodeRequest(BaseModel):
    node_id: str
    node_type: str
    edge_to: Optional[str] = None
    edge_type: Optional[str] = None


class GraphAddNodeResponse(BaseModel):
    success: bool
    node_id: Optional[str] = None
    warning: Optional[str] = None
    error: Optional[str] = None


@app.get("/health")
async def health():
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}


@app.post("/api/rag/query", response_model=RAGQueryResponse)
async def query_rag(request: RAGQueryRequest):
    try:
        # ── Translation layer ──────────────────────────────────────────────
        # Translate non-English queries to English for ChromaDB similarity
        # search. The original query is kept so the LLM can respond in the
        # user's native language.
        english_query, was_translated = await translate_query(request.query)

        retrieval = vector_store.query(
            query_text=english_query,
            n_results=request.n_results,
            is_code_filter=request.is_code
        )
        contexts = retrieval.get("results", [])

        # Pass both the original query (for native-language response) and
        # the translated query (for fallback keyword matching) to synthesizer.
        result: SynthesisResult = synthesizer.synthesize(
            query=request.query,
            contexts=contexts,
            english_query=english_query if was_translated else None,
        )

        return RAGQueryResponse(
            answer=result.answer,
            citations=[
                {
                    "is_code": c.is_code,
                    "clause_num": c.clause_num,
                    "page_num": c.page_num,
                    "table_ref": c.table_ref,
                    "text": c.text
                }
                for c in result.citations
            ],
            contexts=contexts
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/graph/verify")
async def verify_graph(request: GraphVerifyRequest):
    target_id = request.license_id or request.product_id
    if not target_id:
        raise HTTPException(status_code=400, detail="Either license_id or product_id must be provided")

    try:
        result = graph_engine.verify_license(target_id)
        return JSONResponse(content=result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/graph/nodes/add", response_model=GraphAddNodeResponse)
async def add_graph_node(request: GraphAddNodeRequest):
    try:
        payload = request.dict()
        result = graph_engine.add_graph_node(payload)
        return GraphAddNodeResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/graph/export")
async def export_graph():
    try:
        data = graph_engine.get_graph_data()
        return JSONResponse(content=data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/rag/codes")
async def list_is_codes():
    try:
        codes = vector_store.get_all_codes()
        return {"codes": codes}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/rag/codes/{is_code}")
async def delete_is_code(is_code: str):
    try:
        deleted = vector_store.delete_by_is_code(is_code)
        return {"success": True, "deleted_chunks": deleted}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
