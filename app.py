"""app.py — BIS Conformity Assessment RAG Assistant (Streamlit).

Entrypoint that wires the production orchestration pipeline together:

    Query Rewriting → Hybrid Retrieval (dense + BM25)
                  → Cross-Encoder Reranking → Threshold Filter
                  → LLM generation with citations

Run with:  streamlit run app.py
"""

import os

import streamlit as st
from dotenv import load_dotenv

from retriever import HybridRetriever
from reranker import Reranker
from generator import CitationGenerator

load_dotenv()

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY") or os.getenv("OPENROUTER_API")
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "qwen/qwen3-8b")
RERANK_MODEL = os.getenv("RERANK_MODEL", "cross-encoder/ms-marco-MiniLM-L-6-v2")
RERANK_THRESHOLD = float(os.getenv("RERANK_THRESHOLD", "0.15"))

st.set_page_config(
    page_title="BIS Conformity Assessment RAG Assistant",
    page_icon="🏛️",
    layout="centered",
    initial_sidebar_state="expanded",
)

st.markdown(
    """
    <style>
    .block-container { padding-top: 2rem; }
    div[data-testid="stSidebar"] h1 { font-size: 1rem; }
    .stApp { background: #fbfaf7; }
    </style>
    """,
    unsafe_allow_html=True,
)

SAMPLE_PROMPTS = [
    "What is the minimum yield strength for Fe 500 steel bars?",
    "What are the electrical safety requirements for IT equipment?",
    "How must a lithium battery behave during thermal abuse testing?",
    "What is the impact absorption test requirement for safety helmets?",
]


@st.cache_resource(show_spinner=False)
def build_pipeline():
    """Construct the shared retrieval + generation stack once per session."""
    from app.engine.rag.pipeline import create_vector_store, create_neo4j_graph_store

    store = create_vector_store()
    graph_store = create_neo4j_graph_store()
    retriever = HybridRetriever(dense_store=store, graph_store=graph_store)
    reranker = Reranker(model_name=RERANK_MODEL, threshold=RERANK_THRESHOLD)
    generator = CitationGenerator(
        api_key=OPENROUTER_API_KEY,
        model=OPENROUTER_MODEL,
        temperature=0.3,
        max_tokens=1024,
    )
    return retriever, reranker, generator


def render_citation(citation) -> None:
    label = f"[{citation.is_code} | Clause {citation.clause_num} | Page {citation.page_num}]"
    with st.popover(label, use_container_width=True):
        st.markdown(
            f"**Source excerpt** — {citation.is_code}"
            f"{f' — {citation.table_ref}' if citation.table_ref != 'N/A' else ''}"
        )
        st.write(citation.text)


def run_pipeline(query: str, is_code: str, n_results: int, enable_rerank: bool) -> dict:
    retriever, reranker, generator = build_pipeline()

    # Stage 1 — query rewriting
    rewritten = generator.rewrite_query(query)
    retrieval_query = rewritten or query

    # Stage 2 — hybrid retrieval (dense + BM25, RRF fusion); over-fetch to
    # give the reranker headroom.
    fetched = retriever.query(
        query_text=retrieval_query,
        n_results=min(n_results * 3, 24),
        is_code=None if is_code == "All standards" else is_code,
    )
    contexts = fetched.get("results", [])

    # Stage 3 — cross-encoder reranking + strict threshold filter
    if enable_rerank and contexts:
        contexts = reranker.rerank(query=retrieval_query, candidates=contexts)
        contexts = reranker.filter_by_threshold(contexts)

        # Never let the filter starve the prompt entirely.
        if not contexts:
            contexts = reranker.rerank(query=retrieval_query, candidates=list(fetched.get("results", [])))

    contexts = contexts[:n_results]

    # Stage 4 — citation-enforcing generation
    result = generator.generate(query, contexts, rewritten_query=rewritten)
    return {
        "answer": result.answer,
        "citations": result.citations,
        "contexts": contexts,
        "rewritten": rewritten,
        "copies": rewritten != query,
    }


def main() -> None:
    st.title("🏛️ BIS Conformity Assessment RAG Assistant")
    st.caption(
        "Citation-backed answers for Indian Standard (IS) codebooks — "
        "query rewriting, hybrid retrieval, cross-encoder reranking, "
        "and LLM generation with source attribution."
    )

    with st.sidebar:
        st.header("Pipeline Controls")
        retriever, _, _ = build_pipeline()
        codes = retriever.get_all_codes()

        is_code = st.selectbox(
            "Standard filter",
            options=["All standards"] + codes,
            index=0,
            help="Restrict retrieval to a single IS codebook.",
        )
        n_results = st.slider("Top-k contexts", min_value=3, max_value=12, value=6, step=1)
        enable_rerank = st.toggle("Cross-encoder reranking", value=True)
        st.divider()
        st.caption(
            f"Rerank model: `{RERANK_MODEL}`\n\n"
            f"Threshold: `{RERANK_THRESHOLD}`\n\n"
            f"LLM: `{OPENROUTER_MODEL}`"
        )
        if not OPENROUTER_API_KEY:
            st.warning("No OPENROUTER_API_KEY set — answers fall back to grounded excerpts.")

    query = st.chat_input("Ask about any IS codebook…")
    if query:
        st.chat_message("user").write(query)
    else:
        st.markdown("**Try one of these:**")
        for prompt in SAMPLE_PROMPTS:
            if st.button(prompt, use_container_width=True):
                query = prompt
                st.chat_message("user").write(prompt)
                break

    if not query:
        return

    with st.spinner("Running Query Rewriting → Hybrid Retrieval → Reranking → Generation…"):
        try:
            payload = run_pipeline(query, is_code, n_results, enable_rerank)
        except Exception as exc:  # noqa: BLE001
            st.error(f"Pipeline failed: {exc}")
            return

    if payload["copies"]:
        with st.expander("✍️ Rewritten query (retrieval)"):
            st.code(payload["rewritten"])

    with st.chat_message("assistant"):
        st.markdown(payload["answer"])

        if payload["citations"]:
            st.markdown("**Citations**")
            cols = st.columns(min(len(payload["citations"]), 3))
            for index, citation in enumerate(payload["citations"]):
                with cols[index % 3]:
                    render_citation(citation)

    with st.expander(f"🔍 Retrieved context ({len(payload['contexts'])}) — hybrid retrieval + rerank scores"):
        for context in payload["contexts"]:
            meta = context.get("metadata", {})
            st.markdown(
                f"**{meta.get('is_code', 'N/A')}** · Clause {meta.get('clause_num', 'N/A')} "
                f"· Page {meta.get('page_num', 'N/A')} · Table {meta.get('table_ref', 'N/A')}"
            )
            st.code(context.get("text", ""))
            st.caption(
                f"fused `{context.get('score')}` · dense `{context.get('dense_score')}` · "
                f"sparse `{context.get('sparse_score')}` · rerank `{context.get('rerank_score')}`"
            )


if __name__ == "__main__":
    main()