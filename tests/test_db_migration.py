"""
test_db_migration.py — offline tests for the Pinecone + Neo4j migration.

Everything runs against fake drivers (no network, no cloud credentials), so the
suite is deterministic and CI-safe. Embedding vectors are deterministic
(seeded from the text hash), so chunk ordering / dedupe assertions are stable.
"""

import hashlib
import math
import os
import random
from types import SimpleNamespace

import pinecone
import pytest

from app.engine.rag.pipeline import (
    create_neo4j_graph_store,
    create_vector_store,
    expand_contexts,
    pinecone_configured,
)
from app.engine.rag.pinecone_store import (
    PineconeVectorStore,
    PineconeStoreConfig,
    chunk_key,
)

import app.engine.rag.pinecone_store as pinecone_store_module
import app.engine.graph.graph_store as graph_store_module

from retriever import HybridRetriever


# ── Deterministic embedding helper ─────────────────────────────────────────
def _fake_embed(texts):
    out = []
    for t in texts:
        rng = random.Random(hashlib.sha1(t.encode()).hexdigest())
        vec = [rng.uniform(0.0, 1.0) for _ in range(384)]
        norm = math.sqrt(sum(x * x for x in vec)) or 1.0
        out.append([x / norm for x in vec])
    return out


# ── Fake Pinecone SDK ──────────────────────────────────────────────────────
class FakeIndex:
    def __init__(self):
        self.vectors = {}

    @staticmethod
    def _match(metadata, flt):
        if not flt:
            return True
        for key, value in flt.items():
            meta_val = metadata.get(key)
            if isinstance(value, dict) and "$eq" in value:
                if meta_val != value["$eq"]:
                    return False
            elif meta_val != value:
                return False
        return True

    def upsert(self, *, vectors, namespace="", **kw):
        for vec in vectors:
            vid, vvec = vec[0], list(vec[1])
            meta = dict(vec[2]) if len(vec) > 2 else {}
            self.vectors[vid] = (vvec, meta)
        return SimpleNamespace(upserted_count=len(vectors))

    def query(self, *, vector, top_k, include_metadata=False, filter=None, namespace="", **kw):
        scored = []
        for vid, (vvec, meta) in self.vectors.items():
            if not self._match(meta, filter):
                continue
            dot = sum(a * b for a, b in zip(vector, vvec))
            scored.append((dot, vid, meta))
        scored.sort(key=lambda item: item[0], reverse=True)
        matches = []
        for dot, vid, meta in scored[:top_k]:
            payload = {"id": vid, "score": dot}
            if include_metadata:
                payload["metadata"] = meta
            matches.append(SimpleNamespace(**payload))
        return SimpleNamespace(matches=matches)

    def fetch(self, *, ids, namespace="", **kw):
        fetched = {
            vid: SimpleNamespace(metadata=self.vectors[vid][1])
            for vid in ids
            if vid in self.vectors
        }
        return SimpleNamespace(vectors=fetched)

    def delete(self, *, ids=None, delete_all=False, filter=None, namespace="", **kw):
        to_delete = set(ids or [])
        if delete_all:
            self.vectors.clear()
        elif filter:
            to_delete = {
                vid for vid, (_, meta) in self.vectors.items()
                if self._match(meta, filter)
            }
        for vid in to_delete:
            self.vectors.pop(vid, None)

    def list(self, *, prefix="", limit=100, pagination_token=None, namespace="", **kw):
        ids = [vid for vid in self.vectors.keys() if vid.startswith(prefix)]
        page = list(ids[:limit])
        items = [SimpleNamespace(id=vid) for vid in page]
        pagination = None if len(page) < limit else SimpleNamespace(next=page[-1])
        return SimpleNamespace(vectors=items, pagination=pagination)

    def describe_index_stats(self, **kw):
        return SimpleNamespace(total_vector_count=len(self.vectors))


class FakePinecone:
    def __init__(self, **kw):
        self.indexes = {}

    def has_index(self, name):
        return name in self.indexes

    def describe_index(self, name):
        return SimpleNamespace(status=SimpleNamespace(state="ready"))

    def create_index(self, name, dimension=None, metric=None, spec=None, **kw):
        self.indexes[name] = FakeIndex()
        return SimpleNamespace(name=name)

    def Index(self, name):
        return self.indexes.setdefault(name, FakeIndex())


# ── Fake Neo4j driver ──────────────────────────────────────────────────────
class FakeRecord(dict):
    pass


class FakeSession:
    def __init__(self, driver):
        self.driver = driver

    def __enter__(self):
        return self

    def __exit__(self, *exc_info):
        return False

    def execute_write(self, fn, *args, **kwargs):
        return fn(self, *args, **kwargs)

    def execute_read(self, fn, *args, **kwargs):
        return fn(self, *args, **kwargs)

    def run(self, cypher, **params):
        self.driver.calls.append((cypher, params))
        if "labels(n)" in cypher:
            return [FakeRecord(label="Clause", count=3)]
        if "AS chunk_key" in cypher:
            return [
                FakeRecord(
                    chunk_key="k-neighbour",
                    text="Related clause referenced by Section 8.1",
                    is_code="IS 1786",
                    clause_num="8.1",
                    page_num=6,
                    table_ref="Table 3",
                    relation="REFERENCES",
                ),
                FakeRecord(
                    chunk_key="k-entity",
                    text="This clause requires a manufacturer licence for surveillance.",
                    is_code="IS 456",
                    clause_num="9.2",
                    page_num=7,
                    table_ref="N/A",
                    relation="REQUIRES",
                ),
            ]
        return iter(())


class FakeGraphDatabase:
    def __init__(self):
        self.calls = []

    driver = staticmethod(lambda *args, **kwargs: FakeGraphDatabase())

    def verify_connectivity(self):
        return True

    def close(self):
        pass

    def session(self, database=None):
        return FakeSession(self)


# Test documents reused across tests.
_TEST_CHUNKS = [
    {
        "is_code": "IS 1786",
        "clause_num": "8.1",
        "page_num": 6,
        "table_ref": "Table 3",
        "text": "All clauses referenced under Sub-Clause 8.1 require factory surveillance.",
    },
    {
        "is_code": "IS 1786",
        "clause_num": "8.2",
        "page_num": 6,
        "table_ref": "N/A",
        "text": "Test report and licence marking are recorded per IS 1786.",
    },
    {
        "is_code": "IS 456",
        "clause_num": "9.1",
        "page_num": 7,
        "table_ref": "N/A",
        "text": "Registration fee applies for each form submitted to the scheme.",
    },
]


@pytest.fixture
def pinecone_env(monkeypatch):
    monkeypatch.setattr(pinecone, "Pinecone", FakePinecone)
    monkeypatch.setattr(pinecone, "ServerlessSpec", lambda **kw: kw)
    monkeypatch.setattr(pinecone_store_module, "embed_texts", _fake_embed)
    monkeypatch.setenv("PINECONE_API_KEY", "fake-key")
    monkeypatch.setenv("VECTOR_DB_PROVIDER", "auto")
    monkeypatch.setenv("PINECONE_CLOUD", "aws")
    monkeypatch.setenv("PINECONE_REGION", "us-east-1")
    monkeypatch.delenv("PINECONE_HOST", raising=False)
    yield


@pytest.fixture
def neo4j_env(monkeypatch):
    monkeypatch.setattr(graph_store_module, "GraphDatabase", FakeGraphDatabase)
    monkeypatch.setenv("NEO4J_URI", "neo4j://fake:7687")
    monkeypatch.setenv("NEO4J_USERNAME", "neo4j")
    monkeypatch.setenv("NEO4J_PASSWORD", "secret")
    monkeypatch.setenv("NEO4J_DATABASE", "neo4j")
    yield


# ── Provider factory ───────────────────────────────────────────────────────

def test_provider_factory_uses_pinecone_when_configured(pinecone_env):
    store = create_vector_store()
    assert isinstance(store, PineconeVectorStore)
    assert pinecone_configured()


def test_provider_factory_forces_chroma_when_override_set(monkeypatch):
    monkeypatch.setenv("PINECONE_API_KEY", "fake-key")
    monkeypatch.setenv("VECTOR_DB_PROVIDER", "chroma")
    monkeypatch.delenv("PINECONE_HOST", raising=False)
    from app.engine.rag.vectorstore import VectorStore

    assert not pinecone_configured()
    assert isinstance(create_vector_store(), VectorStore)


def test_neo4j_store_absent_without_uri(monkeypatch):
    monkeypatch.delenv("NEO4J_URI", raising=False)
    assert create_neo4j_graph_store() is None


def test_neo4j_store_present_with_uri(neo4j_env):
    store = create_neo4j_graph_store()
    assert store is not None
    store.close()


# ── Pinecone store round trip ──────────────────────────────────────────────

def _as_chunk(row):
    return SimpleNamespace(
        text=row["text"],
        metadata={
            "is_code": row["is_code"],
            "clause_num": row["clause_num"],
            "page_num": row["page_num"],
            "table_ref": row["table_ref"],
        },
    )


def test_pinecone_store_roundtrip(pinecone_env):
    store = PineconeVectorStore(config=PineconeStoreConfig(index_name="test-index"))
    try:
        assert isinstance(store._client, FakePinecone)
        # The constructor auto-seeds the bundled standards; start clean.
        store.clear()

        added = store.add_chunks([_as_chunk(r) for r in _TEST_CHUNKS])
        assert added == 3
        assert store.count() == 3

        codes = store.get_all_codes()
        assert codes == ["IS 1786", "IS 456"]

        docs = store.get_all_documents()
        assert len(docs) == 3
        assert all("text" in doc and "metadata" in doc for doc in docs)

        q = store.query(
            query_text="factory surveillance requirements",
            n_results=2,
            is_code_filter="IS 1786",
        )
        assert q["indexed_codes"] == ["IS 1786", "IS 456"]
        assert 1 <= len(q["results"]) <= 2
        for result in q["results"]:
            assert result["metadata"]["is_code"] == "IS 1786"
            assert "score" in result

        deleted = store.delete_by_is_code("IS 456")
        assert deleted == 1
        assert store.count() == 2
        assert store.get_all_codes() == ["IS 1786"]
    finally:
        store.clear()


# ── Neo4j graph store ──────────────────────────────────────────────────────

def test_neo4j_ingest_and_relation_expansion(neo4j_env):
    store = create_neo4j_graph_store()
    try:
        ingested = store.ingest_chunks([_as_chunk(r) for r in _TEST_CHUNKS])
        assert ingested == 3

        session = store._driver.session()
        merge_stats = [c for c in store._driver.calls if "MERGE" in c[0]]
        assert merge_stats, "expected MERGE-based Cypher ingestion"

        related = store.get_related_context([chunk_key(_TEST_CHUNKS[0]["text"])], max_nodes=3)
        assert len(related) == 2
        first = related[0]
        assert first["metadata"]["graph_expanded"] is True
        assert first["metadata"]["chunk_key"] in {"k-neighbour", "k-entity"}
        assert first["metadata"]["relation"] in {"REFERENCES", "REQUIRES"}
    finally:
        store.close()


def test_neo4j_stats_and_clear(neo4j_env):
    store = create_neo4j_graph_store()
    try:
        store.ingest_chunks([_as_chunk(r) for r in _TEST_CHUNKS])
        assert store.stats().get("Clause") == 3
        store.clear()
        assert len(store._driver.calls) >= 2
    finally:
        store.close()


# ── Graph-RAG context expansion ────────────────────────────────────────────

class _FakeGraphStore:
    def __init__(self, related):
        self.related = related

    def get_related_context(self, keys, max_nodes):
        return self.related


def test_expand_contexts_deduplicates_and_merges_new_rows():
    context = [
        {
            "text": "Known chunk already in retrieval set quite long bit of text",
            "metadata": {"chunk_key": "k-known", "is_code": "IS 1786"},
        }
    ]
    graph = _FakeGraphStore(
        related=[
            # duplicate of an already-retrieved chunk → must be dropped
            {
                "text": "Known chunk already in retrieval set quite long bit of text",
                "metadata": {"chunk_key": "k-known-technical", "relation": "REFERENCES"},
            },
            {
                "text": "Brand new neighbouring clause material from the graph",
                "metadata": {"chunk_key": "k-new", "relation": "REQUIRES"},
            },
        ]
    )

    merged = expand_contexts(context, graph, max_nodes=5)
    assert len(merged) == 2
    texts = {entry["text"] for entry in merged}
    assert "Brand new neighbouring clause material from the graph" in texts


def test_expand_contexts_noop_without_graph():
    assert expand_contexts([], None) == []
    context = [{"text": "x", "metadata": {}}]
    assert expand_contexts(context, None) == context


# ── Hybrid retriever decoupled from Chroma (interface-only) ────────────────

class _FakeDenseStore:
    def __init__(self, docs):
        self.docs = docs
        self.codes = ["IS 1786", "IS 456"]

    def get_all_codes(self):
        return self.codes

    def get_all_documents(self):
        return [{"text": d["text"], "metadata": d["metadata"]} for d in self.docs]

    def query(self, query_text, n_results, is_code_filter=None):
        results = []
        for d in self.docs:
            if is_code_filter and d["metadata"]["is_code"] != is_code_filter:
                continue
            results.append(
                {
                    "text": d["text"],
                    "metadata": d["metadata"],
                    "score": 0.9 if "surveillance" in d["text"] else 0.3,
                }
            )
        results.sort(key=lambda r: r["score"], reverse=True)
        return {"results": results[:n_results]}


class _FakeExpansionGraph:
    def get_related_context(self, keys, max_nodes):
        return [
            {
                "text": "Expanded cross-referenced clause from Neo4j beyond the top-k",
                "metadata": {"chunk_key": "k-expanded", "relation": "REFERENCES"},
            }
        ]


def test_retriever_uses_dense_interface_and_expands_via_graph():
    chunks = [_as_chunk(r) for r in _TEST_CHUNKS]
    docs = [{"text": c.text, "metadata": c.metadata} for c in chunks]
    retriever = HybridRetriever(
        dense_store=_FakeDenseStore(docs),
        graph_store=_FakeExpansionGraph(),
        dense_top_k=5,
        sparse_top_k=3,
    )

    response = retriever.query("factory surveillance test report", n_results=5)
    assert response["indexed_codes"] == ["IS 1786", "IS 456"]
    assert len(response["results"]) == 4  # 3 dense/sparse + 1 graph expansion

    expanded = [
        entry for entry in response["results"]
        if entry["metadata"].get("graph_expanded")
    ]
    assert len(expanded) == 1
    assert expanded[0]["text"].startswith("Expanded cross-referenced")