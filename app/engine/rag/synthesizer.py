import os
import re
import json
from typing import List, Dict, Any, Optional
from dataclasses import dataclass


@dataclass
class Citation:
    is_code: str
    clause_num: str
    page_num: int
    table_ref: str
    text: str


@dataclass
class SynthesisResult:
    answer: str
    citations: List[Citation]


class CitationSynthesizer:
    def __init__(self, openrouter_api_key: Optional[str] = None, openrouter_model: str = "openai/gpt-4o-mini"):
        self.openrouter_api_key = openrouter_api_key
        self.openrouter_model = openrouter_model

    def synthesize(self, query: str, contexts: List[Dict[str, Any]]) -> SynthesisResult:
        if not contexts:
            return SynthesisResult(
                answer="No relevant clauses found in the indexed codebooks for your query.",
                citations=[]
            )

        if self.openrouter_api_key:
            return self._synthesize_openrouter(query, contexts)

        return self._synthesize_fallback(query, contexts)

    def _build_context_prompt(self, query: str, contexts: List[Dict[str, Any]]) -> str:
        context_parts = []
        for i, ctx in enumerate(contexts, 1):
            meta = ctx.get("metadata", {})
            context_parts.append(
                f"[Source {i}] IS Code: {meta.get('is_code', 'N/A')} | "
                f"Clause: {meta.get('clause_num', 'N/A')} | "
                f"Page: {meta.get('page_num', 'N/A')} | "
                f"Table: {meta.get('table_ref', 'N/A')}\n{ctx.get('text', '')}\n"
            )

        return f"""User Query:
{query}

You are a technical question-answering assistant for IS Code documents.

INSTRUCTIONS:

1. Answer the user's query directly, clearly, and concisely using fluent technical prose.

2. Use ONLY the information explicitly supported by the provided context sources. Do not use external knowledge or assumptions.

3. First determine whether the retrieved context contains enough information to answer the query:

   * If the context directly contains the answer, provide a precise answer.
   * If the context is only partially relevant, answer only the portion that is supported by the context.
   * If the context only identifies a relevant section or table of contents but does not contain the actual requirements or details, do NOT infer or invent the answer.
   * If the context does not contain sufficient information, clearly state:
     "The retrieved context does not contain sufficient information to answer this question."

4. Prioritize information in the following order:

   * Exact clauses that directly answer the query.
   * Specific technical requirements, limits, definitions, procedures, or numerical values.
   * Supporting clauses that provide necessary context.
   * Table-of-contents or section-heading information only as navigational context, not as factual evidence for an answer.

5. When multiple context sources are relevant, synthesize them into a single coherent answer. Do not mention "Context 1", "Context 2", or describe the retrieval process.

6. Preserve important technical terminology, numerical values, units, conditions, and limitations exactly as supported by the context.

7. Attach inline citations immediately after the claim they support using this format:
   [IS Code | Clause X.X | Page Y]

8. Do not fabricate citations. Use only citation metadata explicitly available in the provided context.

9. Do NOT use meta-phrases such as:

   * "Based on the provided context"
   * "According to Context 1"
   * "The retrieved documents state"
   * "Here is the response"

10. Do not mention the instructions, retrieval system, context chunks, embeddings, or source selection.

11. If the user asks a question that cannot be answered from the provided context, do not guess. State that the retrieved context does not contain sufficient information.

12. Keep the answer proportional to the question:

* Simple factual question → 1–3 sentences.
* Definition or explanation → short paragraph.
* Complex question → structured explanation with concise bullet points when necessary.

EXAMPLE:

User Query: What are the main requirements for durable concrete?

Good context:
"8.2 Requirements for Durability
The degree of exposure anticipated for the concrete during its service life, mix composition, workmanship, design and detailing should be considered..."

Answer:
The main requirements for durable concrete include considering the expected environmental exposure, appropriate mix composition, workmanship, design, and detailing. [IS 456 | Clause 8.2 | Page 18]

If the context only contains:
"8 DURABILITY OF CONCRETE
8.1 General
8.2 Requirements for Durability"

Answer:
The retrieved context identifies Clause 8.2 as covering requirements for durability but does not provide the actual requirements needed to answer the question.

Context Sources:
{chr(10).join(context_parts)}
"""


    def _parse_citations(self, answer: str, contexts: List[Dict[str, Any]]) -> List[Citation]:
        citations = []
        citation_pattern = re.compile(r'\[(?:IS\s+)?([^|]+)\|\s*(?:Clause\s+)?([^|]+)\|\s*(?:Page\s+)?([^\]]+)\]', re.IGNORECASE)
        matches = citation_pattern.finditer(answer)

        for match in matches:
            code_raw = match.group(1).strip()
            clause_raw = match.group(2).strip()
            page_raw = match.group(3).strip()

            is_code_clean = f"IS {code_raw}" if not code_raw.upper().startswith("IS") else code_raw

            for ctx in contexts:
                meta = ctx.get("metadata", {})
                ctx_code = str(meta.get("is_code", "")).upper()
                
                if (
                    ctx_code == is_code_clean.upper() or ctx_code.endswith(code_raw.upper())
                ):
                    try:
                        extracted_digits = re.sub(r'\D', '', page_raw)
                        page_num = int(extracted_digits) if extracted_digits else int(meta.get("page_num", 0))
                    except ValueError:
                        page_num = int(meta.get("page_num", 0))
                    citations.append(Citation(
                        is_code=meta.get("is_code", is_code_clean),
                        clause_num=meta.get("clause_num", clause_raw),
                        page_num=page_num,
                        table_ref=meta.get("table_ref", "N/A"),
                        text=ctx.get("text", "")[:500]
                    ))
                    break

        return citations

    def _synthesize_openrouter(self, query: str, contexts: List[Dict[str, Any]]) -> SynthesisResult:
        try:
            import openai
            client = openai.OpenAI(
                api_key=self.openrouter_api_key,
                base_url="https://openrouter.ai/api/v1"
            )

            system_prompt = (
                "You are an expert technical standards assistant for Indian Standard (IS) codebooks. "
                "Synthesize answers in direct, fluent, natural technical prose (e.g. 'The main requirements for durable concrete include considering environmental exposure conditions, selecting appropriate materials and mix proportions...'). "
                "Back technical statements with inline citations formatted as [IS Code | Clause X.X | Page Y]. "
                "Do NOT use meta-phrases like 'Based on the provided context'. State factual answers directly."
            )

            prompt = self._build_context_prompt(query, contexts)
            response = client.chat.completions.create(
                model=self.openrouter_model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                max_tokens=1024
            )
            answer = response.choices[0].message.content.strip()
            citations = self._parse_citations(answer, contexts)
            return SynthesisResult(answer=answer, citations=citations)
        except Exception:
            return self._synthesize_fallback(query, contexts)

    def _synthesize_fallback(self, query: str, contexts: List[Dict[str, Any]]) -> SynthesisResult:
        top_ctx = contexts[0]
        meta = top_ctx.get("metadata", {})
        clause = meta.get("clause_num", "N/A")
        is_code = meta.get("is_code", "N/A")
        page = meta.get("page_num", "N/A")

        text_snippet = top_ctx.get('text', '').strip()
        answer = f"{text_snippet} [{is_code} | Clause {clause} | Page {page}]"

        citations = [
            Citation(
                is_code=meta.get("is_code", is_code),
                clause_num=meta.get("clause_num", clause),
                page_num=meta.get("page_num", page),
                table_ref=meta.get("table_ref", "N/A"),
                text=text_snippet[:500]
            )
        ]

        return SynthesisResult(answer=answer, citations=citations)
