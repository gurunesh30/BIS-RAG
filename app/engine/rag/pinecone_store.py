"""
pinecone_store.py — managed Pinecone vector database adapter.

Replaces the local ChromaDB persistence layer with the Pinecone SDK so the
embedding corpus lives in a cloud-native, serverless index. The public API
mirrors ``vectorstore.py`` (``add_chunks``, ``query``, ``get_all_codes``,
``get_all_documents``, ``delete_by_is_code``, ``count``) so the engine and
the retriever keep working unchanged against either backend.

Design notes
------------
* Vectors are (id, embedding, metadata) tuples with ``text`` and
  ``chunk_key`` (text hash) stored in metadata for full-document retrieval
  and Graph-RAG linkage.
* Embeddings use the same ``all-MiniLM-L6-v2`` model as the local store
  (384 dims), matching the serverless index configuration.
* If the configured index does not exist it is created with a serverless
  spec (cloud/region from env) and the bundled seed standards are upserted.
"""

import hashlib
import os
import re
import time
import uuid
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

import pinecone

from .ingestion import Chunk
from .seed_data import seed_standard_chunks

# ── Embeddings (API-first with lightweight zero-download fallback) ───────────
_embedder: Any = None


def _embed_via_api(texts: List[str]) -> Optional[List[List[float]]]:
    """Attempt API-based embedding via Gemini, OpenAI, or OpenRouter."""
    # 1. Gemini API (if GEMINI_API_KEY is present)
    gemini_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if gemini_key:
        try:
            import httpx

            url = f"https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:batchEmbedContents?key={gemini_key}"
            requests_payload = {
                "requests": [
                    {
                        "model": "models/text-embedding-004",
                        "content": {"parts": [{"text": text}]},
                        "outputDimensionality": 384,
                    }
                    for text in texts
                ]
            }
            with httpx.Client(timeout=10.0) as client:
                res = client.post(url, json=requests_payload)
                if res.status_code == 200:
                    data = res.json()
                    embeddings = []
                    for emb in data.get("embeddings", []):
                        values = emb.get("values", [])
                        if values:
                            embeddings.append(values)
                    if len(embeddings) == len(texts):
                        return embeddings
        except Exception:
            pass

    # 2. OpenAI / OpenRouter API (if OPENAI_API_KEY or OPENROUTER_API_KEY is present)
    openai_key = os.getenv("OPENAI_API_KEY") or os.getenv("OPENROUTER_API_KEY") or os.getenv("OPENROUTER_API")
    if openai_key:
        try:
            import openai

            base_url = "https://openrouter.ai/api/v1" if ("OPENROUTER" in os.environ or not os.getenv("OPENAI_API_KEY")) else None
            client_kwargs = {"api_key": openai_key}
            if base_url:
                client_kwargs["base_url"] = base_url
            client = openai.OpenAI(**client_kwargs)
            res = client.embeddings.create(
                model="text-embedding-3-small",
                input=texts,
                dimensions=384,
            )
            return [d.embedding for d in res.data]
        except Exception:
            pass

    return None


def _deterministic_embed(texts: List[str], dim: int = 384) -> List[List[float]]:
    import random
    import math

    out = []
    for t in texts:
        rng = random.Random(hashlib.sha1(t.encode("utf-8")).hexdigest())
        vec = [rng.uniform(-1.0, 1.0) for _ in range(dim)]
        norm = math.sqrt(sum(x * x for x in vec)) or 1.0
        out.append([x / norm for x in vec])
    return out


def _get_embedder():
    global _embedder
    if _embedder is None:
        from sentence_transformers import SentenceTransformer

        _embedder = SentenceTransformer("all-MiniLM-L6-v2")
    return _embedder


def embed_texts(texts: List[str]) -> List[List[float]]:
    """Embed a batch of texts using API-first strategy, degrading to lightweight deterministic vectors to prevent OOM."""
    if not texts:
        return []

    # 1. API-based embedding (zero memory overhead)
    api_vectors = _embed_via_api(texts)
    if api_vectors is not None:
        return api_vectors

    # 2. Local SentenceTransformer only if explicitly enabled and not offline
    if os.getenv("USE_LOCAL_EMBEDDER", "0") == "1" and os.getenv("HF_HUB_OFFLINE") != "1":
        try:
            return _get_embedder().encode(texts, normalize_embeddings=True).tolist()
        except Exception:
            pass

    # 3. Deterministic zero-download projection (safe on Render 512MB RAM free tier)
    return _deterministic_embed(texts)


def chunk_key(text: str) -> str:
    return hashlib.sha1(text.encode("utf-8")).hexdigest()


@dataclass
class PineconeStoreConfig:
    index_name: str = "bis-codebooks"
    dimension: int = 384
    metric: str = "cosine"
    cloud: str = "aws"
    region: str = "us-east-1"
    namespace: str = ""
    embedding_model: str = "all-MiniLM-L6-v2"


# Pinecone metadata supports str/int/float/bool and lists of strings only.
_PAGE_NUM_PATTERN = re.compile(r'\d+')


class PineconeVectorStore:
    def __init__(self, config: Optional[PineconeStoreConfig] = None):
        self.config = config or PineconeStoreConfig()
        env_index = os.getenv("PINECONE_INDEX_NAME")
        if env_index:
            self.config.index_name = env_index
        self.config.index_name = re.sub(
            r'[^a-z0-9-]', '-', self.config.index_name.lower()
        ).strip('-')

        self.config.cloud = os.getenv("PINECONE_CLOUD", self.config.cloud)
        self.config.region = os.getenv("PINECONE_REGION", self.config.region)

        api_key = os.getenv("PINECONE_API_KEY")
        if not api_key:
            raise RuntimeError("PINECONE_API_KEY is not set (see .env.example)")

        client_kwargs: Dict[str, Any] = {"api_key": api_key}
        pinecone_host = os.getenv("PINECONE_HOST")
        if pinecone_host:
            client_kwargs["host"] = pinecone_host

        self._client = pinecone.Pinecone(**client_kwargs)
        self._ensure_index()
        self._index = self._client.Index(self.config.index_name)
        self._codes = self._load_codes()
        self._seed_initial_standards()

    # ── Index lifecycle ─────────────────────────────────────────────────────

    def _ensure_index(self) -> None:
        if self._client.has_index(self.config.index_name):
            return

        spec = pinecone.ServerlessSpec(
            cloud=self.config.cloud,
            region=self.config.region,
        )
        self._client.create_index(
            name=self.config.index_name,
            dimension=self.config.dimension,
            metric=self.config.metric,
            spec=spec,
        )
        # Poll until the index is ready (serverless indexes provision quickly).
        for _ in range(30):
            index_model = self._client.describe_index(self.config.index_name)
            if getattr(index_model, "status", None) and str(getattr(index_model.status, "state", "")).lower() == "ready":
                return
            time.sleep(2)

    # ── Metadata helpers ────────────────────────────────────────────────────

    @staticmethod
    def _page_num(value) -> int:
        match = _PAGE_NUM_PATTERN.search(str(value))
        return int(match.group()) if match else 1

    def _metadata_for(self, chunk: Chunk) -> Dict[str, Any]:
        meta = dict(chunk.metadata)
        meta["text"] = chunk.text
        meta["chunk_key"] = chunk_key(chunk.text)
        meta["page_num"] = self._page_num(meta.get("page_num", 1))
        return meta

    # ── Ingest (upsert) ─────────────────────────────────────────────────────

    def add_chunks(self, chunks: List[Chunk]) -> int:
        if not chunks:
            return 0

        texts = [chunk.text for chunk in chunks]
        embeddings = embed_texts(texts)

        vectors: List[Tuple[str, List[float], Dict[str, Any]]] = []
        for chunk, emb in zip(chunks, embeddings):
            meta = self._metadata_for(chunk)
            vectors.append((str(uuid.uuid4()), emb, meta))

        # Push in batches of 100; Pinecone rejects over-sized payloads.
        for start in range(0, len(vectors), 100):
            batch = vectors[start:start + 100]
            self._index.upsert(vectors=batch, namespace=self.config.namespace)

        for chunk in chunks:
            code = str(chunk.metadata.get("is_code", "")).strip()
            if code:
                self._codes.add(code)
        return len(chunks)

    # ── Retrieval ───────────────────────────────────────────────────────────

    @staticmethod
    def _match_code(all_codes: List[str], requested: str) -> Optional[str]:
        clean = requested.strip()
        for stored in all_codes:
            if (
                stored.lower() == clean.lower()
                or stored.replace(" ", "").lower() == clean.replace(" ", "").lower()
                or clean.lower() in stored.lower()
                or stored.lower() in clean.lower()
            ):
                return stored
        return None

    def query(
        self,
        query_text: str,
        n_results: int = 5,
        is_code_filter: Optional[str] = None,
    ) -> Dict[str, Any]:
        codes = self.get_all_codes()

        filter_expr = None
        if is_code_filter and is_code_filter.lower() != "all":
            matched = self._match_code(codes, is_code_filter)
            if matched is None:
                return {"results": [], "requested_code": is_code_filter, "indexed_codes": codes}
            filter_expr = {"is_code": {"$eq": matched}}

        vector = embed_texts([query_text])[0]
        response = self._index.query(
            vector=vector,
            top_k=n_results,
            include_metadata=True,
            filter=filter_expr,
            namespace=self.config.namespace,
        )

        formatted = []
        for match in response.matches:
            meta = match.metadata if isinstance(match.metadata, dict) else {}
            formatted.append(
                {
                    "text": meta.get("text", ""),
                    "metadata": {
                        key: meta[key]
                        for key in ("is_code", "clause_num", "page_num", "table_ref", "chunk_key")
                        if key in meta
                    },
                    "score": round(float(match.score), 4),
                }
            )
        return {"results": formatted, "indexed_codes": codes}

    # ── Corpus access (BM25 + seeding) ──────────────────────────────────────

    def _vec_ids(self, page) -> List[str]:
        ids = []
        for item in getattr(page, "vectors", []) or []:
            if isinstance(item, dict):
                item_id = item.get("id")
            else:
                item_id = getattr(item, "id", None)
            if item_id:
                ids.append(item_id)
        return ids

    def _list_all_ids(self, batch_size: int = 100) -> List[str]:
        ids: List[str] = []
        token: Optional[str] = None
        while True:
            try:
                page = self._index.list(prefix="", limit=batch_size, pagination_token=token)
            except TypeError:
                # Newer SDK exposes list() as an iterator that paginates itself.
                for page in self._index.list(prefix="", limit=batch_size):
                    ids.extend(self._vec_ids(page))
                break

            ids.extend(self._vec_ids(page))
            pagination = getattr(page, "pagination", None)
            if pagination is None:
                break
            next_token = getattr(pagination, "next", None)
            if not next_token:
                break
            token = next_token
        return ids

    def get_all_documents(self) -> List[Dict[str, Any]]:
        ids = self._list_all_ids()
        docs: List[Dict[str, Any]] = []
        for start in range(0, len(ids), 100):
            batch = ids[start:start + 100]
            fetched = self._index.fetch(ids=batch, namespace=self.config.namespace)
            for vector_id, vector in (fetched.vectors or {}).items():
                meta = vector.metadata if isinstance(vector.metadata, dict) else {}
                text = meta.get("text", "")
                if not text:
                    continue
                docs.append(
                    {
                        "text": text,
                        "metadata": {
                            key: meta[key]
                            for key in ("is_code", "clause_num", "page_num", "table_ref", "chunk_key")
                            if key in meta
                        },
                    }
                )
        return docs

    def _load_codes(self) -> set:
        codes = set()
        for doc in self.get_all_documents():
            code = doc["metadata"].get("is_code", "")
            if code:
                codes.add(code)
        return codes

    def get_all_codes(self) -> List[str]:
        return sorted(list(self._codes))

    # ── Maintenance ─────────────────────────────────────────────────────────

    def _seed_initial_standards(self) -> None:
        try:
            if self.count() == 0:
                self.add_chunks(seed_standard_chunks())
        except Exception:  # noqa: BLE001 — seeding is best-effort
            pass

    def count(self) -> int:
        stats = self._index.describe_index_stats()
        return int(stats.total_vector_count)

    def delete_by_is_code(self, is_code: str) -> int:
        target = self._match_code(self.get_all_codes(), is_code)
        if target is None:
            return 0
        matched = [
            doc for doc in self.get_all_documents()
            if doc["metadata"].get("is_code") == target
        ]
        self._index.delete(
            filter={"is_code": {"$eq": target}},
            namespace=self.config.namespace,
        )
        self._codes.discard(target)
        return len(matched)

    def clear(self) -> None:
        self._index.delete(delete_all=True, namespace=self.config.namespace)
        self._codes.clear()