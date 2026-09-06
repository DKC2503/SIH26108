"""
backend/services/pipeline.py

Main analysis pipeline — Optimized with MongoDB-first retrieval, explicit timeouts,
Gemini availability tracking, single-query BIS discovery, and deterministic ranking.

Sequence:
1. Requirement Understanding (Gemini with local fallback)
2. Check MongoDB Cache First
   - If sufficient candidates found: return candidates (skip live BIS)
   - If insufficient: run ONE BIS discovery query using primary product
3. Hybrid ranking & deterministic composite scoring
4. Candidate classification & explanation (Gemini top-k max 3-5 if available, else local)
5. Structured pipeline stage status & debug timing logs
"""

from typing import Dict, List
import time

from backend.db_client import get_standards_collection
from backend.services.verification import determine_verification_status
from backend.ai.gemini_client import is_gemini_available


def _trigger_bis_discovery(primary_query: str) -> List[Dict]:
    """
    Trigger live BIS discovery for a single primary query term.
    Returns list of standard records after BIS scraping and MongoDB update.
    """
    if not primary_query or not primary_query.strip():
        return []

    try:
        from backend.bis.client import discover_standards_by_keyword
    except ImportError:
        print("[Pipeline] Error importing BIS client.")
        return []

    kw = primary_query.strip()
    print(f"[BIS] discovery started for: '{kw}'")
    try:
        results = discover_standards_by_keyword(kw, limit=10, timeout_sec=25.0)
        if results:
            print(f"[BIS] discovery completed: {len(results)} candidate(s) found for '{kw}'")
            return results
        else:
            print(f"[BIS] discovery completed: 0 results for '{kw}'")
    except Exception as e:
        print(f"[BIS] discovery failed for '{kw}': {e}")

    return []


def _score_to_label(score: float) -> str:
    if score >= 0.75:
        return "HIGH"
    if score >= 0.50:
        return "MEDIUM"
    if score >= 0.25:
        return "LOW"
    return "VERY LOW"


def _local_classify(std: Dict, requirement: Dict) -> Dict:
    """
    Local deterministic classification when Gemini is unavailable or for candidates beyond top-k.
    Uses title keywords, word stemming, and product type matching.
    """
    title = (std.get("title") or "").lower()
    product = requirement.get("product", "").lower()
    product_type = requirement.get("product_type", "").lower().replace("_", " ")
    verification_source = std.get("verification_source") or ""

    # Check for withdrawn status
    bis_status = (std.get("bis_status") or std.get("status") or "").lower()
    if bis_status == "withdrawn":
        return {"classification": "UNRELATED", "confidence": 0.1, "reason": "Standard is withdrawn."}

    # Check exact product type match (e.g. "ordinary portland cement" in title)
    if product_type and product_type != "unknown":
        if product_type in title:
            return {
                "classification": "DIRECT_PRODUCT",
                "confidence": 0.90,
                "reason": f"Title contains exact product type '{product_type}'.",
            }

    # Check product word overlap (handles singular/plural like pen vs pens, lamp vs lamps)
    product_words = [w for w in product.split() if len(w) > 2 and w not in ("for", "the", "and", "use", "with")]
    title_words = title.split()
    if product_words:
        matched_words = 0
        for pw in product_words:
            if any(pw in tw or tw in pw for tw in title_words):
                matched_words += 1
        
        if matched_words >= max(1, len(product_words) - 1):
            is_test = any(ti in title for ti in ["test method", "methods of test", "method of sampling", "sampling", "chemical analysis"])
            if is_test:
                return {
                    "classification": "TEST_METHOD",
                    "confidence": 0.75,
                    "reason": f"Title indicates test method for product '{product}'.",
                }
            return {
                "classification": "DIRECT_PRODUCT",
                "confidence": 0.85,
                "reason": f"Title matches key product words for '{product}'.",
            }

    # Check live BIS discovery candidate
    if verification_source == "official_bis_live" or std.get("data_source") == "BIS_LIVE":
        return {
            "classification": "DIRECT_PRODUCT",
            "confidence": 0.80,
            "reason": f"Live BIS candidate discovered for product keyword '{product}'.",
        }

    # Check for test method indicators
    test_indicators = [
        "test method", "testing", "methods of test", "specification for test",
        "method of sampling", "sampling", "chemical analysis",
    ]
    if any(ti in title for ti in test_indicators):
        return {
            "classification": "TEST_METHOD",
            "confidence": 0.70,
            "reason": "Standard title indicates test/sampling methods.",
        }

    return {
        "classification": "RELATED_PRODUCT",
        "confidence": 0.50,
        "reason": "Local classification fallback — possible relation.",
    }


def run_analysis(
    query: str,
    input_type: str = "product_description",
    enable_bis_discovery: bool = True,
) -> Dict:
    """
    Full analysis pipeline with performance optimizations, MongoDB-first retrieval,
    and Gemini availability checks.
    """
    t0 = time.time()
    run_meta = {
        "live_bis_used": False,
        "mongo_cache_used": False,
        "deep_extraction_performed": False,
        "gemini_used": False,
        "local_fallback_used": False,
        "bis_skipped_reason": None,
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
        "stages": [],
        "timings": {},
        "warnings": [],
        "run_meta": run_meta,
    }

    # ----------------------------------------------------------
    # STEP 1: REQUIREMENT UNDERSTANDING
    # ----------------------------------------------------------
    t_req = time.time()
    requirement = None
    gemini_active = is_gemini_available()

    if gemini_active:
        print("[Gemini] AVAILABLE — Attempting Gemini requirement parser")
        try:
            from backend.ai.gemini_client import parse_requirement, _validate_requirement
            raw = parse_requirement(query, input_type)
            requirement = _validate_requirement(raw, query)
            if requirement:
                run_meta["gemini_used"] = True
        except Exception as e:
            print(f"[Gemini] parse_requirement failed: {e}")
    else:
        print("[Gemini] UNAVAILABLE — Skipping Gemini requirement call")

    if not requirement:
        from backend.ai.gemini_client import _local_fallback_parse
        requirement = _local_fallback_parse(query)
        run_meta["local_fallback_used"] = True
        if not gemini_active:
            result["warnings"].append("Gemini unavailable — using local deterministic requirement parser.")

    # Validation check: ensure product is concise
    product = requirement.get("product", "")
    if not product or len(product.split()) > 6 or product.strip().lower() == query.strip().lower():
        from backend.ai.gemini_client import _local_fallback_parse
        requirement = _local_fallback_parse(query)
        run_meta["local_fallback_used"] = True

    t_req_ms = round((time.time() - t_req) * 1000, 1)
    print(f"[Timing] requirement parsing: {t_req_ms} ms")
    print(f"[Requirement] Product: '{requirement.get('product')}' | Type: '{requirement.get('product_type')}' | Purpose: '{requirement.get('purpose')}'")

    result["requirement"] = requirement

    # ----------------------------------------------------------
    # STEP 2: CHECK MONGODB CACHE FIRST
    # ----------------------------------------------------------
    t_mongo = time.time()
    from backend.db_client import is_mongo_available
    mongo_candidates = []
    scored_mongo = []

    if is_mongo_available():
        print("[MongoDB] retrieval started")
        from backend.services.retrieval import hybrid_retrieve
        try:
            scored_mongo = hybrid_retrieve(requirement, top_k=15)
            mongo_candidates = [sm["standard"] for sm in scored_mongo]
            run_meta["mongo_cache_used"] = True
        except Exception as e:
            print(f"[MongoDB] retrieval error: {e}")
            result["warnings"].append(f"MongoDB search warning: {e}")
    else:
        print("[MongoDB] UNAVAILABLE — Using local hybrid retrieval dataset")
        from backend.services.retrieval import hybrid_retrieve
        try:
            scored_mongo = hybrid_retrieve(requirement, top_k=15)
            mongo_candidates = [sm["standard"] for sm in scored_mongo]
            run_meta["mongo_cache_used"] = False
        except Exception as e:
            print(f"[Local Dataset] retrieval error: {e}")
            result["warnings"].append(f"Local dataset search warning: {e}")

    t_mongo_ms = round((time.time() - t_mongo) * 1000, 1)
    print(f"[Timing] MongoDB retrieval: {t_mongo_ms} ms ({len(mongo_candidates)} candidates retrieved)")

    # Evaluate if MongoDB candidates are sufficient
    is_sufficient = False
    if mongo_candidates and is_mongo_available():
        for sm in scored_mongo[:3]:
            details = sm.get("score_details", {})
            if details.get("phrase_score", 0) >= 0.8 or sm.get("score", 0) >= 0.65:
                is_sufficient = True
                break
        if len(mongo_candidates) >= 3 and any(sm.get("score_details", {}).get("phrase_score", 0) > 0 for sm in scored_mongo):
            is_sufficient = True

    # ----------------------------------------------------------
    # STEP 3: LIVE BIS DISCOVERY (ONLY IF INSUFFICIENT & ENABLED)
    # ----------------------------------------------------------
    t_bis = time.time()
    bis_candidates = []

    if not enable_bis_discovery:
        run_meta["bis_skipped_reason"] = "Disabled by user request"
        print("[BIS] discovery skipped: Disabled by request")
    elif is_sufficient:
        run_meta["bis_skipped_reason"] = "Sufficient candidates found in MongoDB"
        print("[BIS] discovery skipped: Sufficient candidates found in MongoDB")
    else:
        primary_term = requirement.get("product") or query
        bis_candidates = _trigger_bis_discovery(primary_term)

        # If primary search produced 0 results and product_type exists, try product_type
        if not bis_candidates and requirement.get("product_type") and requirement["product_type"] != "unknown":
            alt_term = requirement["product_type"].replace("_", " ")
            if alt_term != primary_term.lower():
                print(f"[BIS] Primary search returned 0 results. Trying secondary term: '{alt_term}'")
                bis_candidates = _trigger_bis_discovery(alt_term)

        if bis_candidates:
            run_meta["live_bis_used"] = True
        else:
            run_meta["bis_skipped_reason"] = "No live BIS candidates found"

    t_bis_ms = round((time.time() - t_bis) * 1000, 1)
    print(f"[Timing] BIS discovery: {t_bis_ms} ms")

    # Combine candidates (BIS candidates take precedence, merged with local/Mongo metadata)
    candidate_dict = {}
    for c in mongo_candidates:
        is_num = c.get("is_number")
        if is_num:
            item_copy = dict(c)
            if not item_copy.get("verification_source"):
                item_copy["verification_source"] = "mongodb_cache" if is_mongo_available() else "local_dataset"
            candidate_dict[is_num] = item_copy

    for c in bis_candidates:
        is_num = c.get("is_number")
        if is_num:
            if is_num in candidate_dict:
                existing = candidate_dict[is_num]
                for k, v in c.items():
                    if v:
                        existing[k] = v
                existing["verification_source"] = "official_bis_live"
            else:
                c_copy = dict(c)
                c_copy["verification_source"] = "official_bis_live"
                candidate_dict[is_num] = c_copy

    combined_candidates = list(candidate_dict.values())

    # ----------------------------------------------------------
    # STEP 4: DETERMINISTIC COMPOSITE RANKING & TOP-K CLASSIFICATION
    # ----------------------------------------------------------
    t_rank = time.time()
    print("[Ranking] started")

    from backend.services.retrieval import score_standard, _get_embedding_model
    from sentence_transformers import util
    from backend.ai.gemini_client import classify_candidate, generate_explanation, generate_local_explanation
    from backend.services.freshness import get_completeness_level

    # Compute semantic embeddings in bulk
    product_query = requirement.get("product", "")
    if requirement.get("material"):
        product_query += " " + requirement["material"]
    if requirement.get("product_type"):
        product_query += " " + requirement["product_type"].replace("_", " ")

    sem_scores = [0.0] * len(combined_candidates)
    if combined_candidates:
        try:
            embed_model = _get_embedding_model()
            q_emb = embed_model.encode(product_query, convert_to_tensor=True)
            from backend.services.retrieval import _build_standard_text
            c_texts = [_build_standard_text(c) for c in combined_candidates]
            c_embs = embed_model.encode(c_texts, convert_to_tensor=True)
            sims = util.cos_sim(q_emb, c_embs)[0]
            sem_scores = sims.tolist()
        except Exception as e:
            print(f"[Ranking] Embedding warning: {e}")

    # Score candidates
    scored_candidates = []
    for i, std in enumerate(combined_candidates):
        scores = score_standard(std, requirement, sem_scores[i])
        scored_candidates.append({
            "standard": std,
            "composite_score": scores["score"],
            "scores": scores,
        })

    # Sort descending by composite score
    scored_candidates.sort(key=lambda x: x["composite_score"], reverse=True)

    # Process candidates: Gemini for TOP 5 candidates MAX (if available), local for rest
    TOP_K_GEMINI = 5
    for rank_idx, item in enumerate(scored_candidates):
        std = item["standard"]
        is_num = std.get("is_number", "")
        composite_score = item["composite_score"]

        # Verification status check
        verification = determine_verification_status(std)
        bis_status = (std.get("bis_status") or std.get("status") or "").lower()
        if bis_status in ("withdrawn", "superseded", "obsolete", "cancelled"):
            verification["lifecycle_status"] = bis_status.capitalize()
            verification["eligible_for_recommendation"] = False

        classification = None
        confidence = composite_score
        evidence = ""

        # Use Gemini only for TOP-K candidates when available
        if rank_idx < TOP_K_GEMINI and is_gemini_available():
            try:
                cls_res = classify_candidate(std, requirement)
                classification = cls_res.get("classification")
                evidence = cls_res.get("reason", "")
                confidence = float(cls_res.get("confidence", composite_score))
            except Exception:
                pass

        if not classification:
            cls_res = _local_classify(std, requirement)
            classification = cls_res.get("classification", "RELATED_PRODUCT")
            evidence = cls_res.get("reason", "Local deterministic classification.")
            confidence = float(cls_res.get("confidence", composite_score))

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

        # Explanation: Gemini for TOP-K if available, local fallback otherwise
        if rank_idx < TOP_K_GEMINI and is_gemini_available():
            explanation = generate_explanation(std, requirement, classification, confidence)
        else:
            explanation = generate_local_explanation(std, requirement, classification, confidence)

        norm_refs = std.get("normative_references") or []
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
            "certification": {
                "status": cert_display,
                "mandatory": cert_mandatory,
                "scheme": std.get("certification_scheme") or None,
            },
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

    t_rank_ms = round((time.time() - t_rank) * 1000, 1)
    print(f"[Timing] embedding/ranking: {t_rank_ms} ms")
    print(f"[Ranking] completed: {len(result['primary_standards'])} primary, {sum(len(v) for v in result['allied_standards'].values())} allied standards")

    t_total_ms = round((time.time() - t0) * 1000, 1)
    print(f"[Timing] total: {t_total_ms} ms")
    print(f"[Pipeline] === COMPLETE in {t_total_ms / 1000:.3f}s ===")

    # ----------------------------------------------------------
    # STEP 5: PIPELINE STAGE FEEDBACK
    # ----------------------------------------------------------
    stages = [
        {
            "id": "requirement_understanding",
            "name": "Requirement understanding",
            "status": "completed" if run_meta.get("gemini_used") else "fallback",
            "detail": "Gemini AI" if run_meta.get("gemini_used") else "Local fallback parser (Gemini unavailable)",
            "timing_ms": t_req_ms,
        },
        {
            "id": "bis_discovery",
            "name": "BIS live discovery",
            "status": "completed" if run_meta.get("live_bis_used") else "skipped",
            "detail": f"{len(bis_candidates)} candidates found" if run_meta.get("live_bis_used") else (run_meta.get("bis_skipped_reason") or "Skipped"),
            "timing_ms": t_bis_ms,
        },
        {
            "id": "mongodb_retrieval",
            "name": "MongoDB hybrid retrieval",
            "status": "completed",
            "detail": f"{len(mongo_candidates)} candidates retrieved",
            "timing_ms": t_mongo_ms,
        },
        {
            "id": "classification_and_ranking",
            "name": "Verification & classification",
            "status": "completed" if is_gemini_available() else "fallback",
            "detail": "Gemini top-k classification" if is_gemini_available() else "Deterministic ranking engine (Gemini unavailable)",
            "timing_ms": t_rank_ms,
        },
        {
            "id": "report_generation",
            "name": "Building recommendation report",
            "status": "completed",
            "detail": f"{len(result['primary_standards'])} primary, {sum(len(v) for v in result['allied_standards'].values())} allied standards",
            "timing_ms": t_total_ms,
        },
    ]

    result["stages"] = stages
    result["timings"] = {
        "requirement_parsing_ms": t_req_ms,
        "mongodb_retrieval_ms": t_mongo_ms,
        "bis_discovery_ms": t_bis_ms,
        "ranking_ms": t_rank_ms,
        "total_ms": t_total_ms,
    }

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
