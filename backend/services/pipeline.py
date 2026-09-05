"""
backend/services/pipeline.py

Main analysis pipeline — BIS-first, MongoDB-as-cache.

Sequence:
1. Requirement Understanding (Gemini with local fallback)
2. LIVE BIS DISCOVERY → collect_from_keyword → saves full BIS data to MongoDB
3. Retrieve full MongoDB records (now containing scope, normative_refs, amendments)
4. Completeness check (3 levels: BASIC/OFFICIAL/ENRICHED)
5. Freshness check (if complete, lightweight compare)
6. AI classification (with local fallback — no Gemini needed for basic routing)
7. Local explanation generation (Gemini only as optional upgrade)
8. Final structured response

Key rules:
- BIS data ALWAYS wins over MongoDB cache
- Gemini failure NEVER blocks BIS data from being returned
- scope/normative_references/amendments come from BIS scraper, not Gemini
"""

from typing import Dict, List
import time

from backend.db_client import get_standards_collection
from backend.services.verification import determine_verification_status, merge_bis_and_mongo

# We no longer hardcode PRIMARY_CLASSIFICATIONS, we rely on the structured explanation.


def _trigger_bis_discovery(queries: List[str]) -> List[Dict]:
    """
    Trigger live BIS discovery for a list of queries.
    Now returns FULL MongoDB records (including scope, normative_refs, amendments)
    after BIS scraping and MongoDB save.
    """
    try:
        from backend.bis.client import discover_standards_by_keyword
    except ImportError:
        print("[Pipeline] Error importing BIS client.")
        return []

    candidates = {}

    for kw in queries:
        kw = kw.strip()
        if not kw:
            continue
        print(f"[Pipeline] Live BIS Discovery for: '{kw}'")
        try:
            # discover_standards_by_keyword now returns full MongoDB records
            results = discover_standards_by_keyword(kw, limit=10)
            if results:
                for r in results:
                    is_num = r.get("is_number")
                    if is_num and is_num not in candidates:
                        candidates[is_num] = r
                        print(f"[Pipeline]   Found: {is_num} | scope={'YES' if r.get('scope') else 'NO'} | refs={len(r.get('normative_references') or [])}")
        except Exception as e:
            print(f"[Pipeline] BIS Discovery failed for query '{kw}': {e}")
            continue

    return list(candidates.values())


def _score_to_label(score: float) -> str:
    if score >= 0.75: return "HIGH"
    if score >= 0.50: return "MEDIUM"
    if score >= 0.25: return "LOW"
    return "VERY LOW"


def _local_classify(std: Dict, requirement: Dict) -> Dict:
    """
    Local deterministic classification when Gemini is unavailable.
    Uses title keywords and product type matching.
    """
    import re
    title = (std.get("title") or "").lower()
    product = requirement.get("product", "").lower()
    product_type = requirement.get("product_type", "").lower().replace("_", " ")

    # Check for withdrawn status
    bis_status = (std.get("bis_status") or std.get("status") or "").lower()
    if bis_status == "withdrawn":
        return {"classification": "UNRELATED", "confidence": 0.1, "reason": "Standard is withdrawn."}

    # Check exact product type match (e.g. "ordinary portland cement" in title)
    if product_type and product_type != "unknown":
        if product_type in title:
            return {"classification": "DIRECT_PRODUCT", "confidence": 0.9,
                    "reason": f"Title contains exact product type '{product_type}'."}

    # Check product keyword match
    if product and len(product) > 2 and product in title:
        # Could be direct or variant — check for qualifiers
        qualifiers = ["test", "method", "sampling", "testing", "analysis", "equipment",
                      "reinforcement", "concrete pipe", "slag", "pozzolana"]
        for q in qualifiers:
            if q in title:
                return {"classification": "RELATED_PRODUCT", "confidence": 0.6,
                        "reason": f"Title contains '{product}' but also qualifier '{q}'."}
        return {"classification": "DIRECT_PRODUCT", "confidence": 0.75,
                "reason": f"Title contains product keyword '{product}'."}

    # Check for test method indicators
    test_indicators = ["test method", "testing", "methods of test", "specification for test",
                       "method of sampling", "sampling", "chemical analysis"]
    if any(ti in title for ti in test_indicators):
        return {"classification": "TEST_METHOD", "confidence": 0.7,
                "reason": "Standard title indicates test/sampling methods."}

    # Default to related
    return {"classification": "RELATED_PRODUCT", "confidence": 0.4,
            "reason": "Local classification fallback — possible relation."}


def run_analysis(
    query: str,
    input_type: str = "product_description",
    enable_bis_discovery: bool = True,
) -> Dict:
    """
    Full BIS-first analysis pipeline.
    Returns the complete structured API response.
    """
    t0 = time.time()
    run_meta = {
        "live_bis_used": False,
        "mongo_cache_used": False,
        "deep_extraction_performed": False,
        "gemini_used": False,
        "local_fallback_used": False,
    }

    result = {
        "requirement": {},
        "primary_standards": [],
        "allied_standards": {
            "normative_references": [],
            "test_methods": [],
            "safety": [],
            "installation": [],
            "terminology": [],
            "cross_references": [],
            "related_products": [],
        },
        "tender_analysis": {},
        "timings": {},
        "warnings": [],
        "run_meta": run_meta,
    }

    # ----------------------------------------------------------
    # STEP 1: Requirement Understanding
    # Gemini first, local fallback on any failure
    # ----------------------------------------------------------
    t_req = time.time()
    requirement = None

    try:
        from backend.ai.gemini_client import parse_requirement, _validate_requirement
        raw = parse_requirement(query, input_type)
        requirement = _validate_requirement(raw, query)
        if requirement:
            run_meta["gemini_used"] = True
    except Exception as e:
        print(f"[Pipeline] Gemini parse_requirement failed: {e}")

    if not requirement:
        from backend.ai.gemini_client import _local_fallback_parse
        requirement = _local_fallback_parse(query)
        run_meta["local_fallback_used"] = True
        result["warnings"].append("Gemini unavailable — used local fallback requirement parser.")

    # Final validation: product must not be the full query
    product = requirement.get("product", "")
    if not product or len(product.split()) > 6 or product.strip().lower() == query.strip().lower():
        from backend.ai.gemini_client import _local_fallback_parse
        requirement = _local_fallback_parse(query)
        run_meta["local_fallback_used"] = True

    print("[Pipeline] === REQUIREMENT UNDERSTOOD ===")
    print(f"[Pipeline]   Product  : {requirement.get('product')}")
    print(f"[Pipeline]   Type     : {requirement.get('product_type')}")
    print(f"[Pipeline]   Purpose  : {requirement.get('purpose')}")
    print(f"[Pipeline]   Industry : {requirement.get('industry')}")
    print(f"[Pipeline]   Queries  : {requirement.get('bis_search_queries')}")
    print(f"[Pipeline]   Source   : {requirement.get('_source', 'gemini')}")
    print("[Pipeline] ========================================")

    result["requirement"] = requirement
    search_queries = requirement.get("bis_search_queries") or [requirement.get("product", query)]
    result["timings"]["requirement_understanding"] = round(time.time() - t_req, 3)

    # ----------------------------------------------------------
    # STEP 2: Live BIS Discovery
    # Returns full MongoDB records with scope/normative_refs/amendments
    # ----------------------------------------------------------
    t_bis = time.time()
    bis_candidates = []

    if enable_bis_discovery:
        bis_candidates = _trigger_bis_discovery(search_queries)
        if bis_candidates:
            run_meta["live_bis_used"] = True
            print(f"[Pipeline] BIS Discovery found {len(bis_candidates)} candidates.")
        else:
            print("[Pipeline] Live BIS Discovery returned 0 results.")

    result["timings"]["live_bis_discovery"] = round(time.time() - t_bis, 3)

    # ----------------------------------------------------------
    # STEP 3: MongoDB Completeness Check & Optional Refresh
    # ----------------------------------------------------------
    t_mongo = time.time()
    coll = get_standards_collection()
    verified_candidates = []
    deep_extraction_count = 0
    MAX_DEEP = 3

    from backend.services.freshness import get_completeness_level, perform_lightweight_freshness_check, trigger_deep_extraction

    if not bis_candidates:
        result["warnings"].append("Live BIS Discovery yielded no results. Falling back to MongoDB cache.")
        run_meta["mongo_cache_used"] = True
        try:
            from backend.services.retrieval import hybrid_retrieve
            scored_mongo = hybrid_retrieve(requirement, top_k=10)
            for sm in scored_mongo:
                std = sm["standard"]
                std["verification_source"] = "mongodb_cache"
                verified_candidates.append(std)
        except Exception as e:
            result["warnings"].append(f"MongoDB fallback also failed: {e}")
    else:
        # bis_candidates are already full MongoDB records from client.py
        for std in bis_candidates:
            is_num = std.get("is_number")
            if not is_num:
                continue

            # Determine completeness from the record we already have
            level = get_completeness_level(std)
            official_url = std.get("official_bis_url") or std.get("detail_url", "")

            print(f"[Pipeline] {is_num}: completeness={level} | scope={'YES' if std.get('scope') else 'NO'} | refs={len(std.get('normative_references') or [])}")

            # If only BASIC_COMPLETE or INCOMPLETE, try deep extraction to get full BIS data
            if level in ("INCOMPLETE", "BASIC_COMPLETE") and official_url and deep_extraction_count < MAX_DEEP:
                # Pre-filter: skip obviously unrelated standards
                title = (std.get("title") or "").lower()
                product_kw = requirement.get("product", "").lower()
                product_type_kw = requirement.get("product_type", "").lower().replace("_", " ")

                is_relevant = (
                    not title or  # No title yet → extract
                    (product_kw and product_kw in title) or
                    (product_type_kw and product_type_kw != "unknown" and product_type_kw in title)
                )
                is_withdrawn = (std.get("bis_status") or "").lower() == "withdrawn" or title == "withdrawn"

                if is_relevant and not is_withdrawn:
                    print(f"[Pipeline] Triggering deep extraction for {is_num} (level={level})")
                    deep_data = trigger_deep_extraction(is_num, official_url)
                    deep_extraction_count += 1
                    run_meta["deep_extraction_performed"] = True

                    if deep_data:
                        # Save enriched data to MongoDB
                        try:
                            coll.update_one(
                                {"is_number": is_num},
                                {"$set": deep_data},
                                upsert=True
                            )
                            # Fetch fresh record
                            fresh = coll.find_one({"is_number": is_num}, {"_id": 0})
                            if fresh:
                                std = fresh
                        except Exception as e:
                            print(f"[Pipeline] MongoDB update failed for {is_num}: {e}")
                            std.update(deep_data)
                else:
                    if is_withdrawn:
                        print(f"[Pipeline] Skipping deep extraction for {is_num} (withdrawn)")
                    else:
                        print(f"[Pipeline] Skipping deep extraction for {is_num} (unrelated to '{product_kw}')")

            # Ensure official_bis_url is always set
            if not std.get("official_bis_url") and official_url:
                std["official_bis_url"] = official_url

            std["verification_source"] = "official_bis_live"
            verified_candidates.append(std)

    result["timings"]["mongo_and_completeness"] = round(time.time() - t_mongo, 3)

    # ----------------------------------------------------------
    # STEP 4: AI Classification + Local Explanation
    # ----------------------------------------------------------
    t_cls = time.time()
    from backend.ai.gemini_client import classify_candidate, generate_explanation, generate_local_explanation

    product_req = requirement.get("product", "").lower()

    for std in verified_candidates:
        is_num = std.get("is_number", "")

        # Status check
        verification = determine_verification_status(std)
        bis_status = (std.get("bis_status") or std.get("status") or "").lower()
        if bis_status in ("withdrawn", "superseded", "obsolete", "cancelled"):
            verification["lifecycle_status"] = bis_status.capitalize()
            verification["eligible_for_recommendation"] = False

        # Classification — try Gemini, fall back to local
        classification = None
        confidence = 0.5
        evidence = ""

        try:
            cls_result = classify_candidate(std, requirement)
            classification = cls_result.get("classification", "UNRELATED")
            evidence = cls_result.get("reason", "")
            confidence = float(cls_result.get("confidence", 0.5))
        except Exception:
            pass

        if not classification:
            cls_result = _local_classify(std, requirement)
            classification = cls_result.get("classification", "RELATED_PRODUCT")
            evidence = cls_result.get("reason", "Local classification.")
            confidence = float(cls_result.get("confidence", 0.5))

        if classification == "UNRELATED":
            continue

        # Format certification
        cert = std.get("certification") or {}
        if isinstance(cert, dict):
            cert_display = cert.get("status") or cert.get("type") or ""
            cert_mandatory = cert.get("mandatory")
        else:
            cert_display = str(cert)
            cert_mandatory = None

        # Generate explanation — local first, Gemini optional
        explanation = generate_explanation(std, requirement, classification, confidence)

        # Build normative_references display:
        # BIS-sourced referred standards are in normative_references as list of dicts
        norm_refs = std.get("normative_references") or []
        # Also check legacy test_methods / related_standards fields
        test_methods = std.get("test_methods") or []
        amendments = std.get("amendments") or []

        formatted = {
            "is_number": is_num,
            "title": std.get("title", ""),
            "structured_explanation": explanation,
            "explanation": explanation.get("why_recommended", "") if isinstance(explanation, dict) else explanation,
            "classification": classification,
            "relevance": _score_to_label(confidence),
            "score": round(confidence, 3),
            "verification": verification,
            "evidence": evidence,
            # BIS-extracted fields (source: BIS)
            "scope": std.get("scope") or None,
            "bis_status": std.get("bis_status") or std.get("status") or "Unknown",
            "normative_references": norm_refs,
            "test_methods": test_methods,
            "amendments": amendments,
            "safety_standards": std.get("safety_standards") or [],
            "installation_requirements": std.get("installation_requirements") or [],
            "related_standards": std.get("related_standards") or [],
            "cross_references": std.get("cross_references") or [],
            "data_source": std.get("data_source", "BIS"),
            # Certification
            "certification": {
                "status": cert_display,
                "mandatory": cert_mandatory,
                "scheme": std.get("certification_scheme") or None,
            },
            # Lifecycle
            "lifecycle": {
                "status": std.get("bis_status") or std.get("status", "Unknown"),
                "number_of_revisions": std.get("number_of_revisions"),
                "number_of_amendments": std.get("number_of_amendments"),
                "reaffirmation_year": std.get("reaffirmation_year"),
                "reviewed_in": std.get("reviewed_in"),
                "supersedes": std.get("supersedes") or [],
                "superseded_by": std.get("superseded_by") or [],
                "superseding_is": std.get("superseding_is"),
            },
            "department": std.get("department"),
            "technical_committee": std.get("technical_committee"),
            "type_of_standard": std.get("type_of_standard"),
            "degree_of_equivalence": std.get("degree_of_equivalence"),
            "official_bis_url": std.get("official_bis_url", ""),
            "last_verified": std.get("last_verified", ""),
            "verification_source": std.get("verification_source", ""),
            "completeness_level": get_completeness_level(std),
        }

        # Route to correct bucket
        # Route to correct bucket based on the explanation's recommendation level
        rec_level = explanation.get("recommendation_level") if isinstance(explanation, dict) else "ALLIED"

        if rec_level == "PRIMARY" and verification.get("eligible_for_recommendation"):
            result["primary_standards"].append(formatted)
        elif classification == "TEST_METHOD":
            result["allied_standards"]["test_methods"].append(formatted)
        elif classification == "SAFETY":
            result["allied_standards"]["safety"].append(formatted)
        elif classification == "INSTALLATION":
            result["allied_standards"]["installation"].append(formatted)
        elif classification == "TERMINOLOGY":
            result["allied_standards"]["terminology"].append(formatted)
        elif classification in ("CROSS_REFERENCE", "NORMATIVE_REFERENCE"):
            result["allied_standards"]["cross_references"].append(formatted)
        else:
            result["allied_standards"]["related_products"].append(formatted)

    result["timings"]["classification"] = round(time.time() - t_cls, 3)
    result["timings"]["total"] = round(time.time() - t0, 3)
    result["run_meta"] = run_meta

    print(f"[Pipeline] === COMPLETE in {result['timings']['total']}s ===")
    print(f"[Pipeline]   Primary: {len(result['primary_standards'])} | Allied: {sum(len(v) for v in result['allied_standards'].values())}")

    return result


def run_tender_analysis(pages: List[Dict]) -> Dict:
    """Analyze a tender document."""
    from backend.services.document_parser import combine_pages_text
    from backend.ai.gemini_client import analyze_tender

    tender_text = combine_pages_text(pages)

    try:
        coll = get_standards_collection()
        known = list(coll.find({}, {"_id": 0, "is_number": 1, "title": 1}).limit(50))
    except Exception:
        known = []

    try:
        analysis = analyze_tender(tender_text, known_standards=known)
    except Exception as e:
        analysis = {"error": str(e)}

    return {
        "pages_extracted": len(pages),
        "tender_analysis": analysis,
    }
