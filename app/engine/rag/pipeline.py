"""
pipeline.py — cloud database providers & unified context aggregation.

Provider factory
----------------
* ``create_vector_store()`` returns the Pinecone adapter when configured,
  otherwise the local ChromaDB store. ``VECTOR_DB_PROVIDER=chroma`` forces
  the local backend even if a Pinecone key is present.
* ``create_neo4j_graph_store()`` returns a Neo4j adapter (or ``None``) based
  on the ``NEO4J_URI`` environment variable.

Context aggregation (Graph-RAG expansion)
------------------------------------------
``expand_contexts()`` merges Neo4j relational context — neighbouring clauses,
cross-references and required entities reachable from the retrieved chunks —
into the dense/sparse retrieval results, forming a single context block for
the cross-encoder reranker stage.
"""

import os
from typing import Any, Dict, List, Optional


def pinecone_configured() -> bool:
    return bool(os.getenv("PINECONE_API_KEY")) and os.getenv("VECTOR_DB_PROVIDER", "auto").lower() != "chroma"


def neo4j_configured() -> bool:
    return bool(os.getenv("NEO4J_URI"))


def create_vector_store():
    """Return the configured dense vector store (Pinecone or local ChromaDB)."""
    if pinecone_configured():
        from .pinecone_store import PineconeVectorStore

        return PineconeVectorStore()

    from .vectorstore import VectorStore

    return VectorStore()


def create_neo4j_graph_store():
    """Return a Neo4j graph store when ``NEO4J_URI`` is configured, else None.

    If the connection fails (bad credentials, network issues, etc.) the error
    is logged and ``None`` is returned so the rest of the application can
    continue without Graph-RAG expansion.
    """
    if not neo4j_configured():
        return None
    try:
        from ..graph.graph_store import Neo4jGraphStore

        store = Neo4jGraphStore()
        print("[startup] Neo4j graph store connected successfully")
        return store
    except Exception as exc:  # noqa: BLE001
        print(f"[startup] ⚠ Neo4j unavailable — skipping Graph-RAG expansion: {exc}")
        return None


def expand_contexts(
    contexts: List[Dict[str, Any]],
    graph_store: Optional[Any],
    max_nodes: int = 8,
) -> List[Dict[str, Any]]:
    """
    Enrich *contexts* with Neo4j relational neighbours reachable from the
    retrieved chunks, deduplicated so the reranker sees one copy per chunk.
    """
    if not contexts or graph_store is None:
        return contexts

    keys = []
    for ctx in contexts:
        meta = ctx.get("metadata", {})
        stored_key = meta.get("chunk_key")
        if stored_key:
            keys.append(stored_key)
        else:
            import hashlib

            keys.append(hashlib.sha1(ctx.get("text", "").encode("utf-8")).hexdigest())

    related = graph_store.get_related_context(keys, max_nodes=max_nodes)
    if not related:
        return contexts

    # Deduplicate against content already in the retrieval set.
    existing = {c.get("text", "")[:400] for c in contexts}
    merged = list(contexts)
    for entry in related:
        if entry.get("text", "")[:400] in existing:
            continue
        existing.add(entry["text"][:400])
        merged.append(entry)
    return merged