"""
backend/bis/client.py

Wrapper that reuses the existing collect_standards.py BIS discovery logic.
After discovery, queries MongoDB for the full enriched record.
"""

import sys
import os

# Add root to path so existing collect_standards.py can be imported
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../"))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)


def discover_standards_by_keyword(keyword: str, limit: int = 5) -> list:
    """
    Trigger the existing playwright-based BIS discovery.
    After scraping, fetches full MongoDB records for each discovered standard.
    Returns list of full standard dicts (not just {is_number, detail_url}).
    """
    try:
        from collect_standards import collect_from_keyword

        # collect_from_keyword now returns full MongoDB records
        raw_results = collect_from_keyword(keyword=keyword, limit=limit)

        if not raw_results:
            return []

        for doc in raw_results:
            if not doc.get("verification_source"):
                doc["verification_source"] = "official_bis_live"
            if not doc.get("official_bis_url") and doc.get("detail_url"):
                doc["official_bis_url"] = doc["detail_url"]

        return raw_results

    except Exception as e:
        print(f"[BIS Discovery] Error for '{keyword}': {e}")
        return []


def discover_standards_by_number(is_number: str) -> dict:
    """
    Exact IS number lookup. Returns the full MongoDB record or None.
    """
    try:
        from collect_standards import collect_from_keyword, connect_mongodb, normalize_is_number

        norm = normalize_is_number(is_number)
        if not norm:
            return None

        results = collect_from_keyword(keyword=is_number, limit=1)
        if not results:
            return None

        # Fetch full MongoDB record
        try:
            mongo_client, collection = connect_mongodb()
            doc = collection.find_one({"is_number": norm}, {"_id": 0})
            mongo_client.close()
            if doc:
                doc["verification_source"] = "official_bis_live"
                return doc
        except Exception:
            pass

        # Fallback
        r = results[0]
        return {
            "is_number": norm,
            "official_bis_url": r.get("detail_url", ""),
            "verification_source": "official_bis_live",
        }

    except Exception as e:
        print(f"[BIS Discovery] Error for IS number '{is_number}': {e}")
        return None
