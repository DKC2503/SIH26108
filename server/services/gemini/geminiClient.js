import { GoogleGenAI } from "@google/genai";

let aiInstance = null;
let geminiAvailable = false;
let geminiChecked = false;
let geminiDisableReason = "";

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

/**
 * Initialize Gemini client singleton
 */
export function getGeminiClient() {
  if (aiInstance) return aiInstance;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim().length < 10) {
    return null;
  }
  try {
    aiInstance = new GoogleGenAI({ apiKey: apiKey.trim() });
    return aiInstance;
  } catch (err) {
    console.warn(`[Gemini] Initialization warning: ${err.message}`);
    return null;
  }
}

/**
 * Startup health check:
 * - If missing: "[Gemini] NOT CONFIGURED"
 * - If present, perform ONE lightweight ping with 4.0s timeout.
 * - If valid: "[Gemini] AVAILABLE"
 * - If invalid: "[Gemini] INVALID API KEY"
 *
 * A permanent authentication failure disables Gemini until server restart.
 */
export async function checkGeminiHealth() {
  if (geminiChecked) return geminiAvailable;
  geminiChecked = true;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim().length < 10) {
    geminiAvailable = false;
    geminiDisableReason = "Missing or unconfigured GEMINI_API_KEY";
    console.log("[Gemini] NOT CONFIGURED");
    console.log("[Gemini] Local intelligence mode enabled");
    return false;
  }

  try {
    const ai = getGeminiClient();
    if (!ai) {
      geminiAvailable = false;
      geminiDisableReason = "Could not initialize client";
      console.log("[Gemini] INVALID API KEY");
      console.log("[Gemini] Local intelligence mode enabled");
      return false;
    }

    // Ping test with timeout
    const pingPromise = ai.models.generateContent({
      model: MODEL,
      contents: "ping",
      config: { maxOutputTokens: 1 }
    });

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Timeout")), 4000)
    );

    await Promise.race([pingPromise, timeoutPromise]);
    geminiAvailable = true;
    console.log("[Gemini] AVAILABLE — Connected to official Google GenAI");
    return true;
  } catch (err) {
    const msg = err.message || String(err);
    geminiAvailable = false;
    geminiDisableReason = msg;

    if (
      msg.includes("400") ||
      msg.includes("API_KEY_INVALID") ||
      msg.includes("API key not valid") ||
      msg.includes("INVALID_ARGUMENT") ||
      msg.includes("unauthenticated")
    ) {
      console.log("[Gemini] INVALID API KEY");
    } else {
      console.log(`[Gemini] UNAVAILABLE (${msg})`);
    }
    console.log("[Gemini] Local intelligence mode enabled");
    return false;
  }
}

export function isGeminiAvailable() {
  return geminiAvailable;
}

export function getGeminiStatus() {
  if (geminiAvailable) return "available";
  return "unavailable";
}

/**
 * Optional AI requirement parsing (if Gemini is available)
 */
export async function parseRequirementWithGemini(query, inputType = "product_description") {
  if (!geminiAvailable) return null;

  try {
    const ai = getGeminiClient();
    const system = `You are a procurement standards analyst for BIS. Extract product information from query. Output ONLY valid JSON:
{"product":"short product name (1-3 words)","product_type":"snake_case_variant","purpose":"intended use","industry":"industry category","bis_search_queries":["query1","query2"]}`;

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Timeout")), 5000)
    );

    const callPromise = ai.models.generateContent({
      model: MODEL,
      contents: `Input Type: ${inputType}\nUser Input: ${query}`,
      config: {
        systemInstruction: system,
        temperature: 0.1
      }
    });

    const response = await Promise.race([callPromise, timeoutPromise]);
    const text = response?.text?.trim() || "";
    const clean = text.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(clean);
    if (parsed && parsed.product && parsed.product.split(/\s+/).length <= 5) {
      return parsed;
    }
  } catch (err) {
    console.warn(`[Gemini] parseRequirement error: ${err.message}`);
  }
  return null;
}

/**
 * Optional AI explanation on TOP candidates
 */
export async function enhanceTopCandidatesWithGemini(candidates, requirement) {
  if (!geminiAvailable || !candidates || candidates.length === 0) return candidates;

  const topK = candidates.slice(0, 3);
  try {
    const ai = getGeminiClient();
    const prompt = `Requirement: ${requirement.product} (${requirement.purpose})\nAnalyze these standards and return a JSON object with IS number as key and why_recommended string as value:\n` +
      topK.map(c => `- ${c.is_number}: ${c.title}`).join("\n");

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Timeout")), 5000)
    );

    const callPromise = ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: { temperature: 0.1 }
    });

    const res = await Promise.race([callPromise, timeoutPromise]);
    const clean = (res?.text || "").replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
    const json = JSON.parse(clean);

    for (const c of candidates) {
      if (json[c.is_number]) {
        if (!c.structured_explanation) c.structured_explanation = {};
        c.structured_explanation.why_recommended = json[c.is_number];
        c.explanation = json[c.is_number];
      }
    }
  } catch (err) {
    // Non-blocking fallback
  }
  return candidates;
}
