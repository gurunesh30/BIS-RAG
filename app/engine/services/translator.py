"""
services/translator.py

Lightweight async translation layer using the MyMemory REST API.
Non-English queries are translated to English before ChromaDB lookup.
The original query is preserved separately so the LLM can respond
in the user's native language.
"""

import os
import logging
from typing import Tuple

import httpx

logger = logging.getLogger(__name__)

_MYMEMORY_URL = "https://api.mymemory.translated.net/get"
_TIMEOUT_SECONDS = 0.8  # 800 ms hard cap as per spec

# Unicode script ranges → explicit MyMemory langpair codes.
# Explicit codes are far more reliable than autodetect for Indic scripts.
_SCRIPT_LANGPAIRS = [
    ((0x0C00, 0x0C7F), "te|en"),   # Telugu
    ((0x0900, 0x097F), "hi|en"),   # Devanagari (Hindi)
    ((0x0B80, 0x0BFF), "ta|en"),   # Tamil
    ((0x0C80, 0x0CFF), "kn|en"),   # Kannada
    ((0x0D00, 0x0D7F), "ml|en"),   # Malayalam
    ((0x0980, 0x09FF), "bn|en"),   # Bengali
    ((0x0A00, 0x0A7F), "pa|en"),   # Gurmukhi (Punjabi)
    ((0x0A80, 0x0AFF), "gu|en"),   # Gujarati
    ((0x0B00, 0x0B7F), "or|en"),   # Odia
    ((0x4E00, 0x9FFF), "zh|en"),   # CJK (Chinese)
    ((0x3040, 0x30FF), "ja|en"),   # Japanese
    ((0xAC00, 0xD7AF), "ko|en"),   # Korean
    ((0x0600, 0x06FF), "ar|en"),   # Arabic
    ((0x0400, 0x04FF), "ru|en"),   # Cyrillic
]


def _detect_langpair(text: str) -> str | None:
    """
    Returns the explicit MyMemory langpair string (e.g. 'te|en') for the
    dominant non-Latin script found in *text*, or None if the text is
    plain ASCII/Latin.
    """
    # Count codepoints per script range
    scores: dict[str, int] = {}
    for ch in text:
        cp = ord(ch)
        for (lo, hi), pair in _SCRIPT_LANGPAIRS:
            if lo <= cp <= hi:
                scores[pair] = scores.get(pair, 0) + 1
                break

    if not scores:
        return None
    # Return the langpair with the most matching characters
    return max(scores, key=lambda k: scores[k])


def is_english(text: str) -> bool:
    """Returns True when no non-Latin script characters are detected."""
    return _detect_langpair(text) is None


async def translate_query(text: str) -> Tuple[str, bool]:
    """
    Translates *text* to English via MyMemory API using an explicit
    script-specific langpair (e.g. te|en for Telugu) rather than autodetect,
    which is unreliable for Indic scripts.

    Returns
    -------
    (translated_text, was_translated)
        - translated_text : English string to use for ChromaDB search.
        - was_translated  : True when translation actually ran.

    Falls back to the raw query on timeout / error.
    """
    langpair = _detect_langpair(text)
    if langpair is None:
        return text, False

    email = os.getenv("MYMEMORY_EMAIL", "")
    params: dict = {
        "q": text,
        "langpair": langpair,
    }
    if email:
        params["de"] = email

    # Explicitly request UTF-8 JSON so MyMemory never returns a
    # mis-encoded text/plain body that breaks response.json().
    headers = {
        "Accept": "application/json; charset=utf-8",
        "Accept-Charset": "utf-8",
    }

    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT_SECONDS) as client:
            response = await client.get(_MYMEMORY_URL, params=params, headers=headers)
            response.raise_for_status()

            # Explicitly decode as UTF-8 regardless of what Content-Type
            # the server declares — MyMemory occasionally returns
            # Content-Type: text/plain which confuses httpx's auto-detect.
            try:
                data = response.json()
            except Exception:
                raw = response.content.decode("utf-8", errors="replace")
                logger.warning(
                    "MyMemory response was not valid JSON (langpair=%s). Raw: %r",
                    langpair, raw[:200]
                )
                return text, False

        translated = (
            data.get("responseData", {})
                .get("translatedText", "")
                .strip()
        )

        if not translated or translated.lower() == text.lower():
            logger.warning("MyMemory returned empty/identical translation (langpair=%s).", langpair)
            return text, False

        # Guard: if the "translation" still contains the original script
        # characters it means MyMemory echoed the input back unchanged.
        if _detect_langpair(translated) == langpair:
            logger.warning(
                "MyMemory returned text in the source script unchanged (langpair=%s). Using raw query.",
                langpair
            )
            return text, False

        logger.info("Translated [%s]: %r → %r", langpair, text, translated)
        return translated, True

    except httpx.TimeoutException:
        logger.warning("MyMemory timed out (>800ms, langpair=%s). Using raw query.", langpair)
        return text, False
    except Exception as exc:
        logger.warning("MyMemory failed (langpair=%s): %s. Using raw query.", langpair, exc)
        return text, False
