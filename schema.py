
"""
schema.py

BIS AI Standards Recommendation System
---------------------------------------
Central data contract and validation rules.

This file does NOT modify MongoDB.
It defines how BIS official data, AI enrichment,
verification/trust information, relationships, and
discovery metadata are logically separated.

Current MongoDB documents remain compatible with the
existing flat schema.
"""

import re
from typing import Any, Dict, List


# ============================================================
# PROJECT / DATABASE CONSTANTS
# ============================================================

DATABASE_NAME = "BIS_Standards"
COLLECTION_NAME = "standards"

DATA_CONTRACT_VERSION = "1.0"


# ============================================================
# FIELD OWNERSHIP
# ============================================================
#
# IMPORTANT:
# The collector must NOT overwrite USER_CONTROLLED_FIELDS.
#
# BIS official fields come from BIS.
# AI enrichment fields come from our AI pipeline.
# Trust fields come from verification logic.
# Discovery fields describe how a standard entered our DB.

USER_CONTROLLED_FIELDS = {
    "category",
    "sub_category",
}


OFFICIAL_BIS_FIELDS = {
    "title",
    "department",
    "technical_committee",
    "certification",
    "superseding_is",
    "degree_of_equivalence",
    "number_of_revisions",
    "number_of_amendments",
    "type_of_standard",
    "language",
    "reaffirmation_year",
    "reviewed_in",
    "member_secretary",
    "source_url",
}


AI_ENRICHMENT_FIELDS = {
    "scope",
    "applicability",
    "key_requirements",
    "technical_requirements",
    "product_keywords",
    "normative_references",
    "cross_references",
    "related_standards",
    "test_methods",
    "safety_standards",
    "installation_standards",
}


TRUST_FIELDS = {
    "verification_status",
    "eligible_for_recommendation",
    "last_verified",
    "verification_source",
    "verification_issues",
}


LIFECYCLE_FIELDS = {
    "status",
    "amendments",
    "supersedes",
    "superseded_by",
}


DISCOVERY_FIELDS = {
    "discovery_keywords",
    "discovery_method",
}


SYSTEM_FIELDS = {
    "_id",
    "is_number",
    "source",
    "created_at",
    "updated_at",
    "last_updated",
    "schema_version",
}


# ============================================================
# VERIFICATION STATUS
# ============================================================

VERIFICATION_STATUSES = {
    "verified",
    "needs_verification",
    "failed",
    "unknown",
}


# ============================================================
# RECOMMENDATION ELIGIBILITY
# ============================================================

RECOMMENDATION_ELIGIBILITY = {
    True,
    False,
}


# ============================================================
# RELATIONSHIP TYPES
# ============================================================

RELATIONSHIP_TYPES = {
    "normative_reference",
    "test_method",
    "safety",
    "installation",
    "terminology",
    "related_product",
    "cross_reference",
    "supersedes",
    "superseded_by",
    "amendment",
}


# ============================================================
# LIFECYCLE STATUS VALUES
# ============================================================

KNOWN_LIFECYCLE_STATUSES = {
    "current",
    "withdrawn",
    "superseded",
    "obsolete",
    "cancelled",
    "under_revision",
    "draft",
    "unknown",
}


# ============================================================
# SOURCE RULES
# ============================================================

OFFICIAL_BIS_HOSTS = {
    "standards.bis.gov.in",
    "www.services.bis.gov.in",
    "services.bis.gov.in",
}


OFFICIAL_STANDARD_DETAILS_MARKER = "/website/standard-details"


# ============================================================
# MISSING VALUE HELPERS
# ============================================================

def is_missing(value: Any) -> bool:
    """
    Return True when a field is effectively missing.

    Empty strings, None, empty lists and empty dictionaries
    are treated as missing for validation purposes.
    """

    if value is None:
        return True

    if isinstance(value, str):
        return not value.strip()

    if isinstance(value, (list, tuple, set, dict)):
        return len(value) == 0

    return False


def clean_text(value: Any) -> str:
    """Safely convert a value to stripped text."""

    if value is None:
        return ""

    return str(value).strip()


# ============================================================
# IS NUMBER NORMALIZATION
# ============================================================

IS_NUMBER_PATTERN = re.compile(
    r"""
    ^\s*
    (?:IS\s*)?
    (?P<number>\d{1,6})
    \s*
    (?:
        \(\s*Part\s*(?P<part1>\d+)\s*\)
        |
        Part\s*(?P<part2>\d+)
    )?
    \s*
    :
    \s*
    (?P<year>\d{4})
    \s*$
    """,
    re.IGNORECASE | re.VERBOSE,
)


def normalize_is_number(value: Any) -> str:
    """
    Convert common IS number formats into a canonical form.

    Examples:

        17803:2022
        IS 17803:2022

    ->  IS 17803:2022

        17804 Part 1:2022
        17804 (Part 1):2022

    ->  IS 17804 (Part 1):2022
    """

    text = clean_text(value)

    if not text:
        return ""

    match = IS_NUMBER_PATTERN.match(text)

    if not match:
        # Fall back to normalized whitespace/case.
        return re.sub(r"\s+", " ", text).strip()

    number = match.group("number")
    part = match.group("part1") or match.group("part2")
    year = match.group("year")

    if part:
        return f"IS {number} (Part {part}):{year}"

    return f"IS {number}:{year}"


# ============================================================
# URL VALIDATION
# ============================================================

def is_official_bis_url(url: Any) -> bool:
    """
    Check whether a URL belongs to a known official BIS domain.
    """

    value = clean_text(url).lower()

    if not value:
        return False

    if not value.startswith(("http://", "https://")):
        return False

    for host in OFFICIAL_BIS_HOSTS:
        if host in value:
            return True

    return False


def is_standard_details_url(url: Any) -> bool:
    """
    Check whether a URL looks like an official BIS standard-details page.
    """

    value = clean_text(url).lower()

    return (
        is_official_bis_url(value)
        and OFFICIAL_STANDARD_DETAILS_MARKER in value
    )


# ============================================================
# TITLE / STATUS CONSISTENCY
# ============================================================

WITHDRAWN_TITLE_WORDS = {
    "withdrawn",
    "withdrawal",
    "superseded",
    "obsolete",
    "cancelled",
    "canceled",
}


def title_suggests_non_current(title: Any) -> bool:
    """
    Heuristic only.

    This is NOT an authoritative BIS lifecycle determination.

    It exists to catch suspicious records such as:

        title = "X — Withdrawn"
        status = "Current"

    Such records must subsequently be checked against BIS.
    """

    text = clean_text(title).lower()

    if not text:
        return False

    return any(
        word in text
        for word in WITHDRAWN_TITLE_WORDS
    )


# ============================================================
# DOCUMENT VALIDATION
# ============================================================

def validate_document(document: Dict[str, Any]) -> List[Dict[str, str]]:
    """
    Validate one MongoDB standard document.

    Returns a list of issues.

    Each issue:

        {
            "severity": "ERROR" | "WARNING" | "INFO",
            "field": "...",
            "message": "..."
        }

    This function DOES NOT modify the document.
    """

    issues: List[Dict[str, str]] = []

    # --------------------------------------------------------
    # Identity
    # --------------------------------------------------------

    is_number = document.get("is_number")

    if is_missing(is_number):
        issues.append({
            "severity": "ERROR",
            "field": "is_number",
            "message": "Missing IS number.",
        })
    else:
        normalized = normalize_is_number(is_number)

        if not normalized.upper().startswith("IS "):
            issues.append({
                "severity": "WARNING",
                "field": "is_number",
                "message": (
                    f"IS number may not be in canonical form: {is_number}"
                ),
            })

    # --------------------------------------------------------
    # Official title
    # --------------------------------------------------------

    title = document.get("title")

    if is_missing(title):
        issues.append({
            "severity": "ERROR",
            "field": "title",
            "message": "Missing BIS standard title.",
        })

    # --------------------------------------------------------
    # Source
    # --------------------------------------------------------

    source_url = document.get("source_url")

    if is_missing(source_url):
        issues.append({
            "severity": "ERROR",
            "field": "source_url",
            "message": "Missing BIS source URL.",
        })

    elif not is_official_bis_url(source_url):
        issues.append({
            "severity": "ERROR",
            "field": "source_url",
            "message": (
                "Source URL is not recognized as an official BIS domain."
            ),
        })

    elif not is_standard_details_url(source_url):
        issues.append({
            "severity": "WARNING",
            "field": "source_url",
            "message": (
                "URL belongs to BIS but does not appear to be a "
                "standard-details page."
            ),
        })

    # --------------------------------------------------------
    # Source identifier
    # --------------------------------------------------------

    source = clean_text(document.get("source"))

    if source and source.upper() != "BIS":
        issues.append({
            "severity": "WARNING",
            "field": "source",
            "message": f"Expected source='BIS', found '{source}'.",
        })

    # --------------------------------------------------------
    # Category ownership
    # --------------------------------------------------------

    if is_missing(document.get("category")):
        issues.append({
            "severity": "WARNING",
            "field": "category",
            "message": (
                "Category is missing. This is user-controlled taxonomy "
                "and must not be automatically guessed by the collector."
            ),
        })

    if is_missing(document.get("sub_category")):
        issues.append({
            "severity": "WARNING",
            "field": "sub_category",
            "message": (
                "Sub-category is missing. This is user-controlled taxonomy."
            ),
        })

    # --------------------------------------------------------
    # Lifecycle status
    # --------------------------------------------------------

    status = clean_text(document.get("status"))

    if not status:
        issues.append({
            "severity": "WARNING",
            "field": "status",
            "message": (
                "Lifecycle status is missing. Current/withdrawn status "
                "must eventually be verified from BIS."
            ),
        })
    else:
        status_lower = status.lower()

        if status_lower not in KNOWN_LIFECYCLE_STATUSES:
            issues.append({
                "severity": "WARNING",
                "field": "status",
                "message": (
                    f"Unknown lifecycle status value: '{status}'."
                ),
            })

        if (
            status_lower == "current"
            and title_suggests_non_current(title)
        ):
            issues.append({
                "severity": "ERROR",
                "field": "status",
                "message": (
                    "Potential lifecycle conflict: record says "
                    "'Current' but the title appears to contain "
                    "withdrawn/superseded/obsolete wording. "
                    "Must be verified against BIS."
                ),
            })

    # --------------------------------------------------------
    # Verification
    # --------------------------------------------------------

    verification_status = clean_text(
        document.get("verification_status")
    ).lower()

    if not verification_status:
        issues.append({
            "severity": "WARNING",
            "field": "verification_status",
            "message": (
                "No explicit BIS verification status exists yet."
            ),
        })
    elif verification_status not in VERIFICATION_STATUSES:
        issues.append({
            "severity": "WARNING",
            "field": "verification_status",
            "message": (
                f"Unknown verification_status: "
                f"'{verification_status}'."
            ),
        })

    if is_missing(document.get("last_verified")):
        issues.append({
            "severity": "WARNING",
            "field": "last_verified",
            "message": "No BIS verification timestamp recorded.",
        })

    if is_missing(document.get("verification_source")):
        issues.append({
            "severity": "WARNING",
            "field": "verification_source",
            "message": "No verification source recorded.",
        })

    # --------------------------------------------------------
    # Recommendation eligibility
    # --------------------------------------------------------

    eligible = document.get("eligible_for_recommendation")

    if eligible is None:
        issues.append({
            "severity": "WARNING",
            "field": "eligible_for_recommendation",
            "message": (
                "Recommendation eligibility has not been explicitly "
                "determined."
            ),
        })
    elif not isinstance(eligible, bool):
        issues.append({
            "severity": "WARNING",
            "field": "eligible_for_recommendation",
            "message": (
                "eligible_for_recommendation must be boolean."
            ),
        })

    # --------------------------------------------------------
    # AI enrichment
    # --------------------------------------------------------

    enrichment_present = False

    for field in AI_ENRICHMENT_FIELDS:
        value = document.get(field)

        if not is_missing(value):
            enrichment_present = True
            break

    if not enrichment_present:
        issues.append({
            "severity": "INFO",
            "field": "ai_enrichment",
            "message": (
                "No AI enrichment data is currently populated. "
                "This is expected for newly collected standards."
            ),
        })

    # --------------------------------------------------------
    # Schema version
    # --------------------------------------------------------

    if is_missing(document.get("schema_version")):
        issues.append({
            "severity": "INFO",
            "field": "schema_version",
            "message": (
                "Document does not yet contain the new data-contract "
                "version field."
            ),
        })

    return issues


# ============================================================
# COLLECTION-LEVEL HELPERS
# ============================================================

def summarize_issues(
    issues: List[Dict[str, str]]
) -> Dict[str, int]:
    """
    Count validation issues by severity.
    """

    summary = {
        "ERROR": 0,
        "WARNING": 0,
        "INFO": 0,
    }

    for issue in issues:
        severity = issue.get("severity", "INFO")

        if severity in summary:
            summary[severity] += 1

    return summary


def get_field_groups() -> Dict[str, set]:
    """
    Return the logical field ownership groups.

    Useful for future collector / enrichment / verification code.
    """

    return {
        "user_controlled": USER_CONTROLLED_FIELDS,
        "official_bis": OFFICIAL_BIS_FIELDS,
        "ai_enrichment": AI_ENRICHMENT_FIELDS,
        "trust": TRUST_FIELDS,
        "lifecycle": LIFECYCLE_FIELDS,
        "discovery": DISCOVERY_FIELDS,
        "system": SYSTEM_FIELDS,
    }