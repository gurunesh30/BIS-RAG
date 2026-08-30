import os
import uuid
from datetime import datetime
from typing import Optional, List
from pathlib import Path

from fastapi import FastAPI, UploadFile, File, HTTPException, Query
from pydantic import BaseModel, Field
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .rag.ingestion import PDFIngestionEngine, Chunk
from .rag.vectorstore import VectorStore, VectorStoreConfig
from .rag.synthesizer import CitationSynthesizer, SynthesisResult
from .graph.engine import KnowledgeGraphEngine
from .graph.schema import NodeType, EdgeType


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

UPLOAD_DIR = Path("./data/uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

ingestion_engine = PDFIngestionEngine()
vector_store = VectorStore()
synthesizer = CitationSynthesizer(
    openai_api_key=os.getenv("OPENAI_API_KEY"),
    gemini_api_key=os.getenv("GEMINI_API_KEY")
)
graph_engine = KnowledgeGraphEngine(backup_path="./graph_backup.json")


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
    node_id: str
    warning: Optional[str] = None


@app.get("/health")
async def health():
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}


@app.post("/api/rag/ingest")
async def ingest_pdf(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    file_id = f"{uuid.uuid4().hex}_{file.filename}"
    file_path = UPLOAD_DIR / file_id

    try:
        content = await file.read()
        with open(file_path, "wb") as f:
            f.write(content)

        chunks = ingestion_engine.ingest_pdf(str(file_path), file.filename)
        added = vector_store.add_chunks(chunks)

        return {
            "success": True,
            "filename": file.filename,
            "chunks_processed": len(chunks),
            "chunks_added": added,
            "total_chunks_in_store": vector_store.count()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if file_path.exists():
            file_path.unlink()


@app.post("/api/rag/query", response_model=RAGQueryResponse)
async def query_rag(request: RAGQueryRequest):
    try:
        retrieval = vector_store.query(
            query_text=request.query,
            n_results=request.n_results,
            is_code_filter=request.is_code
        )
        contexts = retrieval.get("results", [])
        result: SynthesisResult = synthesizer.synthesize(request.query, contexts)

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
