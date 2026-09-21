# BIS Conformity Assessment RAG Assistant — container blueprint
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    STREAMLIT_SERVER_PORT=8501 \
    STREAMLIT_SERVER_ADDRESS=0.0.0.0

WORKDIR /app

# Install dependencies first to leverage Docker layer caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the full project (backend engine, RAG pipeline, UI entrypoint, standards)
COPY . .

# ChromaDB persistence volume
VOLUME ["/app/chroma_db"]
ENV CHROMA_PERSIST_DIR=/app/chroma_db

EXPOSE 8501

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD python -c "import http.client; http.client.HTTPConnection('localhost', 8501).request('GET', '/_stcore/health'); ok = http.client.HTTPConnection('localhost', 8501); ok.request('HEAD', '/'); raise SystemExit(0 if ok.getresponse().status < 500 else 1)"

CMD ["streamlit", "run", "app.py", "--server.port=8501", "--server.address=0.0.0.0"]