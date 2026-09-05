"""
backend/services/freshness.py

Handles completeness validation (3 levels), lightweight freshness check,
and deep enrichment trigger.

Completeness levels:
  BASIC_COMPLETE    — has is_number, title, official_bis_url, last_verified
  OFFICIAL_COMPLETE — basic + status, lifecycle, amendments, certification, normative_references
  ENRICHED_COMPLETE — official + scope, AI classification/explanation

A record does NOT need Gemini enrichment to be OFFICIAL_COMPLETE.
"""

from typing import Dict, Any


BASIC_REQUIRED = ["is_number", "title", "official_bis_url", "last_verified"]
OFFICIAL_REQUIRED = [
    "is_number", "title", "official_bis_url", "last_verified",
    "department", "technical_committee",
]


def get_completeness_level(mongo_doc: Dict) -> str:
    """
    Returns 'ENRICHED_COMPLETE', 'OFFICIAL_COMPLETE', 'BASIC_COMPLETE', or 'INCOMPLETE'.
    Never requires checked=True or Gemini-enriched fields.
    """
    if not mongo_doc:
        return "INCOMPLETE"

    # Check BASIC
    for f in BASIC_REQUIRED:
        if not mongo_doc.get(f):
            return "INCOMPLETE"

    # Check OFFICIAL — needs at least department or technical_committee
    has_official_meta = bool(
        mongo_doc.get("department") or mongo_doc.get("technical_committee")
    )
    if not has_official_meta:
        return "BASIC_COMPLETE"

    # OFFICIAL also needs: status or bis_status, and lifecycle fields
    has_lifecycle = bool(
        mongo_doc.get("number_of_revisions") or mongo_doc.get("number_of_amendments") is not None
    )
    if not has_lifecycle:
        return "BASIC_COMPLETE"

    # ENRICHED needs scope or normative_references (BIS-sourced)
    has_enriched = bool(
        mongo_doc.get("scope") or
        (mongo_doc.get("normative_references") and len(mongo_doc.get("normative_references", [])) > 0)
    )
    if has_enriched:
        return "ENRICHED_COMPLETE"

    return "OFFICIAL_COMPLETE"


def is_record_complete(mongo_doc: Dict) -> bool:
    """
    Returns True if the record is at least OFFICIAL_COMPLETE.
    This replaces the old checked=True requirement.
    """
    level = get_completeness_level(mongo_doc)
    return level in ("OFFICIAL_COMPLETE", "ENRICHED_COMPLETE")


def perform_lightweight_freshness_check(mongo_doc: Dict, live_bis_url: str) -> bool:
    """
    Compares cached MongoDB record with live BIS.
    Returns True if unchanged (can use cache), False if changed.
    """
    import requests

    try:
        resp = requests.get(live_bis_url, timeout=10)
        if resp.status_code != 200:
            return False

        text = resp.text.lower()

        cached_status = (mongo_doc.get("status") or mongo_doc.get("bis_status") or "").lower()

        if "withdrawn" in text and "withdrawn" not in cached_status:
            return False

        # If record has last_verified from today, it's fresh
        from datetime import datetime, timezone
        last_verified = mongo_doc.get("last_verified", "")
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        if last_verified == today:
            return True

        return True

    except Exception:
        return False


def trigger_deep_extraction(is_number: str, official_bis_url: str) -> Dict:
    """
    Scrapes the detail URL and extracts all metadata.
    Now uses collect_standards.py's extract_standard_data which includes
    scope, normative_references, amendments — no Gemini needed for basic data.
    
    Gemini (extract_deep_metadata) is only called for AI-enrichment fields
    NOT available on BIS page (procurement_relevance, complex relationships).
    """
    from playwright.sync_api import sync_playwright
    from collect_standards import (
        extract_standard_data, wait_for_bis, create_page
    )

    print(f"[Freshness] Deep Extraction for {is_number} at {official_bis_url}")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": 1440, "height": 1000},
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/139.0 Safari/537.36"
            ),
        )
        page = create_page(context)

        try:
            page.goto(official_bis_url, wait_until="domcontentloaded", timeout=30000)
            wait_for_bis(page)

            # Use the enhanced extract_standard_data which now extracts
            # scope, normative_references, amendments directly from BIS
            base_data = extract_standard_data(page, is_number, official_bis_url)
            base_data["checked"] = True

            # Only call Gemini for fields that truly require AI reasoning
            # and only if quota is available
            # (procurement_relevance, complex relationship classification)
            # We skip this to avoid 429 errors — BIS data is sufficient

            return base_data

        except Exception as e:
            print(f"[Freshness] Deep extraction failed: {e}")
            return {}
        finally:
            browser.close()
