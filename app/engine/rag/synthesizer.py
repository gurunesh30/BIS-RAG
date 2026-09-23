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
    def __init__(self, openrouter_api_key: Optional[str] = None, openrouter_model: str = "qwen/qwen3-8b"):
        self.openrouter_api_key = openrouter_api_key
        self.openrouter_model = openrouter_model

    def synthesize(self, query: str, contexts: List[Dict[str, Any]], english_query: Optional[str] = None) -> SynthesisResult:
        if not contexts:
            return SynthesisResult(
                answer="No relevant clauses found in the indexed codebooks for your query.",
                citations=[]
            )

        if self.openrouter_api_key:
            return self._synthesize_openrouter(query, contexts, english_query)

        # Fallback uses the English query for keyword matching when available
        return self._synthesize_fallback(english_query or query, contexts)

    def _build_context_prompt(self, query: str, contexts: List[Dict[str, Any]], english_query: Optional[str] = None) -> str:
        context_parts = []
        for i, ctx in enumerate(contexts, 1):
            meta = ctx.get("metadata", {})
            context_parts.append(
                f"[Source {i}] IS Code: {meta.get('is_code', 'N/A')} | "
                f"Clause: {meta.get('clause_num', 'N/A')} | "
                f"Page: {meta.get('page_num', 'N/A')} | "
                f"Table: {meta.get('table_ref', 'N/A')}\n{ctx.get('text', '')}\n"
            )

        # When a translation was used, show the English equivalent so the
        # model understands what was searched, but make the language
        # requirement unmissable right above the context block.
        if english_query:
            query_block = (
                f"User Query (original language — YOU MUST RESPOND IN THIS LANGUAGE): {query}\n"
                f"English translation used for retrieval: {english_query}\n"
                f"\n⚠ RESPOND ENTIRELY IN THE SAME LANGUAGE AS THE USER'S ORIGINAL QUERY ABOVE. DO NOT USE ENGLISH.\n"
            )
        else:
            query_block = f"User Query: {query}\n"

        return f"""{query_block}
You are a technical question-answering assistant for IS Code documents.

INSTRUCTIONS:

1. Answer the user's query directly, clearly, and concisely using fluent technical prose.

2. Use ONLY the information explicitly supported by the provided context sources. Do not use external knowledge or assumptions.

3. First determine whether the retrieved context contains enough information to answer the query:

   * If the context directly contains the answer, provide a precise answer.
   * If the context is only partially relevant, answer only the portion that is supported by the context.
   * If the context only identifies a relevant section or table of contents but does not contain the actual requirements or details, do NOT infer or invent the answer.
   * If the context does not contain sufficient information, clearly state it in the user's original language.

4. Prioritize information in the following order:

   * Exact clauses that directly answer the query.
   * Specific technical requirements, limits, definitions, procedures, or numerical values.
   * Supporting clauses that provide necessary context.
   * Table-of-contents or section-heading information only as navigational context, not as factual evidence.

5. When multiple context sources are relevant, synthesize them into a single coherent answer.

6. Preserve important technical terminology, numerical values, units, conditions, and IS Code identifiers exactly as they appear.

7. Attach inline citations immediately after the claim they support using this format:
   [IS Code | Clause X.X | Page Y]

8. Do not fabricate citations. Use only citation metadata explicitly available in the provided context.

9. Do NOT use meta-phrases such as "Based on the provided context" or "According to Context 1".

10. Keep the answer proportional to the question.

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

    def _synthesize_openrouter(self, query: str, contexts: List[Dict[str, Any]], english_query: Optional[str] = None) -> SynthesisResult:
        try:
            import openai
            client = openai.OpenAI(
                api_key=self.openrouter_api_key,
                base_url="https://openrouter.ai/api/v1"
            )

            is_multilingual = english_query is not None

            if is_multilingual:
                system_prompt = (
                    "You are an expert technical standards assistant for Indian Standard (IS) codebooks. "
                    "The user has submitted a query in a non-English language. "
                    "The context below was retrieved using an English translation of their query. "
                    "You MUST respond entirely in the same language as the user's original query — "
                    "do NOT write any part of your answer in English. "
                    "Preserve IS Code numbers, clause numbers, page numbers, and numerical values exactly as-is. "
                    "Back technical statements with inline citations formatted as [IS Code | Clause X.X | Page Y]. "
                    "Do NOT use meta-phrases like 'Based on the provided context'. State factual answers directly."
                )
            else:
                system_prompt = (
                    "You are an expert technical standards assistant for Indian Standard (IS) codebooks. "
                    "Synthesize answers in direct, fluent, natural technical prose. "
                    "Back technical statements with inline citations formatted as [IS Code | Clause X.X | Page Y]. "
                    "Do NOT use meta-phrases like 'Based on the provided context'. State factual answers directly."
                )

            # Build the user message. For multilingual queries, prepend a
            # language reminder right next to the query so it is not buried.
            prompt = self._build_context_prompt(query, contexts, english_query)

            response = client.chat.completions.create(
                model=self.openrouter_model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                max_tokens=1024,
                extra_body={"thinking": {"type": "disabled"}} if "qwen3" in self.openrouter_model.lower() else {}
            )
            raw_answer = response.choices[0].message.content.strip()

            # Strip any leaked <think>…</think> blocks from Qwen3
            answer = re.sub(r"<think>.*?</think>", "", raw_answer, flags=re.DOTALL).strip()

            citations = self._parse_citations(answer, contexts)
            return SynthesisResult(answer=answer, citations=citations)
        except Exception:
            return self._synthesize_fallback(english_query or query, contexts)

    def _synthesize_fallback(self, query: str, contexts: List[Dict[str, Any]]) -> SynthesisResult:
        # 1. Extract explicit IS code mentioned in query (e.g. IS 1786, IS 13252)
        match_is = re.search(r'\bIS\s*(\d+)\b', query, re.IGNORECASE)
        requested_code_num = match_is.group(1) if match_is else None

        # 2. Check if retrieved chunks match the requested IS code or have high similarity
        valid_chunks = []
        stop_words = {'what', 'is', 'the', 'are', 'for', 'in', 'of', 'and', 'to', 'a', 'an', 'under', 'specified', 'requirements', 'mandatory', 'code', 'standard'}
        query_words = set(re.findall(r'\w+', query.lower())) - stop_words

        for ctx in contexts:
            meta = ctx.get('metadata', {})
            chunk_code = str(meta.get('is_code', '')).upper()
            chunk_text = ctx.get('text', '')
            score = float(ctx.get('score', 0.5))

            # Count keyword overlap
            chunk_words = set(re.findall(r'\w+', chunk_text.lower()))
            overlap = len(query_words & chunk_words)

            # Boost score if keywords overlap or code matches
            if requested_code_num and requested_code_num in chunk_code:
                overlap += 3

            valid_chunks.append((overlap, score, ctx))

        # Sort by overlap descending, then score descending
        valid_chunks.sort(key=lambda x: (x[0], x[1]), reverse=True)

        # Check if any chunk matches the requested code number or text
        matching_code_chunk = None
        if requested_code_num:
            for overlap, score, ctx in valid_chunks:
                meta = ctx.get('metadata', {})
                code = str(meta.get('is_code', '')).upper()
                text = ctx.get('text', '')
                if requested_code_num in code or requested_code_num in text:
                    matching_code_chunk = (overlap, score, ctx)
                    break

        best_tuple = matching_code_chunk or valid_chunks[0]
        best_overlap, best_score, best_ctx = best_tuple
        best_meta = best_ctx.get('metadata', {})
        best_is_code = best_meta.get('is_code', '') or (f"IS {requested_code_num}" if requested_code_num else "Indexed Standard")

        # If requested code is explicitly absent from all retrieved chunks and text
        if requested_code_num and (matching_code_chunk is None) and best_overlap == 0 and best_score < 0.3:
            answer = (
                f"The requested standard (IS {requested_code_num}) was not found in the retrieved chunks. "
                f"Retrieved clauses from database: {best_is_code}. "
                f"Please verify the question or upload the specific IS Codebook PDF."
            )
            return SynthesisResult(answer=answer, citations=[])

        # Format clean response from best matching chunk
        clause = best_meta.get('clause_num', 'N/A')
        page = best_meta.get('page_num', 'N/A')
        table_ref = best_meta.get('table_ref', 'N/A')
        text_snippet = best_ctx.get('text', '').strip()

        # Clean snippet text for presentation
        answer = f"{text_snippet}\n\n[{best_is_code} | Clause {clause} | Page {page}]"

        citations = [
            Citation(
                is_code=best_is_code,
                clause_num=clause,
                page_num=int(page) if str(page).isdigit() else 0,
                table_ref=table_ref,
                text=text_snippet[:500]
            )
        ]

        return SynthesisResult(answer=answer, citations=citations)

