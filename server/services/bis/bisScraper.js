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

/**
 * Scrape BIS Standards Portal for a keyword or query.
 * Falls back across candidate query terms if primary returns 0 results.
 */
export async function scrapeBisKeyword(keyword, limit = 6, timeoutMs = 12000) {
  if (!keyword || !keyword.trim()) return [];
  const rawKw = keyword.trim();
  console.log(`[BIS] Starting live discovery for: '${rawKw}'`);

  // Build candidate search terms (e.g. "electric transformer" -> ["electric transformer", "transformer"])
  const searchTerms = [rawKw];
  const words = rawKw.split(/\s+/).filter(w => w.length > 3);
  if (words.length > 1) {
    // Also try the last prominent noun (e.g., "transformer" from "electric transformer", "chair" from "office chair")
    const lastWord = words[words.length - 1];
    if (!searchTerms.includes(lastWord)) {
      searchTerms.push(lastWord);
    }
    // Also try the first two words
    const firstTwo = words.slice(0, 2).join(" ");
    if (!searchTerms.includes(firstTwo)) {
      searchTerms.push(firstTwo);
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
              detail_url: c.href || searchUrl,
              official_bis_url: c.href || searchUrl,
              bis_status: "Active",
              status: "Active",
              category: "BIS Portal Discovered",
              verification_source: "official_bis_live",
              data_source: "BIS_LIVE",
              search_term: term,
              published_year: c.publishedYear || null,
              scope: `Official Indian Standard ${isNum} discovered live from the BIS Standards Portal for query '${rawKw}'.`,
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

    console.log(`[BIS] Live discovery finished: found ${results.length} standard(s) for '${rawKw}'`);
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
