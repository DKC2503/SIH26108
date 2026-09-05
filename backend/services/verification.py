"""
backend/services/verification.py

Verification / Trust layer.
BIS is the single source of truth.
"""

from typing import Dict

WITHDRAWN_WORDS = {"withdrawn", "withdrawal", "superseded", "obsolete", "cancelled"}


def _title_suggests_non_current(title: str) -> bool:
    if not title:
        return False
    return any(w in title.lower() for w in WITHDRAWN_WORDS)


def determine_verification_status(standard: Dict) -> Dict:
    """
    Evaluate a standard's verification status.
    Returns a verification block.
    """
    issues = []
    title = standard.get("title", "")
    status = (standard.get("status") or "").strip()
    official_bis_url = standard.get("official_bis_url", "")
    last_verified = standard.get("last_verified", "")
    eligible = standard.get("eligible_for_recommendation")

    lifecycle_status = status if status else "Unknown"

    # Title vs status consistency check
    if status.lower() == "current" and _title_suggests_non_current(title):
        issues.append({
            "severity": "ERROR",
            "message": "Title suggests non-current but status is 'Current'. Needs BIS re-verification.",
        })

    if not official_bis_url:
        issues.append({"severity": "WARNING", "message": "No official BIS detail URL."})

    if not title:
        issues.append({"severity": "ERROR", "message": "Missing BIS title."})

    error_count = sum(1 for i in issues if i["severity"] == "ERROR")
    warn_count = sum(1 for i in issues if i["severity"] == "WARNING")

    ls_lower = lifecycle_status.lower()
    source = standard.get("verification_source", "mongodb")
    
    if ls_lower in ("withdrawn", "superseded", "obsolete", "cancelled"):
        final_status = "failed"
        eligible_final = False
        badge = "[DO NOT RECOMMEND] Withdrawn/Superseded"
    elif source == "mongodb":
        final_status = "cache_only"
        eligible_final = True
        badge = "[CACHE ONLY] MongoDB Cache Only"
    elif error_count > 0:
        final_status = "needs_verification"
        eligible_final = False
        badge = "[NEEDS VERIFICATION] BIS Data Needs Verification"
    elif warn_count > 0:
        final_status = "needs_verification"
        eligible_final = True if eligible is not False else False
        badge = "[NEEDS VERIFICATION] BIS Data Needs Verification"
    elif not last_verified:
        final_status = "unknown"
        eligible_final = True
        badge = "[NOT VERIFIED] Not Yet BIS Verified"
    else:
        final_status = "verified"
        eligible_final = True
        badge = "[BIS VERIFIED] BIS Verified - Current"

    return {
        "status": final_status,
        "eligible_for_recommendation": eligible_final,
        "issues": issues,
        "ui_badge": badge,
        "lifecycle_status": lifecycle_status,
        "last_verified": last_verified,
        "source": standard.get("verification_source", "mongodb"),
    }


def merge_bis_and_mongo(bis_data: Dict, mongo_doc: Dict) -> Dict:
    """
    Merge BIS official data (authoritative) with MongoDB enrichment.
    BIS wins on all official fields.
    MongoDB contributes AI enrichment / relationships / discovery metadata.
    User-controlled fields (category, sub_category) are never overwritten.
    """
    BIS_FIELDS = {
        "title", "department", "technical_committee", "certification",
        "superseding_is", "degree_of_equivalence", "number_of_revisions",
        "number_of_amendments", "type_of_standard", "language",
        "reaffirmation_year", "reviewed_in", "member_secretary", "official_bis_url",
    }
    USER_FIELDS = {"category", "sub_category"}

    merged = dict(mongo_doc)

    for field in BIS_FIELDS:
        if field in bis_data and bis_data[field] is not None:
            merged[field] = bis_data[field]

    for field in USER_FIELDS:
        if field in mongo_doc and mongo_doc[field]:
            merged[field] = mongo_doc[field]

    return merged
