"""
graph_store.py — Neo4j-backed regulatory relation graph store.

Migrates the lightweight in-memory knowledge representation to a managed
graph database (Neo4j Aura / cloud) tuned for Graph-RAG expansion.

Schema
------
Nodes
    (:Document {code})          — an IS codebook
    (:Section {id, title})      — a top-level section of a document
    (:Clause {chunk_key, ...})  — an indexed regulatory clause/chunk
    (:Entity {label})           — e.g. license, fee, form, scheme

Relationships
    (:Document)-[:CONTAINS]->(:Section/Clause/Section)
    (:Clause)-[:REFERENCES]->(:Clause | :Document | :Section)
    (:Clause)-[:REQUIRES]->(:Entity)
"""

import hashlib
import os
import re
from typing import Any, Dict, List, Optional

from neo4j import GraphDatabase

# ── Reference extraction ────────────────────────────────────────────────────
_CLAUSE_REF_PATTERN = re.compile(
    r'\b(?:Clause|Sub-Clause|Section|Table|Annex|Schedule)\s+[\d\.]+(?:\s*\([^)]*\))?',
    re.IGNORECASE,
)
_IS_REF_PATTERN = re.compile(r'IS\s+\d+(?::\d+)?', re.IGNORECASE)

_ENTITY_KEYWORDS = (
    "license", "licence", "fee", "form", "scheme", "certificate", "registration",
    "test report", "factory surveillance", "marking",
)


def chunk_key(text: str) -> str:
    return hashlib.sha1(text.encode("utf-8")).hexdigest()


def _extract_clause_refs(text: str) -> List[str]:
    """Clause numbers referenced inside a chunk's body text."""
    refs = []
    for match in _CLAUSE_REF_PATTERN.finditer(text):
        token = match.group(0)
        clause_num = re.sub(r'^\s*(?:Clause|Sub-Clause|Section|Table|Annex|Schedule)\s+',
                            '', token, flags=re.IGNORECASE)
        clause_num = re.sub(r'\s*\([^)]*\)$', '', clause_num).strip()
        if clause_num and clause_num not in refs:
            refs.append(clause_num)
    return refs


def _extract_document_refs(text: str) -> List[str]:
    return list(set(_IS_REF_PATTERN.findall(text.upper())))


def _extract_entities(text: str) -> List[str]:
    lowered = text.lower()
    return [kw for kw in _ENTITY_KEYWORDS if kw in lowered]


# ── Cypher templates ────────────────────────────────────────────────────────
_BULK_CREATE_DOCS_AND_CLAUSES = """
UNWIND $rows AS row
MERGE (d:Document {code: row.is_code})
MERGE (c:Clause {chunk_key: row.chunk_key})
SET c.is_code = row.is_code,
    c.clause_num = row.clause_num,
    c.page_num = row.page_num,
    c.table_ref = row.table_ref,
    c.text = row.text
MERGE (d)-[:CONTAINS]->(c)
"""

_BULK_CREATE_CLAUSE_REFERENCES = """
UNWIND $items AS item
MATCH (c:Clause {chunk_key: item.from_key})
MATCH (t:Clause) WHERE t.is_code = item.is_code AND t.clause_num = item.ref
MERGE (c)-[:REFERENCES]->(t)
"""

_BULK_CREATE_DOCUMENT_REFERENCES = """
UNWIND $items AS item
MATCH (c:Clause {chunk_key: item.from_key})
MATCH (d:Document {code: item.ref})
WHERE NOT d.code = item.is_code
MERGE (c)-[:REFERENCES]->(d)
"""

_BULK_CREATE_ENTITY_REQUIREMENTS = """
UNWIND $items AS item
MATCH (c:Clause {chunk_key: item.chunk_key})
MERGE (e:Entity {label: item.label})
MERGE (c)-[:REQUIRES]->(e)
"""

_GET_RELATED_CONTEXT = """
MATCH (c:Clause)-[r:REFERENCES|REQUIRES]-(x)
WHERE c.chunk_key IN $keys AND NOT x.chunk_key IN $keys
RETURN x.chunk_key AS chunk_key,
       x.text       AS text,
       x.is_code    AS is_code,
       x.clause_num AS clause_num,
       x.page_num   AS page_num,
       x.table_ref  AS table_ref,
       type(r)      AS relation
LIMIT $limit
"""

_STATS_QUERY = """
MATCH (n) RETURN labels(n)[0] AS label, count(n) AS count ORDER BY count DESC
"""

_CLEAR_QUERY = "MATCH (n) DETACH DELETE n"


class Neo4jGraphStore:
    def __init__(
        self,
        uri: Optional[str] = None,
        username: Optional[str] = None,
        password: Optional[str] = None,
        database: Optional[str] = None,
    ):
        self.uri = uri or os.getenv("NEO4J_URI")
        self.username = username or os.getenv("NEO4J_USER") or os.getenv("NEO4J_USERNAME", "neo4j")
        self.password = password or os.getenv("NEO4J_PASSWORD", "")
        self.database = database or os.getenv("NEO4J_DATABASE", "neo4j")

        if not self.uri:
            raise RuntimeError("NEO4J_URI is not set (see .env.example)")

        self._driver = GraphDatabase.driver(
            self.uri,
            auth=(self.username, self.password),
            connection_timeout=15,
        )
        try:
            self._driver.verify_connectivity()
        except Exception as exc:  # noqa: BLE001 — surface clearly at startup
            self._driver.close()
            raise RuntimeError(f"Neo4j connectivity check failed: {exc}") from exc

    # ── Lifecycle ───────────────────────────────────────────────────────────

    def close(self) -> None:
        self._driver.close()

    def __enter__(self):
        return self

    def __exit__(self, *exc_info) -> None:
        self.close()

    # ── Ingestion ───────────────────────────────────────────────────────────

    @staticmethod
    def _ingest_tx(tx, rows: List[Dict[str, Any]]) -> None:
        if not rows:
            return

        tx.run(_BULK_CREATE_DOCS_AND_CLAUSES, rows=rows)

        clause_refs = [
            {"from_key": row["chunk_key"], "is_code": row["is_code"], "ref": ref}
            for row in rows for ref in row["clause_refs"]
        ]
        if clause_refs:
            tx.run(_BULK_CREATE_CLAUSE_REFERENCES, items=clause_refs)

        document_refs = [
            {"from_key": row["chunk_key"], "is_code": row["is_code"], "ref": ref}
            for row in rows for ref in row["document_refs"]
        ]
        if document_refs:
            tx.run(_BULK_CREATE_DOCUMENT_REFERENCES, items=document_refs)

        entities = [
            {"chunk_key": row["chunk_key"], "label": label}
            for row in rows for label in row["entities"]
        ]
        if entities:
            tx.run(_BULK_CREATE_ENTITY_REQUIREMENTS, items=entities)

    def ingest_chunks(self, chunks, batch_size: int = 200) -> int:
        rows = []
        for chunk in chunks:
            text = chunk.text
            meta = chunk.metadata
            rows.append(
                {
                    "chunk_key": chunk_key(text),
                    "is_code": str(meta.get("is_code", "")).strip(),
                    "clause_num": str(meta.get("clause_num", "N/A")),
                    "page_num": int(meta.get("page_num", 1)) if str(meta.get("page_num", "1")).isdigit() else 1,
                    "table_ref": str(meta.get("table_ref", "N/A")),
                    "text": text,
                    "clause_refs": _extract_clause_refs(text),
                    "document_refs": _extract_document_refs(text),
                    "entities": _extract_entities(text),
                }
            )

        with self._driver.session(database=self.database) as session:
            for start in range(0, len(rows), batch_size):
                session.execute_write(self._ingest_tx, rows[start:start + batch_size])
        return len(rows)

    # ── Runtime retrieval (Graph-RAG expansion) ─────────────────────────────

    def get_related_context(self, chunk_keys: List[str], max_nodes: int = 10) -> List[Dict[str, Any]]:
        if not chunk_keys:
            return []

        def _read(tx):
            return list(tx.run(_GET_RELATED_CONTEXT, keys=chunk_keys, limit=max_nodes))

        with self._driver.session(database=self.database) as session:
            records = session.execute_read(_read)

        related = []
        for record in records:
            data = {key: record[key] for key in
                    ("chunk_key", "text", "is_code", "clause_num", "page_num", "table_ref", "relation")
                    if key in record and record[key] is not None}
            if not data.get("text"):
                continue
            related.append(
                {
                    "text": data["text"],
                    "metadata": {
                        "is_code": data.get("is_code", ""),
                        "clause_num": data.get("clause_num", "N/A"),
                        "page_num": data.get("page_num", 1),
                        "table_ref": data.get("table_ref", "N/A"),
                        "chunk_key": data.get("chunk_key", ""),
                        "relation": data.get("relation", ""),
                        "graph_expanded": True,
                    },
                }
            )
        return related

    # ── Maintenance & diagnostics ───────────────────────────────────────────

    def export_graph(self, limit: int = 500) -> Dict[str, List[Dict[str, Any]]]:
        """Export nodes and relationships from Neo4j in network visualization format."""
        query = """
        MATCH (n)
        OPTIONAL MATCH (n)-[r]->(m)
        RETURN n, labels(n)[0] AS n_type, r, type(r) AS rel_type, m, labels(m)[0] AS m_type
        LIMIT $limit
        """
        nodes_dict: Dict[str, Dict[str, Any]] = {}
        edges_list: List[Dict[str, Any]] = []

        with self._driver.session(database=self.database) as session:
            records = list(session.run(query, limit=limit))

        for rec in records:
            n = rec["n"]
            if n:
                n_props = dict(n.items())
                n_id = str(n_props.get("code") or n_props.get("chunk_key") or n_props.get("label") or n_props.get("id") or getattr(n, "element_id", "node"))
                n_type = rec["n_type"] or "Entity"
                n_name = str(n_props.get("is_code") or n_props.get("code") or n_props.get("label") or n_id)
                if n_props.get("clause_num") and n_props.get("is_code"):
                    n_name = f"{n_props['is_code']} Cl.{n_props['clause_num']}"

                if n_id not in nodes_dict:
                    nodes_dict[n_id] = {
                        "id": n_id,
                        "name": n_name,
                        "label": n_name,
                        "type": n_type,
                        "attributes": n_props,
                    }

            m = rec["m"]
            r = rec["r"]
            if m and r:
                m_props = dict(m.items())
                m_id = str(m_props.get("code") or m_props.get("chunk_key") or m_props.get("label") or m_props.get("id") or getattr(m, "element_id", "node"))
                m_type = rec["m_type"] or "Entity"
                m_name = str(m_props.get("is_code") or m_props.get("code") or m_props.get("label") or m_id)
                if m_props.get("clause_num") and m_props.get("is_code"):
                    m_name = f"{m_props['is_code']} Cl.{m_props['clause_num']}"

                if m_id not in nodes_dict:
                    nodes_dict[m_id] = {
                        "id": m_id,
                        "name": m_name,
                        "label": m_name,
                        "type": m_type,
                        "attributes": m_props,
                    }

                edges_list.append({
                    "source": n_id,
                    "target": m_id,
                    "relation": rec["rel_type"] or "LINKS_TO",
                    "type": rec["rel_type"] or "LINKS_TO",
                })

        return {"nodes": list(nodes_dict.values()), "edges": edges_list}

    def stats(self) -> Dict[str, int]:
        with self._driver.session(database=self.database) as session:
            records = list(session.run(_STATS_QUERY))
        return {record["label"]: int(record["count"]) for record in records}

    def clear(self) -> None:
        with self._driver.session(database=self.database) as session:
            session.run(_CLEAR_QUERY)