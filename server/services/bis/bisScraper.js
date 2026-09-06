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
 * Helper to extract fields from standard detail page text
 */
export function extractDetailFields(pageText) {
  if (!pageText) return {};
  const lines = pageText.split('\n').map(s => s.trim()).filter(Boolean);

  const getVal = (prefix) => {
    const idx = lines.findIndex(l => {
      const clean = l.replace(/\s+/g, ' ').toLowerCase();
      return clean.startsWith(prefix.toLowerCase()) || clean === prefix.toLowerCase() + ' :';
    });
    if (idx === -1) return null;
    const line = lines[idx];
    let afterColon = line.split(':').slice(1).join(':').trim();
    if (afterColon && afterColon.toLowerCase() !== 'n/a' && afterColon.toLowerCase() !== 'none') {
      return afterColon;
    }
    if (idx + 1 < lines.length) {
      const nextLine = lines[idx + 1].trim();
      if (!nextLine.includes(':') && nextLine.toLowerCase() !== 'n/a' && nextLine.toLowerCase() !== 'none') {
        return nextLine;
      }
    }
    return null;
  };

  const cert = getVal('Certification');
  let certObj = null;
  if (cert && cert.toLowerCase() !== 'n/a' && cert.toLowerCase() !== 'none') {
    const isMandatory = cert.toLowerCase().includes('mandatory') ||
      cert.toLowerCase().includes('isi mark') ||
      cert.toLowerCase().includes('crs') ||
      cert.toLowerCase().includes('qco');
    certObj = { status: cert, mandatory: isMandatory };
  }

  return {
    reviewed_in: getVal('Reviewed In'),
    department: getVal('Department'),
    technical_committee: getVal('Technical Committee'),
    type_of_standard: getVal('Type of Standard'),
    certification: certObj,
    superseding_is: getVal('Superseding IS'),
    degree_of_equivalence: getVal('Degree of Equivalence'),
    number_of_revisions: getVal('Number of Revisions'),
    number_of_amendments: getVal('Number of Amendments'),
    reaffirmation_year: getVal('Reaffirmation Year'),
    language: getVal('Language'),
    member_secretary: getVal('Member Secretary'),
    relevant_ministries: getVal('Relevant Ministries'),
    short_title: getVal("Short Common Man's Title"),
    group: getVal('Group'),
    sub_group: getVal('Sub-Group'),
    sub_sub_group: getVal('Sub Sub-Group'),
    ics_code: getVal('ICS Code')
  };
}

/**
 * Scrape BIS Standards Portal for a keyword or candidate queries.
 * @param {string|string[]} queryInput - Single keyword or array of candidate query terms
 * @param {number} limit - Maximum number of standards to return
 * @param {number} timeoutMs - Timeout per request in milliseconds (capped at 8000ms)
 */
export async function scrapeBisKeyword(queryInput, limit = 20, timeoutMs = 8000) {
  if (!queryInput) return [];

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
  console.log(`[BIS] search started query="${primaryTerm}"`);

  const tStart = Date.now();
  const maxBudgetMs = 10000; // Strictly bound total live BIS budget to 10 seconds

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
    page.setDefaultTimeout(Math.min(timeoutMs, 8000));

    for (const term of searchTerms) {
      if (results.length >= limit || (Date.now() - tStart) > (maxBudgetMs - 3000)) break;

      try {
        await page.goto(`${BIS_BASE_URL}/website`, { waitUntil: 'domcontentloaded', timeout: 7000 });
        await page.waitForSelector('#isSearch', { timeout: 6000 });
        await page.fill('#isSearch', term);
        await page.keyboard.press('Enter');

        // Wait for search result listings to populate
        try {
          await page.waitForSelector('a[href*="standard-details"]', { timeout: 4500 });
        } catch (_) {}

        const extractedListings = await page.evaluate(() => {
          const listings = Array.from(document.querySelectorAll('.search__listing'));
          if (listings.length > 0) {
            return listings.map(l => {
              const a = l.querySelector('a[href*="standard-details"]');
              const p = l.querySelector('p');
              return {
                isText: a ? a.innerText.trim() : '',
                href: a ? a.href : '',
                titleText: p ? p.innerText.trim() : ''
              };
            }).filter(item => item.isText.length > 2 && item.href);
          }

          // Fallback if class changes
          const anchors = Array.from(document.querySelectorAll('a[href*="standard-details"]'));
          return anchors.map(a => {
            const p = a.closest('tr, li, .card, div')?.querySelector('p');
            return {
              isText: a.innerText.trim(),
              href: a.href,
              titleText: p ? p.innerText.trim() : ''
            };
          }).filter(item => item.isText.length > 2 && item.href);
        });

        if (extractedListings && extractedListings.length > 0) {
          for (const item of extractedListings) {
            if (results.length >= limit) break;
            const isNum = extractIsNumberFromText(item.isText) || extractIsNumberFromText(item.href);
            if (!isNum) continue;

            const key = isNum.toUpperCase();
            if (!seen.has(key)) {
              seen.add(key);

              // Validate URL domain and structure
              const validUrl = (item.href && item.href.startsWith(`${BIS_BASE_URL}/website/standard-details`))
                ? item.href
                : null;

              const title = item.titleText && item.titleText.length > 3
                ? item.titleText
                : (item.isText !== isNum && item.isText.length > 4 ? item.isText : `Indian Standard ${isNum}`);

              results.push({
                is_number: isNum,
                title: title,
                detail_url: validUrl,
                official_bis_url: validUrl,
                bis_status: "Active",
                status: "Active",
                category: "BIS Portal Discovered",
                verification_source: "official_bis_live",
                data_source: "BIS_LIVE",
                search_term: term,
                scope: `Official Indian Standard ${isNum} discovered live from the BIS Standards Portal.`,
                certification: null
              });
            }
          }
        }

        if (results.length > 0) break;
      } catch (termErr) {
        console.warn(`[BIS] Notice for query term '${term}': ${termErr.message}`);
      }
    }

    console.log(`[BIS] candidates=${results.length}`);

    // Enrich top candidates within remaining time budget
    const toEnrich = results.slice(0, Math.min(results.length, 5));
    for (const res of toEnrich) {
      if ((Date.now() - tStart) > (maxBudgetMs - 2000)) {
        console.log(`[BIS] detail enrichment budget reached, stopping enrichment`);
        break;
      }

      if (res.official_bis_url) {
        console.log(`[BIS] enriching ${res.is_number}`);
        try {
          await page.goto(res.official_bis_url, { waitUntil: 'domcontentloaded', timeout: 4000 });
          // Give brief moment for dynamic fields to render
          try {
            await page.waitForSelector('text=Department:', { timeout: 2500 });
          } catch (_) {}

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
          if (fields.language) res.language = fields.language;
          if (fields.member_secretary) res.member_secretary = fields.member_secretary;
          if (fields.relevant_ministries) res.relevant_ministries = fields.relevant_ministries;
          if (fields.ics_code) res.ics_code = fields.ics_code;
          if (fields.short_title && (!res.title || res.title.startsWith('Indian Standard'))) {
            res.title = fields.short_title;
          }

          // Extract verified referenced standard links present on the page
          const refAnchors = await page.evaluate(() => {
            const anchors = Array.from(document.querySelectorAll('a[href*="standard-details"]'));
            return anchors.map(a => ({
              text: a.innerText.trim(),
              href: a.href
            })).filter(a => a.text && a.href && a.href.startsWith('https://standards.bis.gov.in/website/standard-details'));
          });

          if (refAnchors.length > 0) {
            res.referenced_bis_links = refAnchors;
          }

          console.log(`[BIS] detail validated ${res.is_number}`);
        } catch (enrichErr) {
          console.warn(`[BIS] Could not enrich ${res.is_number}: ${enrichErr.message}`);
        }
      }
    }

    const elapsed = Date.now() - tStart;
    console.log(`[Search] BIS search completed in ${elapsed}ms`);
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
