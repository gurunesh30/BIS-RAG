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
                f"[Context {i}] IS Code: {meta.get('is_code', 'N/A')} | "
                f"Clause: {meta.get('clause_num', 'N/A')} | "
                f"Page: {meta.get('page_num', 'N/A')} | "
                f"Table: {meta.get('table_ref', 'N/A')}\n{ctx.get('text', '')}\n"
            )

        return (
            f"You are an expert assistant for Indian Standard (IS) codebooks. "
            f"Answer the user's query using ONLY the provided context. "
            f"Format citations strictly as [IS Code | Clause X.X | Page Y]. "
            f"If the answer is not in the context, say so explicitly.\n\n"
            f"User Query: {query}\n\n"
            f"Context:\n{chr(10).join(context_parts)}"
        )

    def _parse_citations(self, answer: str, contexts: List[Dict[str, Any]]) -> List[Citation]:
        citations = []
        citation_pattern = re.compile(r'\[IS\s+([^|]+)\|\s*([^|]+)\|\s*([^\]]+)\]')
        matches = citation_pattern.finditer(answer)

        for match in matches:
            is_code = match.group(1).strip()
            clause_num = match.group(2).strip()
            page_str = match.group(3).strip().replace("Page", "").strip()

            for ctx in contexts:
                meta = ctx.get("metadata", {})
                if (
                    meta.get("is_code", "").upper() == is_code.upper()
                    and meta.get("clause_num", "") == clause_num
                ):
                    try:
                        page_num = int(page_str)
                    except ValueError:
                        page_num = meta.get("page_num", 0)
                    citations.append(Citation(
                        is_code=meta.get("is_code", is_code),
                        clause_num=meta.get("clause_num", clause_num),
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

            prompt = self._build_context_prompt(query, contexts)
            response = client.chat.completions.create(
                model=self.openrouter_model,
                messages=[
                    {"role": "system", "content": "You are a citation-based assistant for IS codebooks."},
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

        answer = (
            f"Based on the retrieved context from {is_code}, here is the relevant information:\n\n"
            f"> {top_ctx.get('text', '')[:800]}\n\n"
            f"Source: [{is_code} | {clause} | Page {page}]"
        )

        citations = [
            Citation(
                is_code=meta.get("is_code", is_code),
                clause_num=meta.get("clause_num", clause),
                page_num=meta.get("page_num", page),
                table_ref=meta.get("table_ref", "N/A"),
                text=top_ctx.get("text", "")[:500]
            )
        ]

        return SynthesisResult(answer=answer, citations=citations)
