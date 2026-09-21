"""
parser.py — production document ingestion & parsing module.

Transforms raw regulatory PDF documents (scans of gazettes, BIS codebooks)
into clean, structured, chunked text segments ready for the retrieval layer.

Responsibilities
----------------
* block-based text extraction that reconstructs multi-column reading order
* detection and removal of repeating page headers / footers
* skipping of table-of-contents pages (dot-leader heuristic)
* structural (semantic) chunking at Clause / Section / Table / Annex
  boundaries with a token overlap window so no legal context is lost
  across chunk edge cases.
"""

import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

try:
    import pymupdf as fitz
except ImportError:
    import fitz


@dataclass
class Chunk:
    """A single indexed text segment plus its provenance metadata."""
    text: str
    metadata: Dict[str, Any] = field(default_factory=dict)


# ── Tuning knobs ────────────────────────────────────────────────────────────
# Vertical margin fraction used to locate running headers/footers.
_MARGIN_FRACTION = 0.12
# Minimum characters a chunk must carry to be indexed.
_MIN_CHUNK_CHARS = 120
# Soft ceiling for a single chunk; longer segments are sub-split.
_MAX_CHUNK_CHARS = 1400
# Overlap window (characters) preserved between adjacent sub-chunks.
_OVERLAP_CHARS = 60
# Row band tolerance used when reconstructing multi-column ordering.
_COLUMN_BAND_TOLERANCE = 6.0

# Structural markers that delineate one legal fragment from the next.
_STRUCTURE_PATTERN = re.compile(
    r'\b(?:Clause|Sub-Clause|Section|Rule|Table|Annex|Schedule)\s+[\d\.]+'
    r'(?:\s*[\-\.]\s*[\d\.]*)?(?:\s*\([^)]*\))?',
    re.IGNORECASE,
)

_TOC_LINE_PATTERN = re.compile(r'[\.\s]{3,}\d+\s*$')

_IS_CODE_PATTERN = re.compile(r'IS\s+\d+(?::\d+)?', re.IGNORECASE)

_SENTENCE_SPLIT_PATTERN = re.compile(r'(?<=[.!?])\s+(?=[A-Z0-9(])')


class LayoutAwarePDFParser:
    """
    Parses a PDF into clean text pages and then into overlapping,
    structurally-aligned chunks with BIS-style metadata.
    """

    def extract_is_code(self, text: str, filename: str) -> str:
        match = _IS_CODE_PATTERN.search(text)
        if match:
            return match.group(0).upper()
        return re.sub(r'\.pdf$', '', filename, flags=re.IGNORECASE).strip()

    def _page_lines(self, page, page_height: float) -> List[dict]:
        """Extract non-empty text lines with vertical positions."""
        blocks = page.get_text("dict")["blocks"]
        lines: List[dict] = []
        for block in blocks:
            if block.get("type") != 0:
                continue  # skip image blocks
            for line in block.get("lines", []):
                spans = [s.get("text", "") for s in line.get("spans", [])]
                text = "".join(spans).strip()
                if not text:
                    continue
                x0, y0, x1, y1 = line["bbox"]
                lines.append({"text": text, "x0": float(x0), "y0": float(y0), "y1": float(y1)})
        return lines

    def _detect_running_elements(self, all_page_lines: List[List[dict]]) -> set:
        """
        Return the set of page-edge text fragments that repeat across most
        pages — classic running headers and footers (and page numbers).
        """
        from collections import Counter

        top_counts: Counter = Counter()
        bottom_counts: Counter = Counter()
        for lines in all_page_lines:
            for line in lines:
                if line["y1"] <= _MARGIN_FRACTION * self._page_height:
                    top_counts[line["text"]] += 1
                elif line["y0"] >= (1 - _MARGIN_FRACTION) * self._page_height:
                    bottom_counts[line["text"]] += 1

        page_count = max(1, len(all_page_lines))
        running = set()
        for counter in (top_counts, bottom_counts):
            running.update(t for t, n in counter.items() if n >= 0.5 * page_count)
        return running

    def _reconstruct_reading_order(self, lines: List[dict], running: set) -> str:
        """
        Rebuild the page's reading order after headers/footers are stripped.
        Lines are banded into rows (vertical tolerance) and each row is
        emitted left-to-right, which reconstructs two-column layouts.
        """
        clean = [l for l in lines if l["text"] not in running]
        if not clean:
            return ""

        clean.sort(key=lambda l: (round(l["y0"] / _COLUMN_BAND_TOLERANCE), l["x0"]))

        rows: List[List[dict]] = []
        current_row: List[dict] = []
        current_band = None

        for line in clean:
            band = round(line["y0"] / _COLUMN_BAND_TOLERANCE)
            if current_band is None:
                current_band, current_row = band, [line]
            elif band == current_band:
                current_row.append(line)
            else:
                rows.append(current_row)
                current_band, current_row = band, [line]
        if current_row:
            rows.append(current_row)

        rendered = []
        for row in rows:
            row.sort(key=lambda l: l["x0"])
            rendered.append("   ".join(l["text"] for l in row))
        return "\n".join(rendered)

    def _is_toc_page(self, text: str) -> bool:
        lines = [l.strip() for l in text.splitlines() if l.strip()]
        if not lines:
            return False
        toc_hits = sum(1 for l in lines if _TOC_LINE_PATTERN.search(l))
        return (toc_hits / len(lines)) > 0.4

    def extract_pages(self, file_path: str) -> List[Dict[str, Any]]:
        """Extract noise-free, reading-ordered text for every page."""
        doc = fitz.open(file_path)
        self._page_height = float(doc[0].rect.height)

        all_lines = [self._page_lines(page, self._page_height) for page in doc]
        running = self._detect_running_elements(all_lines)

        pages = []
        for page_num, lines in enumerate(all_lines, start=1):
            text = self._reconstruct_reading_order(lines, running)
            pages.append({"page_num": page_num, "text": text})
        doc.close()
        return pages

    # ── Chunking ────────────────────────────────────────────────────────────

    def _subsplit_with_overlap(self, text: str) -> List[str]:
        """
        Split a long fragment into sentences and re-join them into chunks of
        at most _MAX_CHUNK_CHARS. Each chunk after the first is prefixed with
        the trailing _OVERLAP_CHARS of the previous chunk so clause context
        survives the boundary.
        """
        sentences = [s.strip() for s in _SENTENCE_SPLIT_PATTERN.split(text.strip()) if s.strip()]
        if len(" ".join(sentences)) <= _MAX_CHUNK_CHARS:
            return [" ".join(sentences)] if sentences else []

        grouped: List[str] = []
        buffer = ""
        for sentence in sentences:
            candidate = f"{buffer} {sentence}".strip()
            if not buffer or len(candidate) <= _MAX_CHUNK_CHARS:
                buffer = candidate
            else:
                grouped.append(buffer)
                buffer = sentence
        if buffer:
            grouped.append(buffer)

        overlapping: List[str] = []
        for index, group in enumerate(grouped):
            if index == 0:
                overlapping.append(group)
                continue
            tail = grouped[index - 1][-_OVERLAP_CHARS:]
            overlapping.append(f"{tail}\n{group}")
        return overlapping

    def chunk_text(self, text: str, is_code: str, page_num: int) -> List[Chunk]:
        text = text.strip()
        if not text:
            return []

        matches = list(_STRUCTURE_PATTERN.finditer(text))

        if not matches:
            if len(text) >= _MIN_CHUNK_CHARS:
                return [
                    Chunk(
                        text=text,
                        metadata={
                            "is_code": is_code,
                            "clause_num": "N/A",
                            "page_num": page_num,
                            "table_ref": "N/A",
                        },
                    )
                ]
            return []

        slices: List[Dict[str, Any]] = []
        for index, match in enumerate(matches):
            clause_num = match.group(0)
            start = match.start()
            end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
            fragment = text[start:end].strip()

            table_ref = "N/A"
            table_match = re.search(r'Table\s+[\d\.]+', fragment, re.IGNORECASE)
            if table_match:
                table_ref = table_match.group(0)

            slices.append({"text": fragment, "clause_num": clause_num, "table_ref": table_ref})

        # Absorb heading-only fragments (< min chars) into their follower so
        # table headings and their bodies land in the same chunk.
        merged: List[Dict[str, Any]] = []
        buffer: Optional[Dict[str, Any]] = None

        for sl in slices:
            if buffer is None:
                buffer = dict(sl)
                continue
            if len(buffer["text"]) < _MIN_CHUNK_CHARS:
                buffer["text"] = f"{buffer['text']}\n{sl['text']}"
                if sl["table_ref"] != "N/A":
                    buffer["table_ref"] = sl["table_ref"]
            else:
                merged.append(buffer)
                buffer = dict(sl)

        if buffer is not None:
            if merged and len(buffer["text"]) < _MIN_CHUNK_CHARS:
                merged[-1]["text"] = f"{merged[-1]['text']}\n{buffer['text']}"
            else:
                merged.append(buffer)

        chunks: List[Chunk] = []
        for sl in merged:
            for part in self._subsplit_with_overlap(sl["text"]):
                if len(part) < _MIN_CHUNK_CHARS:
                    continue
                chunks.append(
                    Chunk(
                        text=part,
                        metadata={
                            "is_code": is_code,
                            "clause_num": sl["clause_num"],
                            "page_num": page_num,
                            "table_ref": sl["table_ref"],
                        },
                    )
                )
        return chunks

    def parse(self, file_path: str, filename: str) -> List[Chunk]:
        """Full pipeline: extract → clean → chunk."""
        pages = self.extract_pages(file_path)
        all_text = " ".join(page["text"] for page in pages)
        is_code = self.extract_is_code(all_text, filename)

        chunks: List[Chunk] = []
        for page in pages:
            if self._is_toc_page(page["text"]):
                continue
            chunks.extend(self.chunk_text(page["text"], is_code, page["page_num"]))
        return chunks