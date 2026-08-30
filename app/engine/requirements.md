# BIS RAG Backend Requirements

## Python Version
- Python >= 3.10

## Core Dependencies

- fastapi>=0.111.0
- uvicorn[standard]>=0.30.0
- pydantic>=2.7.0

## RAG Engine

- chromadb>=0.5.0
- sentence-transformers>=3.0.0
- PyMuPDF>=1.24.0
- openai>=1.35.0
- google-generativeai>=0.7.0

## Graph Engine

- networkx>=3.3

## Utilities

- python-multipart>=0.0.9

## Installation

```bash
pip install -r requirements.txt
```

## Environment Variables

Create a `.env` file (optional, for LLM features):

```
OPENAI_API_KEY=your_openai_key
GEMINI_API_KEY=your_gemini_key
```

Without these keys, the RAG engine falls back to context-only retrieval without LLM synthesis.

## Running the Backend

```bash
cd app/engine
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```
