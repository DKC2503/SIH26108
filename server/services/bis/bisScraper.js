import { chromium } from 'playwright';

const BIS_BASE_URL = "https://standards.bis.gov.in";
const BIS_SEARCH_URL = `${BIS_BASE_URL}/website/know-your-standards`;
const PAGE_TIMEOUT = 12000;

// Health check cache
let cachedHealth = null;
let lastHealthCheck = 0;

/**
 * Robust Playwright browser launcher.
 * Tries default Chromium, then system-installed Chrome, then system-installed MS Edge.
 */
export async function launchBrowser() {
  const launchOptions = {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  };

  // 1. Try bundled Playwright Chromium executable
  try {
    return await chromium.launch(launchOptions);
  } catch (errDefault) {
    // 2. Try system Google Chrome
    try {
      return await chromium.launch({ ...launchOptions, channel: 'chrome' });
    } catch (errChrome) {
      // 3. Try system Microsoft Edge
      try {
        return await chromium.launch({ ...launchOptions, channel: 'msedge' });
      } catch (errEdge) {
        throw new Error("playwright_browser_missing");
      }
    }
  }
}

/**
 * Health verification for BIS discovery system.
 * Returns { status: "available" } or { status: "unavailable", reason: "..." }
 */
export async function getBisHealth(force = false) {
  const now = Date.now();
  if (!force && cachedHealth && (now - lastHealthCheck < 60000)) {
    return cachedHealth;
  }

  try {
    const browser = await launchBrowser();
    await browser.close();
    cachedHealth = { status: "available" };
  } catch (err) {
    const reason = err.message.includes("playwright_browser_missing")
      ? "playwright_browser_missing"
      : "browser_launch_failed";
    cachedHealth = { status: "unavailable", reason };
  }

  lastHealthCheck = Date.now();
  return cachedHealth;
}

export function parseIsNumber(val) {
  if (!val) return null;
  let str = String(val).trim().toUpperCase().replace(/^IS\s+/i, "").replace(/\s+/g, " ");
  const match = str.match(/^(\d+(?:\.\d+)?)(?:\s*\(?\s*PART\s*(\d+)\s*\)?)?\s*:\s*(\d{4})$/i);
  if (!match) return null;
  return {
    base: match[1],
    part: match[2] ? parseInt(match[2], 10) : null,
    year: match[3]
  };
}

export function normalizeIsNumber(val) {
  if (!val) return null;
  const parsed = parseIsNumber(val);
  if (!parsed) {
    let clean = String(val).trim().replace(/\s+/g, " ");
    if (!clean.toUpperCase().startsWith("IS ")) {
      clean = `IS ${clean}`;
    }
    return clean;
  }
  if (parsed.part === null) {
    return `IS ${parsed.base}:${parsed.year}`;
  }
  return `IS ${parsed.base} (Part ${parsed.part}):${parsed.year}`;
}

export function extractIsNumberFromText(text) {
  if (!text) return null;
  const match = text.match(/\bIS\s*\d+(?:\s*\(?\s*PART\s*\d+(?:\s*\/\s*SEC\s*\d+)?\s*\)?)?(?:\s*:\s*\d{4})?\b/i);
  if (match) {
    return normalizeIsNumber(match[0]);
  }
  return null;
}

const OVERLY_BROAD_WORDS = new Set([
  "bar", "bars", "light", "lights", "pipe", "pipes", "water", "tank", "tanks",
  "chair", "chairs", "pen", "pens", "wire", "wires", "bottle", "bottles", "tube", "tubes",
  "valve", "valves", "plate", "plates", "sheet", "sheets", "pump", "pumps"
]);

/**
 * Scrape BIS Standards Portal for a keyword or candidate queries.
 * Falls back across candidate query terms while preserving product meaning.
 * @param {string|string[]} queryInput - Single keyword or array of candidate query terms
 * @param {number} limit - Maximum number of standards to return
 * @param {number} timeoutMs - Timeout per request in milliseconds
 */
export async function scrapeBisKeyword(queryInput, limit = 6, timeoutMs = 12000) {
  if (!queryInput) return [];

  // Assemble list of search terms
  const searchTerms = [];
  const addTerm = (t) => {
    if (!t || typeof t !== 'string') return;
    const clean = t.trim();
    if (clean.length >= 2 && !searchTerms.includes(clean)) {
      searchTerms.push(clean);
    }
  };

  if (Array.isArray(queryInput)) {
    for (const q of queryInput) addTerm(q);
  } else {
    addTerm(queryInput);
  }

  if (searchTerms.length === 0) return [];
  const primaryTerm = searchTerms[0];
  console.log(`[BIS] Starting live discovery for: '${primaryTerm}' (candidate queries: ${JSON.stringify(searchTerms)})`);

  // Also add derived 2-word combinations if primary query is longer
  const words = primaryTerm.split(/\s+/).filter(w => w.length > 2);
  if (words.length > 2) {
    const firstTwo = words.slice(0, 2).join(" ");
    if (!OVERLY_BROAD_WORDS.has(firstTwo.toLowerCase())) {
      addTerm(firstTwo);
    }
    const lastTwo = words.slice(-2).join(" ");
    if (!OVERLY_BROAD_WORDS.has(lastTwo.toLowerCase())) {
      addTerm(lastTwo);
    }
  }

  let browser = null;
  const results = [];
  const seen = new Set();

  try {
    browser = await launchBrowser();
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
    });

    const page = await context.newPage();
    page.setDefaultTimeout(PAGE_TIMEOUT);

    for (const term of searchTerms) {
      if (results.length >= limit) break;

      const encoded = encodeURIComponent(term);
      const searchUrl = `${BIS_SEARCH_URL}?searchTerm=${encoded}`;

      try {
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT });
        
        // Wait for Angular results to render (up to 4 seconds)
        try {
          await page.waitForSelector('.search__listing', { timeout: 4000 });
        } catch (_) {}

        const candidates = await page.evaluate(() => {
          const listings = Array.from(document.querySelectorAll('.search__listing'));
          return listings.map(listing => {
            const anchor = listing.querySelector('h2 a') || listing.querySelector('a');
            const href = anchor ? anchor.href : '';
            const lines = listing.innerText.trim().split('\n').map(s => s.trim()).filter(Boolean);
            const rawHeader = anchor ? anchor.innerText.trim() : (lines[0] || '');
            const title = lines.length > 1 ? lines[1] : rawHeader;
            const publishedLine = lines.find(l => l.startsWith('Published In:')) || '';
            const publishedYear = publishedLine.replace('Published In:', '').trim();

            return {
              rawHeader,
              title,
              href,
              publishedYear
            };
          });
        });

        for (const c of candidates) {
          if (results.length >= limit) break;
          const isNum = extractIsNumberFromText(c.rawHeader) || extractIsNumberFromText(c.title);
          if (!isNum) continue;

          const key = isNum.toUpperCase();
          if (!seen.has(key)) {
            seen.add(key);
            results.push({
              is_number: isNum,
              title: c.title !== c.rawHeader && c.title.length > 3 ? c.title : `Indian Standard ${isNum}`,
              detail_url: c.href || "",
              official_bis_url: c.href || "",
              bis_status: "Active",
              status: "Active",
              category: "BIS Portal Discovered",
              verification_source: "official_bis_live",
              data_source: "BIS_LIVE",
              search_term: term,
              published_year: c.publishedYear || null,
              scope: `Official Indian Standard ${isNum} discovered live from the BIS Standards Portal for query '${primaryTerm}'.`,
              certification: { status: "Voluntary", mandatory: false }
            });
          }
        }

        // If we found results on the primary term, no need to query looser fallback terms
        if (results.length > 0) break;
      } catch (termErr) {
        console.warn(`[BIS] Notice for query term '${term}': ${termErr.message}`);
      }
    }

    console.log(`[BIS] Live discovery finished: found ${results.length} standard(s) for '${primaryTerm}'`);
    return results;
  } catch (err) {
    console.error(`[BIS] Discovery failed: ${err.message}`);
    return [];
  } finally {
    if (browser) {
      try { await browser.close(); } catch (_) {}
    }
  }
}
