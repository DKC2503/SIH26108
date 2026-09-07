import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Common stop words
export const STOP_WORDS = new Set([
  "i", "we", "my", "our", "me", "the", "a", "an", "this", "that", "these", "those",
  "which", "what", "are", "is", "am", "do", "does", "can", "could", "should", "would",
  "please", "tell", "give", "show", "want", "need", "looking", "for", "about", "according",
  "to", "bis", "standard", "standards", "in", "of", "and", "or", "with", "from", "by",
  "procure", "procuring", "procurement", "supply", "purchase", "purchasing"
]);

// Product aliases map: [regex, product, product_type]
export const PRODUCT_ALIASES = [
  // Direct standard query
  [/\b(IS\s*\d+(?:\s*\(?\s*PART\s*[\d\w\s/-]+\s*\)?)?(?:\s*:\s*\d{4})?)\b/i, null, "is_standard_query"],

  // Cement variants
  [/\bmasonry cement\b/i, "cement", "masonry_cement"],
  [/\bportland pozzolana cement\b/i, "cement", "portland_pozzolana_cement"],
  [/\bppc\b/i, "cement", "portland_pozzolana_cement"],
  [/\bportland slag cement\b/i, "cement", "portland_slag_cement"],
  [/\bpsc\b/i, "cement", "portland_slag_cement"],
  [/\brapid hardening cement\b/i, "cement", "rapid_hardening_portland_cement"],
  [/\bwhite cement\b/i, "cement", "white_portland_cement"],
  [/\bhydrophobic cement\b/i, "cement", "hydrophobic_portland_cement"],
  [/\b(?:ordinary )?portland cement\b/i, "cement", "ordinary_portland_cement"],
  [/\bopc\b/i, "cement", "ordinary_portland_cement"],
  [/\bcement\b/i, "cement", "cement"],

  // Steel & Rebar
  [/\bhigh tensile (?:steel )?rebars?\b/i, "steel bar", "high_tensile_rebar"],
  [/\bhigh strength deformed steel bars?\b/i, "steel bar", "tmt_bar"],
  [/\btmt bars?\b/i, "steel bar", "tmt_bar"],
  [/\brebars?\b/i, "steel bar", "rebar"],
  [/\b(?:steel )?structural components?\b/i, "structural steel", "structural_steel"],
  [/\bstructural steel\b/i, "structural steel", "structural_steel"],
  [/\bstainless steel\b/i, "steel", "stainless_steel"],

  // Transformers & Electrical
  [/\b(?:electric(?:al)?\s+)?transformers?\b/i, "transformer", "transformer"],
  [/\bdistribution transformers?\b/i, "transformer", "distribution_transformer"],
  [/\bpower transformers?\b/i, "transformer", "power_transformer"],

  // Solar
  [/\bsolar panels?\b|\bsolar modules?\b|\bphotovoltaic\b/i, "solar", "solar_panel"],

  // Chairs & Furniture
  [/\boffice chairs?\b|\bwork chairs?\b/i, "office chair", "office_chair"],
  [/\bchairs?\b/i, "chair", "chair"],

  // Fire safety
  [/\b(?:portable\s+)?fire extinguishers?\b|\bextinguishers?\b/i, "fire extinguisher", "fire_extinguisher"],

  // Bridges & Infrastructure
  [/\b(?:underground\s+)?bridges?\b/i, "bridge", "bridge"],
  [/\brailway track components?\b|\brailway tracks?\b|\brailway\b/i, "railway", "railway_track"],

  // Water Treatment
  [/\b(?:drinking\s+)?water treatment(?: equipment)?\b/i, "water treatment", "water_treatment"],

  // Water bottles
  [/\bstainless steel water bottles?\b/i, "water bottle", "stainless_steel_water_bottle"],
  [/\bvacuum bottles?\b/i, "water bottle", "stainless_steel_water_bottle"],
  [/\bwater bottles?\b/i, "water bottle", "water_bottle"],

  // Water storage & tanks
  [/\bhdpe plastic water storage tanks?\b/i, "water storage tank", "hdpe_water_storage_tank"],
  [/\bwater storage tanks?\b/i, "water storage tank", "water_storage_tank"],
  [/\bplastic water tanks?\b/i, "water storage tank", "plastic_water_tank"],
  [/\bwater tanks?\b/i, "water storage tank", "water_storage_tank"],

  // Pipes
  [/\bconcrete pipes?\b/i, "concrete pipes", "concrete_pipe"],
  [/\bhdpe pipes?\b/i, "hdpe pipe", "hdpe_pipe"],
  [/\bgi pipes?\b/i, "pipe", "galvanized_iron_pipe"],
  [/\bupvc pipes?\b/i, "pipe", "upvc_pipe"],
  [/\bpipes?\b/i, "pipe", "pipe"],

  // Water
  [/\bpackaged drinking waters?\b/i, "drinking water", "packaged_drinking_water"],
  [/\bdrinking waters?\b/i, "drinking water", "drinking_water"],

  // Electrical & Lighting
  [/\bled street lights?\b/i, "led street light", "led_street_light"],
  [/\bstreet lights?\b/i, "street light", "led_street_light"],
  [/\bled (?:lamp|bulb|light)s?\b/i, "LED lamp", "led_lamp"],
  [/\bbulbs?\b|\bleds?\b/i, "LED lamp", "led_lamp"],
  [/\bpvc insulated cables?\b/i, "cable", "pvc_insulated_cable"],
  [/\belectric cables?\b/i, "cable", "electric_cable"],
  [/\belectric wires?\b/i, "wire", "electric_wire"],

  // Food
  [/\bwhite bread\b|\bbrown bread\b|\bwheat bread\b/i, "bread", "bread"],
  [/\bbread(?:s)?\b/i, "bread", "bread"],
  [/\bbakery products?\b/i, "bakery products", "bakery_products"],
  [/\bbiscuits?\b/i, "biscuits", "biscuits"],
  [/\bwheat flour\b|\batta\b/i, "wheat flour", "packaged_wheat_flour"],
  [/\bwheat(?:\s+grains?)?\b/i, "wheat", "wheat_grain"],
  [/\bedible oil\b/i, "edible oil", "packaged_edible_oil"],

  // Bricks
  [/\bfly ash bricks?\b/i, "brick", "fly_ash_brick"],
  [/\bclay bricks?\b|\bred bricks?\b/i, "brick", "clay_brick"],
  [/\bburnt clay building bricks?\b/i, "brick", "clay_brick"],
  [/\bbricks?\b/i, "brick", "brick"],

  // Stationery
  [/\bball(?:\s|-)?point pens?\b|\bball pens?\b|\bpens?\b/i, "ball point pen", "ball_point_pen"],

  // Safety
  [/\b(?:industrial\s+)?(?:safety\s+)?helmets?\b/i, "safety helmet", "safety_helmet"],
  [/\bhelmets?\b/i, "safety helmet", "safety_helmet"],
  [/\b(?:safety\s+)?shoes?\b|\bboots?\b/i, "safety shoes", "safety_shoes"],

  // Construction materials
  [/\bsand\b/i, "sand", "sand"],
  [/\baggregate\b/i, "aggregate", "aggregate"],
  [/\bpaint\b/i, "paint", "paint"],
  [/\badhesive\b/i, "adhesive", "adhesive"],
  [/\bglass\b/i, "glass", "glass"],
  [/\b(?:ceramic\s+)?tiles?\b/i, "tiles", "ceramic_tile"],
  [/\bsteel\s+(?:pipes?|tubes?)\b/i, "steel pipe", "steel_pipe"],

  // Batteries & Electrical
  [/\b(?:storage\s+)?batter(?:y|ies)\b/i, "battery", "storage_battery"],
  [/\belectric(?:al)?\s+cables?\b/i, "electrical cable", "electrical_cable"],

  // Additional Food & Agri
  [/\brice(?:\s+grains?)?\b/i, "rice", "rice_grain"],
  [/\bbun(?:s)?\b/i, "bun", "bakery_products"],
  [/\bmilk\b/i, "milk", "dairy_products"],

  // Commodities & General
  [/\b(?:writing\s+)?paper\b/i, "paper", "paper_product"],
  [/\bfurniture\b/i, "furniture", "furniture"]
];

const PURPOSE_PATTERNS = [
  /for ([\w\s]+(?:construction|building|use|supply|purpose|application|project|hospital|school|office|hostel|road|lighting))/i,
  /(?:used?|using) for ([\w\s]+)/i
];

const INDUSTRY_MAP = {
  construction: ["construction", "building", "foundation", "slab", "beam", "column", "concrete", "masonry", "civil", "road", "bridge", "brick", "cement", "rebar", "tmt"],
  food: ["food", "atta", "flour", "water", "drinking", "edible", "hostel", "canteen", "wheat", "grain", "cereal"],
  electrical: ["electrical", "cable", "wire", "led", "lamp", "bulb", "switch", "luminaire", "lighting", "transformer", "solar"],
  plumbing: ["pipe", "plumbing", "water supply", "drainage", "tank", "treatment", "hdpe pipe"],
  stationery: ["pen", "ball point", "refill", "paper", "stationery", "office"],
  manufacturing: ["steel", "tmt", "bar", "structural", "chair", "furniture", "extinguisher", "helmet", "safety", "bottle"],
  general: []
};

/**
 * High-performance deterministic requirement parser.
 * Executes in < 1ms without requiring external API calls.
 */
export function parseRequirementLocal(query) {
  const q = (query || "").trim();
  const qLower = q.toLowerCase();

  let product = null;
  let productType = null;
  let isNumberQuery = null;

  // Check direct IS number query first
  const isMatch = q.match(/\bIS\s*\d+(?:\s*\(?\s*PART(?:S)?\s*[\d\w\s/–—-]+?\s*\)?)?(?:\s*:\s*\d{4})?\b/i);
  if (isMatch) {
    isNumberQuery = isMatch[0].toUpperCase().replace(/\s+/g, ' ');
    product = isNumberQuery;
    productType = "is_standard";
  }

  if (!product) {
    for (const [pattern, p, pt] of PRODUCT_ALIASES) {
      if (pattern.test(qLower)) {
        product = p;
        productType = pt;
        break;
      }
    }
  }

  // Material extraction
  let material = null;
  const materials = ["stainless steel", "hdpe", "polyethylene", "clay", "glass", "upvc", "pvc", "concrete", "steel", "iron", "copper", "aluminum", "plastic"];
  for (const mat of materials) {
    if (qLower.includes(mat)) {
      material = mat;
      break;
    }
  }

  // Purpose extraction
  let purpose = "";
  for (const pat of PURPOSE_PATTERNS) {
    const m = qLower.match(pat);
    if (m && m[1]) {
      purpose = m[1].trim().replace(/[.,;]+$/, "");
      break;
    }
  }

  // Industry detection
  let industry = "general";
  for (const [ind, keywords] of Object.entries(INDUSTRY_MAP)) {
    if (keywords.some(kw => qLower.includes(kw))) {
      industry = ind;
      break;
    }
  }

  // Fallback if no product matched
  if (!product) {
    const procMatch = q.match(/(?:procur(?:e|ing)|need|requir(?:e|ing)|purchas(?:e|ing)|buy(?:ing)?)\s+([\w\s]+?)(?:\s+for|\s+to|\.$|$)/i);
    if (procMatch && procMatch[1]) {
      const candidate = procMatch[1].trim();
      if (candidate.split(/\s+/).length <= 6) {
        product = candidate.toLowerCase();
        productType = product.replace(/\s+/g, "_");
      }
    }
  }

  if (!product) {
    const words = q.split(/\s+/).filter(w => !STOP_WORDS.has(w.toLowerCase()));
    product = words.slice(0, 3).join(" ").toLowerCase();
    productType = product.replace(/\s+/g, "_") || "general";
  }

  // Strip generic broad industry suffix words from product if attached
  // e.g. "bread food" -> product becomes "bread", while industry is already "food"
  if (product && !isNumberQuery) {
    const broadIndustrySuffixes = [" food", " construction", " electrical", " stationery", " plumbing"];
    for (const suff of broadIndustrySuffixes) {
      if (product.endsWith(suff) && product.length > suff.length) {
        product = product.slice(0, -suff.length).trim();
        break;
      }
    }
  }

  // Build intelligent, deduplicated BIS search queries
  const bisQueries = [];
  const addQuery = (term) => {
    if (!term || typeof term !== 'string') return;
    const clean = term.trim().toLowerCase();
    if (clean.length >= 2 && !bisQueries.includes(clean)) {
      bisQueries.push(clean);
    }
  };

  // Original query and raw cleaned query ALWAYS first priority
  addQuery(qLower);
  if (product && product !== qLower) addQuery(product);

  // Automatic plural / singular expansion
  if (product && !isNumberQuery) {
    if (product.endsWith('ies')) {
      addQuery(product.slice(0, -3) + 'y');
    } else if (product.endsWith('y') && !product.endsWith('ey')) {
      addQuery(product.slice(0, -1) + 'ies');
    } else if (product.endsWith('s') && !product.endsWith('ss')) {
      addQuery(product.slice(0, -1));
    } else {
      addQuery(product + 's');
    }
  }

  if (productType && productType !== "unknown" && productType !== "general" && productType !== product && productType !== "is_standard") {
    addQuery(productType.replace(/_/g, " "));
  }

  // Domain variants for specific products
  if (product === "battery" || product === "batteries") {
    addQuery("storage battery");
    addQuery("secondary battery");
  } else if (product === "bread") {
    addQuery("bread products");
    addQuery("white bread");
    addQuery("bakery products");
  } else if (product === "bun" || product === "buns") {
    addQuery("bakery products");
    addQuery("bread");
  } else if (product === "wheat") {
    addQuery("wheat grain");
    addQuery("food grains");
  } else if (product === "rice") {
    addQuery("paddy");
    addQuery("food grains");
  } else if (product.includes("fire extinguisher")) {
    addQuery("portable fire extinguisher");
  } else if (product.includes("cable")) {
    addQuery("electric cables");
  } else if (product.includes("rebar") || product.includes("steel bar")) {
    addQuery("reinforcement bars");
    addQuery("high strength deformed steel bars");
  } else if (product.includes("light") && !product.includes("street light")) {
    addQuery("led luminaires");
  }

  if (purpose) {
    addQuery(`${product} for ${purpose}`);
  }

  return {
    language: "English",
    product: product || "unknown product",
    product_type: productType || "unknown",
    material: material,
    packaging: null,
    purpose: purpose || "general procurement",
    applications: [],
    industry: industry,
    technical_attributes: [],
    procurement_intent: true,
    bis_search_queries: bisQueries,
    is_number_query: isNumberQuery
  };
}
