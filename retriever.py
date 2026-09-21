"""
retriever.py — hybrid retrieval module.

Combines Dense Vector Search (Pinecone or local ChromaDB via the store
interface) with Sparse Keyword Search (BM25 over exact statutory terms such
as "Scheme-I", "IS 1234", clause numbers) that dense search frequently misses.

The two independent rankings are merged with Reciprocal Rank Fusion (RRF),
which is robust to score-scale mismatch. When a Neo4j graph store is wired
in, the top results are further expanded with relational neighbours
(Graph-RAG) so cross-referenced clauses reach the reranker as well.
"""

import hashlib
import re
from typing import Any, Dict, List, Optional, Tuple

try:
    from rank_bm25 import BM25Okapi

    _BM25_AVAILABLE = True
except ImportError:
    _BM25_AVAILABLE = False


_TOKEN_PATTERN = re.compile(r'[a-z0-9]+')

# Default constant used by reciprocal rank fusion: 1/(k + rank).
_RRF_K = 60


def _tokenize(text: str) -> List[str]:
    return _TOKEN_PATTERN.findall(text.lower())


class HybridRetriever:
    """
    Dense + sparse retrieval with reciprocal-rank fusion and optional
    Neo4j graph expansion.

    ``dense_store`` is any object exposing ``query(query_text, n_results,
    is_code_filter)``, ``get_all_documents()`` and ``get_all_codes()`` —
    both ``vectorstore.VectorStore`` and ``pinecone_store.PineconeVectorStore``
    implement this interface.
    """

    def __init__(
        self,
        dense_store: Optional[Any] = None,
        graph_store: Optional[Any] = None,
        dense_top_k: int = 10,
        sparse_top_k: int = 12,
        rrf_k: int = _RRF_K,
    ) -> None:
        self.dense_top_k = dense_top_k
        self.sparse_top_k = sparse_top_k
        self.rrf_k = rrf_k

        if dense_store is None:
            from app.engine.rag.pipeline import create_vector_store

            self._dense = create_vector_store()
        else:
            self._dense = dense_store

        self._graph_store = graph_store
        self._corpus = self._load_corpus()
        self._bm25 = self._build_bm25_index()

    # ── Index setup ─────────────────────────────────────────────────────────

    def _load_corpus(self) -> List[Dict[str, Any]]:
        if hasattr(self._dense, "get_all_documents"):
            return list(self._dense.get_all_documents())
        return []

    def _build_bm25_index(self):
        if not _BM25_AVAILABLE:
            return None
        tokenized_docs = [_tokenize(item["text"]) for item in self._corpus]
        return BM25Okapi(tokenized_docs) if tokenized_docs else None

    # ── Retrieval ───────────────────────────────────────────────────────────

    def get_all_codes(self) -> List[str]:
        if hasattr(self._dense, "get_all_codes"):
            return self._dense.get_all_codes()
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

    def _dense_query(self, query_text: str, is_code: Optional[str]) -> List[Dict[str, Any]]:
        response = self._dense.query(
            query_text=query_text,
            n_results=self.dense_top_k,
            is_code_filter=is_code,
        )
        return [
            {
                "text": result["text"],
                "metadata": result.get("metadata", {}),
                "dense_score": round(float(result.get("score", 0.0)), 4),
            }
            for result in response.get("results", [])
        ]

    def _sparse_query(self, query_text: str, is_code: Optional[str]) -> List[Dict[str, Any]]:
        if not self._bm25:
            return []

        tokenized_query = _tokenize(query_text)
        if not tokenized_query:
            return []

        scores = self._bm25.get_scores(tokenized_query)
        relevant = []
        for index, item in enumerate(self._corpus):
            if is_code is not None:
                item_code = item["metadata"].get("is_code", "")
                if item_code != is_code:
                    continue
            score = max(0.0, float(scores[index]))
            if score > 0.0:
                relevant.append((index, score))

        relevant.sort(key=lambda pair: pair[1], reverse=True)
        return [
            {
                "text": self._corpus[index]["text"],
                "metadata": self._corpus[index]["metadata"],
                "sparse_score": round(score, 4),
            }
            for index, score in relevant[: self.sparse_top_k]
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

    @staticmethod
    def _chunk_key(entry: Dict[str, Any]) -> str:
        meta = entry.get("metadata", {})
        stored = meta.get("chunk_key")
        if stored:
            return stored
        return hashlib.sha1(entry.get("text", "").encode("utf-8")).hexdigest()

    def _expand_with_graph(self, results: List[Dict[str, Any]], max_nodes: int) -> List[Dict[str, Any]]:
        from app.engine.rag.pipeline import expand_contexts

        expanded = expand_contexts(results, self._graph_store, max_nodes=max_nodes)
        # Stamp expansion provenance for traceability.
        if len(expanded) > len(results):
            known = {self._chunk_key(entry) for entry in results}
            for entry in expanded:
                if self._chunk_key(entry) not in known:
                    entry.setdefault("metadata", {})["graph_expanded"] = True
        return expanded

    def query(
        self,
        query_text: str,
        n_results: int = 5,
        is_code: Optional[str] = None,
        graph_expand: bool = True,
    ) -> Dict[str, Any]:
        all_codes = self.get_all_codes()

        matched_code = None
        if is_code and is_code.lower() != "all":
            matched_code = self._match_is_code_filter(is_code)
            if matched_code is None:
                return {"results": [], "requested_code": is_code, "indexed_codes": all_codes}

        dense = self._dense_query(query_text, matched_code)
        sparse = self._sparse_query(query_text, matched_code) if self._bm25 else []

        if not dense and not sparse:
            return {"results": [], "indexed_codes": all_codes}

        fused = self._fuse(dense, sparse)
        top = fused[:n_results]

        if self._graph_store is not None and graph_expand:
            top = self._expand_with_graph(top, max_nodes=n_results)

        return {"results": top, "indexed_codes": all_codes}