"""
retriever.py — hybrid retrieval module.

Combines Dense Vector Search (ChromaDB + sentence-transformer embeddings)
with Sparse Keyword Search (BM25 over exact statutory terms such as
"Scheme-I", "IS 1234", clause numbers) that dense search frequently misses.

The two independent rankings are merged with Reciprocal Rank Fusion (RRF),
which is robust to score-scale mismatch and produces a single relevance
ordering for the reranker stage.
"""

import os
import re
from typing import Any, Dict, List, Optional, Tuple

import chromadb
from chromadb.config import Settings as ChromaSettings
from chromadb.utils import embedding_functions

try:
    from rank_bm25 import BM25Okapi

    _BM25_AVAILABLE = True
except ImportError:
    _BM25_AVAILABLE = False


_TOKEN_PATTERN = re.compile(r'[a-z0-9]+')

# Default cnst used by reciprocal rank fusion: 1/(k + rank).
_RRF_K = 60


def _tokenize(text: str) -> List[str]:
    return _TOKEN_PATTERN.findall(text.lower())


class HybridRetriever:
    """
    Dense + sparse retrieval with reciprocal-rank fusion.

    Pass an existing vector store (providing a ChromaDB ``_collection``) as
    ``dense_store`` to reuse the already-initialised embedding function and
    seed data; otherwise the retriever bootstraps its own persistent client
    on ``persist_directory``.
    """

    def __init__(
        self,
        dense_store: Optional[Any] = None,
        persist_directory: str = "./chroma_db",
        collection_name: str = "is_codebooks",
        huggingface_model: str = "all-MiniLM-L6-v2",
        dense_top_k: int = 10,
        sparse_top_k: int = 12,
        rrf_k: int = _RRF_K,
    ) -> None:
        self.dense_top_k = dense_top_k
        self.sparse_top_k = sparse_top_k
        self.rrf_k = rrf_k

        if dense_store is not None and hasattr(dense_store, "_collection"):
            self._collection = dense_store._collection
        else:
            self._collection = self._open_collection(
                persist_directory, collection_name, huggingface_model
            )

        self._corpus = self._load_corpus()
        self._bm25 = self._build_bm25_index()

    # ── Index setup ─────────────────────────────────────────────────────────

    def _open_collection(self, persist_directory: str, collection_name: str, huggingface_model: str):
        os.makedirs(persist_directory, exist_ok=True)
        client = chromadb.PersistentClient(
            path=persist_directory,
            settings=ChromaSettings(anonymized_telemetry=False),
        )
        embedding_fn = embedding_functions.SentenceTransformerEmbeddingFunction(
            model_name=huggingface_model
        )
        return client.get_or_create_collection(
            name=collection_name,
            embedding_function=embedding_fn,
            metadata={"hnsw:space": "cosine"},
        )

    def _load_corpus(self) -> List[Dict[str, Any]]:
        data = self._collection.get(include=["documents", "metadatas"])
        corpus = []
        for doc, meta in zip(data.get("documents", []), data.get("metadatas", [])):
            corpus.append({"text": doc or "", "metadata": meta or {}})
        return corpus

    def _build_bm25_index(self):
        if not _BM25_AVAILABLE:
            return None
        tokenized_docs = [_tokenize(item["text"]) for item in self._corpus]
        return BM25Okapi(tokenized_docs) if tokenized_docs else None

    # ── Retrieval ───────────────────────────────────────────────────────────

    def get_all_codes(self) -> List[str]:
        codes = set()
        for item in self._corpus:
            code = item["metadata"].get("is_code", "")
            if code:
                codes.add(code)
        return sorted(codes)

    def _match_is_code_filter(self, is_code: str) -> Optional[str]:
        clean = is_code.strip()
        for stored in self.get_all_codes():
            if (
                stored.lower() == clean.lower()
                or stored.replace(" ", "").lower() == clean.replace(" ", "").lower()
                or clean.lower() in stored.lower()
                or stored.lower() in clean.lower()
            ):
                return stored
        return None

    @staticmethod
    def _key(result: Dict[str, Any]) -> Tuple[str, str]:
        meta = result.get("metadata", {})
        return (result.get("text", "")[:200], str(meta.get("is_code", "")))

    def _dense_query(self, query_text: str, where: Optional[dict]) -> List[Dict[str, Any]]:
        results = self._collection.query(
            query_texts=[query_text],
            n_results=self.dense_top_k,
            where=where,
        )
        formatted = []
        for doc, meta, dist in zip(
            results.get("documents", [[]])[0] if results.get("documents") else [],
            results.get("metadatas", [[]])[0] if results.get("metadatas") else [],
            results.get("distances", [[]])[0] if results.get("distances") else [],
        ):
            formatted.append(
                {
                    "text": doc,
                    "metadata": meta or {},
                    "dense_score": round(1 - dist, 4),
                }
            )
        return formatted

    def _sparse_query(self, query_text: str, where: Optional[dict]) -> List[Dict[str, Any]]:
        if not self._bm25:
            return []

        tokenized_query = _tokenize(query_text)
        if not tokenized_query:
            return []

        scores = self._bm25.get_scores(tokenized_query)
        # Convert to rankable list paired against the filtered corpus
        sized = []
        for index, item in enumerate(self._corpus):
            if where is not None:
                item_code = item["metadata"].get("is_code", "")
                if item_code != where.get("is_code"):
                    continue
            sized.append((index, max(0.0, scores[index])))

        sized.sort(key=lambda pair: pair[1], reverse=True)
        return [
            {
                "text": self._corpus[index]["text"],
                "metadata": self._corpus[index]["metadata"],
                "sparse_score": round(score, 4),
            }
            for index, score in sized[: self.sparse_top_k]
        ]

    def _fuse(self, dense: List[Dict[str, Any]], sparse: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        dense_keys = {self._key(item): item for item in dense}
        sparse_keys = {self._key(item): item for item in sparse}

        fused: Dict[Tuple[str, str], Dict[str, Any]] = {}
        for rank, key in enumerate(dense_keys, start=1):
            entry = fused.setdefault(
                key,
                {
                    "text": dense_keys[key]["text"],
                    "metadata": dense_keys[key]["metadata"],
                    "dense_score": dense_keys[key]["dense_score"],
                    "sparse_score": None,
                    "score": 0.0,
                },
            )
            entry["dense_score"] = dense_keys[key]["dense_score"]
            entry["score"] += 1.0 / (self.rrf_k + rank)

        for rank, key in enumerate(sparse_keys, start=1):
            entry = fused.setdefault(
                key,
                {
                    "text": sparse_keys[key]["text"],
                    "metadata": sparse_keys[key]["metadata"],
                    "dense_score": None,
                    "sparse_score": sparse_keys[key]["sparse_score"],
                    "score": 0.0,
                },
            )
            entry["sparse_score"] = sparse_keys[key]["sparse_score"]
            entry["score"] += 1.0 / (self.rrf_k + rank)

        results = list(fused.values())
        results.sort(key=lambda entry: entry["score"], reverse=True)

        for entry in results:
            source_count = int(entry["dense_score"] is not None) + int(
                entry["sparse_score"] is not None
            )
            # Normalise the fused score into a 0–1 display range.
            entry["score"] = round(entry["score"] * self.rrf_k / max(1, source_count), 4)
        return results

    def query(
        self,
        query_text: str,
        n_results: int = 5,
        is_code: Optional[str] = None,
    ) -> Dict[str, Any]:
        all_codes = self.get_all_codes()

        where = None
        if is_code and is_code.lower() != "all":
            matched = self._match_is_code_filter(is_code)
            if matched is None:
                return {"results": [], "requested_code": is_code, "indexed_codes": all_codes}
            where = {"is_code": matched}

        dense = self._dense_query(query_text, where)
        sparse = self._sparse_query(query_text, where) if self._bm25 else []

        if not dense and not sparse:
            return {"results": [], "indexed_codes": all_codes}

        fused = self._fuse(dense, sparse)
        return {"results": fused[:n_results], "indexed_codes": all_codes}