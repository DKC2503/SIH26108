import { chromium } from 'playwright';

const BIS_BASE_URL = "https://standards.bis.gov.in";
const BIS_ADMIN_BASE_URL = "https://standardsadmin.bis.gov.in";
const BIS_SEARCH_URL = `${BIS_BASE_URL}/website/know-your-standards`;
const PAGE_TIMEOUT = 12000;

export const BIS_API_HEADERS = {
  'Referer': 'https://standards.bis.gov.in/',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Content-Type': 'application/json'
};

// In-memory query and details caches (TTL: 2 hours)
export const bisQueryCache = new Map();
export const bisDetailsCache = new Map();
const CACHE_TTL_MS = 2 * 60 * 60 * 1000;

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

  // 1. Check direct BIS review-service API
  try {
    const res = await fetch(`${BIS_ADMIN_BASE_URL}/review-service//searchKnowStandards`, {
      method: 'POST',
      headers: BIS_API_HEADERS,
      body: JSON.stringify({ searchText: 'cement' }),
      signal: AbortSignal.timeout(3000)
    });
    if (res.ok) {
      cachedHealth = { status: "available" };
      lastHealthCheck = Date.now();
      return cachedHealth;
    }
  } catch (_) {}

  // 2. Check Playwright browser launcher as fallback
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
 * First uses official BIS Review-Service REST endpoint (< 1.5s).
 * If REST fails or returns 0, falls back gracefully to Playwright browser scraper.
 *
 * @param {string|string[]} queryInput - Single keyword or array of candidate query terms
 * @param {number} limit - Maximum number of standards to return
 * @param {number} timeoutMs - Timeout per request in milliseconds
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
  console.log(`[BIS] search terms=${JSON.stringify(searchTerms.slice(0, 4))}`);

  const tStart = Date.now();
  const results = [];
  const seen = new Set();

  // 1. FAST PATH: Direct BIS review-service REST API
  try {
    for (const term of searchTerms.slice(0, 3)) {
      if (results.length >= limit || (Date.now() - tStart) > 6000) break;

      const cacheKey = term.toLowerCase();
      let termItems = null;

      if (bisQueryCache.has(cacheKey)) {
        const cached = bisQueryCache.get(cacheKey);
        if (Date.now() - cached.timestamp < CACHE_TTL_MS) {
          termItems = cached.data;
        }
      }

      if (!termItems) {
        try {
          const res = await fetch(`${BIS_ADMIN_BASE_URL}/review-service//searchKnowStandards`, {
            method: 'POST',
            headers: BIS_API_HEADERS,
            body: JSON.stringify({ searchText: term }),
            signal: AbortSignal.timeout(Math.min(timeoutMs, 4000))
          });

          if (res.ok) {
            const json = await res.json();
            const list = Array.isArray(json) ? json : (Array.isArray(json?.data) ? json.data : null);
            if (list) {
              termItems = list;
              bisQueryCache.set(cacheKey, { data: list, timestamp: Date.now() });
            }
          }
        } catch (fetchErr) {
          console.warn(`[BIS] Direct REST search failed for '${term}': ${fetchErr.message}`);
        }
      }

      if (Array.isArray(termItems) && termItems.length > 0) {
        for (const item of termItems) {
          if (results.length >= limit) break;
          const rawNum = item.standardNumber || item.standard_number;
          if (!rawNum) continue;

          const isNum = normalizeIsNumber(rawNum);
          if (!isNum) continue;

          const key = isNum.toUpperCase();
          if (!seen.has(key)) {
            seen.add(key);

            const encId = item.standardEncId || item.encryptedId || item.encId || '';
            const officialUrl = encId
              ? `${BIS_BASE_URL}/website/standard-details?encryptedId=${encodeURIComponent(encId)}&standardNumber=${encodeURIComponent(rawNum)}`
              : `${BIS_BASE_URL}/website/standard-details`;

            const title = (item.standardName || item.standard_name || item.title || `Indian Standard ${isNum}`).trim();

            results.push({
              is_number: isNum,
              title: title,
              detail_url: officialUrl,
              official_bis_url: officialUrl,
              standard_enc_id: encId,
              bis_status: item.status || "Active",
              status: item.status || "Active",
              published_on: item.publishedOn || item.published_on || null,
              valid_upto: item.validUpto || item.valid_upto || null,
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
    }
  } catch (apiErr) {
    console.warn(`[BIS] Direct REST API error: ${apiErr.message}`);
  }

  // If direct REST API returned candidates, we can enrich top candidates and return
  if (results.length > 0) {
    console.log(`[BIS] candidates=${results.length} (source: official_bis_api)`);

    // Quick parallel enrichment for top 4 candidates
    const toEnrich = results.slice(0, 4);
    await Promise.allSettled(toEnrich.map(async (res) => {
      if (res.standard_enc_id) {
        try {
          await enrichStandardFromBis(res, 2000);
        } catch (_) {}
      }
    }));

    const elapsed = Date.now() - tStart;
    console.log(`[Search] BIS search completed in ${elapsed}ms`);
    return results;
  }

  // 2. FALLBACK PATH: Playwright browser scraping (if REST unavailable or returned 0)
  console.log(`[BIS] Direct REST returned 0 or failed, attempting browser scraping fallback`);
  let browser = null;
  try {
    browser = await launchBrowser();
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent: BIS_API_HEADERS['User-Agent']
    });

    const page = await context.newPage();
    page.setDefaultTimeout(Math.min(timeoutMs, 6000));

    for (const term of searchTerms.slice(0, 2)) {
      if (results.length >= limit || (Date.now() - tStart) > 9000) break;

      try {
        await page.goto(`${BIS_BASE_URL}/website`, { waitUntil: 'domcontentloaded', timeout: 6000 });
        await page.waitForSelector('#isSearch', { timeout: 4000 });
        await page.fill('#isSearch', term);
        await page.keyboard.press('Enter');

        try {
          await page.waitForSelector('a[href*="standard-details"]', { timeout: 3500 });
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
        console.warn(`[BIS] Browser notice for query term '${term}': ${termErr.message}`);
      }
    }

    console.log(`[BIS] candidates=${results.length}`);
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

/**
 * Enriches a standard object with authentic department, committee, certification,
 * revisions, and referenced standards using official review-service REST endpoints.
 *
 * @param {object} standard - The standard object to enrich
 * @param {number} timeoutMs - Timeout in milliseconds
 */
export async function enrichStandardFromBis(standard, timeoutMs = 2500) {
  if (!standard || !standard.standard_enc_id) return standard;

  const encId = standard.standard_enc_id;
  let details = null;

  // Check details cache
  if (bisDetailsCache.has(encId)) {
    const cached = bisDetailsCache.get(encId);
    if (Date.now() - cached.timestamp < CACHE_TTL_MS) {
      details = cached.data;
    }
  }

  if (!details) {
    try {
      const [detRes, refRes] = await Promise.allSettled([
        fetch(`${BIS_ADMIN_BASE_URL}/review-service//getWebsiteStandardDetails`, {
          method: 'POST',
          headers: BIS_API_HEADERS,
          body: JSON.stringify({ encId: encId, fromPage: 'guestUserPage' }),
          signal: AbortSignal.timeout(timeoutMs)
        }).then(r => r.ok ? r.json() : null),
        fetch(`${BIS_ADMIN_BASE_URL}/review-service//getCrossRefDetails`, {
          method: 'POST',
          headers: BIS_API_HEADERS,
          body: JSON.stringify({ standardId: encId }),
          signal: AbortSignal.timeout(timeoutMs)
        }).then(r => r.ok ? r.json() : null)
      ]);

      const rawDetails = (detRes.status === 'fulfilled' && detRes.value) ? (detRes.value.data || detRes.value) : null;
      const refData = (refRes.status === 'fulfilled' && refRes.value) ? (refRes.value.data || refRes.value) : null;
      const rawRefs = Array.isArray(refData) ? refData : (Array.isArray(refData?.crossRefData) ? refData.crossRefData : []);

      details = { rawDetails, rawRefs };
      bisDetailsCache.set(encId, { data: details, timestamp: Date.now() });
    } catch (enrichErr) {
      console.warn(`[BIS] Enrich error for ${standard.is_number}: ${enrichErr.message}`);
      return standard;
    }
  }

  if (details && details.rawDetails) {
    const d = details.rawDetails;
    if (d.departmentName || d.department) standard.department = d.departmentName || d.department;
    if (d.committeeName || d.technicalCommittee) standard.technical_committee = d.committeeName || d.technicalCommittee;
    if (d.standardType || d.typeOfStandard) standard.type_of_standard = d.standardType || d.typeOfStandard;
    if (d.reaffirmationYear) standard.reaffirmation_year = String(d.reaffirmationYear);
    if (d.noOfRevisions !== undefined && d.noOfRevisions !== null) standard.number_of_revisions = String(d.noOfRevisions);
    if (d.noOfAmendments !== undefined && d.noOfAmendments !== null) standard.number_of_amendments = String(d.noOfAmendments);
    if (d.scopeText && (!standard.scope || standard.scope.startsWith('Official Indian Standard'))) {
      standard.scope = d.scopeText.trim();
    }
    if (d.standardTitle && (!standard.title || standard.title.startsWith('Indian Standard'))) {
      standard.title = d.standardTitle.trim();
    }

    if (d.isCertificationMandatory || d.certificationStatus || d.isiMark) {
      const isMandatory = Boolean(d.isCertificationMandatory || (d.certificationStatus && d.certificationStatus.toLowerCase().includes('mandatory')));
      standard.certification = {
        status: d.certificationStatus || (isMandatory ? 'Mandatory ISI' : 'Voluntary'),
        mandatory: isMandatory
      };
    }
  }

  if (details && Array.isArray(details.rawRefs) && details.rawRefs.length > 0) {
    standard.referenced_bis_links = details.rawRefs.map(ref => {
      const refNum = ref.standardNumber || ref.standard_number;
      const refEnc = ref.standardEncId || ref.encId || '';
      return {
        text: refNum ? normalizeIsNumber(refNum) : 'Referenced Standard',
        href: refEnc ? `${BIS_BASE_URL}/website/standard-details?encryptedId=${encodeURIComponent(refEnc)}&standardNumber=${encodeURIComponent(refNum || '')}` : null
      };
    }).filter(r => r.text && r.href);
  }

  console.log(`[BIS] validated=${standard.is_number}`);
  return standard;
}

