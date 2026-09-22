import os
from datetime import datetime
from typing import Optional, List
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from pydantic import BaseModel, Field
from fastapi.middleware.cors import CORSMiddleware
from starlette.concurrency import run_in_threadpool

from .rag.ingestion import PDFIngestionEngine, Chunk
from .rag.pipeline import create_vector_store, create_neo4j_graph_store, expand_contexts
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

# CORS Configuration:
# Support Vercel production/preview domains and local development environments.
_default_origins = [
    "https://bis-rag-teal.vercel.app",
    "https://bis-rag.vercel.app",
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:8001",
]
_frontend_url = os.getenv("FRONTEND_URL", "")
_custom_origins = [u.strip().rstrip("/") for u in _frontend_url.split(",") if u.strip()]
_allowed_origins = list(dict.fromkeys(_default_origins + _custom_origins))

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Standards PDFs are placed in data/standards/ and ingested automatically
# on startup. The uploads scratch directory is kept for any future use.
STANDARDS_DIR = Path("./data/standards")
STANDARDS_DIR.mkdir(parents=True, exist_ok=True)

ingestion_engine = PDFIngestionEngine()
# Cloud-native by default: Pinecone when PINECONE_API_KEY is set, else local
# ChromaDB. The Neo4j graph store is used for Graph-RAG context expansion
# (skipped entirely when NEO4J_URI is not configured).
vector_store = create_vector_store()
neo4j_graph_store = create_neo4j_graph_store()
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

    When a Neo4j graph store is configured the same chunks are mirrored into
    the graph (MERGE on chunk_key keeps the mirror idempotent).
    """
    pdf_files = sorted(STANDARDS_DIR.glob("*.pdf"))

    if neo4j_graph_store is not None:
        _sync_seed_graph()
        if not pdf_files:
            return
    elif not pdf_files:
        return

    already_indexed = set(vector_store.get_all_codes())

    for pdf_path in pdf_files:
        chunks = ingestion_engine.ingest_pdf(str(pdf_path), pdf_path.name)
        if not chunks:
            continue

        # Determine the IS code from the first chunk's metadata
        is_code = chunks[0].metadata.get("is_code", "")
        if is_code in already_indexed:
            if neo4j_graph_store is not None:
                neo4j_graph_store.ingest_chunks(chunks)
            continue

        added = vector_store.add_chunks(chunks)
        if neo4j_graph_store is not None:
            neo4j_graph_store.ingest_chunks(chunks)
        print(f"[startup] Ingested {pdf_path.name} → {added} chunks ({is_code})")


def _sync_seed_graph() -> None:
    """Mirror the bundled seed clauses into Neo4j once when the graph is empty."""
    try:
        if neo4j_graph_store.stats().get("Clause", 0) > 0:
            return
    except Exception as exc:  # noqa: BLE001 — graph must never block boot
        print(f"[startup] Neo4j stats unavailable, skipping seed sync: {exc}")
        return

    from .rag.seed_data import seed_standard_chunks

    neo4j_graph_store.ingest_chunks(seed_standard_chunks())
    print("[startup] Seeded Neo4j graph with bundled standard clauses")


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


class UploadIngestResponse(BaseModel):
    success: bool
    filename: str
    is_code: Optional[str] = None
    chunk_count: int = 0
    added_chunks: int = 0
    already_indexed: bool = False
    message: str = ""


_MAX_UPLOAD_BYTES = 50 * 1024 * 1024  # 50 MB safety cap per PDF


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

        # Graph-RAG expansion: pull neighbouring clauses / cross-references
        # from Neo4j and merge them into the context block before reranking.
        if neo4j_graph_store is not None:
            contexts = expand_contexts(contexts, neo4j_graph_store, max_nodes=8)

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


def _process_and_ingest_pdf(dest_path: Path, filename: str):
    chunks = ingestion_engine.ingest_pdf(str(dest_path), filename)
    if not chunks:
        dest_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=422,
            detail=f"No ingestible chunks were extracted from '{filename}'",
        )

    is_code = str(chunks[0].metadata.get("is_code", "")).strip()
    already_indexed = is_code in set(vector_store.get_all_codes())

    # Mirror to Neo4j either way (MERGE makes it idempotent).
    if neo4j_graph_store is not None:
        neo4j_graph_store.ingest_chunks(chunks)

    if already_indexed:
        message = (
            f"'{filename}' is already indexed as {is_code}; "
            "skipped vector upsert (graph mirror refreshed)"
        )
        added_chunks = 0
    else:
        added_chunks = vector_store.add_chunks(chunks)
        message = f"Indexed '{filename}' as {is_code} ({added_chunks} chunks)"

    return is_code, len(chunks), added_chunks, already_indexed, message


@app.post("/api/rag/upload", response_model=UploadIngestResponse)
async def upload_and_ingest_pdf(file: UploadFile = File(...)):
    """
    Upload an IS codebook PDF and ingest it end-to-end.

    The file is persisted to data/standards/, parsed into chunks, embedded
    and upserted into the active vector store (Pinecone or ChromaDB), and
    mirrored into the Neo4j graph store when configured. Re-uploading an
    already-indexed IS code is idempotent: the vector upsert is skipped and
    the graph mirror is refreshed instead. FastAPI/Swagger only — not exposed
    in the Streamlit frontend.
    """
    try:
        original_name = Path(file.filename or "upload.pdf").name
        if not original_name.lower().endswith(".pdf"):
            raise HTTPException(status_code=400, detail="Only PDF files are accepted")
        if not original_name:
            raise HTTPException(status_code=400, detail="A filename is required")

        dest = STANDARDS_DIR / original_name

        # Stream the upload to disk with a size guard.
        size = 0
        with dest.open("wb") as out:
            while True:
                data = await file.read(1024 * 1024)
                if not data:
                    break
                size += len(data)
                if size > _MAX_UPLOAD_BYTES:
                    dest.unlink(missing_ok=True)
                    raise HTTPException(status_code=413, detail="File exceeds the 50 MB limit")
                out.write(data)
        await file.close()

        is_code, chunk_count, added_chunks, already_indexed, message = await run_in_threadpool(
            _process_and_ingest_pdf, dest, dest.name
        )

        return UploadIngestResponse(
            success=True,
            filename=original_name,
            is_code=is_code or None,
            chunk_count=chunk_count,
            added_chunks=added_chunks,
            already_indexed=already_indexed,
            message=message,
        )
    except HTTPException:
        raise
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
