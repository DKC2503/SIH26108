import { randomUUID } from 'crypto';
import { parseRequirementLocal } from './requirementParser.js';
import { searchLocalStandards, scoreStandard } from '../embeddings/vectorIndex.js';
import { determineVerificationStatus, getCompletenessLevel } from './verification.js';
import { isMongoConnected, getStandardsCollection } from '../mongodb/mongoClient.js';
import { scrapeBisKeyword, getBisHealth } from '../bis/bisScraper.js';
import { isGeminiAvailable, parseRequirementWithGemini } from '../gemini/geminiClient.js';

// Background jobs registry
const jobsRegistry = new Map();

function scoreToLabel(score) {
  if (score >= 0.80) return "HIGH";
  if (score >= 0.60) return "MEDIUM";
  if (score >= 0.40) return "LOW";
  return "VERY LOW";
}

/**
 * Standard relationship classifier.
 * Never auto-promotes live BIS candidates to DIRECT_PRODUCT without evidence.
 * Correctly distinguishes DIRECT_PRODUCT, TEST_METHOD, SAFETY, INSTALLATION, TERMINOLOGY, UNRELATED.
 */
export function localClassify(std, requirement, scoreDetails = null) {
  const title = (std.title || "").toLowerCase();
  const product = (requirement.product || "").toLowerCase();
  const productType = (requirement.product_type || "").toLowerCase().replace(/_/g, " ");
  const isNum = (std.is_number || "").toLowerCase();
  const score = scoreDetails ? scoreDetails.score : 0;

  // Direct standard number query match
  if (requirement.is_number_query || (product && isNum && (isNum.includes(product) || product.includes(isNum.replace(/\s+/g, ''))))) {
    return {
      classification: "DIRECT_PRODUCT",
      confidence: 0.99,
      reason: `Exact standard number match for '${requirement.is_number_query || product}'.`
    };
  }

  // Withdrawn / superseded standards
  const bisStatus = (std.bis_status || std.status || "").toLowerCase();
  if (["withdrawn", "superseded", "obsolete", "cancelled"].includes(bisStatus)) {
    return { classification: "UNRELATED", confidence: 0.0, reason: "Standard is withdrawn or obsolete." };
  }

  // If score is negligible (< 0.35), standard is unrelated to requirement
  if (score < 0.35) {
    return { classification: "UNRELATED", confidence: 0.0, reason: "Insufficient relevance to procurement requirement." };
  }

  // Test method standard check (e.g. IS 3495)
  const isTestMethod = ["test method", "methods of test", "method of test", "sampling and test", "determination of"].some(kw => title.includes(kw)) ||
    std.type_of_standard === "Test Method";

  if (isTestMethod) {
    return {
      classification: "TEST_METHOD",
      confidence: Math.min(score, 0.80),
      reason: `Allied test method standard for '${product}'.`
    };
  }

  // Safety standard check
  const isSafety = ["safety requirements", "code of safety", "safety specification", "safety code"].some(kw => title.includes(kw)) ||
    std.type_of_standard === "Safety Specification";

  if (isSafety) {
    return {
      classification: "SAFETY",
      confidence: Math.min(score, 0.85),
      reason: `Allied safety specification for '${product}'.`
    };
  }

  // Installation / Code of Practice check
  const isInstallation = ["code of practice for installation", "code of practice for laying", "installation and maintenance"].some(kw => title.includes(kw));
  if (isInstallation) {
    return {
      classification: "INSTALLATION",
      confidence: Math.min(score, 0.80),
      reason: `Installation and practice guideline for '${product}'.`
    };
  }

  // Terminology check
  const isTerminology = ["glossary of terms", "terminology"].some(kw => title.includes(kw));
  if (isTerminology) {
    return {
      classification: "TERMINOLOGY",
      confidence: Math.min(score, 0.70),
      reason: `Terminology standard for '${product}'.`
    };
  }

  // High relevance specification match -> DIRECT_PRODUCT
  if (score >= 0.65) {
    return {
      classification: "DIRECT_PRODUCT",
      confidence: score,
      reason: `Primary product specification for '${product}'.`
    };
  }

  // Moderate relevance -> RELATED_PRODUCT
  if (score >= 0.45) {
    return {
      classification: "RELATED_PRODUCT",
      confidence: score,
      reason: `Allied or related product specification for '${product}'.`
    };
  }

  return { classification: "UNRELATED", confidence: 0.0, reason: "No strong match found." };
}

/**
 * Generate truthful, evidence-based procurement explanation.
 * Never manufactures false claims.
 */
export function generateEvidenceBasedExplanation(std, requirement, classification, confidence, scoreDetails) {
  const isDirect = classification === "DIRECT_PRODUCT";
  const sourceLabel = std.verification_source === "official_bis_live"
    ? "official live BIS portal discovery"
    : (std.verification_source === "mongodb_cache" ? "MongoDB Atlas standards cache" : "canonical Indian Standards repository");

  let why = "";
  let whyNotPrimary = "";

  if (confidence < 0.45) {
    why = "This standard was not assigned a high-confidence match because the available evidence does not establish direct applicability.";
    whyNotPrimary = "Available evidence does not meet confidence threshold for procurement specification.";
  } else if (isDirect) {
    if (scoreDetails?.is_direct_is_match) {
      why = `Exact citation match for Indian Standard ${std.is_number} (${std.title}). Specifies official technical requirements, dimensions, and conformity assessment criteria.`;
    } else {
      why = `Directly specifies technical specifications, dimensions, quality benchmarks, and conformity requirements for procurement of ${requirement.product}.`;
    }
  } else if (classification === "TEST_METHOD") {
    why = `Specifies standardized sampling and laboratory testing procedures for verification of quality criteria for ${requirement.product}.`;
    whyNotPrimary = "This is a testing/sampling method standard, recommended to accompany the primary product specification.";
  } else if (classification === "SAFETY") {
    why = `Specifies mandatory safety precautions, protection levels, and risk mitigation requirements relevant to ${requirement.product}.`;
    whyNotPrimary = "Specifies safety guidelines and protection criteria rather than core product specification.";
  } else if (classification === "INSTALLATION") {
    why = `Provides engineering code of practice for laying, mounting, and site installation of ${requirement.product}.`;
    whyNotPrimary = "Code of practice for field installation rather than manufacturing specification.";
  } else {
    why = `Allied Indian Standard providing complementary technical specifications for ${requirement.product}.`;
    whyNotPrimary = "Provides related or allied specifications rather than primary product standard.";
  }

  const evidenceText = scoreDetails?.is_direct_is_match
    ? `Direct IS number match against ${sourceLabel}`
    : `Matched product attributes for '${requirement.product}' (relevance score ${(confidence * 100).toFixed(0)}/100). Sourced from ${sourceLabel}.`;

  return {
    relevance_score: scoreToLabel(confidence),
    confidence: confidence,
    recommendation_level: (isDirect && confidence >= 0.65) ? "PRIMARY" : "ALLIED",
    relationship_type: classification,
    why_recommended: why,
    applicability: std.scope || `Applicable for procurement and compliance verification of ${requirement.product}.`,
    procurement_checks: `- Verify current BIS status (${std.bis_status || std.status || 'Active'}).\n- Confirm manufacturer possesses valid BIS certification / ISI mark license.\n- Verify test certificate conformity to latest revision.`,
    why_not_primary: isDirect ? "" : whyNotPrimary,
    evidence: evidenceText
  };
}

export function formatStandard(std, requirement, classification, confidence, explanation, verification) {
  const cert = std.certification || {};

  return {
    is_number: std.is_number,
    title: std.title || "",
    structured_explanation: explanation,
    explanation: explanation.why_recommended || "",
    classification: classification,
    relevance: scoreToLabel(confidence),
    score: Math.round(confidence * 1000) / 1000,
    verification: verification,
    evidence: explanation.evidence || "",
    scope: std.scope || null,
    bis_status: std.bis_status || std.status || "Active",
    normative_references: std.normative_references || [],
    test_methods: std.test_methods || [],
    amendments: std.amendments || [],
    safety_standards: std.safety_standards || [],
    installation_requirements: std.installation_requirements || [],
    related_standards: std.related_standards || [],
    cross_references: std.cross_references || [],
    data_source: std.data_source || (std.verification_source === "official_bis_live" ? "BIS_LIVE" : "BIS"),
    certification: {
      status: typeof cert === 'object' ? (cert.status || cert.type || "Voluntary") : String(cert),
      mandatory: cert.mandatory || false,
      scheme: std.certification_scheme || null
    },
    lifecycle: {
      status: std.bis_status || std.status || "Active",
      number_of_revisions: std.number_of_revisions || null,
      number_of_amendments: std.number_of_amendments || null,
      reaffirmation_year: std.reaffirmation_year || null,
      reviewed_in: std.reviewed_in || null,
      supersedes: std.supersedes || [],
      superseded_by: std.superseded_by || [],
      superseding_is: std.superseding_is || null
    },
    department: std.department || null,
    technical_committee: std.technical_committee || null,
    type_of_standard: std.type_of_standard || null,
    degree_of_equivalence: std.degree_of_equivalence || null,
    official_bis_url: std.official_bis_url || std.detail_url || "",
    last_verified: std.last_verified || "",
    verification_source: std.verification_source || (verification && verification.source) || "official_bis_cache",
    completeness_level: getCompletenessLevel(std)
  };
}

/**
 * FULL RECOMMENDATION PIPELINE WITH FALLBACK & ZERO-RESULT HANDLING
 *
 * USER QUERY
 *     ↓
 * Requirement understanding
 *     ↓
 * Local standards retrieval & MongoDB retrieval
 *     ↓
 * Candidate scoring through scoreStandard()
 *     ↓
 * If local results are insufficient (< 0.65 match)
 *     ↓
 * BIS live discovery
 *     ↓
 * Merge + deduplicate by normalized IS number
 *     ↓
 * Rank with confidence thresholds
 *     ↓
 * Return recommendations (or truthful no_match state)
 */
export async function runFastAnalysis(query, inputType = "product_description", enableBisDiscovery = true) {
  const t0 = Date.now();

  // Step 1: Requirement parsing
  const tReq0 = Date.now();
  let requirement = parseRequirementLocal(query);

  if (isGeminiAvailable()) {
    try {
      const gReq = await parseRequirementWithGemini(query);
      if (gReq && gReq.product) {
        requirement = { ...requirement, ...gReq };
      }
    } catch (_) {}
  }
  const tReq = Date.now() - tReq0;

  // Step 2: Multi-source candidate retrieval
  const tRet0 = Date.now();
  let candidatePool = [];
  let mongoUsed = false;
  const seenIS = new Set();

  // 2a. MongoDB Atlas retrieval with REAL SCORING
  if (isMongoConnected()) {
    try {
      const coll = getStandardsCollection();
      const product = requirement.product || "";
      const regex = new RegExp(product.replace(/[^a-z0-9]/gi, ".*"), "i");
      const docs = await coll.find({
        $or: [
          { title: { $regex: regex } },
          { product_keywords: { $regex: regex } }
        ]
      }, { projection: { _id: 0 } }).limit(15).toArray();

      if (docs.length > 0) {
        for (const doc of docs) {
          const details = scoreStandard(doc, requirement);
          if (details.score >= 0.35) {
            const key = (doc.is_number || "").toUpperCase();
            if (!seenIS.has(key)) {
              seenIS.add(key);
              candidatePool.push({
                standard: {
                  ...doc,
                  verification_source: doc.verification_source || "mongodb_cache",
                  data_source: "MONGODB_CACHE"
                },
                score: details.score,
                score_details: details
              });
            }
          }
        }
        mongoUsed = true;
      }
    } catch (_) {
      // Gracefully continue to local index
    }
  }

  // 2b. In-memory local standards search with REAL SCORING
  const localCandidates = searchLocalStandards(requirement, 15);
  for (const item of localCandidates) {
    const key = (item.standard.is_number || "").toUpperCase();
    if (!seenIS.has(key)) {
      seenIS.add(key);
      candidatePool.push(item);
    }
  }
  const tRet = Date.now() - tRet0;

  // Step 3: Candidate classification and initial filtering
  const tRank0 = Date.now();
  let primaryStandards = [];
  const alliedStandards = {
    normative_references: [],
    test_methods: [],
    safety: [],
    installation: [],
    terminology: [],
    cross_references: [],
    related_products: []
  };

  for (const item of candidatePool) {
    const std = item.standard;
    const scoreDetails = item.score_details || scoreStandard(std, requirement);
    const compositeScore = scoreDetails.score;

    if (compositeScore < 0.35) continue;

    const verification = determineVerificationStatus(std);
    const cls = localClassify(std, requirement, scoreDetails);
    if (cls.classification === "UNRELATED") continue;

    const explanation = generateEvidenceBasedExplanation(std, requirement, cls.classification, compositeScore, scoreDetails);
    const formatted = formatStandard(std, requirement, cls.classification, compositeScore, explanation, verification);

    // Primary standards must be DIRECT_PRODUCT, have score >= 0.65, and be eligible
    if (cls.classification === "DIRECT_PRODUCT" && compositeScore >= 0.65 && verification.eligible_for_recommendation) {
      primaryStandards.push(formatted);
    } else if (cls.classification === "TEST_METHOD" && compositeScore >= 0.40) {
      alliedStandards.test_methods.push(formatted);
    } else if (cls.classification === "SAFETY" && compositeScore >= 0.40) {
      alliedStandards.safety.push(formatted);
    } else if (cls.classification === "INSTALLATION" && compositeScore >= 0.40) {
      alliedStandards.installation.push(formatted);
    } else if (cls.classification === "TERMINOLOGY" && compositeScore >= 0.40) {
      alliedStandards.terminology.push(formatted);
    } else if (["CROSS_REFERENCE", "NORMATIVE_REFERENCE"].includes(cls.classification) && compositeScore >= 0.40) {
      alliedStandards.cross_references.push(formatted);
    } else if (compositeScore >= 0.45) {
      alliedStandards.related_products.push(formatted);
    }
  }

  // Sort candidates by score descending
  primaryStandards.sort((a, b) => b.score - a.score);

  // Step 4: Live BIS Discovery if local results are insufficient
  // Trigger if no primary standards found OR highest local score is below 0.65
  let liveBisUsed = false;
  let bisStatus = "not_needed";
  let bisReason = null;
  let bisCandidatesFound = 0;
  const tBis0 = Date.now();

  const topLocalScore = primaryStandards.length > 0 ? primaryStandards[0].score : 0.0;
  const localResultsInsufficient = (primaryStandards.length === 0 || topLocalScore < 0.65);

  const candidateBisQueries = requirement.bis_search_queries && requirement.bis_search_queries.length > 0
    ? requirement.bis_search_queries
    : [requirement.product];

  if (localResultsInsufficient) {
    if (!enableBisDiscovery) {
      bisStatus = "unavailable";
      bisReason = "bis_discovery_disabled";
    } else {
      const bisHealth = await getBisHealth();

      if (bisHealth.status === "available") {
        try {
          // Pass the expanded queries list so bisScraper tries them sequentially
          const liveCandidates = await scrapeBisKeyword(candidateBisQueries, 6, 12000);
          bisCandidatesFound = liveCandidates.length;

          if (liveCandidates.length > 0) {
            for (const c of liveCandidates) {
              const key = (c.is_number || "").toUpperCase();
              if (seenIS.has(key)) continue;
              seenIS.add(key);

              // STRICT SCORING ON LIVE BIS CANDIDATES
              const details = scoreStandard(c, requirement);
              if (details.score < 0.35) continue;

              const v = determineVerificationStatus(c);
              const cls = localClassify(c, requirement, details);
              if (cls.classification === "UNRELATED") continue;

              const expl = generateEvidenceBasedExplanation(c, requirement, cls.classification, details.score, details);
              const formatted = formatStandard(c, requirement, cls.classification, details.score, expl, v);

              if (cls.classification === "DIRECT_PRODUCT" && details.score >= 0.65) {
                primaryStandards.push(formatted);
              } else if (cls.classification === "TEST_METHOD" && details.score >= 0.40) {
                alliedStandards.test_methods.push(formatted);
              } else if (cls.classification === "SAFETY" && details.score >= 0.40) {
                alliedStandards.safety.push(formatted);
              } else if (details.score >= 0.40) {
                alliedStandards.related_products.push(formatted);
              }
            }

            primaryStandards.sort((a, b) => b.score - a.score);
            liveBisUsed = primaryStandards.some(s => s.verification_source === "official_bis_live");
            bisStatus = liveCandidates.length > 0 ? "success" : "searched_no_results";
          } else {
            bisStatus = "searched_no_results";
          }
        } catch (err) {
          console.error("[Recommendation] BIS live discovery error:", err.message);
          bisStatus = "error";
          bisReason = "bis_discovery_failed";
        }
      } else {
        bisStatus = "unavailable";
        bisReason = bisHealth.reason || "playwright_browser_missing";
      }
    }
  }

  const tBis = Date.now() - tBis0;
  const tRank = Date.now() - tRank0;
  const tTotal = Date.now() - t0;

  // Stages feedback for UI / diagnostics
  const stages = [
    {
      id: "requirement_understanding",
      name: "Requirement understanding",
      status: "completed",
      detail: `Identified product '${requirement.product}'`,
      timing_ms: tReq
    },
    {
      id: "mongodb_retrieval",
      name: "Local verified standards retrieval",
      status: "completed",
      detail: mongoUsed ? "MongoDB Atlas standards cache" : "In-memory verified Indian Standards index",
      timing_ms: tRet
    },
    {
      id: "bis_discovery",
      name: "BIS live discovery",
      status: liveBisUsed ? "completed" : (bisStatus === "unavailable" ? "unavailable" : "skipped"),
      detail: liveBisUsed
        ? `Discovered ${primaryStandards.filter(s => s.verification_source === 'official_bis_live').length} standard(s) from official BIS portal`
        : (bisStatus === "unavailable" ? `Live BIS discovery unavailable (${bisReason})` : "Local match sufficient"),
      timing_ms: tBis
    },
    {
      id: "classification_and_ranking",
      name: "Classification & ranking",
      status: "completed",
      detail: `${primaryStandards.length} primary, ${Object.values(alliedStandards).reduce((a, b) => a + b.length, 0)} allied standards`,
      timing_ms: tRank
    }
  ];

  // Handle Zero / Insufficient Results Truthfully
  if (primaryStandards.length === 0) {
    if (bisStatus === "unavailable") {
      return {
        status: "partial",
        requirement,
        primary_standards: [],
        allied_standards: alliedStandards,
        bisStatus: "unavailable",
        bis_reason: bisReason,
        bisQueries: candidateBisQueries,
        bisCandidatesFound,
        live_bis_used: false,
        live_bis_attempted: true,
        message: `No high-confidence Indian Standard found for '${requirement.product}' in the currently available verified sources, and live BIS verification is unavailable.`,
        stages,
        timings: {
          requirement_parsing_ms: tReq,
          retrieval_ms: tRet,
          bis_discovery_ms: tBis,
          ranking_ms: tRank,
          total_ms: tTotal
        },
        warnings: ["No direct Indian Standard matched with high confidence in the verified local repository, and live BIS verification was unavailable."],
        run_meta: {
          live_bis_used: false,
          live_bis_attempted: true,
          bis_status: "unavailable",
          bis_queries: candidateBisQueries,
          bis_candidates_found: bisCandidatesFound,
          mongo_cache_used: mongoUsed,
          local_index_used: true
        }
      };
    }

    return {
      status: "no_match",
      requirement,
      primary_standards: [],
      allied_standards: alliedStandards,
      bisStatus: bisStatus,
      bisQueries: candidateBisQueries,
      bisCandidatesFound,
      live_bis_used: liveBisUsed,
      live_bis_attempted: true,
      message: `No high-confidence Indian Standard found for '${requirement.product}' in the currently available verified sources.`,
      stages,
      timings: {
        requirement_parsing_ms: tReq,
        retrieval_ms: tRet,
        bis_discovery_ms: tBis,
        ranking_ms: tRank,
        total_ms: tTotal
      },
      warnings: ["No direct Indian Standard met the minimum confidence threshold for this requirement."],
      run_meta: {
        live_bis_used: liveBisUsed,
        live_bis_attempted: true,
        bis_status: bisStatus,
        bis_queries: candidateBisQueries,
        bis_candidates_found: bisCandidatesFound,
        mongo_cache_used: mongoUsed,
        local_index_used: true
      }
    };
  }

  return {
    status: "success",
    requirement,
    primary_standards: primaryStandards,
    allied_standards: alliedStandards,
    bisStatus: bisStatus,
    bisQueries: candidateBisQueries,
    bisCandidatesFound,
    live_bis_used: liveBisUsed,
    live_bis_attempted: localResultsInsufficient,
    stages,
    timings: {
      requirement_parsing_ms: tReq,
      retrieval_ms: tRet,
      bis_discovery_ms: tBis,
      ranking_ms: tRank,
      total_ms: tTotal
    },
    warnings: [],
    run_meta: {
      live_bis_used: liveBisUsed,
      live_bis_attempted: localResultsInsufficient,
      bis_status: bisStatus,
      bis_queries: candidateBisQueries,
      bis_candidates_found: bisCandidatesFound,
      mongo_cache_used: mongoUsed,
      local_index_used: true
    }
  };
}

export function getJobStatus(jobId) {
  if (!jobsRegistry.has(jobId)) {
    return { status: "not_found" };
  }
  return jobsRegistry.get(jobId);
}

