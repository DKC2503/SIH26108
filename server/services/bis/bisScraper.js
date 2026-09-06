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
/**
 * Helper to extract field from standard detail page text
 */
export function extractDetailFields(pageText) {
  if (!pageText) return {};
  const lines = pageText.split('\n').map(s => s.trim()).filter(Boolean);

  const getVal = (prefix) => {
    const line = lines.find(l => l.toLowerCase().startsWith(prefix.toLowerCase()));
    if (!line) return null;
    let val = line.slice(prefix.length).replace(/^[\s:]+/, '').trim();
    if (!val || val.toLowerCase() === 'n/a' || val.toLowerCase() === 'none') return null;
    return val;
  };

  const getRowVal = (prefix) => {
    const row = lines.find(l => l.toLowerCase().includes(prefix.toLowerCase() + ' :'));
    if (!row) return null;
    const parts = row.split(':');
    if (parts.length < 2) return null;
    const val = parts.slice(1).join(':').trim();
    if (!val || val.toLowerCase() === 'n/a' || val.toLowerCase() === 'none') return null;
    return val;
  };

  const cert = getVal('Certification') || getRowVal('Certification');
  const isMandatory = cert ? (cert.toLowerCase().includes('mandatory') || cert.toLowerCase().includes('isi mark') || cert.toLowerCase().includes('crs') || cert.toLowerCase().includes('qco')) : null;

  return {
    reviewed_in: getVal('Reviewed In') || getRowVal('Reviewed In'),
    department: getVal('Department') || getRowVal('Department'),
    technical_committee: getVal('Technical Committee') || getRowVal('Technical Committee'),
    type_of_standard: getVal('Type of Standard') || getRowVal('Type of Standard'),
    certification: cert ? { status: cert, mandatory: isMandatory } : null,
    superseding_is: getVal('Superseding IS') || getRowVal('Superseding IS'),
    degree_of_equivalence: getVal('Degree of Equivalence') || getRowVal('Degree of Equivalence'),
    number_of_revisions: getVal('Number of Revisions') || getRowVal('Number of Revisions'),
    number_of_amendments: getVal('Number of Amendments') || getRowVal('Number of Amendments'),
    reaffirmation_year: getVal('Reaffirmation Year') || getRowVal('Reaffirmation Year'),
    relevant_ministries: getVal('Relevant Ministries') || getRowVal('Relevant Ministries'),
    short_title: getVal("Short Common Man's Title") || getRowVal("Short Common Man's Title"),
    group: getVal('Group') || getRowVal('Group'),
    sub_group: getVal('Sub-Group') || getRowVal('Sub-Group'),
    sub_sub_group: getVal('Sub Sub-Group') || getRowVal('Sub Sub-Group'),
    ics_code: getVal('ICS Code') || getRowVal('ICS Code')
  };
}

/**
 * Scrape BIS Standards Portal for a keyword or candidate queries.
 * Falls back across candidate query terms while preserving product meaning.
 * @param {string|string[]} queryInput - Single keyword or array of candidate query terms
 * @param {number} limit - Maximum number of standards to return
 * @param {number} timeoutMs - Timeout per request in milliseconds
 */
export async function scrapeBisKeyword(queryInput, limit = 20, timeoutMs = 25000) {
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
    page.setDefaultTimeout(timeoutMs);

    for (const term of searchTerms) {
      if (results.length >= limit) break;

      try {
        // Strategy A: Try official website homepage input '#isSearch' (produces official standard-details links)
        await page.goto(`${BIS_BASE_URL}/website`, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
        await page.waitForSelector('#isSearch', { timeout: 8000 });
        await page.fill('#isSearch', term);
        await page.keyboard.press('Enter');

        // Wait for results to render
        try {
          await page.waitForSelector('a[href*="standard-details"]', { timeout: 6000 });
        } catch (_) {}

        const detailLinks = await page.evaluate(() => {
          const anchors = Array.from(document.querySelectorAll('a[href*="standard-details"]'));
          return anchors.map(a => ({
            isText: a.innerText.trim(),
            href: a.href,
            parentText: a.closest('tr, li, .card, div')?.innerText?.trim() || ''
          })).filter(item => item.isText.length > 2);
        });

        if (detailLinks && detailLinks.length > 0) {
          for (const item of detailLinks) {
            if (results.length >= limit) break;
            const isNum = extractIsNumberFromText(item.isText) || extractIsNumberFromText(item.href);
            if (!isNum) continue;

            const key = isNum.toUpperCase();
            if (!seen.has(key)) {
              seen.add(key);

              // Verify URL is genuine standard-details link
              const validUrl = (item.href && item.href.startsWith(`${BIS_BASE_URL}/website/standard-details`))
                ? item.href
                : null;

              results.push({
                is_number: isNum,
                title: item.isText !== isNum && item.isText.length > 4 ? item.isText : `Indian Standard ${isNum}`,
                detail_url: validUrl,
                official_bis_url: validUrl,
                bis_status: "Active",
                status: "Active",
                category: "BIS Portal Discovered",
                verification_source: "official_bis_live",
                data_source: "BIS_LIVE",
                search_term: term,
                scope: `Official Indian Standard ${isNum} discovered live from the BIS Standards Portal for query '${primaryTerm}'.`,
                certification: null
              });
            }
          }
        }

        // If strategy A returned candidates, stop querying fallback terms
        if (results.length > 0) break;

        // Strategy B: Fallback to know-your-standards search page
        const encoded = encodeURIComponent(term);
        const searchUrl = `${BIS_SEARCH_URL}?searchTerm=${encoded}`;
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs });

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

            return { rawHeader, title, href, publishedYear };
          });
        });

        for (const c of candidates) {
          if (results.length >= limit) break;
          const isNum = extractIsNumberFromText(c.rawHeader) || extractIsNumberFromText(c.title);
          if (!isNum) continue;

          const key = isNum.toUpperCase();
          if (!seen.has(key)) {
            seen.add(key);
            // CRITICAL: Ensure URL is not a fake search URL
            const isStandardDetail = c.href && c.href.includes('/standard-details');
            const officialUrl = isStandardDetail ? c.href : null;

            results.push({
              is_number: isNum,
              title: c.title !== c.rawHeader && c.title.length > 3 ? c.title : `Indian Standard ${isNum}`,
              detail_url: officialUrl,
              official_bis_url: officialUrl,
              bis_status: "Active",
              status: "Active",
              category: "BIS Portal Discovered",
              verification_source: "official_bis_live",
              data_source: "BIS_LIVE",
              search_term: term,
              published_year: c.publishedYear || null,
              scope: `Official Indian Standard ${isNum} discovered live from the BIS Standards Portal for query '${primaryTerm}'.`,
              certification: null
            });
          }
        }

        if (results.length > 0) break;
      } catch (termErr) {
        console.warn(`[BIS] Notice for query term '${term}': ${termErr.message}`);
      }
    }

    // Step 2: Enrich candidate standards with full details from actual detail page
    // Enrich top results (up to 8) to maintain high responsiveness
    const toEnrich = results.slice(0, Math.min(results.length, 8));
    for (const res of toEnrich) {
      if (res.official_bis_url) {
        try {
          await page.goto(res.official_bis_url, { waitUntil: 'domcontentloaded', timeout: 8000 });
          const pageText = await page.evaluate(() => document.body.innerText);
          const fields = extractDetailFields(pageText);

          if (fields.department) res.department = fields.department;
          if (fields.technical_committee) res.technical_committee = fields.technical_committee;
          if (fields.type_of_standard) res.type_of_standard = fields.type_of_standard;
          if (fields.certification) res.certification = fields.certification;
          if (fields.reviewed_in) res.reviewed_in = fields.reviewed_in;
          if (fields.superseding_is) res.superseding_is = fields.superseding_is;
          if (fields.degree_of_equivalence) res.degree_of_equivalence = fields.degree_of_equivalence;
          if (fields.number_of_revisions) res.number_of_revisions = fields.number_of_revisions;
          if (fields.number_of_amendments) res.number_of_amendments = fields.number_of_amendments;
          if (fields.reaffirmation_year) res.reaffirmation_year = fields.reaffirmation_year;
          if (fields.relevant_ministries) res.relevant_ministries = fields.relevant_ministries;
          if (fields.ics_code) res.ics_code = fields.ics_code;
          if (fields.short_title && (!res.title || res.title.startsWith('Indian Standard'))) {
            res.title = fields.short_title;
          }
        } catch (enrichErr) {
          console.warn(`[BIS] Could not enrich ${res.is_number}: ${enrichErr.message}`);
        }
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
