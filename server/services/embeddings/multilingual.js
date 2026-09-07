/**
 * Multilingual Semantic Mapper for Indian Standards Retrieval Architecture (ISRA)
 * Provides script detection, Indic tokenization, and concept mapping for
 * Hindi (Devanagari) and Telugu to technical procurement concepts.
 */

// Script detectors
export const TELUGU_REGEX = /[\u0C00-\u0C7F]/;
export const HINDI_REGEX = /[\u0900-\u097F]/;

// Multilingual concept dictionaries
const HINDI_CONCEPT_MAP = {
  // Head & Worker Safety
  "सुरक्षा": "safety protection",
  "हेलमेट": "helmet headgear",
  "निर्माण": "construction building",
  "श्रमिक": "workers personnel",
  "श्रमिकों": "workers personnel",
  "मजदूर": "workers",
  "मजदूरों": "workers",
  "सिर": "head",
  "बचाव": "protection safety",
  "कवरऑल": "coveralls protective",
  "दस्ताने": "gloves",
  "चश्मा": "goggles protective",

  // Construction & Materials
  "सीमेंट": "cement concrete",
  "स्टील": "steel rebar",
  "इस्पात": "steel rebar",
  "छड़": "rebar bar",
  "छड़ें": "rebars bars",
  "सरिया": "rebar tmt bar",
  "कंक्रीट": "concrete reinforcement",
  "ईंट": "brick clay brick",
  "ईंटें": "bricks",
  "पाइप": "pipe piping",
  "तार": "wire cable",

  // Illumination & Electrical
  "प्रकाश": "lighting luminaire",
  "बत्ती": "lamp luminaire",
  "लाइट": "light luminaire",
  "सड़क": "road street",
  "मार्ग": "road street",
  "ट्रांसफार्मर": "transformer",

  // Water & Domestic
  "पानी": "water drinking water",
  "जल": "water drinking water",
  "पेयजल": "drinking water potable",
  "बोतल": "bottle vacuum flask",
  "टंकी": "tank storage tank",
  "बर्तन": "utensil container",

  // Fire Safety
  "अग्नि": "fire extinguisher",
  "आग": "fire extinguisher",
  "अग्निशामक": "fire extinguisher",
  "शामक": "extinguisher",

  // Food & Agri
  "गेहूं": "wheat grain",
  "चावल": "rice paddy",
  "अनाज": "grain cereal",
  "आटा": "wheat flour",
  "रोटी": "bread bakery",
  "ब्रेड": "bread bakery",
  "दूध": "milk dairy",

  // Stationery & Furniture
  "कलम": "pen ball point",
  "पेन": "pen ball point",
  "कागज": "paper stationery",
  "कुर्सी": "chair office chair",
  "फर्नीचर": "furniture"
};

const HINDI_STOP_WORDS = new Set([
  "के", "लिए", "का", "की", "को", "में", "पर", "से", "और", "या", "है", "हैं", "था", "थी", "होना", "चाहिए", "कृपया", "बताइए"
]);

const TELUGU_CONCEPT_MAP = {
  // Head & Worker Safety
  "రక్షణ": "safety protection",
  "హెల్మెట్": "helmet headgear",
  "నిర్మాణ": "construction building",
  "కార్మికుల": "workers personnel",
  "కార్మికులు": "workers personnel",
  "పనివారు": "workers personnel",
  "తల": "head",
  "టోపీ": "cap helmet",

  // Construction & Materials
  "సిమెంట్": "cement concrete",
  "ఉక్కు": "steel rebar",
  "కడ్డీలు": "bars rebar",
  "కడ్డీ": "bar rebar",
  "కంక్రీట్": "concrete reinforcement",
  "ఇటుక": "brick clay brick",
  "ఇటుకలు": "bricks",
  "పైపు": "pipe piping",
  "పైపులు": "pipes",

  // Illumination & Electrical
  "లైట్లు": "lights luminaires",
  "లైట్": "light luminaire",
  "దీపాలు": "lamps luminaires",
  "రహదారి": "road street",
  "రోడ్డు": "road street",
  "వీధి": "street road",

  // Water & Domestic
  "నీటి": "water drinking water",
  "నీరు": "water drinking water",
  "త్రాగునీరు": "drinking water potable",
  "సీసా": "bottle vacuum flask",
  "ట్యాంక్": "tank storage tank",
  "తొట్టి": "tank container",

  // Fire Safety
  "అగ్ని": "fire extinguisher",
  "మంటలు": "fire",
  "ఆర్పివేసే": "fire extinguisher",
  "అగ్నిమాపక": "fire extinguisher",

  // Food & Agri
  "గోధుమ": "wheat grain",
  "గోధుమలు": "wheat grains",
  "బియ్యం": "rice paddy",
  "రొట్టె": "bread bakery",
  "పాలు": "milk dairy",

  // Stationery & Furniture
  "కలం": "pen ball point",
  "పెన్ను": "pen ball point",
  "కాగితం": "paper stationery",
  "కుర్చీ": "chair office chair"
};

const TELUGU_STOP_WORDS = new Set([
  "కోసం", "యొక్క", "లో", "పై", "మరియు", "లేదా", "ఉన్న", "కావాలి", "దయచేసి", "చెప్పండి"
]);

/**
 * Detect language of input text
 */
export function detectLanguage(text) {
  if (!text || typeof text !== 'string') return "English";
  if (TELUGU_REGEX.test(text)) return "Telugu";
  if (HINDI_REGEX.test(text)) return "Hindi";
  return "English";
}

/**
 * Normalize Indic query into English technical concepts for semantic vector space
 */
export function normalizeIndicQuery(query) {
  if (!query || typeof query !== 'string') return { language: "English", normalized: "", concepts: [] };

  const lang = detectLanguage(query);
  if (lang === "English") {
    return { language: "English", normalized: query, concepts: [] };
  }

  const words = query.trim().split(/\s+/);
  const concepts = [];

  if (lang === "Hindi") {
    for (const raw of words) {
      const clean = raw.replace(/[.,!?;:"'()]/g, "").trim();
      if (!clean || HINDI_STOP_WORDS.has(clean)) continue;
      if (HINDI_CONCEPT_MAP[clean]) {
        concepts.push(HINDI_CONCEPT_MAP[clean]);
      }
    }
  } else if (lang === "Telugu") {
    for (const raw of words) {
      const clean = raw.replace(/[.,!?;:"'()]/g, "").trim();
      if (!clean || TELUGU_STOP_WORDS.has(clean)) continue;
      if (TELUGU_CONCEPT_MAP[clean]) {
        concepts.push(TELUGU_CONCEPT_MAP[clean]);
      }
    }
  }

  const translatedText = concepts.join(" ");
  return {
    language: lang,
    original: query,
    normalized: translatedText || query,
    concepts: concepts
  };
}
