import os
import uuid
import json
from typing import List, Dict, Any, Optional
from dataclasses import dataclass

import chromadb
from chromadb.config import Settings as ChromaSettings
from chromadb.utils import embedding_functions

from .ingestion import Chunk


@dataclass
class VectorStoreConfig:
    persist_directory: str = "./chroma_db"
    collection_name: str = "is_codebooks"
    embedding_provider: str = "huggingface"
    huggingface_model: str = "all-MiniLM-L6-v2"
    openai_api_key: Optional[str] = None
    openai_model: str = "text-embedding-3-small"


class VectorStore:
    def __init__(self, config: Optional[VectorStoreConfig] = None):
        self.config = config or VectorStoreConfig()
        os.makedirs(self.config.persist_directory, exist_ok=True)

        self._client = chromadb.PersistentClient(
            path=self.config.persist_directory,
            settings=ChromaSettings(anonymized_telemetry=False)
        )

        self._embedding_fn = self._build_embedding_function()
        self._collection = self._client.get_or_create_collection(
            name=self.config.collection_name,
            embedding_function=self._embedding_fn,
            metadata={"hnsw:space": "cosine"}
        )

    def _build_embedding_function(self):
        provider = self.config.embedding_provider.lower()
        if provider == "openai" and self.config.openai_api_key:
            return embedding_functions.OpenAIEmbeddingFunction(
                api_key=self.config.openai_api_key,
                model_name=self.config.openai_model
            )
        return embedding_functions.SentenceTransformerEmbeddingFunction(
            model_name=self.config.huggingface_model
        )

    def add_chunks(self, chunks: List[Chunk]) -> int:
        if not chunks:
            return 0

        ids = []
        documents = []
        metadatas = []

        for chunk in chunks:
            ids.append(str(uuid.uuid4()))
            documents.append(chunk.text)
            metadatas.append(chunk.metadata)

        self._collection.add(
            ids=ids,
            documents=documents,
            metadatas=metadatas
        )
        return len(chunks)

    def query(self, query_text: str, n_results: int = 5, is_code_filter: Optional[str] = None) -> Dict[str, Any]:
        where_filter = None
        if is_code_filter:
            target_codes = list({is_code_filter, is_code_filter.upper(), is_code_filter.lower()})
            where_filter = {"is_code": {"$in": target_codes}}

        results = self._collection.query(
            query_texts=[query_text],
            n_results=n_results,
            where=where_filter
        )

        formatted = []
        if results["documents"] and results["documents"][0]:
            for doc, meta, dist in zip(
                results["documents"][0],
                results["metadatas"][0],
                results["distances"][0]
            ):
                formatted.append({
                    "text": doc,
                    "metadata": meta,
                    "score": 1 - dist
                })
        return {"results": formatted}

    def count(self) -> int:
        return self._collection.count()

    def get_all_codes(self) -> List[str]:
        results = self._collection.get(include=["metadatas"])
        codes = set()
        for meta in results.get("metadatas", []):
            if meta and "is_code" in meta:
                codes.add(meta["is_code"])
        return sorted(list(codes))

    def delete_by_is_code(self, is_code: str) -> int:
        target_codes = list({is_code, is_code.upper(), is_code.lower()})
        results = self._collection.get(where={"is_code": {"$in": target_codes}})
        ids = results.get("ids", []) if results else []

        if not ids:
            # Fallback scan: case-insensitive comparison over all metadatas
            all_data = self._collection.get(include=["metadatas"])
            all_ids = all_data.get("ids", [])
            all_meta = all_data.get("metadatas", [])
            target_lower = is_code.strip().lower()
            ids = [
                doc_id for doc_id, meta in zip(all_ids, all_meta)
                if meta and meta.get("is_code", "").strip().lower() == target_lower
            ]

        if ids:
            self._collection.delete(ids=ids)
            return len(ids)
        return 0
