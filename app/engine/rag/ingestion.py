import re
try:
    import pymupdf as fitz
except ImportError:
    import fitz
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field


@dataclass
class Chunk:
    text: str
    metadata: Dict[str, Any] = field(default_factory=dict)


# Minimum number of characters a chunk must contain to be indexed.
# Chunks shorter than this are almost always TOC entries, running
# headers/footers, or empty section titles with no real content.
_MIN_CHUNK_CHARS = 80


class PDFIngestionEngine:
    def __init__(self):
        self.clause_pattern = re.compile(
            r'(\b(?:Clause|Section|Table|Annex)\s+[\d\.]+(?:\s*[\-\.]\s*[\d\.]*)?(?:\s*\([^)]*\))?)',
            re.IGNORECASE
        )
        self.is_code_pattern = re.compile(r'IS\s+\d+(?::\d+)?', re.IGNORECASE)

    def extract_text_from_pdf(self, file_path: str) -> List[Dict[str, Any]]:
        doc = fitz.open(file_path)
        pages = []
        for page_num in range(len(doc)):
            page = doc.load_page(page_num)
            text = page.get_text()
            pages.append({
                "page_num": page_num + 1,
                "text": text
            })
        doc.close()
        return pages

    def extract_is_code(self, text: str, filename: str) -> str:
        match = self.is_code_pattern.search(text)
        if match:
            return match.group(0).upper()
        clean_name = re.sub(r'\.pdf$', '', filename, flags=re.IGNORECASE)
        return clean_name.strip()

    def _is_toc_page(self, text: str) -> bool:
        """
        Returns True when the page looks like a table-of-contents page.
        Heuristic: more than 40% of non-empty lines end with a page number
        (dots/spaces followed by digits), which is the classic TOC pattern.
        """
        lines = [l.strip() for l in text.splitlines() if l.strip()]
        if not lines:
            return False
        toc_line_pattern = re.compile(r'[\.\s]{3,}\d+\s*$')
        toc_hits = sum(1 for l in lines if toc_line_pattern.search(l))
        return (toc_hits / len(lines)) > 0.4

    def chunk_pages(self, pages: List[Dict[str, Any]], is_code: str) -> List[Chunk]:
        chunks = []
        for page in pages:
            text = page["text"]
            page_num = page["page_num"]

            # Skip TOC pages entirely — they produce heading-only chunks
            # that match queries but contain no actual technical content.
            if self._is_toc_page(text):
                continue

            clause_matches = list(self.clause_pattern.finditer(text))

            if not clause_matches:
                if len(text.strip()) >= _MIN_CHUNK_CHARS:
                    chunks.append(Chunk(
                        text=text.strip(),
                        metadata={
                            "is_code": is_code,
                            "clause_num": "N/A",
                            "page_num": page_num,
                            "table_ref": "N/A"
                        }
                    ))
                continue

            # Build raw slices between clause/table headings
            raw_slices: List[Dict] = []
            for i, match in enumerate(clause_matches):
                clause_num = match.group(1)
                start = match.start()
                end = clause_matches[i + 1].start() if i + 1 < len(clause_matches) else len(text)
                chunk_text = text[start:end].strip()

                table_ref = "N/A"
                table_match = re.search(r'Table\s+[\d\.]+', chunk_text, re.IGNORECASE)
                if table_match:
                    table_ref = table_match.group(0)

                raw_slices.append({
                    "text": chunk_text,
                    "clause_num": clause_num,
                    "table_ref": table_ref,
                })

            # Merge short slices into the next sibling so that heading-only
            # fragments (e.g. "Table 13\nNominal Mix Proportions") absorb
            # the actual table body that follows them.
            merged: List[Dict] = []
            buffer: Dict | None = None

            for sl in raw_slices:
                if buffer is None:
                    buffer = sl.copy()
                    continue

                if len(buffer["text"]) < _MIN_CHUNK_CHARS:
                    # Absorb next slice into buffer
                    buffer["text"] = buffer["text"] + "\n" + sl["text"]
                    # Keep the more specific clause/table reference
                    if sl["table_ref"] != "N/A":
                        buffer["table_ref"] = sl["table_ref"]
                else:
                    merged.append(buffer)
                    buffer = sl.copy()

            if buffer is not None:
                # Last buffer: if still too short, merge into previous
                if merged and len(buffer["text"]) < _MIN_CHUNK_CHARS:
                    merged[-1]["text"] = merged[-1]["text"] + "\n" + buffer["text"]
                else:
                    merged.append(buffer)

            # Index only chunks that meet the minimum length
            for sl in merged:
                if len(sl["text"]) >= _MIN_CHUNK_CHARS:
                    chunks.append(Chunk(
                        text=sl["text"],
                        metadata={
                            "is_code": is_code,
                            "clause_num": sl["clause_num"],
                            "page_num": page_num,
                            "table_ref": sl["table_ref"],
                        }
                    ))

        return chunks

    def ingest_pdf(self, file_path: str, filename: str) -> List[Chunk]:
        pages = self.extract_text_from_pdf(file_path)
        is_code = self.extract_is_code(" ".join(p["text"] for p in pages), filename)
        return self.chunk_pages(pages, is_code)
