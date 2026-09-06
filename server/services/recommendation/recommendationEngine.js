import { randomUUID } from 'crypto';
import { parseRequirementLocal } from './requirementParser.js';
import { searchLocalStandards } from '../embeddings/vectorIndex.js';
import { determineVerificationStatus, getCompletenessLevel } from './verification.js';
import { isMongoConnected, getStandardsCollection } from '../mongodb/mongoClient.js';
import { scrapeBisKeyword, getBisHealth } from '../bis/bisScraper.js';
import { isGeminiAvailable, parseRequirementWithGemini } from '../gemini/geminiClient.js';

// Background jobs registry
const jobsRegistry = new Map();

function scoreToLabel(score) {
  if (score >= 0.75) return "HIGH";
  if (score >= 0.50) return "MEDIUM";
  if (score >= 0.25) return "LOW";
  return "VERY LOW";
}

function localClassify(std, requirement) {
  const title = (std.title || "").toLowerCase();
  const product = (requirement.product || "").toLowerCase();
  const productType = (requirement.product_type || "").toLowerCase().replace(/_/g, " ");
  const isNum = (std.is_number || "").toLowerCase();

  // If query matches standard number directly
  if (product && isNum && (isNum.includes(product) || product.includes(isNum.replace(/\s+/g, '')))) {
    return { classification: "DIRECT_PRODUCT", confidence: 0.95, reason: `Exact standard number match for '${product}'.` };
  }

  const bisStatus = (std.bis_status || std.status || "").toLowerCase();
  if (["withdrawn", "superseded", "obsolete", "cancelled"].includes(bisStatus)) {
    return { classification: "UNRELATED", confidence: 0.1, reason: "Standard is withdrawn." };
  }

  if (productType && productType !== "unknown" && productType !== "is_standard" && title.includes(productType)) {
    return { classification: "DIRECT_PRODUCT", confidence: 0.90, reason: `Title matches product type '${productType}'.` };
  }

  const pWords = product.split(/\s+/).filter(w => w.length > 2);
  if (pWords.length > 0) {
    const titleWords = title.split(/\s+/);
    let matched = 0;
    for (const pw of pWords) {
      if (titleWords.some(tw => tw.includes(pw) || pw.includes(tw))) {
        matched++;
      }
    }

    if (matched >= Math.max(1, pWords.length - 1)) {
      const isTest = ["test method", "methods of test", "sampling", "chemical analysis"].some(kw => title.includes(kw));
      if (isTest) {
        return { classification: "TEST_METHOD", confidence: 0.75, reason: `Test method for product '${product}'.` };
      }
      return { classification: "DIRECT_PRODUCT", confidence: 0.85, reason: `Direct product standard for '${product}'.` };
    }
  }

  if (std.verification_source === "official_bis_live") {
    return { classification: "DIRECT_PRODUCT", confidence: 0.85, reason: `Live BIS discovered standard for '${product}'.` };
  }

  if (["test method", "methods of test", "sampling"].some(kw => title.includes(kw))) {
    return { classification: "TEST_METHOD", confidence: 0.70, reason: "Standard title indicates test/sampling methods." };
  }

  return { classification: "RELATED_PRODUCT", confidence: 0.50, reason: "Related product or allied standard." };
}

function generateLocalExplanation(std, requirement, classification, confidence) {
  const isDirect = classification === "DIRECT_PRODUCT";
  const source = std.verification_source === "official_bis_live" ? "official live BIS portal discovery" : "official BIS verified metadata";
  const why = isDirect
    ? `This standard specifies the primary technical, quality, and performance requirements for ${requirement.product}.`
    : `This standard provides essential specifications or testing procedures allied to ${requirement.product}.`;

  return {
    relevance_score: scoreToLabel(confidence),
    confidence: confidence,
    recommendation_level: (isDirect && confidence >= 0.75) ? "PRIMARY" : "ALLIED",
    relationship_type: classification,
    why_recommended: why,
    applicability: std.scope || `Applicable for procurement of ${requirement.product}.`,
    procurement_checks: `- Verify current BIS status (${std.bis_status || std.status || 'Active'}).\n- Check applicable conformity / ISI marking requirements.`,
    why_not_primary: isDirect ? "" : "This standard provides allied test or safety guidelines rather than primary product specification.",
    evidence: `Derived from ${source}`
  };
}

function formatStandard(std, requirement, classification, confidence, explanation, verification) {
  const recLevel = explanation.recommendation_level || "ALLIED";
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
      status: typeof cert === 'object' ? (cert.status || cert.type || "") : String(cert),
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
    verification_source: std.verification_source || "official_bis_cache",
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
 * Local standards retrieval
 *     ↓
 * If local results are insufficient (< 0.75 match)
 *     ↓
 * BIS live discovery
 *     ↓
 * Merge + deduplicate
 *     ↓
 * Rank
 *     ↓
 * Return recommendations (or clear partial state if BIS unavailable)
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

  // Step 2: Local standards retrieval
  const tRet0 = Date.now();
  let candidateItems = [];
  let mongoUsed = false;

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
      }, { projection: { _id: 0 } }).limit(10).toArray();

      if (docs.length > 0) {
        candidateItems = docs.map(d => ({ standard: d, score: 0.9 }));
        mongoUsed = true;
      }
    } catch (_) {}
  }

  // If MongoDB offline or empty, search local in-memory dataset
  if (candidateItems.length === 0) {
    candidateItems = searchLocalStandards(requirement, 12);
  }
  const tRet = Date.now() - tRet0;

  // Step 3: Classification and ranking of local standards
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

  const seenIS = new Set();

  for (const item of candidateItems) {
    const std = item.standard;
    const compositeScore = item.score;
    const verification = determineVerificationStatus(std);

    const cls = localClassify(std, requirement);
    if (cls.classification === "UNRELATED") continue;

    const explanation = generateLocalExplanation(std, requirement, cls.classification, cls.confidence);
    const formatted = formatStandard(std, requirement, cls.classification, cls.confidence, explanation, verification);

    if (explanation.recommendation_level === "PRIMARY" && verification.eligible_for_recommendation && compositeScore >= 0.75) {
      if (!seenIS.has(formatted.is_number.toUpperCase())) {
        seenIS.add(formatted.is_number.toUpperCase());
        primaryStandards.push(formatted);
      }
    } else if (cls.classification === "TEST_METHOD") {
      alliedStandards.test_methods.push(formatted);
    } else if (cls.classification === "SAFETY") {
      alliedStandards.safety.push(formatted);
    } else if (cls.classification === "INSTALLATION") {
      alliedStandards.installation.push(formatted);
    } else if (cls.classification === "TERMINOLOGY") {
      alliedStandards.terminology.push(formatted);
    } else if (["CROSS_REFERENCE", "NORMATIVE_REFERENCE"].includes(cls.classification)) {
      alliedStandards.cross_references.push(formatted);
    } else if (compositeScore >= 0.50) {
      alliedStandards.related_products.push(formatted);
    }
  }

  // Step 4: Check if local results are insufficient -> trigger BIS live discovery
  let liveBisUsed = false;
  let bisStatus = "not_needed";
  let bisReason = null;
  const tBis0 = Date.now();

  const localResultsInsufficient = (primaryStandards.length === 0);

  if (localResultsInsufficient) {
    if (!enableBisDiscovery) {
      bisStatus = "unavailable";
      bisReason = "bis_discovery_disabled";
    } else {
      const bisHealth = await getBisHealth();

      if (bisHealth.status === "available") {
        try {
          const liveCandidates = await scrapeBisKeyword(requirement.product, 6, 12000);

          if (liveCandidates.length > 0) {
            for (const c of liveCandidates) {
              const key = (c.is_number || "").toUpperCase();
              if (seenIS.has(key)) continue;
              seenIS.add(key);

              const v = determineVerificationStatus(c);
              const cls = localClassify(c, requirement);
              const expl = generateLocalExplanation(c, requirement, cls.classification, cls.confidence);
              const formatted = formatStandard(c, requirement, cls.classification, cls.confidence, expl, v);

              if (expl.recommendation_level === "PRIMARY" || cls.classification === "DIRECT_PRODUCT") {
                primaryStandards.push(formatted);
              } else {
                alliedStandards.related_products.push(formatted);
              }
            }

            primaryStandards.sort((a, b) => b.score - a.score);
            liveBisUsed = true;
            bisStatus = "success";
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
      detail: mongoUsed ? "MongoDB Atlas cache" : "Fast in-memory verified Indian Standards index",
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

  // PHASE 3: Handle Zero Results Correctly
  if (primaryStandards.length === 0) {
    if (bisStatus === "unavailable") {
      return {
        status: "partial",
        requirement,
        localResults: candidateItems.filter(i => i.score >= 0.35).map(i => i.standard),
        primary_standards: [],
        allied_standards: alliedStandards,
        bisStatus: "unavailable",
        bis_reason: bisReason,
        message: "No matching standard was found in the local verified dataset and live BIS verification is currently unavailable.",
        stages,
        timings: {
          requirement_parsing_ms: tReq,
          retrieval_ms: tRet,
          bis_discovery_ms: tBis,
          ranking_ms: tRank,
          total_ms: tTotal
        },
        warnings: ["Local standards repository did not contain a high-confidence match and live BIS discovery could not be reached."],
        run_meta: {
          live_bis_used: false,
          live_bis_attempted: true,
          bis_status: "unavailable",
          mongo_cache_used: mongoUsed,
          local_index_used: !mongoUsed
        }
      };
    }

    if (bisStatus === "searched_no_results") {
      return {
        status: "no_match",
        requirement,
        localResults: candidateItems.filter(i => i.score >= 0.35).map(i => i.standard),
        primary_standards: [],
        allied_standards: alliedStandards,
        bisStatus: "searched_no_results",
        message: `No matching Indian Standard was found in the local verified dataset or official BIS portal for '${requirement.product}'.`,
        stages,
        timings: {
          requirement_parsing_ms: tReq,
          retrieval_ms: tRet,
          bis_discovery_ms: tBis,
          ranking_ms: tRank,
          total_ms: tTotal
        },
        warnings: ["No direct Indian Standards matched this specific product query on the official BIS portal."],
        run_meta: {
          live_bis_used: false,
          live_bis_attempted: true,
          bis_status: "searched_no_results",
          mongo_cache_used: mongoUsed,
          local_index_used: !mongoUsed
        }
      };
    }
  }

  return {
    status: "success",
    requirement,
    primary_standards: primaryStandards,
    allied_standards: alliedStandards,
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
      bis_status: bisStatus,
      mongo_cache_used: mongoUsed,
      local_index_used: !mongoUsed
    }
  };
}

export function getJobStatus(jobId) {
  if (!jobsRegistry.has(jobId)) {
    return { status: "not_found" };
  }
  return jobsRegistry.get(jobId);
}
