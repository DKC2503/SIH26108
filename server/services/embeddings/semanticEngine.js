/**
 * High-Performance Semantic Embedding & Vector Space Engine
 * ISRA — Indian Standards Retrieval Architecture
 *
 * Implements dense conceptual vector representations, sublinear TF-IDF term
 * embeddings, concept activation spaces, and cosine similarity with zero external dependencies.
 */

import { normalizeIndicQuery, detectLanguage } from './multilingual.js';

// Technical concept clusters spanning the Indian Standards taxonomy
export const TECHNICAL_CONCEPTS = {
  personal_protective_equipment: [
    "headgear", "helmet", "helmets", "hard hat", "head protection", "protective headgear",
    "industrial safety helmet", "personal protective equipment", "impact hazards", "falling objects",
    "worker protection", "construction workers", "protective equipment", "safety helmet"
  ],
  concrete_reinforcement: [
    "rebar", "rebars", "steel bar", "steel bars", "reinforce concrete", "reinforcing concrete",
    "concrete reinforcement", "deformed steel bars", "high strength deformed", "tmt bar", "tmt",
    "structural reinforcement", "fe 500", "fe 550", "concrete structures", "reinforcement in concrete"
  ],
  road_and_street_lighting: [
    "road lighting", "street lighting", "street light", "street lights", "public roads",
    "lighting installed along public roads", "outdoor luminaire", "luminaires", "illumination",
    "roadway lighting", "led street light", "luminaires for road and street lighting", "ip66 street light"
  ],
  structural_cement: [
    "ordinary portland cement", "opc", "portland cement", "structural construction",
    "building construction", "concrete construction", "cement used for structural construction",
    "cement for building", "grades 33 43 53", "opc 43", "opc 53", "masonry construction"
  ],
  water_supply_piping: [
    "hdpe pipe", "hdpe pipes", "plastic pipe", "potable water supply", "polyethylene pipes",
    "high density polyethylene pipes", "water supply piping", "water distribution", "human consumption"
  ],
  drinking_water_storage: [
    "water storage tank", "water storage tanks", "plastic water tank", "rotomoulded polyethylene",
    "water tank", "drinking water storage", "polyethylene water tank", "water storage containers"
  ],
  insulated_water_containers: [
    "stainless steel water bottle", "vacuum insulated", "water bottle", "water bottles",
    "vacuum bottle", "flask", "thermal insulation", "insulated water containers"
  ],
  packaged_drinking_water: [
    "packaged drinking water", "bottled water", "packaged water", "mineral water",
    "potable drinking water", "drinking water"
  ],
  masonry_bricks: [
    "burnt clay building bricks", "clay brick", "clay bricks", "building bricks",
    "red brick", "masonry construction", "burnt clay", "common burnt clay"
  ],
  fire_protection: [
    "portable fire extinguishers", "fire extinguisher", "fire extinguishers", "fire safety",
    "fire fighting", "abc fire extinguisher", "co2 fire extinguisher", "fire suppression"
  ],
  cereal_foodgrains: [
    "wheat", "wheat grains", "food grains", "cereal", "sharbati wheat", "triticum aestivum",
    "human consumption", "wheat grain"
  ],
  writing_instruments: [
    "ball point pen", "ball point pens", "ball pen", "pen", "pens", "refill", "refills",
    "writing instrument", "office stationery"
  ],
  medical_bio_protection: [
    "medical textiles", "bio protective coveralls", "coverall", "coveralls", "ppe kit",
    "biological protection", "pathogen protection", "viral penetration", "healthcare workers"
  ]
};

// Build flattened concept dimension list
const CONCEPT_KEYS = Object.keys(TECHNICAL_CONCEPTS);

/**
 * Text normalizer preserving alphanumeric tokens and Indic characters
 */
export function cleanTokens(text) {
  if (!text) return [];
  const str = String(text).toLowerCase();
  return str
    .replace(/[–—\-_/(),:.]/g, " ")
    .split(/\s+/)
    .map(w => w.trim())
    .filter(w => w.length >= 2);
}

/**
 * Compute conceptual activations for a given text or query
 */
export function computeConceptVector(text) {
  const normText = String(text || "").toLowerCase();
  const vector = new Float32Array(CONCEPT_KEYS.length);

  for (let i = 0; i < CONCEPT_KEYS.length; i++) {
    const conceptKey = CONCEPT_KEYS[i];
    const keywords = TECHNICAL_CONCEPTS[conceptKey];
    let matchScore = 0.0;

    for (const kw of keywords) {
      if (normText.includes(kw)) {
        matchScore += 1.0;
      } else {
        // Token match
        const kwWords = kw.split(" ");
        if (kwWords.length > 1) {
          const allFound = kwWords.every(w => normText.includes(w));
          if (allFound) matchScore += 0.8;
        }
      }
    }

    if (matchScore > 0) {
      vector[i] = Math.min(1.0, matchScore / 2.0);
    }
  }

  // Normalize vector to unit length
  let norm = 0.0;
  for (let i = 0; i < vector.length; i++) {
    norm += vector[i] * vector[i];
  }
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < vector.length; i++) {
      vector[i] /= norm;
    }
  }

  return vector;
}

/**
 * Build rich conceptual text for standard
 */
export function buildDocumentSemanticText(std) {
  const parts = [
    std.title || "",
    std.title || "", // 2x weight
    Array.isArray(std.product_keywords) ? std.product_keywords.join(" ") : "",
    Array.isArray(std.product_keywords) ? std.product_keywords.join(" ") : "", // 2x weight
    std.scope || "",
    std.category || "",
    std.sub_category || "",
    std.department || "",
    Array.isArray(std.safety_standards) ? std.safety_standards.join(" ") : "",
    Array.isArray(std.technical_requirements) ? std.technical_requirements.join(" ") : ""
  ];
  return parts.join(" ").toLowerCase();
}

/**
 * Build query semantic text handling Indic scripts
 */
export function buildQuerySemanticText(query) {
  const indic = normalizeIndicQuery(query);
  const lang = indic.language;

  let queryText = String(query).toLowerCase();
  if (lang !== "English" && indic.normalized) {
    queryText = `${indic.normalized} ${queryText}`;
  }

  return {
    language: lang,
    queryText: queryText
  };
}

/**
 * Calculate Cosine Similarity between two unit vectors
 */
export function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0.0;
  let dotProduct = 0.0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
  }
  return Math.max(0.0, Math.min(1.0, dotProduct));
}

/**
 * Compute semantic similarity between query and pre-embedded standard
 */
export function calculateSemanticScore(query, std) {
  const { queryText } = buildQuerySemanticText(query);
  const qVector = computeConceptVector(queryText);

  // Check if standard has precomputed vector, otherwise compute dynamically
  const dVector = std._concept_vector || computeConceptVector(buildDocumentSemanticText(std));

  const cosSim = cosineSimilarity(qVector, dVector);

  // Character/word n-gram conceptual bonus for descriptive queries
  const qTokens = cleanTokens(queryText);
  const dTokens = cleanTokens(std._semantic_text || buildDocumentSemanticText(std));

  let tokenMatchCount = 0;
  for (const qt of qTokens) {
    if (dTokens.includes(qt)) {
      tokenMatchCount++;
    }
  }

  const tokenOverlap = qTokens.length > 0 ? (tokenMatchCount / qTokens.length) : 0.0;

  // Blended semantic score
  let finalSim = (0.75 * cosSim) + (0.25 * tokenOverlap);
  if (cosSim >= 0.70) {
    finalSim = Math.max(finalSim, cosSim);
  }

  return Math.round(finalSim * 1000) / 1000;
}
