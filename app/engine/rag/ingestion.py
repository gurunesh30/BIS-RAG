import re
import fitz
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field


@dataclass
class Chunk:
    text: str
    metadata: Dict[str, Any] = field(default_factory=dict)


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

    def chunk_pages(self, pages: List[Dict[str, Any]], is_code: str) -> List[Chunk]:
        chunks = []
        for page in pages:
            text = page["text"]
            page_num = page["page_num"]

            clause_matches = list(self.clause_pattern.finditer(text))

            if not clause_matches:
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

            for i, match in enumerate(clause_matches):
                clause_num = match.group(1)
                start = match.start()
                end = clause_matches[i + 1].start() if i + 1 < len(clause_matches) else len(text)
                chunk_text = text[start:end].strip()

                table_ref = "N/A"
                table_match = re.search(r'Table\s+[\d\.]+', chunk_text, re.IGNORECASE)
                if table_match:
                    table_ref = table_match.group(0)

                chunks.append(Chunk(
                    text=chunk_text,
                    metadata={
                        "is_code": is_code,
                        "clause_num": clause_num,
                        "page_num": page_num,
                        "table_ref": table_ref
                    }
                ))

        return chunks

    def ingest_pdf(self, file_path: str, filename: str) -> List[Chunk]:
        pages = self.extract_text_from_pdf(file_path)
        is_code = self.extract_is_code(" ".join(p["text"] for p in pages), filename)
        return self.chunk_pages(pages, is_code)
