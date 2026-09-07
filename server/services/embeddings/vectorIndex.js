import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { STOP_WORDS } from '../recommendation/requirementParser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Generic specification words that must NEVER contribute to product relevance
export const GENERIC_SPEC_WORDS = new Set([
  "test", "tests", "testing", "method", "methods", "requirements", "requirement",
  "specification", "specifications", "standard", "standards", "quality", "general",
  "use", "uses", "application", "applications", "determination", "procedure", "procedures",
  "sampling", "code", "codes", "practice", "practices", "guideline", "guidelines",
  "part", "parts", "section", "sections", "grade", "grades", "type", "types",
  "class", "classes", "is", "indian", "specifies", "provisions", "prescribes",
  "covers", "suitable", "purpose", "purposes", "product", "products", "item", "items"
]);

// In-memory pre-indexed standards cache
let inMemoryStandards = [];
let localIndexStatus = "uninitialized";

/**
 * Text normalization helper
 */
export function normalize(text) {
  if (text === null || text === undefined) return "";
  if (Array.isArray(text)) return text.map(t => normalize(t)).join(" ");
  if (typeof text === 'object') {
    return Object.entries(text).map(([k, v]) => `${k} ${normalize(v)}`).join(" ");
  }
  return String(text)
    .toLowerCase()
    .replace(/[–—\-_/()]/g, " ")
    .replace(/[^a-z0-9\s:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extract meaningful product words (excluding stopwords and generic specification words)
 */
export function extractProductWords(text) {
  return normalize(text)
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w) && !GENERIC_SPEC_WORDS.has(w));
}

/**
 * Build flexible word regex pattern supporting plurals, singulars, and common variants.
 */
export function buildWordPattern(w) {
  if (!w || typeof w !== 'string') return "";
  const clean = w.toLowerCase().trim();
  if (clean.length <= 2) return clean;

  if (clean === "electric" || clean === "electrical") {
    return "(?:electric|electrical)";
  }
  if (clean === "steel" || clean === "steels") {
    return "(?:steel|steels)";
  }

  // Plural / singular variations
  if (clean.endsWith('ies')) {
    const base = clean.slice(0, -3);
    return `(?:${clean}|${base}y)`;
  }
  if (clean.endsWith('y') && clean.length >= 3) {
    const base = clean.slice(0, -1);
    return `(?:${clean}|${base}ies|${clean}s)`;
  }
  if (clean.endsWith('es') && clean.length >= 4) {
    return `(?:${clean}|${clean.slice(0, -2)}|${clean.slice(0, -1)})`;
  }
  if (clean.endsWith('s') && !clean.endsWith('ss') && clean.length >= 3) {
    return `(?:${clean}|${clean.slice(0, -1)})`;
  }
  return `(?:${clean}|${clean}s|${clean}es)`;
}

/**
 * Strict plural/stem word matcher.
 * Never matches random substrings or short prefixes.
 */
export function wordsMatch(w1, w2) {
  if (w1 === w2) return true;
  if (!w1 || !w2) return false;
  if ((w1 === "electric" && w2 === "electrical") || (w1 === "electrical" && w2 === "electric")) return true;
  if (w1.length >= 3 && w2.length >= 3) {
    if (w1 + "s" === w2 || w2 + "s" === w1) return true;
    if (w1 + "es" === w2 || w2 + "es" === w1) return true;
    if (w1.endsWith("ies") && w1.slice(0, -3) + "y" === w2) return true;
    if (w2.endsWith("ies") && w2.slice(0, -3) + "y" === w1) return true;
    if (w1.endsWith("s") && !w1.endsWith("ss") && w1.slice(0, -1) === w2) return true;
    if (w2.endsWith("s") && !w2.endsWith("ss") && w2.slice(0, -1) === w1) return true;
  }
  return false;
}

/**
 * Check if query directly matches standard's IS number
 */
function checkIsNumberMatch(query, stdIsNumber) {
  if (!query || !stdIsNumber) return false;
  const qClean = normalize(query).replace(/\s+/g, "");
  const stdClean = normalize(stdIsNumber).replace(/\s+/g, "");

  // Exact full match
  if (qClean === stdClean) return true;

  // Match IS number without year (e.g. "is 3495" matches "is 3495:2019" or "is 3495 (parts 1 to 4):2019")
  const stdBase = stdClean.split(":")[0];
  const qBase = qClean.split(":")[0];

  if (qClean === stdBase || qBase === stdClean) return true;
  if (stdBase.includes(qBase) && qBase.length >= 5) return true;
  return false;
}

/**
 * Build searchable document text representation
 */
export function buildStandardText(std) {
  const parts = [
    std.is_number || "",
    std.title || "",
    std.category || "",
    std.sub_category || "",
    std.scope || "",
    std.department || "",
    Array.isArray(std.product_keywords) ? std.product_keywords.join(" ") : "",
    Array.isArray(std.key_requirements) ? std.key_requirements.join(" ") : "",
    Array.isArray(std.technical_requirements) ? std.technical_requirements.join(" ") : ""
  ];
  return normalize(parts.join(" "));
}

/**
 * Word overlap scoring on meaningful product keywords only
 */
export function calculateWordOverlap(productWords, targetText) {
  if (!productWords || productWords.length === 0) return 0.0;
  const targetWords = normalize(targetText).split(/\s+/);
  let matchCount = 0;

  for (const pw of productWords) {
    if (targetWords.some(tw => wordsMatch(pw, tw))) {
      matchCount++;
    }
  }

  return matchCount / productWords.length;
}

/**
 * Exact word-boundary phrase matcher.
 * Uses flexible word patterns (singular/plural, variants) and sequential token matching.
 */
export function matchesPhrase(targetText, phrase) {
  if (!targetText || !phrase) return false;
  const arr = Array.isArray(targetText) ? targetText : [targetText];
  const pWords = normalize(phrase).split(/\s+/).filter(Boolean);
  if (pWords.length === 0) return false;

  const pPattern = pWords.map(buildWordPattern).join('\\s+');
  const rx = new RegExp(`\\b${pPattern}\\b`, 'i');
  if (arr.some(t => rx.test(normalize(t)))) return true;

  // Also check token-by-token sequential match
  for (const text of arr) {
    const tWords = normalize(text).split(/\s+/).filter(Boolean);
    if (tWords.length < pWords.length) continue;
    for (let i = 0; i <= tWords.length - pWords.length; i++) {
      let match = true;
      for (let j = 0; j < pWords.length; j++) {
        if (!wordsMatch(pWords[j], tWords[i + j])) {
          match = false;
          break;
        }
      }
      if (match) return true;
    }
  }

  return false;
}

/**
 * Phrase match score with heavy title weighting for general product search
 */
export function calculatePhraseScore(product, std) {
  if (!product) return 0.0;

  if (matchesPhrase(std.title, product)) return 1.0;
  if (matchesPhrase(std.product_keywords, product)) return 0.95;
  if (matchesPhrase(std.sub_category, product)) return 0.90;
  if (matchesPhrase(std.scope, product)) return 0.70;

  // Check if all product words appear in title
  const pWords = extractProductWords(product);
  if (pWords.length >= 1) {
    const titleWords = normalize(std.title || "").split(/\s+/);
    let allFound = true;
    for (const pw of pWords) {
      if (!titleWords.some(tw => wordsMatch(pw, tw))) {
        allFound = false;
        break;
      }
    }
    if (allFound) {
      return pWords.length === 1 ? 0.95 : 0.85;
    }
  }

  return 0.0;
}

/**
 * Robust domain/industry compatibility check
 */
function checkDomainCompatibility(requirementIndustry, std) {
  if (!requirementIndustry || requirementIndustry === "general") return 0;

  const stdCat = normalize(`${std.category || ""} ${std.sub_category || ""} ${std.department || ""}`);

  // Incompatible domain pairings
  const incompatibilities = {
    food: ["civil engineering", "clay products", "pipe", "cement", "electrical", "stationery"],
    stationery: ["civil engineering", "clay products", "food", "cement", "pipe"],
    construction: ["food", "drinks", "stationery", "cosmetics"],
    electrical: ["food", "clay products", "stationery", "drinks"],
    plumbing: ["food", "stationery", "textiles"]
  };

  const blockedCategories = incompatibilities[requirementIndustry] || [];
  for (const blocked of blockedCategories) {
    if (stdCat.includes(blocked)) {
      return -0.40; // Substantial penalty for cross-domain collision
    }
  }

  return 0.05; // Modest bonus for compatible domain
}

/**
 * Fast composite scoring with strict relevance hierarchy (< 0.1ms per standard)
 */
export function scoreStandard(std, requirement) {
  const product = requirement.product || "";
  const productType = requirement.product_type || "";
  const material = requirement.material || "";
  const industry = requirement.industry || "general";

  // Check direct IS number query (Highest priority: 0.99)
  const isDirectMatch = checkIsNumberMatch(product, std.is_number) ||
    checkIsNumberMatch(requirement.is_number_query, std.is_number);

  if (isDirectMatch) {
    return {
      score: 0.99,
      phrase_score: 1.0,
      overlap: 1.0,
      material_match: 1.0,
      is_direct_is_match: true,
      evidence: `Exact match for Indian Standard ${std.is_number}`
    };
  }

  const pWords = extractProductWords(product);

  // If query had no meaningful product words (e.g. only stop words), return 0
  if (pWords.length === 0) {
    return {
      score: 0.0,
      phrase_score: 0.0,
      overlap: 0.0,
      material_match: 0.0,
      is_direct_is_match: false
    };
  }

  // 1. Phrase matching
  let phrase = calculatePhraseScore(product, std);

  if (productType && productType !== "unknown" && productType !== "is_standard" && productType !== "is_standard_query") {
    const typeClean = productType.replace(/_/g, " ");
    const phraseType = calculatePhraseScore(typeClean, std);
    phrase = Math.max(phrase, phraseType * 0.9);
  }

  // 2. Keyword & Title overlap
  const titleOverlap = calculateWordOverlap(pWords, std.title || std.standard_name || "");
  const kwOverlap = calculateWordOverlap(pWords, Array.isArray(std.product_keywords) ? std.product_keywords.join(" ") : "");
  const scopeOverlap = calculateWordOverlap(pWords, std.scope || "");
  
  const hasKw = Array.isArray(std.product_keywords) && std.product_keywords.length > 0;
  const hasScope = Boolean(std.scope && std.scope.length > 10);
  let textOverlap = 0.0;
  if (hasKw && hasScope) {
    textOverlap = (0.50 * titleOverlap) + (0.35 * kwOverlap) + (0.15 * scopeOverlap);
  } else if (hasKw) {
    textOverlap = (0.65 * titleOverlap) + (0.35 * kwOverlap);
  } else if (hasScope) {
    textOverlap = (0.75 * titleOverlap) + (0.25 * scopeOverlap);
  } else {
    textOverlap = titleOverlap;
  }

  // If zero product words match anywhere in title or keywords, this standard is NOT relevant
  if (titleOverlap === 0 && kwOverlap === 0 && phrase === 0) {
    return {
      score: 0.0,
      phrase_score: 0.0,
      overlap: 0.0,
      material_match: 0.0,
      is_direct_is_match: false
    };
  }

  // 3. Material match
  let materialMatch = 0.0;
  if (material) {
    const stdText = normalize(`${std.title || ""} ${std.scope || ""}`);
    if (stdText.includes(normalize(material))) {
      materialMatch = 0.5;
    }
  }

  // 4. Domain compatibility penalty / bonus
  const domainDelta = checkDomainCompatibility(industry, std);

  // 5. Test method vs Product Specification penalty
  // A test method standard should NOT score higher than a product specification for the same product
  const titleLower = (std.title || std.standard_name || "").toLowerCase();
  const isTestMethod = titleLower.includes("methods of test") ||
    titleLower.includes("method of test") ||
    titleLower.includes("determination of") ||
    std.type_of_standard === "Test Method";

  const userAskedForTest = pWords.some(w => ["test", "testing", "sampling", "method"].includes(w));
  let testMethodPenalty = 0.0;
  if (isTestMethod && !userAskedForTest) {
    testMethodPenalty = 0.15; // Ensure product specification ranks ahead of test method
  }

  // Calculate composite score
  let finalScore = (0.50 * phrase) + (0.35 * textOverlap) + (0.15 * materialMatch) + domainDelta - testMethodPenalty;

  // If title has direct product match and is a product specification, boost score
  if (phrase >= 0.85 && !isTestMethod) {
    finalScore = Math.max(finalScore, 0.88);
  } else if (phrase >= 0.85 && isTestMethod) {
    finalScore = Math.min(finalScore, 0.72); // Cap test method score below primary product specification
  }

  finalScore = Math.max(0.0, Math.min(1.0, finalScore));

  return {
    score: Math.round(finalScore * 1000) / 1000,
    phrase_score: Math.round(phrase * 1000) / 1000,
    overlap: Math.round(textOverlap * 1000) / 1000,
    material_match: Math.round(materialMatch * 1000) / 1000,
    is_direct_is_match: false
  };
}

/**
 * Initialize and pre-warm local standards in memory at server startup.
 * Runs ONCE at startup. Instant execution (< 5ms).
 */
export function initLocalIndex() {
  try {
    const dataPath = path.resolve(__dirname, '../../../data/local_standards.json');
    if (fs.existsSync(dataPath)) {
      const raw = fs.readFileSync(dataPath, 'utf-8');
      inMemoryStandards = JSON.parse(raw);
    } else {
      console.warn(`[LocalIndex] File not found at ${dataPath}`);
      inMemoryStandards = [];
    }

    // Pre-cache normalized texts for every standard
    for (const std of inMemoryStandards) {
      std._search_text = buildStandardText(std);
      std._norm_title = normalize(std.title || "");
    }

    localIndexStatus = "ready";
    console.log(`[LocalIndex] READY — Pre-loaded ${inMemoryStandards.length} real Indian Standards in memory`);
  } catch (err) {
    console.error(`[LocalIndex] Initialization error: ${err.message}`);
    localIndexStatus = "error";
  }
}

export function getLocalIndexStatus() {
  return localIndexStatus;
}

export function getAllLocalStandards() {
  return inMemoryStandards;
}

/**
 * Super-fast in-memory hybrid search (< 2ms).
 */
export function searchLocalStandards(requirement, limit = 15) {
  if (inMemoryStandards.length === 0) {
    initLocalIndex();
  }
  const scored = [];

  for (const std of inMemoryStandards) {
    const details = scoreStandard(std, requirement);
    // Only return candidates that have non-zero score
    if (details.score > 0) {
      scored.push({
        standard: { ...std },
        score: details.score,
        score_details: details
      });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}
