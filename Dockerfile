# BIS Conformity Assessment RAG Assistant — optimized lightweight image
# Per spec/reconstruct_docker_image.md: CPU-only PyTorch, no CUDA toolchain,
# no local storage bloat (cloud-native Pinecone + Neo4j only).

FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    STREAMLIT_SERVER_PORT=8501 \
    STREAMLIT_SERVER_ADDRESS=0.0.0.0

WORKDIR /app

# Install basic OS utilities (excluding heavy build tools)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy dependency specifications first to leverage Docker layer caching
COPY requirements.txt .

# Install CPU-only PyTorch first (avoids the 2-3GB CUDA wheel bundle), then the
# streamlined production requirements.
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu \
 && pip install --no-cache-dir -r requirements.txt

# Copy application source code into the container workdir
COPY . .

# Expose FastAPI backend port (Render sets $PORT automatically)
EXPOSE 8001

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD python -c "import http.client; c=http.client.HTTPConnection('localhost', 8001); c.request('GET', '/health'); raise SystemExit(0 if c.getresponse().status < 500 else 1)"

# Run the FastAPI backend via uvicorn.
# Render injects $PORT; default to 8001 for local Docker runs.
CMD ["sh", "-c", "uvicorn app.engine.main:app --host 0.0.0.0 --port ${PORT:-8001}"]