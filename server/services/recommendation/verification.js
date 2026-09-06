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
  const rawSource = standard.verification_source || standard.data_source || "official_bis_cache";

  let finalStatus = "unverified";
  let eligibleFinal = true;
  let sourceLabel = "UNVERIFIED";
  let badge = "[UNVERIFIED] Unverified Standard";

  if (WITHDRAWN_WORDS.has(lsLower)) {
    finalStatus = "withdrawn";
    eligibleFinal = false;
    sourceLabel = "WITHDRAWN";
    badge = "[DO NOT RECOMMEND] Withdrawn / Superseded";
  } else if (rawSource === "official_bis_live" || standard.data_source === "BIS_LIVE") {
    finalStatus = "live_verified";
    eligibleFinal = true;
    sourceLabel = "LIVE BIS VERIFIED";
    badge = "[LIVE BIS VERIFIED] Live BIS Portal";
  } else if (rawSource === "official_bis_cache" || standard.data_source === "LOCAL_KNOWLEDGE_BASE") {
    finalStatus = "local_verified";
    eligibleFinal = true;
    sourceLabel = "LOCAL VERIFIED INDEX";
    badge = "[LOCAL VERIFIED INDEX] Local Verified Index";
  } else if (rawSource === "mongodb_cache" || standard.data_source === "MONGODB_CACHE") {
    finalStatus = "mongodb_cached";
    eligibleFinal = true;
    sourceLabel = "MONGODB CACHED";
    badge = "[MONGODB CACHED] MongoDB Cache";
  } else if (errorCount > 0) {
    finalStatus = "needs_verification";
    eligibleFinal = false;
    sourceLabel = "UNVERIFIED";
    badge = "[NEEDS VERIFICATION] Needs Verification";
  } else {
    finalStatus = "unverified";
    eligibleFinal = true;
    sourceLabel = "UNVERIFIED";
    badge = "[UNVERIFIED] Unverified Standard";
  }

  return {
    status: finalStatus,
    eligible_for_recommendation: eligibleFinal,
    issues: issues,
    ui_badge: badge,
    source_label: sourceLabel,
    lifecycle_status: lifecycleStatus,
    last_verified: lastVerified,
    source: rawSource
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
