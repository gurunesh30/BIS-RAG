# BIS Verification Suite

A full-stack platform for querying Indian Standard (IS) codebooks with citation-backed answers, verifying BIS product licenses through a supply-chain knowledge graph, and locating nearby accredited testing laboratories — with multilingual support for Tamil, Telugu, Hindi, and 10+ other languages.

---

## Table of Contents

- [Project Walkthrough](#project-walkthrough)
- [System Architecture](#system-architecture)
- [Repository Structure](#repository-structure)
- [Getting Started](#getting-started)
- [Configuration](#configuration)
- [API Reference](#api-reference)
- [Multilingual Support](#multilingual-support)
- [Knowledge Graph](#knowledge-graph)
- [Adding Standard Documents](#adding-standard-documents)

---

## Project Walkthrough

### RAG Assistant

Ask natural-language questions about any indexed Indian Standard codebook and receive clause-cited answers.

- Type a query in English or any supported Indian language (Tamil, Telugu, Hindi, Kannada, Malayalam, Bengali, Gujarati, Punjabi, Odia)
- Non-English queries are automatically translated to English for vector retrieval, then the answer is returned in your original language
- Filter by a specific IS Code using the Standard selector in the input bar
- Click **Sources** to inspect the exact chunks and similarity scores that produced the answer
- Sample prompts are shown on the empty state for quick exploration

### Graph Verifier

Verify whether a BIS product license is legitimate by traversing a supply-chain knowledge graph.

- Enter a License ID (e.g. `CM/L-1234567`) or Product ID (e.g. `PROD-LED-50W`)
- The engine performs a BFS traversal checking: license status and expiry, manufacturer factory registration, standard conformance, and test lab accreditation
- Results show the full traversal path with per-hop pass/fail status
- The interactive force-directed graph visualises all nodes and edges in the system
- New nodes can be added via the Add Node drawer

### IS Code Finder

Look up which Indian Standard applies to a manufactured product.

- Type a product name or IS Code number — ghost autocomplete completes known entries
- Press Tab or → to accept the suggestion; press Enter to search
- Results show the standard title, mandatory testing parameters, and a RAG-powered clause summary
- Quick-select pills surface the most common product categories

### Nearby Labs

Find BIS-accredited testing laboratories closest to your current location.

- The browser's GPS is used in real time (`watchPosition` with high accuracy)
- If location access is denied, the view falls back to Pollachi Bus Stand coordinates
- Labs are ranked by live Haversine distance and re-sorted as you move
- Click a lab row to expand contact details, applicable IS standards, Google Maps directions, and a direct phone link
- An OpenStreetMap iframe shows your position relative to all labs

---

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      Browser (React 19)                  │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ RAG Assistant│  │Graph Verifier│  │ IS Code Finder│  │
│  └──────┬───────┘  └──────┬───────┘  └───────────────┘  │
│         │                 │                              │
│  ┌──────▼─────────────────▼──────────────────────────┐  │
│  │              api.ts  (fetch wrapper)               │  │
│  └──────────────────────┬─────────────────────────────┘  │
└─────────────────────────┼───────────────────────────────┘
                          │ HTTP/JSON
┌─────────────────────────▼───────────────────────────────┐
│                FastAPI Engine  (port 8001)               │
│                                                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │              Translation Layer                   │    │
│  │  services/translator.py                         │    │
│  │  · Unicode script detection (14 ranges)         │    │
│  │  · MyMemory REST API  (te|en, hi|en, ta|en …)   │    │
│  │  · 800ms timeout, UTF-8 guards, echo detection  │    │
│  └────────────────────┬────────────────────────────┘    │
│                       │ English query                    │
│  ┌────────────────────▼────────────────────────────┐    │
│  │                 RAG Pipeline                     │    │
│  │                                                  │    │
│  │  ingestion.py          vectorstore.py            │    │
│  │  · PyMuPDF text        · ChromaDB persistent     │    │
│  │    extraction          · all-MiniLM-L6-v2        │    │
│  │  · TOC page skip         embedding               │    │
│  │  · Clause/Table        · Cosine similarity       │    │
│  │    boundary chunking     HNSW index              │    │
│  │  · Min 80-char         · IS code filter          │    │
│  │    length gate           support                 │    │
│  │                                                  │    │
│  │  synthesizer.py                                  │    │
│  │  · OpenRouter → Qwen3-8B                         │    │
│  │  · Native-language system prompt                 │    │
│  │  · <think> block stripping                       │    │
│  │  · Citation regex parser                         │    │
│  │  · Keyword-overlap fallback                      │    │
│  └──────────────────────────────────────────────────┘    │
│                                                          │
│  ┌──────────────────────────────────────────────────┐    │
│  │             Knowledge Graph Engine               │    │
│  │                                                  │    │
│  │  graph/engine.py                                 │    │
│  │  · NetworkX DiGraph                              │    │
│  │  · BFS license traversal                         │    │
│  │  · JSON backup persistence                       │    │
│  │  · Seed demo supply-chain graph                  │    │
│  └──────────────────────────────────────────────────┘    │
│                                                          │
│  Startup: _ingest_standards_dir()                        │
│  · Scans data/standards/*.pdf                            │
│  · Skips already-indexed IS codes                        │
│  · Runs before first request                             │
└─────────────────────────────────────────────────────────┘
         │                          │
   ChromaDB (./chroma_db)    graph_backup.json
```

### Data Flow — RAG Query

```
User query (any language)
        │
        ▼
services/translator.py
  detect_langpair() → "te|en" / "hi|en" / None
  MyMemory API → English translation
        │
        ▼ English query
vectorstore.py
  SentenceTransformer embed → ChromaDB cosine search
  Top-N chunks + metadata
        │
        ▼
synthesizer.py
  Qwen3-8B via OpenRouter
  System prompt: language instruction (native or English)
  User message: original query + ⚠ language directive + context sources
  Response: answer in user's language + [IS Code | Clause | Page] citations
        │
        ▼
/api/rag/query JSON response
```

### Data Flow — License Verification

```
License ID or Product ID
        │
        ▼
graph/engine.py  verify_license()
  BFS from root node (depth ≤ 3)
  Per hop checks:
    ISSUED_TO  → manufacturer factory_registration_active
    CONFORMS_TO → standard active flag
    TESTED_BY  → lab_accreditation == VALID
    LICENSE    → status == ACTIVE && expiry_date > today
        │
        ▼
{ is_legitimate, status, path[], broken_edges[], details }
```

---

## Repository Structure

```
BIS-RAG/
├── app/
│   ├── engine/                   # FastAPI backend
│   │   ├── main.py               # App entrypoint, routes, startup ingest
│   │   ├── requirements.txt
│   │   ├── rag/
│   │   │   ├── ingestion.py      # PDF → chunks pipeline
│   │   │   ├── vectorstore.py    # ChromaDB wrapper + seed data
│   │   │   └── synthesizer.py    # LLM synthesis + citation parsing
│   │   ├── graph/
│   │   │   ├── engine.py         # NetworkX graph + BFS verifier
│   │   │   └── schema.py         # NodeType, EdgeType, dataclasses
│   │   └── services/
│   │       └── translator.py     # MyMemory async translation layer
│   └── ui/                       # React 19 + Vite frontend
│       ├── src/
│       │   ├── App.tsx           # Root layout, tab routing
│       │   ├── components/
│       │   │   ├── rag/          # RagAssistant, ChatMessage, SourceDrawer
│       │   │   ├── graph/        # GraphVerifier, NetworkGraph, AddNodeDrawer
│       │   │   ├── product/      # ProductForm (IS Code Finder)
│       │   │   ├── labs/         # LabFinder (GPS proximity)
│       │   │   └── layout/       # TabNavigation, HeaderStatsBar, ThemeToggle
│       │   ├── hooks/
│       │   │   └── useLiveLocation.ts   # watchPosition + fallback
│       │   ├── lib/
│       │   │   ├── api.ts        # Typed fetch wrappers
│       │   │   └── utils.ts      # cn(), filterArray(), getDistanceInKm()
│       │   └── types/index.ts    # Shared TypeScript interfaces
│       └── public/
│           └── labs.json         # Static lab directory (Pollachi area)
├── data/
│   └── standards/                # Drop IS codebook PDFs here
│       └── .gitkeep
├── chroma_db/                    # ChromaDB persistent store (git-ignored)
├── labs.json                     # Source lab data
└── .env                          # API keys (git-ignored)
```

---

## Getting Started

### Prerequisites

- Python 3.11
- [Bun](https://bun.sh) 1.3.14, or Node.js 20.19+ / 22.12+
- An [OpenRouter](https://openrouter.ai) API key

### Backend

Run backend commands from the repository root so package imports and relative data paths resolve correctly.

```bash
python -m venv .venv
source .venv/bin/activate

# Managed Pinecone and Neo4j deployment
python -m pip install -r requirements.txt

# Start the API
uvicorn app.engine.main:app --host 0.0.0.0 --port 8001 --reload
```

For local ChromaDB development, use `python -m pip install -r app/engine/requirements.txt` instead of the production requirements. The server starts on `http://localhost:8001`. On first boot, `_ingest_standards_dir()` scans `data/standards/` and indexes any PDFs it finds. The bundled seed clauses are always available without any PDFs.

### Frontend

```bash
cd app/ui
bun install --frozen-lockfile
bun run dev
```

Copy `app/ui/.env.example` to `app/ui/.env.local` when the API does not run at `http://localhost:8001`. The UI is served on `http://localhost:5173` and proxies API calls to the configured backend URL.

---

## Configuration

Copy `.env.example` to `.env` in the project root and provide only the credentials required by your deployment. All supported credential fields are blank in the template.

| Variable | Required | Default | Description |
|---|---|---|---|
| `OPENROUTER_API_KEY` | Yes | — | OpenRouter API key for LLM synthesis |
| `OPENROUTER_MODEL` | No | `qwen/qwen3-8b` | Any model available on OpenRouter |
| `VECTOR_DB_PROVIDER` | No | `auto` | Use `auto` or force `chroma` |
| `PINECONE_API_KEY` | For Pinecone | — | Pinecone API key |
| `PINECONE_INDEX_NAME` | No | `bis-codebooks` | Pinecone index name |
| `PINECONE_CLOUD` | No | `aws` | Serverless index cloud |
| `PINECONE_REGION` | No | `us-east-1` | Serverless index region |
| `NEO4J_URI` | For graph retrieval | — | Neo4j connection URI |
| `NEO4J_USERNAME` | For graph retrieval | — | Neo4j username |
| `NEO4J_PASSWORD` | For graph retrieval | — | Neo4j password |
| `FRONTEND_URL` | No | — | Comma-separated additional CORS origins |
| `MYMEMORY_EMAIL` | No | — | Registered email for higher translation quota |

Legacy aliases such as `OPENROUTER_API`, `NEO4J_USER`, `GOOGLE_API_KEY`, and `VITE_API_URL` remain accepted by the application, but new deployments should use the canonical names above.

---

## API Reference

Base URL: `http://localhost:8001`

---

### `GET /health`

Health check.

**Response**
```json
{
  "status": "ok",
  "timestamp": "2026-09-11T10:30:00.000000"
}
```

---

### `POST /api/rag/query`

Query the indexed IS codebooks and receive a cited answer.

**Request body**
```json
{
  "query": "string",
  "is_code": "string | null",
  "n_results": 5
}
```

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `query` | string | Yes | — | Question in any supported language |
| `is_code` | string | No | null | Filter to a specific IS code, e.g. `"IS 1786"` |
| `n_results` | integer | No | 5 | Number of context chunks to retrieve (1–20) |

**Response**
```json
{
  "answer": "Fe 500 grade steel bars must have a minimum yield stress of 500 N/mm²... [IS 1786 | Clause 8.1 | Page 6]",
  "citations": [
    {
      "is_code": "IS 1786",
      "clause_num": "8.1",
      "page_num": 6,
      "table_ref": "Table 3",
      "text": "Clause 8.1 & Table 3 Mechanical Properties..."
    }
  ],
  "contexts": [
    {
      "text": "Clause 8.1 & Table 3 Mechanical Properties of High Strength...",
      "metadata": {
        "is_code": "IS 1786",
        "clause_num": "8.1",
        "page_num": 6,
        "table_ref": "Table 3"
      },
      "score": 0.8921
    }
  ]
}
```

**Example — English**
```bash
curl -X POST http://localhost:8001/api/rag/query \
  -H "Content-Type: application/json" \
  -d '{"query": "What is the minimum yield strength for Fe 500 steel?"}'
```

**Example — Tamil**
```bash
curl -X POST http://localhost:8001/api/rag/query \
  -H "Content-Type: application/json" \
  -d '{"query": "Fe 500 தர எஃகு கம்பியின் குறைந்தபட்ச விளைச்சல் அழுத்தம் என்ன?"}'
```

**Example — Telugu**
```bash
curl -X POST http://localhost:8001/api/rag/query \
  -H "Content-Type: application/json" \
  -d '{"query": "Fe 415 గ్రేడ్ ఉక్కు కడ్డీకి కనీస దిగువబలం ఎంత?", "is_code": "IS 1786"}'
```

---

### `GET /api/rag/codes`

List all IS codes currently indexed in ChromaDB.

**Response**
```json
{
  "codes": ["IS 1489", "IS 13252", "IS 14286", "IS 1786", "IS 2925", "IS 694"]
}
```

---

### `DELETE /api/rag/codes/{is_code}`

Remove all chunks for a given IS code from the vector store.

**Path parameter:** `is_code` — e.g. `IS%201786`

**Response**
```json
{
  "success": true,
  "deleted_chunks": 12
}
```

---

### `POST /api/graph/verify`

Verify a BIS product license by traversing the knowledge graph.

**Request body**
```json
{
  "license_id": "CM/L-1234567"
}
```

Either `license_id` or `product_id` must be provided.

**Response**
```json
{
  "license_id": "CM/L-1234567",
  "is_legitimate": true,
  "status": "VALID",
  "path": [
    { "node_id": "CM/L-1234567", "node_type": "License",      "status": "OK",   "details": "Status: active, Expiry: 2028-06-30" },
    { "node_id": "MFG-Apex",     "node_type": "Manufacturer", "status": "OK",   "details": "Factory registration active: True" },
    { "node_id": "IS 13252",     "node_type": "IndianStandard","status": "OK",  "details": "Standard active: True" },
    { "node_id": "LAB-NABL-01",  "node_type": "TestLab",      "status": "OK",   "details": "Lab accreditation: valid" }
  ],
  "broken_edges": [],
  "details": { "license": { "status": "active", "expiry_date": "2028-06-30" } }
}
```

**Possible `status` values**

| Value | Meaning |
|---|---|
| `VALID` | All hops pass — license is legitimate |
| `INVALID` | One or more hops failed |
| `NOT_FOUND` | The node ID does not exist in the graph |

**Failure example** — expired license
```json
{
  "license_id": "CM/L-9999999",
  "is_legitimate": false,
  "status": "INVALID",
  "broken_edges": ["License CM/L-9999999 expired on 2024-01-15"],
  ...
}
```

---

### `POST /api/graph/nodes/add`

Add a new node (and optionally an edge) to the knowledge graph.

**Request body**
```json
{
  "node_id": "PROD-TMT-FE500",
  "node_type": "Product",
  "edge_to": "CM/L-1234567",
  "edge_type": "COVERS"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `node_id` | string | Yes | Unique identifier for the new node |
| `node_type` | string | Yes | One of: `License`, `Product`, `Manufacturer`, `IndianStandard`, `TestLab` |
| `edge_to` | string | No | ID of an existing node to connect to |
| `edge_type` | string | No | One of: `COVERS`, `ISSUED_TO`, `CONFORMS_TO`, `TESTED_BY` |

**Response**
```json
{
  "success": true,
  "node_id": "PROD-TMT-FE500"
}
```

---

### `GET /api/graph/export`

Export the full graph as a node/edge list.

**Response**
```json
{
  "nodes": [
    { "id": "CM/L-1234567", "type": "License", "status": "active", "expiry_date": "2028-06-30" },
    ...
  ],
  "edges": [
    { "source": "CM/L-1234567", "target": "MFG-Apex", "type": "ISSUED_TO" },
    ...
  ]
}
```

---

## Multilingual Support

Queries are automatically detected and translated before retrieval.

**Supported languages**

| Language | Script | MyMemory pair |
|---|---|---|
| Telugu | Telugu (U+0C00–0C7F) | `te\|en` |
| Hindi | Devanagari (U+0900–097F) | `hi\|en` |
| Tamil | Tamil (U+0B80–0BFF) | `ta\|en` |
| Kannada | Kannada (U+0C80–0CFF) | `kn\|en` |
| Malayalam | Malayalam (U+0D00–0D7F) | `ml\|en` |
| Bengali | Bengali (U+0980–09FF) | `bn\|en` |
| Punjabi | Gurmukhi (U+0A00–0A7F) | `pa\|en` |
| Gujarati | Gujarati (U+0A80–0AFF) | `gu\|en` |
| Odia | Odia (U+0B00–0B7F) | `or\|en` |
| Arabic | Arabic (U+0600–06FF) | `ar\|en` |
| Russian | Cyrillic (U+0400–04FF) | `ru\|en` |
| Chinese | CJK (U+4E00–9FFF) | `zh\|en` |
| Japanese | Hiragana/Katakana | `ja\|en` |
| Korean | Hangul (U+AC00–D7AF) | `ko\|en` |

**How it works**

1. The dominant script in the query is identified by codepoint frequency counting — no external language-detection dependency.
2. The text is sent to MyMemory with the explicit langpair (e.g. `ta|en`) and an 800ms hard timeout.
3. ChromaDB search runs against the English translation.
4. The LLM receives the original native-language query with a hard directive to respond in that same language. The English translation is shown only as retrieval context.
5. If translation times out, fails, or returns the input unchanged, the raw query is used as-is — the pipeline degrades gracefully.

**Sample queries for testing**

```
# Tamil
Fe 500 தர எஃகு கம்பியின் குறைந்தபட்ச விளைச்சல் அழுத்தம் என்ன?
கான்கிரீட்டின் நீடித்த தன்மைக்கான தேவைகள் என்ன?

# Telugu
Fe 415 గ్రేడ్ ఉక్కు కడ్డీకి కనీస దిగువబలం ఎంత?
లిథియం బ్యాటరీలకు థర్మల్ అబ్యూజ్ పరీక్ష అవసరాలు ఏమిటి?

# Hindi
औद्योगिक सुरक्षा हेलमेट के लिए प्रभाव अवशोषण परीक्षण क्या है?
PVC इंसुलेटेड केबल के लिए उच्च वोल्टेज परीक्षण की आवश्यकता क्या है?
```

---

## Knowledge Graph

The graph ships with a pre-seeded supply-chain demo covering three product chains.

**Node types**

| Type | Description |
|---|---|
| `License` | BIS CM/L license with status and expiry date |
| `Manufacturer` | Manufacturing entity with factory registration flag |
| `Product` | A specific manufactured product |
| `IndianStandard` | An IS codebook (e.g. IS 1786) |
| `TestLab` | Testing laboratory with accreditation status |

**Edge types**

| Type | Direction | Meaning |
|---|---|---|
| `ISSUED_TO` | License → Manufacturer | License was issued to this manufacturer |
| `COVERS` | Product → License | Product is covered under this license |
| `CONFORMS_TO` | Product → IndianStandard | Product must meet this standard |
| `TESTED_BY` | Product → TestLab | Product was tested by this lab |

**Seeded demo nodes**

| ID | Type | Notes |
|---|---|---|
| `CM/L-1234567` | License | Active, expires 2028-06-30 |
| `CM/L-9999999` | License | Expired 2024-01-15 — fails verification |
| `MFG-Apex` | Manufacturer | Apex Electronics Pvt Ltd |
| `MFG-SunPower` | Manufacturer | SunPower Manufacturing India Ltd |
| `MFG-UltraTech` | Manufacturer | UltraTech Cement Works Unit 4 |
| `PROD-LED-50W` | Product | Smart Modular LED Driver 50W |
| `PROD-SOLAR-400W` | Product | Mono PERC Solar PV Module 400W |
| `PROD-CEMENT-PPC` | Product | Portland Pozzolana Cement Grade 53 |
| `LAB-NABL-01` | TestLab | Central Electronics Testing Lab — accredited |
| `LAB-SOLAR-09` | TestLab | National Solar Testing Institute — accredited |
| `LAB-MAT-04` | TestLab | NABL Civil Materials Lab — **invalid** accreditation |

Verifying `CM/L-1234567` passes. Verifying `CM/L-9999999` fails on expiry. Verifying `PROD-CEMENT-PPC` fails because `LAB-MAT-04` has invalid accreditation.

---

## Adding Standard Documents

Place IS codebook PDFs in `data/standards/` before starting the backend:

```
data/
└── standards/
    ├── IS_456_2000.pdf
    ├── IS_1786_2008.pdf
    └── IS_14286_2010.pdf
```

On the next server start, `_ingest_standards_dir()` runs automatically:

- Extracts text from every page using PyMuPDF
- Skips table-of-contents pages (identified by dot-leader heuristic)
- Splits text at `Clause X.X`, `Table X`, `Section X`, `Annex X` boundaries
- Merges heading-only fragments (< 80 chars) into the following chunk so table headings and their data stay together
- Skips chunks shorter than 80 characters
- Stores each chunk with `is_code`, `clause_num`, `page_num`, `table_ref` metadata
- Skips any IS code already present in ChromaDB — safe to restart

The 10 seed chunks bundled in `vectorstore.py` are always available without any PDFs and cover: IS 1786, IS 13252, IS 15885, IS 14286, IS 1489, IS 694, IS 16046, IS 2925.