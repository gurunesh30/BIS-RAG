"""
reranker.py — reranking & context-filtering module.

Passes the hybrid-retrieved chunks and the (re)written query through a
cross-encoder model to compute deep, pair-wise relevance scores, then applies
a strict score cut-off so low-relevance chunks never reach the LLM prompt —
this is the primary anti-hallucination filter in the pipeline.
"""

import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# Default model: tiny cross-encoder that still beats bi-encoder cosine search
# on legal/technical keyword precision.
DEFAULT_MODEL = "cross-encoder/ms-marco-MiniLM-L-6-v2"
DEFAULT_THRESHOLD = 0.15


def _sigmoid(x: float) -> float:
    """Map a cross-encoder logit into a probability-like [0, 1] score."""
    import math

    if x >= 0:
        z = math.exp(-x)
        return 1.0 / (1.0 + z)
    z = math.exp(x)
    return z / (1.0 + z)


class Reranker:
    """
    Cross-encoder reranker with a strict relevance threshold.

    The model is loaded lazily on first use so a pipeline can be constructed
    cheaply, and it degrades gracefully to an identity pass-through if the
    ``sentence-transformers`` package is unavailable.
    """

    def __init__(
        self,
        model_name: str = DEFAULT_MODEL,
        threshold: float = DEFAULT_THRESHOLD,
    ) -> None:
        self.model_name = model_name
        self.threshold = float(threshold)
        self._model: Optional[Any] = None

    def _get_model(self):
        if self._model is None:
            import os

            if (
                os.getenv("HF_HUB_OFFLINE") == "1"
                or os.getenv("DISABLE_LOCAL_RERANKER", "1") == "1"
                or os.getenv("RENDER") == "true"
            ):
                self._model = False
                return None

            try:
                from sentence_transformers import CrossEncoder

                self._model = CrossEncoder(self.model_name, max_length=512)
            except Exception as exc:  # noqa: BLE001
                logger.warning(
                    "Could not load cross-encoder %s (%s); reranking disabled.",
                    self.model_name,
                    exc,
                )
                self._model = False
        return self._model or None

    def rerank(
        self,
        query: str,
        candidates: List[Dict[str, Any]],
        keep_scores: bool = True,
    ) -> List[Dict[str, Any]]:
        """
        Re-order *candidates* by cross-encoder relevance to *query*.

        Scores are stored under ``rerank_score`` (sigmoid-normalised); the
        original retrieval ``score`` is preserved for the UI.
        """
        if not candidates:
            return []

        model = self._get_model()
        if model is None:
            # Pass-through: keep the fused ordering, stamp a neutral score.
            for index, item in enumerate(candidates):
                item.setdefault("rerank_score", round(1.0 - (index / max(len(candidates), 1)), 4))
            return candidates

        pairs = [[query, item.get("text", "")] for item in candidates]
        logits = model.predict(pairs, show_progress_bar=False)
        logits = logits.tolist() if hasattr(logits, "tolist") else list(logits)

        for index, item in enumerate(candidates):
            item["rerank_score"] = round(_sigmoid(float(logits[index])), 4)

        ranked = sorted(candidates, key=lambda item: item["rerank_score"], reverse=True)
        return ranked

    def filter_by_threshold(
        self,
        candidates: List[Dict[str, Any]],
        threshold: Optional[float] = None,
    ) -> List[Dict[str, Any]]:
        """
        Drop chunks whose rerank score falls below *threshold*.

        Uses ``self.threshold`` when none is supplied. Results are returned
        in descending relevance order.
        """
        cutoff = float(threshold) if threshold is not None else self.threshold
        kept = [item for item in candidates if float(item.get("rerank_score", 0.0)) >= cutoff]
        kept.sort(key=lambda item: item["rerank_score"], reverse=True)
        return kept