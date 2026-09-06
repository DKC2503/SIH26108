const WITHDRAWN_WORDS = new Set(["withdrawn", "withdrawal", "superseded", "obsolete", "cancelled"]);

export function titleSuggestsNonCurrent(title) {
  if (!title) return false;
  const lower = title.toLowerCase();
  for (const w of WITHDRAWN_WORDS) {
    if (lower.includes(w)) return true;
  }
  return false;
}

/**
 * Determine verification status and UI badge for a standard.
 */
export function determineVerificationStatus(standard) {
  const issues = [];
  const title = standard.title || "";
  const status = (standard.status || standard.bis_status || "").trim();
  const officialBisUrl = standard.official_bis_url || standard.detail_url || "";
  const lastVerified = standard.last_verified || "";
  const eligible = standard.eligible_for_recommendation;

  const lifecycleStatus = status ? status : "Active";

  if (status.toLowerCase() === "current" && titleSuggestsNonCurrent(title)) {
    issues.push({
      severity: "ERROR",
      message: "Title suggests non-current but status is 'Current'. Needs BIS re-verification."
    });
  }

  if (!officialBisUrl) {
    issues.push({ severity: "WARNING", message: "No official BIS detail URL." });
  }

  if (!title) {
    issues.push({ severity: "ERROR", message: "Missing BIS title." });
  }

  const errorCount = issues.filter(i => i.severity === "ERROR").length;
  const lsLower = lifecycleStatus.toLowerCase();
  const source = standard.verification_source || "official_bis_cache";

  let finalStatus = "verified";
  let eligibleFinal = true;
  let badge = "[BIS VERIFIED] BIS Verified - Current";

  if (WITHDRAWN_WORDS.has(lsLower)) {
    finalStatus = "failed";
    eligibleFinal = false;
    badge = "[DO NOT RECOMMEND] Withdrawn/Superseded";
  } else if (source === "official_bis_live") {
    finalStatus = "verified";
    eligibleFinal = true;
    badge = "[LIVE BIS VERIFIED] Live BIS Portal";
  } else if (source === "official_bis_cache") {
    finalStatus = "verified";
    eligibleFinal = true;
    badge = "[BIS VERIFIED] BIS Verified - Current";
  } else if (source === "mongodb_cache") {
    finalStatus = "cache_only";
    eligibleFinal = true;
    badge = "[CACHE ONLY] MongoDB Cache";
  } else if (errorCount > 0) {
    finalStatus = "needs_verification";
    eligibleFinal = false;
    badge = "[NEEDS VERIFICATION] BIS Data Needs Verification";
  } else if (!lastVerified) {
    finalStatus = "unknown";
    eligibleFinal = true;
    badge = "[NOT VERIFIED] Not Yet BIS Verified";
  }

  return {
    status: finalStatus,
    eligible_for_recommendation: eligibleFinal,
    issues: issues,
    ui_badge: badge,
    lifecycle_status: lifecycleStatus,
    last_verified: lastVerified,
    source: source
  };
}

export function getCompletenessLevel(std) {
  if (!std || !std.is_number || !std.title) return "INCOMPLETE";
  if (std.department || std.technical_committee) {
    if (std.scope || (Array.isArray(std.normative_references) && std.normative_references.length > 0)) {
      return "ENRICHED_COMPLETE";
    }
    return "OFFICIAL_COMPLETE";
  }
  return "BASIC_COMPLETE";
}
