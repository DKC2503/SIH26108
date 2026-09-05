"""
backend/services/retrieval.py

Hybrid retrieval engine.
Combines:
  - MongoDB lexical search
  - Semantic / vector similarity (SentenceTransformers)
  - Product-type matching
  - Scope / applicability matching
  - Lifecycle filtering

NOTE: embedding similarity is a SIGNAL, not the final answer.
"""

import re
from typing import Any, Dict, List

from backend.db_client import get_standards_collection

# Lazy-load sentence-transformers to avoid blocking startup
_model = None


def _get_embedding_model():
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer
        _model = SentenceTransformer("all-MiniLM-L6-v2")
    return _model


def _normalize(text: Any) -> str:
    if text is None:
        return ""
    if isinstance(text, list):
        return " ".join(str(t) for t in text)
    if isinstance(text, dict):
        return " ".join(f"{k} {v}" for k, v in text.items())
    text = str(text).lower()
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _build_standard_text(s: Dict) -> str:
    parts = [
        s.get("is_number", ""),
        s.get("title", ""),
        s.get("category", ""),
        s.get("sub_category", ""),
        s.get("scope", ""),
        s.get("department", ""),
        " ".join(s.get("product_keywords", [])),
        " ".join(str(x) for x in s.get("key_requirements", [])),
        " ".join(str(x) for x in s.get("technical_requirements", [])),
    ]
    return " ".join(_normalize(p) for p in parts)


STOP_WORDS = {
    "i", "we", "the", "a", "an", "for", "to", "of", "in", "is", "are",
    "and", "or", "need", "want", "please", "give", "show", "about",
    "standards", "standard", "bis",
}


def _word_overlap(query: str, text: str) -> float:
    q_words = {w for w in _normalize(query).split() if w not in STOP_WORDS}
    t_words = set(_normalize(text).split())
    if not q_words:
        return 0.0
    return len(q_words & t_words) / len(q_words)


def _phrase_score(product: str, s: Dict) -> float:
    """Score based on product phrase occurrence in standard fields."""
    p = _normalize(product)
    if not p:
        return 0.0
    title = _normalize(s.get("title", ""))
    sub_cat = _normalize(s.get("sub_category", ""))
    keywords = _normalize(" ".join(s.get("product_keywords", [])))
    scope = _normalize(s.get("scope", ""))
    if p in title:
        return 1.0
    if p in sub_cat:
        return 0.95
    if p in keywords:
        return 0.90
    if p in scope:
        return 0.80
    return 0.0


def score_standard(
    standard: Dict,
    requirement: Dict,
    semantic_score: float,
) -> Dict:
    """Compute a composite relevance score."""
    product = requirement.get("product", "")
    product_type = requirement.get("product_type", "")
    material = requirement.get("material", "") or ""

    phrase = _phrase_score(product, standard)

    # Also try product_type phrase
    phrase_type = _phrase_score(product_type.replace("_", " "), standard)
    phrase = max(phrase, phrase_type * 0.85)

    # Material match boost
    material_match = 0.0
    if material:
        title_text = _normalize(
            standard.get("title", "") + " " + standard.get("scope", "")
        )
        if _normalize(material) in title_text:
            material_match = 0.5

    overlap = _word_overlap(product, _build_standard_text(standard))

    sem = max(0.0, min(float(semantic_score), 1.0))

    # Penalize if only semantic signal and no phrase match
    if phrase == 0.0:
        sem *= 0.65

    final = (
        0.40 * phrase
        + 0.20 * overlap
        + 0.15 * material_match
        + 0.25 * sem
    )

    return {
        "score": round(final, 4),
        "phrase_score": round(phrase, 4),
        "overlap": round(overlap, 4),
        "material_match": round(material_match, 4),
        "semantic_score": round(sem, 4),
    }


def load_all_standards() -> List[Dict]:
    """Load all standards from MongoDB (read-only)."""
    coll = get_standards_collection()
    return list(coll.find({}, {"_id": 0}))


def lexical_search_mongo(requirement: Dict, limit: int = 80) -> List[Dict]:
    """
    Fast lexical pre-filter in MongoDB using regex.
    Returns candidate documents for re-ranking.
    """
    coll = get_standards_collection()
    product = requirement.get("product", "")
    words = [w for w in _normalize(product).split() if len(w) > 2 and w not in STOP_WORDS]

    if not words:
        return list(coll.find({}, {"_id": 0}).limit(limit))

    # Build OR regex across key fields
    pattern = "|".join(re.escape(w) for w in words)
    query = {
        "$or": [
            {"title": {"$regex": pattern, "$options": "i"}},
            {"sub_category": {"$regex": pattern, "$options": "i"}},
            {"scope": {"$regex": pattern, "$options": "i"}},
            {"product_keywords": {"$regex": pattern, "$options": "i"}},
        ]
    }
    return list(coll.find(query, {"_id": 0}).limit(limit))


def hybrid_retrieve(
    requirement: Dict,
    top_k: int = 10,
    lexical_limit: int = 80,
) -> List[Dict]:
    """
    Hybrid retrieval:
    1. Lexical pre-filter from MongoDB
    2. Semantic re-rank with SentenceTransformers
    3. Composite scoring
    Returns sorted list of {standard, score, score_details} dicts.
    """
    product = requirement.get("product", "")
    if not product:
        return []

    # Step 1: Lexical candidates
    candidates = lexical_search_mongo(requirement, limit=lexical_limit)

    # Fall back to all if insufficient
    if len(candidates) < 5:
        candidates = load_all_standards()

    if not candidates:
        return []

    # Step 2: Semantic encoding
    try:
        embed_model = _get_embedding_model()
        from sentence_transformers import util

        query_text = product
        if requirement.get("material"):
            query_text += " " + requirement["material"]
        if requirement.get("product_type"):
            query_text += " " + requirement["product_type"].replace("_", " ")

        q_emb = embed_model.encode(query_text, convert_to_tensor=True)
        c_texts = [_build_standard_text(c) for c in candidates]
        c_embs = embed_model.encode(c_texts, convert_to_tensor=True)
        sims = util.cos_sim(q_emb, c_embs)[0]
        sem_scores = sims.tolist()
    except Exception as e:
        print(f"[Retrieval] Embedding error: {e}")
        sem_scores = [0.0] * len(candidates)

    # Step 3: Score and rank
    scored = []
    for i, std in enumerate(candidates):
        details = score_standard(std, requirement, sem_scores[i])
        scored.append({
            "standard": std,
            "score": details["score"],
            "score_details": details,
        })

    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored[:top_k]
