"""
generator.py — query rewriting & citation-enforcing generation module.

Implements the final two stages of the RAG pipeline:

1. Query Rewriting Agent — turns a natural / vague user query into precise
   formal regulatory language aligned with BIS terminology.
2. LLM Generation with strict source attribution — the model is forced to
   answer exclusively from the provided context and to back every claim with
   a ``[IS Code | Clause X.X | Page Y]`` citation.

If no OpenRouter key is configured (or the API call fails) a keyword-grounding
fallback synthesizer emits the best matching chunk verbatim with its citation.
"""

import os
import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

DEFAULT_MODEL = "qwen/qwen3-8b"

_CITATION_PATTERN = re.compile(
    r'\[(?:IS\s+)?([^|]+)\|\s*(?:Clause\s+)?([^|]+)\|\s*(?:Page\s+)?([^\]]+)\]',
    re.IGNORECASE,
)


@dataclass
class Citation:
    is_code: str
    clause_num: str
    page_num: int
    table_ref: str
    text: str


@dataclass
class GenerationResult:
    answer: str
    citations: List[Citation] = field(default_factory=list)
    rewritten_query: Optional[str] = None


class CitationGenerator:
    def __init__(
        self,
        api_key: Optional[str] = None,
        model: str = DEFAULT_MODEL,
        temperature: float = 0.3,
        max_tokens: int = 1024,
    ) -> None:
        self.api_key = api_key
        self.model = model
        self.temperature = temperature
        self.max_tokens = max_tokens

    # ── Query Rewriting Agent ───────────────────────────────────────────────

    def _rewrite_prompt(self, query: str) -> str:
        return f"""You are a query-rewriting agent for a Bureau of Indian Standards (BIS) regulatory RAG system.

Rewrite the user's query below into precise, formal regulatory language that RAG retrieval will understand.
Keep it faithful to the original intent — do not invent new requirements, standards, or numbers.

Guidelines:
- Use BIS terminology (e.g. "clause", "IS number", "scheme", "certification", "marking").
- Preserve any IS code, clause number, product name, and numeric value verbatim.
- Expand abbreviations only when unambiguous.
- Output ONLY the rewritten query, with no preamble, quotes, or explanation.

User query: {query}
Rewritten query:"""

    def rewrite_query(self, query: str) -> str:
        """Rewrite via LLM; degrade gracefully to a local normaliser."""
        if not self.api_key:
            return self._local_normalise(query)

        try:
            client = self._client()
            response = client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You rewrite user queries into precise regulatory questions."},
                    {"role": "user", "content": self._rewrite_prompt(query)},
                ],
                temperature=0.0,
                max_tokens=160,
                extra_body={"thinking": {"type": "disabled"}} if "qwen3" in self.model.lower() else {},
            )
            rewritten = response.choices[0].message.content.strip()
            if rewritten:
                return rewritten
        except Exception:  # noqa: BLE001
            pass
        return self._local_normalise(query)

    @staticmethod
    def _local_normalise(query: str) -> str:
        """
        Zero-cost fallback rewrite: strip excess whitespace and standardise
        casual question openers into regulatory phrasing.
        """
        text = " ".join(query.split())
        replacements = [
            (r'^\s*can you tell me(?: about)?\s+', 'What are the '),
            (r'^\s*can you\s+', 'What are the requirements for '),
            (r'^\s*tell me(?: about)?\s+', 'What is '),
            (r'^\s*whats\s+', 'What is '),
        ]
        for pattern, replacement in replacements:
            text = re.sub(pattern, replacement, text, flags=re.IGNORECASE)
        return text.strip()

    # ── LLM generation ──────────────────────────────────────────────────────

    def _client(self):
        import openai

        return openai.OpenAI(
            api_key=self.api_key,
            base_url="https://openrouter.ai/api/v1",
        )

    def _build_prompt(self, query: str, contexts: List[Dict[str, Any]]) -> str:
        context_parts = []
        for index, ctx in enumerate(contexts, start=1):
            meta = ctx.get("metadata", {})
            context_parts.append(
                f"[Source {index}] IS Code: {meta.get('is_code', 'N/A')} | "
                f"Clause: {meta.get('clause_num', 'N/A')} | "
                f"Page: {meta.get('page_num', 'N/A')} | "
                f"Table: {meta.get('table_ref', 'N/A')}"
                f"\n{ctx.get('text', '')}\n"
            )

        return f"""You are a technical question-answering assistant for Indian Standard (IS) codebooks.

INSTRUCTIONS:

1. Answer the user's query directly, clearly, and in fluent technical prose, giving step-by-step procedural guidance when the question is procedural.

2. Use ONLY the information explicitly supported by the provided context sources. Do not use external knowledge or assumptions.

3. If the context directly contains the answer, provide a precise answer. If it covers only part of the question, answer only that part. If the context identifies a section but does not contain the actual requirement, do NOT infer or invent the answer — say so clearly.

4. Preserve important technical terminology, numerical values, units, conditions, scheme codes (e.g. Scheme-I), and IS Code identifiers exactly as they appear.

5. Attach an inline citation immediately after every claim using exactly this format:
   [IS Code | Clause X.X | Page Y]

6. Cite only the metadata explicitly available in the provided context. Never fabricate a citation.

7. Do NOT use meta-phrases such as "Based on the provided context" or "According to Source 1".

8. If the question cannot be confidently answered from the context, state that clearly and suggest rephrasing.

User Query: {query}

Context Sources:
{chr(10).join(context_parts)}
"""

    def _parse_citations(self, answer: str, contexts: List[Dict[str, Any]]) -> List[Citation]:
        citations: List[Citation] = []
        for match in _CITATION_PATTERN.finditer(answer):
            code_raw = match.group(1).strip()
            clause_raw = match.group(2).strip()
            page_raw = match.group(3).strip()

            is_code_clean = f"IS {code_raw}" if not code_raw.upper().startswith("IS") else code_raw

            for ctx in contexts:
                meta = ctx.get("metadata", {})
                ctx_code = str(meta.get("is_code", "")).upper()
                if ctx_code == is_code_clean.upper() or ctx_code.endswith(code_raw.upper()):
                    try:
                        digits = re.sub(r'\D', '', page_raw)
                        page_num = int(digits) if digits else int(meta.get("page_num", 0))
                    except (ValueError, TypeError):
                        page_num = int(meta.get("page_num", 0))
                    citations.append(
                        Citation(
                            is_code=meta.get("is_code", is_code_clean),
                            clause_num=meta.get("clause_num", clause_raw),
                            page_num=page_num,
                            table_ref=meta.get("table_ref", "N/A"),
                            text=ctx.get("text", "")[:500],
                        )
                    )
                    break
        return citations

    def generate(
        self,
        query: str,
        contexts: List[Dict[str, Any]],
        rewritten_query: Optional[str] = None,
    ) -> GenerationResult:
        if not contexts:
            return GenerationResult(
                answer="No relevant clauses found in the indexed codebooks for your query.",
                citations=[],
                rewritten_query=rewritten_query,
            )

        if self.api_key:
            try:
                return self._generate_llm(query, contexts, rewritten_query)
            except Exception:  # noqa: BLE001
                pass  # fall through to the grounded fallback

        return self._generate_fallback(query, contexts, rewritten_query)

    def _generate_llm(
        self,
        query: str,
        contexts: List[Dict[str, Any]],
        rewritten_query: Optional[str] = None,
    ) -> GenerationResult:
        client = self._client()
        retrieval_query = rewritten_query or query

        response = client.chat.completions.create(
            model=self.model,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are an expert technical standards assistant for Indian Standard (IS) codebooks. "
                        "Synthesize direct, fluent, natural technical prose backed by inline citations "
                        "formatted as [IS Code | Clause X.X | Page Y]. Never invent citations or external knowledge."
                    ),
                },
                {"role": "user", "content": self._build_prompt(retrieval_query, contexts)},
            ],
            temperature=self.temperature,
            max_tokens=self.max_tokens,
            extra_body={"thinking": {"type": "disabled"}} if "qwen3" in self.model.lower() else {},
        )
        raw_answer = response.choices[0].message.content.strip()
        # Strip any leaked Qwen3 thinking block
        answer = re.sub(r" thinking.*?response", "", raw_answer, flags=re.DOTALL).strip()
        return GenerationResult(
            answer=answer,
            citations=self._parse_citations(answer, contexts),
            rewritten_query=rewritten_query,
        )

    def _generate_fallback(
        self,
        query: str,
        contexts: List[Dict[str, Any]],
        rewritten_query: Optional[str] = None,
    ) -> GenerationResult:
        """Keyword-overlap grounded response — used without an API key or after an API failure."""
        stop_words = {
            "what", "is", "the", "are", "for", "in", "of", "and", "to", "a", "an",
            "under", "specified", "requirements", "mandatory", "code", "standard",
        }
        query_words = set(re.findall(r'\w+', query.lower())) - stop_words

        scored = []
        for ctx in contexts:
            meta = ctx.get("metadata", {})
            chunk_words = set(re.findall(r'\w+', str(meta.get("is_code", "")).lower()))
            overlap = len(query_words & (set(re.findall(r'\w+', ctx.get("text", "").lower())) | chunk_words))
            scored.append((overlap, float(ctx.get("score", 0.0)), ctx))

        scored.sort(key=lambda entry: (entry[0], entry[1]), reverse=True)
        _, _, best = scored[0]
        meta = best.get("metadata", {})
        text = best.get("text", "").strip()

        is_code = meta.get("is_code", "N/A")
        clause = meta.get("clause_num", "N/A")
        page = meta.get("page_num", "N/A")
        table_ref = meta.get("table_ref", "N/A")

        if scored[0][0] == 0 and scored[0][1] < 0.35:
            answer = (
                f"No relevant clauses found in {is_code} matching '{query}'. "
                "Please verify the question or check the indexed IS codebook."
            )
            return GenerationResult(
                answer=answer,
                citations=[],
                rewritten_query=rewritten_query,
            )

        answer = f"{text}\n\n[{is_code} | Clause {clause} | Page {page}]"
        citations = [
            Citation(
                is_code=is_code,
                clause_num=clause,
                page_num=int(page) if str(page).isdigit() else 0,
                table_ref=table_ref,
                text=text[:500],
            )
        ]
        return GenerationResult(
            answer=answer,
            citations=citations,
            rewritten_query=rewritten_query,
        )