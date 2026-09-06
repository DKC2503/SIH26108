import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { STOP_WORDS } from '../recommendation/requirementParser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
    .replace(/[–—\-_/]/g, " ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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
 * Word overlap scoring
 */
export function calculateWordOverlap(query, text) {
  const qWords = normalize(query).split(/\s+/).filter(w => w.length > 2 && !STOP_WORDS.has(w));
  if (qWords.length === 0) return 0.0;
  const tWords = new Set(normalize(text).split(/\s+/));
  let matchCount = 0;
  for (const qw of qWords) {
    if (tWords.has(qw)) {
      matchCount++;
    } else {
      // Check prefix/stem overlap (e.g. pen vs pens, lamp vs lamps)
      for (const tw of tWords) {
        if (tw.startsWith(qw) || qw.startsWith(tw)) {
          matchCount += 0.8;
          break;
        }
      }
    }
  }
  return Math.min(1.0, matchCount / qWords.length);
}

/**
 * Phrase match score
 */
export function calculatePhraseScore(product, std) {
  const p = normalize(product);
  if (!p) return 0.0;

  const title = normalize(std.title || "");
  const subCat = normalize(std.sub_category || "");
  const kw = normalize(Array.isArray(std.product_keywords) ? std.product_keywords.join(" ") : "");
  const scope = normalize(std.scope || "");

  if (title.includes(p)) return 1.0;
  if (subCat.includes(p)) return 0.95;
  if (kw.includes(p)) return 0.90;
  if (scope.includes(p)) return 0.80;

  // Partial phrase words match in title
  const pWords = p.split(/\s+/).filter(w => w.length > 2);
  if (pWords.length > 0 && pWords.every(w => title.includes(w))) {
    return 0.85;
  }

  return 0.0;
}

/**
 * Fast composite scoring (< 0.1ms per standard)
 */
export function scoreStandard(std, requirement) {
  const product = requirement.product || "";
  const productType = requirement.product_type || "";
  const material = requirement.material || "";

  // Check direct IS number query
  const normIs = normalize(std.is_number || "");
  const normP = normalize(product);
  if (normIs && normP && (normIs.includes(normP) || normP.includes(normIs.replace(/\s+/g, '')))) {
    return {
      score: 0.98,
      phrase_score: 1.0,
      overlap: 1.0,
      material_match: 1.0
    };
  }

  let phrase = calculatePhraseScore(product, std);

  if (productType && productType !== "unknown") {
    const phraseType = calculatePhraseScore(productType.replace(/_/g, " "), std);
    phrase = Math.max(phrase, phraseType * 0.9);
  }

  let materialMatch = 0.0;
  if (material) {
    const stdText = normalize(`${std.title || ""} ${std.scope || ""}`);
    if (stdText.includes(normalize(material))) {
      materialMatch = 0.5;
    }
  }

  const overlap = calculateWordOverlap(product, buildStandardText(std));

  // High confidence match bonus
  let finalScore = (0.50 * phrase) + (0.35 * overlap) + (0.15 * materialMatch);

  // If title has direct product match, give primary boost
  if (phrase >= 0.85) {
    finalScore = Math.max(finalScore, 0.85);
  }

  return {
    score: Math.round(finalScore * 1000) / 1000,
    phrase_score: Math.round(phrase * 1000) / 1000,
    overlap: Math.round(overlap * 1000) / 1000,
    material_match: Math.round(materialMatch * 1000) / 1000
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
    scored.push({
      standard: { ...std },
      score: details.score,
      score_details: details
    });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}
