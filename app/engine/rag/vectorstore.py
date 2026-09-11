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
        self._seed_initial_standards()

    def _seed_initial_standards(self):
        existing_codes = set(self.get_all_codes())
        seed_chunks = [
            # IS 1786 - High Strength Deformed Steel Bars (TMT)
            Chunk(
                text="The yield strength/proof stress specified in IS 1786 varies by grade: Fe415 — 415 N/mm², Fe500 — 500 N/mm², Fe550 — 550 N/mm², and Fe600 — 600 N/mm². The 'D' grades (Fe415D, Fe500D, Fe550D) have the same specified minimum yield/proof stress as their corresponding grades but provide enhanced elongation requirements (16%, 16%, and 14.5% respectively) for high seismic zone resistance.",
                metadata={"is_code": "IS 1786", "clause_num": "1.1", "page_num": 1, "table_ref": "Table 3"}
            ),
            Chunk(
                text="Clause 8.1 & Table 3 Mechanical Properties of High Strength Deformed Steel Bars: Grade Fe 415 minimum yield stress 415 N/mm², tensile strength 1.10 times actual yield stress, elongation 14.5%. Grade Fe 500 minimum yield stress 500 N/mm², tensile strength 1.08 times actual yield stress, elongation 12.0%. Grade Fe 550 minimum yield stress 550 N/mm², tensile strength 1.06 times actual yield stress, elongation 10.0%. Grade Fe 600 minimum yield stress 600 N/mm², tensile strength 1.06 times actual yield stress, elongation 8.0%.",
                metadata={"is_code": "IS 1786", "clause_num": "8.1", "page_num": 6, "table_ref": "Table 3"}
            ),
            # IS 13252 - IT Equipment Safety
            Chunk(
                text="Clause 1.4 General Requirements for Electrical & Mechanical Safety: Information technology equipment shall be designed and constructed to protect operators and service personnel against electric shock, energy hazards, fire, thermal hazards, and radiation under normal operating conditions and under single fault conditions.",
                metadata={"is_code": "IS 13252", "clause_num": "1.4", "page_num": 5, "table_ref": "N/A"}
            ),
            Chunk(
                text="Clause 2.1 Protection Against Electric Shock: Accessible conductive parts of equipment must be reliably earthed or separated from live parts by double insulation or reinforced insulation. Dielectric withstand test voltage shall be 1500V RMS for basic insulation and 3000V RMS for reinforced insulation.",
                metadata={"is_code": "IS 13252", "clause_num": "2.1", "page_num": 12, "table_ref": "Table 2B"}
            ),
            # IS 15885 - Lamp Controlgear for LED Modules
            Chunk(
                text="Clause 6.1 Performance and Thermal Safety of Electronic Controlgear for LED Modules: LED drivers shall maintain output voltage/current stability within ±5% across input voltage fluctuations of 180V to 270V AC. Temperature rise of components shall not exceed safety limits under maximum rated ambient temperature.",
                metadata={"is_code": "IS 15885", "clause_num": "6.1", "page_num": 8, "table_ref": "Table 1"}
            ),
            # IS 14286 - Solar PV Modules
            Chunk(
                text="Clause 10.11 Thermal Cycling and Damp Heat Testing: Photovoltaic modules shall undergo 200 thermal cycles (-40°C to +85°C) and 1000 hours of damp heat testing (85°C, 85% RH). Peak power output degradation following stress testing shall not exceed 5% of initial rated power.",
                metadata={"is_code": "IS 14286", "clause_num": "10.11", "page_num": 18, "table_ref": "N/A"}
            ),
            # IS 1489 - Portland Pozzolana Cement
            Chunk(
                text="Clause 6.1 Compressive Strength & Fineness Requirements: Portland Pozzolana Cement (Fly Ash Based) shall achieve minimum compressive strength of 16.0 MPa at 72±1 hours (3 days), 22.0 MPa at 168±2 hours (7 days), and 33.0 MPa at 672±4 hours (28 days). Minimum fineness by Blaine's air permeability method shall be 300 m²/kg.",
                metadata={"is_code": "IS 1489", "clause_num": "6.1", "page_num": 4, "table_ref": "Table 1"}
            ),
            # IS 694 - PVC Cables
            Chunk(
                text="Clause 8.2 Electric Withstand & Insulation Resistance: PVC insulated cables for working voltages up to 1100V shall withstand a high voltage test of 3.0 kV AC for 5 minutes without breakdown. Minimum insulation resistance shall be 10 MΩ·km at 27°C.",
                metadata={"is_code": "IS 694", "clause_num": "8.2", "page_num": 9, "table_ref": "Table 4"}
            ),
            # IS 16046 - Lithium Batteries Safety
            Chunk(
                text="Clause 7.3 Electrical & Thermal Safety for Lithium Secondary Batteries: Cells and battery packs shall pass external short-circuit test at 55°C, continuous overcharge test, and thermal abuse test (130°C for 10 minutes) without explosion or ignition.",
                metadata={"is_code": "IS 16046", "clause_num": "7.3", "page_num": 14, "table_ref": "Table 2"}
            ),
            # IS 2925 - Industrial Safety Helmets
            Chunk(
                text="Clause 6.2 Impact Absorption & Penetration Resistance: Industrial safety helmets shall limit the maximum transmitted force to 5.0 kN under a 5.0 kg striker drop test from 1.0 meter. The helmet shell shall prevent electrical puncture at 10 kV AC.",
                metadata={"is_code": "IS 2925", "clause_num": "6.2", "page_num": 7, "table_ref": "Table 1"}
            )
        ]

        to_add = [c for c in seed_chunks if c.metadata["is_code"] not in existing_codes]
        if to_add:
            self.add_chunks(to_add)


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
        all_codes = self.get_all_codes()

        if is_code_filter and is_code_filter.lower() != 'all':
            clean_code = is_code_filter.strip()
            # Normalize target code patterns: "IS 456", "IS456", "456"
            matched_code = None
            for stored in all_codes:
                if (
                    stored.lower() == clean_code.lower() or
                    stored.replace(" ", "").lower() == clean_code.replace(" ", "").lower() or
                    clean_code.lower() in stored.lower() or
                    stored.lower() in clean_code.lower()
                ):
                    matched_code = stored
                    break

            if matched_code:
                where_filter = {"is_code": matched_code}
            else:
                # If requested IS code is not present in vector database, return empty with metadata
                return {"results": [], "requested_code": is_code_filter, "indexed_codes": all_codes}

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
                    "score": round(1 - dist, 4)
                })

        # Sort by relevance score descending
        formatted.sort(key=lambda x: x["score"], reverse=True)
        return {"results": formatted, "indexed_codes": all_codes}


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
