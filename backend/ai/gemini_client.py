"""
backend/ai/gemini_client.py

Centralized Gemini AI client using the new google-genai SDK.
All AI tasks route through this module.

Gemini is the REASONING layer only.
Gemini must NOT invent BIS facts, IS numbers, or standard details.
"""

import os
import json
import textwrap
from typing import Any, Dict, List

from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

_client = None

def _get_client() -> genai.Client:
    global _client
    if _client is None:
        if not GEMINI_API_KEY:
            raise ValueError("GEMINI_API_KEY is not set in .env")
        _client = genai.Client(api_key=GEMINI_API_KEY)
    return _client

MODEL = "gemini-3.6-flash"

def _generate(system: str, prompt: str) -> str:
    """Core generation function."""
    client = _get_client()
    response = client.models.generate_content(
        model=MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=system,
            temperature=0.1,
        ),
    )
    return response.text or ""


def _parse_json(text: str, fallback: Any = None) -> Any:
    """Strip markdown fences and parse JSON robustly."""
    if not text:
        return fallback
    text = text.strip()

    # Strip any leading/trailing markdown fences
    for fence in ("```json", "```JSON", "```"):
        if text.startswith(fence):
            text = text[len(fence):].strip()
            break
    if text.endswith("```"):
        text = text[:-3].strip()

    # Try direct parse first
    try:
        return json.loads(text)
    except Exception:
        pass

    # Try to extract just the JSON object/array from surrounding text
    for start_char, end_char in (('{', '}'), ('[', ']')):
        start = text.find(start_char)
        end = text.rfind(end_char)
        if start != -1 and end != -1 and end > start:
            try:
                return json.loads(text[start:end + 1])
            except Exception:
                pass

    return fallback


# ============================================================
# LOCAL FALLBACK REQUIREMENT PARSER
# (No Gemini needed — runs on regex + keyword matching)
# ============================================================

import re

# Maps product keywords/aliases -> (product, product_type)
_PRODUCT_ALIASES = [
    # Cement variants
    (r"\bmasonry cement\b",             "cement",         "masonry_cement"),
    (r"\bportland pozzolana cement\b",   "cement",         "portland_pozzolana_cement"),
    (r"\bppc\b",                         "cement",         "portland_pozzolana_cement"),
    (r"\bportland slag cement\b",        "cement",         "portland_slag_cement"),
    (r"\bpsc\b",                         "cement",         "portland_slag_cement"),
    (r"\brapid hardening cement\b",      "cement",         "rapid_hardening_portland_cement"),
    (r"\bwhite cement\b",               "cement",         "white_portland_cement"),
    (r"\bhydrophobic cement\b",          "cement",         "hydrophobic_portland_cement"),
    (r"\b(ordinary )?portland cement\b", "cement",         "ordinary_portland_cement"),
    (r"\bopc\b",                         "cement",         "ordinary_portland_cement"),
    (r"\bcement\b",                      "cement",         "cement"),
    # Steel — compound phrases BEFORE bare 'stainless steel'
    (r"\bstainless steel water bottles?\b", "water bottle",  "stainless_steel_water_bottle"),
    (r"\bwater bottles?\b",                 "water bottle",  "water_bottle"),
    (r"\bstainless steel\b",               "steel",         "stainless_steel"),
    (r"\btmt bars?\b",                      "steel bar",     "tmt_bar"),
    (r"\bstructural steel\b",              "steel",         "structural_steel"),
    # Pipes — compound first
    (r"\bgi pipes?\b",                      "pipe",          "galvanized_iron_pipe"),
    (r"\bupvc pipes?\b",                    "pipe",          "upvc_pipe"),
    (r"\bhdpe pipes?\b",                    "pipe",          "hdpe_pipe"),
    (r"\bpipes?\b",                         "pipe",          "pipe"),
    # Water — compound before bare
    (r"\bpackaged drinking waters?\b",       "drinking water", "packaged_drinking_water"),
    (r"\bdrinking waters?\b",               "drinking water", "drinking_water"),
    (r"\bdrinking waters?\b",               "drinking water", "drinking_water"),
    # Electrical — compound before bare
    (r"\bpvc insulated cables?\b",           "cable",         "pvc_insulated_cable"),
    (r"\belectric cables?\b",               "cable",         "electric_cable"),
    (r"\belectric wires?\b",               "wire",          "electric_wire"),
    (r"\bled (?:lamp|bulb|light)s?\b",       "LED lamp",      "led_lamp"),
    (r"\bbulbs?\b|\bleds?\b",               "LED lamp",      "led_lamp"),
    # Food
    (r"\bwheat flour\b|\batta\b",        "wheat flour",    "packaged_wheat_flour"),
    (r"\bedible oil\b",                  "edible oil",     "packaged_edible_oil"),
    # Bricks / masonry
    (r"\bfly ash brick\b",               "brick",          "fly_ash_brick"),
    (r"\bclay brick\b|\bred brick\b",    "brick",          "clay_brick"),
    (r"\bbrick\b",                       "brick",          "brick"),
    # Stationery
    (r"\bball(?:\s|-)?point pens?\b|\bball pens?\b|\bpens?\b", "ball point pen", "ball_point_pen"),
    # Safety Gear
    (r"\b(?:safety )?helmets?\b",        "safety helmet",  "safety_helmet"),
    (r"\b(?:safety )?shoes?\b|\bboots?\b", "safety shoes", "safety_shoes"),
    # Generic fallback
    (r"\bsand\b",                        "sand",           "sand"),
    (r"\baggregate\b",                   "aggregate",      "aggregate"),
    (r"\bpaint\b",                       "paint",          "paint"),
    (r"\badhesive\b",                    "adhesive",       "adhesive"),
    (r"\bglass\b",                       "glass",          "glass"),
]

_PURPOSE_PATTERNS = [
    (r"for ([\w\s]+(?:construction|building|use|supply|purpose|application|project|hospital|school|office|hostel))",),
    (r"(?:used?|using) for ([\w\s]+)",),
]

_INDUSTRY_MAP = {
    "construction": ["construction", "building", "foundation", "slab", "beam", "column", "concrete", "masonry", "civil"],
    "food": ["food", "atta", "flour", "water", "drinking", "edible", "hostel", "canteen"],
    "electrical": ["electrical", "cable", "wire", "led", "lamp", "bulb", "switch"],
    "plumbing": ["pipe", "plumbing", "water supply", "drainage"],
    "manufacturing": ["steel", "tmt", "bar", "structural"],
    "general": [],
}


def _local_fallback_parse(query: str) -> Dict:
    """
    Local regex/keyword fallback for requirement understanding.
    Does NOT call Gemini. Used when Gemini is unavailable or rate-limited.
    Returns a structured requirement dict.
    """
    q = query.lower()
    product = None
    product_type = None

    for pattern, p, pt in _PRODUCT_ALIASES:
        if re.search(pattern, q, re.IGNORECASE):
            product = p
            product_type = pt
            break

    # Purpose extraction
    purpose = ""
    for (pat,) in _PURPOSE_PATTERNS:
        m = re.search(pat, q, re.IGNORECASE)
        if m:
            purpose = m.group(1).strip().rstrip(".,;")
            break

    # Industry detection
    industry = "general"
    for ind, keywords in _INDUSTRY_MAP.items():
        if any(kw in q for kw in keywords):
            industry = ind
            break

    # If still no product match, extract noun phrase after "procure"/"need"/"require"
    if not product:
        m = re.search(
            r"(?:procur(?:e|ing)|need|requir(?:e|ing)|purchas(?:e|ing)|buy(?:ing)?)\s+([\w\s]+?)(?:\s+for|\s+to|\.$|$)",
            query, re.IGNORECASE
        )
        if m:
            candidate = m.group(1).strip()
            # Only use if it's short (not the whole sentence)
            if len(candidate.split()) <= 6:
                product = candidate.lower()
                product_type = product.replace(" ", "_")

    if not product:
        # Last resort: use first 3 words
        words = query.split()
        product = " ".join(words[:3]).lower().strip(".,;?")
        product_type = product.replace(" ", "_")

    # Build BIS search queries
    bis_queries = [product]
    if product_type and product_type != "unknown" and product_type != product:
        bis_queries.append(product_type.replace("_", " "))
    if purpose:
        bis_queries.append(f"{product} for {purpose}")

    return {
        "language": "English",
        "product": product,
        "product_type": product_type or "unknown",
        "material": None,
        "packaging": None,
        "purpose": purpose or "general procurement",
        "applications": [],
        "industry": industry,
        "technical_attributes": [],
        "procurement_intent": True,
        "bis_search_queries": list(dict.fromkeys(bis_queries)),  # deduplicate
        "_source": "local_fallback",
    }


def _validate_requirement(result: Dict, raw_query: str) -> Dict:
    """
    Validate that the parsed requirement makes sense.
    Rejects cases where 'product' is the full user query (Gemini echoed back the input).
    """
    product = result.get("product", "")

    # If product looks like a full sentence (>6 words or matches the raw query), it's bad
    is_full_sentence = (
        len(product.split()) > 6 or
        product.strip().lower() == raw_query.strip().lower()[:len(product)].lower()
    )
    if is_full_sentence:
        return None  # Signal caller to use fallback

    # If product_type is "unknown" but product is meaningful, try to derive type
    if result.get("product_type") == "unknown" and product:
        # Check aliases for the product
        for pattern, p, pt in _PRODUCT_ALIASES:
            if re.search(pattern, product, re.IGNORECASE):
                result["product"] = p
                result["product_type"] = pt
                break

    return result


# ============================================================
# A. REQUIREMENT UNDERSTANDING
# ============================================================

def parse_requirement(query: str, input_type: str = "product_description") -> Dict:
    """
    Translate user query into Canonical Requirement Object.
    Supports multilingual input.
    Falls back to local regex parser if Gemini is unavailable.
    """
    system = textwrap.dedent("""
        You are an expert procurement standards analyst for the Bureau of Indian Standards (BIS).
        Understand a procurement requirement (possibly multilingual) and extract structured information.

        CRITICAL RULES:
        1. Identify the SPECIFIC product name only — 1 to 4 words maximum.
           * "Our department is procuring 50 kg bags of cement for constructing a hospital" -> product: "cement"
           * "We want to procure Ordinary Portland Cement (OPC) for building construction" -> product: "cement", product_type: "ordinary_portland_cement"
           * "We need stainless steel water bottles for office use" -> product: "water bottle", product_type: "stainless_steel_water_bottle"
           * "We need packaged drinking water for a government event" -> product: "drinking water", product_type: "packaged_drinking_water"
           * "masonry cement" -> product: "cement", product_type: "masonry_cement"
        2. NEVER set product to the full user sentence. If you cannot identify a clear product, set product to the most likely noun.
        3. product_type must be a snake_case string describing the specific variant.
        4. Generate 3-4 short BIS search queries (5 words or fewer each) that will return good results on the BIS portal.
        5. Output ONLY valid JSON — no markdown, no extra text.

        Output schema (all fields required):
        {
          "language": "English",
          "product": "short product name (1-4 words)",
          "product_type": "snake_case_variant",
          "material": "material or null",
          "packaging": "packaging info or null",
          "purpose": "intended use",
          "applications": ["list of applications"],
          "industry": "industry sector",
          "technical_attributes": ["specs from query"],
          "procurement_intent": true,
          "bis_search_queries": ["query1", "query2", "query3"]
        }
    """)

    # Try Gemini first
    gemini_result = None
    try:
        prompt = f"Input Type: {input_type}\nUser Input: {query}"
        text = _generate(system, prompt)
        parsed = _parse_json(text)
        if isinstance(parsed, dict):
            validated = _validate_requirement(parsed, query)
            if validated:
                gemini_result = validated
    except Exception as e:
        print(f"[Gemini] parse_requirement failed: {e}")

    # Use local fallback if Gemini failed or returned a bad result
    if gemini_result is None:
        print("[Requirement] Using local fallback parser.")
        gemini_result = _local_fallback_parse(query)

    # Final safety: ensure bis_search_queries is always populated
    if not gemini_result.get("bis_search_queries"):
        gemini_result["bis_search_queries"] = [gemini_result.get("product", query)]

    # Attach the original raw query separately
    gemini_result["raw_query"] = query

    return gemini_result


# ============================================================
# B. TENDER ANALYSIS
# ============================================================

def analyze_tender(tender_text: str, known_standards: List[Dict] = None) -> Dict:
    """
    Analyze extracted tender text for procurement gaps and issues.
    Does NOT invent IS numbers — only identifies those present in the text.
    """
    context = ""
    if known_standards:
        context = "\n\nVerified current BIS standards in our database:\n"
        for s in known_standards[:20]:
            context += f"  - {s.get('is_number','')}: {s.get('title','')}\n"

    system = textwrap.dedent("""
        You are a procurement compliance expert analyzing a tender document.
        Extract structured information and identify issues.
        IMPORTANT: Do NOT invent IS numbers or standards. Only identify those present in the text.
        Output ONLY valid JSON.

        Output schema:
        {
          "products": ["list of products/materials being procured"],
          "referenced_standards": [{"is_number": "IS XXXX:YYYY", "page": 0, "section": ""}],
          "technical_requirements": ["extracted technical specifications"],
          "certification_requirements": ["certification requirements found"],
          "potential_gaps": [
            {"type": "MISSING_STANDARD|MISSING_TEST_METHOD|MISSING_CERTIFICATION|MISSING_TECHNICAL_PARAMETER",
             "description": "what is missing", "page": 0, "section": ""}
          ],
          "outdated_references": [{"is_number": "IS XXXX:YYYY", "reason": "why outdated", "page": 0}],
          "ambiguous_requirements": [{"text": "exact text", "issue": "what is ambiguous", "page": 0, "section": ""}],
          "conflicting_requirements": [{"description": "conflict description", "items": []}]
        }
    """)

    prompt = f"Tender Document Text:\n{tender_text[:8000]}{context}"
    text = _generate(system, prompt)
    result = _parse_json(text)
    if not isinstance(result, dict):
        return {
            "products": [], "referenced_standards": [],
            "technical_requirements": [], "certification_requirements": [],
            "potential_gaps": [], "outdated_references": [],
            "ambiguous_requirements": [], "conflicting_requirements": [],
        }
    return result


# ============================================================
# C. CANDIDATE CLASSIFICATION
# ============================================================

def classify_candidate(candidate: Dict, requirement: Dict) -> Dict:
    """
    Classify a BIS candidate against the user requirement.
    Returns classification + confidence + reason.
    """
    system = textwrap.dedent("""
        Classify a BIS standard against a procurement requirement.
        Choose exactly ONE category:
          DIRECT_PRODUCT     - Standard directly governs the exact product
          PRODUCT_VARIANT    - Standard covers a variant/subtype of the product
          RELATED_PRODUCT    - Standard covers a related but different product
          TEST_METHOD        - Standard describes how to test the product
          SAMPLING           - Standard describes sampling procedures
          TERMINOLOGY        - Standard defines terms and glossary
          SAFETY             - Standard describes safety requirements
          INSTALLATION       - Standard describes installation or use
          PACKAGING          - Standard describes packaging requirements
          STORAGE_HANDLING   - Standard describes storage and handling
          CODE_OF_PRACTICE   - Standard provides code of practice/guidelines
          CERTIFICATION      - Standard governs certification marks
          EQUIPMENT          - Standard covers equipment used to make the product
          PROCESSING_OR_TREATMENT - Standard covers processing/treatment
          UNRELATED          - Standard is not relevant

        Key rules:
        - "stainless steel water bottle" -> water bottle std = DIRECT_PRODUCT, drinking water std = UNRELATED
        - "masonry cement" -> masonry cement = DIRECT_PRODUCT, ordinary Portland cement = RELATED_PRODUCT
        - Output ONLY valid JSON:
        {"classification": "CATEGORY", "confidence": 0.95, "reason": "Brief evidence-based explanation"}
    """)

    prompt = (
        f"Requirement:\n  Product: {requirement.get('product','')}\n"
        f"  Type: {requirement.get('product_type','')}\n"
        f"  Purpose: {requirement.get('purpose','')}\n\n"
        f"Candidate:\n  IS Number: {candidate.get('is_number','')}\n"
        f"  Title: {candidate.get('title','')}\n"
        f"  Scope: {str(candidate.get('scope',''))[:400]}\n"
        f"  Category: {candidate.get('category','')}\n"
        f"  Sub-category: {candidate.get('sub_category','')}"
    )
    try:
        text = _generate(system, prompt)
        result = _parse_json(text)
        if not isinstance(result, dict):
            raise ValueError("Parse error")
        return result
    except Exception as e:
        print(f"[Gemini] classify_candidate failed: {e}")
        # Local fallback classification — must not incorrectly penalise multi-part standards
        product = requirement.get('product', '').lower()
        product_type = requirement.get('product_type', '').lower().replace('_', ' ')
        title = (candidate.get('title') or '').lower()

        # Keywords that indicate a pure test/sampling/method standard
        test_keywords = [
            'method of test', 'methods of test', 'sampling method',
            'test methods', 'testing method', 'sampling procedure',
        ]
        is_test_std = any(kw in title for kw in test_keywords)

        if product and product in title:
            if is_test_std:
                return {"classification": "TEST_METHOD", "confidence": 0.6,
                        "reason": "Local fallback: title is a dedicated test-method standard."}
            elif product_type and product_type != 'unknown' and product_type in title:
                return {"classification": "DIRECT_PRODUCT", "confidence": 0.85,
                        "reason": f"Local fallback: title contains exact product type '{product_type}'."}
            else:
                return {"classification": "DIRECT_PRODUCT", "confidence": 0.65,
                        "reason": "Local fallback: title contains product keyword."}

        # Product type alone in title (e.g. 'led lamp' even if product=='led light')
        if product_type and product_type != 'unknown' and product_type in title:
            return {"classification": "DIRECT_PRODUCT", "confidence": 0.75,
                    "reason": f"Local fallback: title contains product type '{product_type}'."}

        return {"classification": "UNRELATED", "confidence": 0.0,
                "reason": "Local fallback: no keyword match."}


# ============================================================
# D. ALLIED RELATIONSHIP EXTRACTION
# ============================================================

def extract_allied_relationships(
    primary_standard: Dict,
    candidate_standards: List[Dict],
) -> List[Dict]:
    """
    Identify allied relationships using ONLY metadata present in the provided data.
    Never invents IS numbers or references.
    """
    system = textwrap.dedent("""
        Identify relationships between a primary BIS standard and other standards.
        Use ONLY the metadata provided. Do NOT invent IS numbers or references.
        If insufficient evidence, return an empty list [].

        Relationship types: normative_reference, test_method, sampling_method, safety,
        installation, terminology, classification, related_product, component, packaging,
        cross_reference, supersedes, superseded_by, amendment

        Output ONLY a valid JSON array:
        [
          {
            "standard": "IS XXXXX:YYYY",
            "title": "title if known",
            "relationship": "relationship_type",
            "confidence": 0.95,
            "evidence": "what in the metadata supports this relationship",
            "source": "mongodb_metadata",
            "verified": false
          }
        ]
    """)

    primary_info = {
        "is_number": primary_standard.get("is_number", ""),
        "title": primary_standard.get("title", ""),
        "normative_references": primary_standard.get("normative_references", []),
        "test_methods": primary_standard.get("test_methods", []),
        "safety_standards": primary_standard.get("safety_standards", []),
        "installation_standards": primary_standard.get("installation_standards", []),
        "cross_references": primary_standard.get("cross_references", []),
        "supersedes": primary_standard.get("supersedes", []),
        "superseded_by": primary_standard.get("superseded_by", []),
        "superseding_is": primary_standard.get("superseding_is", ""),
        "amendments": primary_standard.get("amendments", []),
        "related_standards": primary_standard.get("related_standards", []),
    }
    candidates_info = [
        {"is_number": c.get("is_number", ""), "title": c.get("title", "")}
        for c in candidate_standards[:30]
    ]
    prompt = (
        f"Primary Standard:\n{json.dumps(primary_info, indent=2)}\n\n"
        f"Available candidate standards:\n{json.dumps(candidates_info, indent=2)}"
    )
    try:
        text = _generate(system, prompt)
        result = _parse_json(text, fallback=[])
        if not isinstance(result, list):
            return []
        return result
    except Exception:
        return []


# ============================================================
# E. LOCAL EXPLANATION (No Gemini needed)
# ============================================================

def generate_local_explanation(
    standard: Dict,
    requirement: Dict,
    classification: str,
    score: float,
) -> Dict:
    """
    Generates a rich, procurement-useful explanation using all available BIS data.
    No Gemini required. Covers: why recommended, BIS status, amendments, normative refs,
    certification, lifecycle, scope, committee, etc.
    """
    is_num = standard.get("is_number", "")
    title = standard.get("title", "") or ""
    product = requirement.get("product", "") or ""
    product_type = (requirement.get("product_type") or "").replace("_", " ")
    purpose = requirement.get("purpose") or "general procurement"
    dept = standard.get("department") or ""
    committee = standard.get("technical_committee") or ""
    scope = standard.get("scope") or ""
    bis_status = standard.get("bis_status") or standard.get("status") or "Current"
    amendments = standard.get("amendments") or []
    norm_refs = standard.get("normative_references") or []
    cert = standard.get("certification") or {}
    lifecycle = standard.get("lifecycle") or {}
    type_of_std = standard.get("type_of_standard") or ""
    degree_eq = standard.get("degree_of_equivalence") or ""
    superseding = lifecycle.get("superseding_is") or standard.get("superseding_is") or ""
    num_revisions = lifecycle.get("number_of_revisions") or ""
    num_amendments = lifecycle.get("number_of_amendments") or ""
    reaffirmation = lifecycle.get("reaffirmation_year") or ""

    parts = []

    # --- WHY RECOMMENDED ---
    relevance_label = "HIGH" if score >= 0.75 else "MEDIUM" if score >= 0.5 else "LOW"
    
    if classification == "DIRECT_PRODUCT":
        why = f"This is the PRIMARY Indian Standard directly governing {product_type or product or title}. "
        if purpose and purpose not in ("general procurement", "unknown"):
            why += f"It is directly applicable to your procurement of {product_type or product} for {purpose}."
        else:
            why += f"It should be the mandatory reference standard for this procurement."
    elif classification == "PRODUCT_VARIANT":
        why = f"This standard covers a specific variant of {product} ({title}). It applies if this exact variant is required for {purpose}."
    elif classification == "NORMATIVE_REFERENCE":
        why = f"This standard is normatively referenced by the primary product standard and must be consulted alongside it."
    elif classification in ("TEST_METHOD", "SAMPLING"):
        why = f"This standard specifies the test/verification methods for {product or product_type} products."
    elif classification == "SAFETY":
        why = f"This standard defines safety requirements for {product or product_type} products."
    else:
        why = f"This standard is related to the procurement of {product or product_type} for {purpose}."

    applicability = ""
    if scope and len(scope) > 20:
        applicability = scope[:400].rstrip() + ("…" if len(scope) > 400 else "")
    else:
        applicability = f"Applicable for {title}."

    why_not_primary = ""
    if classification != "DIRECT_PRODUCT":
        if classification == "PRODUCT_VARIANT":
            why_not_primary = f"This standard applies to a variant ({title}) which is a different type from the {product} specified in the requirement."
        elif classification in ("TEST_METHOD", "SAMPLING"):
            why_not_primary = "It is a testing/sampling method rather than the product specification itself."
        else:
            why_not_primary = "This standard supports the primary product but does not directly govern the product specification."

    cert_status = cert.get("status") if isinstance(cert, dict) else str(cert) if cert else ""
    checks = []
    checks.append(f"- Verify current BIS status ({bis_status}).")
    if amendments:
        checks.append(f"- Check latest amendments (found {len(amendments)}).")
    if cert_status and cert_status.lower() not in ("n/a", "none", "unknown", ""):
        checks.append(f"- Verify applicable BIS conformity/certification requirements ({cert_status}).")
    
    return {
        "relevance_score": relevance_label,
        "confidence": score,
        "recommendation_level": "PRIMARY" if classification == "DIRECT_PRODUCT" and score >= 0.75 else "ALLIED",
        "relationship_type": classification,
        "why_recommended": why,
        "applicability": applicability,
        "procurement_checks": "\n".join(checks),
        "why_not_primary": why_not_primary,
        "evidence": "Derived locally from BIS metadata"
    }


# ============================================================
# E2. AI EXPLANATION (Gemini, optional upgrade)
# ============================================================

def generate_explanation(
    standard: Dict,
    requirement: Dict,
    classification: str,
    score: float,
) -> Dict:
    """
    Generate a human-readable explanation for why a standard is recommended.
    ALWAYS uses local fallback first. Gemini is an optional upgrade when available.
    Never leaves the user with an empty explanation due to API errors.
    """
    # Always generate a local explanation first
    local_exp = generate_local_explanation(standard, requirement, classification, score)

    # Try Gemini for enhanced explanation (optional upgrade)
    system = textwrap.dedent("""
        You are a procurement standards advisor. Analyze a specific Indian Standard against a procurement requirement.
        Output ONLY valid JSON matching this schema:
        {
          "relevance_score": "HIGH|MEDIUM|LOW",
          "confidence": 0.0,
          "recommendation_level": "PRIMARY|ALLIED",
          "relationship_type": "string",
          "why_recommended": "Brief explanation of why it is relevant",
          "applicability": "Derived from scope",
          "procurement_checks": "- Verify current BIS status\n- Check amendments",
          "why_not_primary": "If not PRIMARY, explain why (e.g. it is a test method or variant)",
          "evidence": "Derived from BIS metadata"
        }
    """)
    prompt = (
        f"Requirement: {requirement.get('product','')} ({requirement.get('purpose','')}) — "
        f"{requirement.get('product_type','')}\n"
        f"Standard: {standard.get('is_number','')} — {standard.get('title','')}\n"
        f"Classification: {classification} | Score: {score}\n"
        f"Department: {standard.get('department','')}\n"
        f"BIS Scope: {str(standard.get('scope',''))[:300]}"
    )
    try:
        gemini_text = _generate(system, prompt).strip()
        parsed = _parse_json(gemini_text)
        if isinstance(parsed, dict) and "why_recommended" in parsed:
            # Merge with local to ensure no empty fields
            for k, v in local_exp.items():
                if k not in parsed or not parsed[k]:
                    parsed[k] = v
            # Enforce strict recommendation level
            parsed["recommendation_level"] = "PRIMARY" if classification == "DIRECT_PRODUCT" and score >= 0.75 else "ALLIED"
            return parsed
    except Exception:
        pass  # Silently fall back to local

    return local_exp


# ============================================================
# F. DEEP EXTRACTION
# ============================================================

def extract_deep_metadata(detail_page_text: str) -> Dict:
    """
    Extracts structured scope, applicability, relationships, safety,
    and test methods from the raw text of a BIS standard detail page.
    """
    system = textwrap.dedent("""
        You are a procurement standards analyst for BIS.
        Your task is to extract rich metadata from the text of a BIS standard detail page.
        Do NOT invent information. If it is not present in the text, leave it blank or empty.
        
        Extract:
        1. Scope and Applicability (combine into a coherent paragraph)
        2. Normative References (list of IS numbers)
        3. Test Methods (list of IS numbers or descriptions)
        4. Safety Requirements (list of IS numbers or descriptions)
        5. Installation/Storage/Handling requirements
        6. Related/Allied Standards (list of IS numbers)
        7. Cross References (list of IS numbers)

        Output ONLY valid JSON matching this schema:
        {
          "scope": "string or null",
          "normative_references": ["list of strings"],
          "test_methods": ["list of strings"],
          "safety_standards": ["list of strings"],
          "installation_requirements": ["list of strings"],
          "related_standards": ["list of strings"],
          "cross_references": ["list of strings"]
        }
    """)

    prompt = f"Detail Page Text:\n{detail_page_text[:15000]}"
    text = _generate(system, prompt)
    result = _parse_json(text)
    if not isinstance(result, dict):
        return {
            "scope": None,
            "normative_references": [],
            "test_methods": [],
            "safety_standards": [],
            "installation_requirements": [],
            "related_standards": [],
            "cross_references": []
        }
    return result
