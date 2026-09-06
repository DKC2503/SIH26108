import os
import re
import json
import time
import urllib.parse
from datetime import datetime, timezone

import certifi
from dotenv import load_dotenv
from pymongo import MongoClient
from playwright.sync_api import (
    sync_playwright,
    TimeoutError as PlaywrightTimeoutError,
)


# ============================================================
# CONFIGURATION
# ============================================================

BIS_BASE_URL = "https://standards.bis.gov.in"
BIS_SEARCH_URL = f"{BIS_BASE_URL}/website/know-your-standards"

DB_NAME = "BIS_Standards"
COLLECTION_NAME = "standards"

PAGE_TIMEOUT = 12000
SEARCH_WAIT_MS = 1500
MAX_SEARCH_ATTEMPTS = 1

# Maximum BIS results collected during keyword discovery.
DEFAULT_KEYWORD_LIMIT = 10


# ============================================================
# PROTECTED USER / AI FIELDS
# ============================================================

PROTECTED_FIELDS = {
    "category",
    "sub_category",
    "applicability",
    "key_requirements",
    "technical_requirements",
    "product_keywords",
    "cross_references",
    "related_standards",
    "safety_standards",
    "installation_standards",
    "supersedes",
    "superseded_by",
    # BIS-extracted fields are NOT protected — BIS wins
}


# ============================================================
# BIS FIELDS THAT MAY BE REFRESHED
# ============================================================

BIS_REFRESH_FIELDS = {
    "title",
    "department",
    "technical_committee",
    "certification",
    "superseding_is",
    "degree_of_equivalence",
    "number_of_revisions",
    "number_of_amendments",
    "type_of_standard",
    "language",
    "reaffirmation_year",
    "reviewed_in",
    "member_secretary",
    # New BIS-scraped fields (always refresh from live BIS)
    "scope",
    "normative_references",
    "amendments",
    "bis_status",
}


# ============================================================
# ENVIRONMENT
# ============================================================

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")

if not MONGO_URI:
    raise RuntimeError(
        "\nMONGO_URI was not found.\n"
        "Make sure your .env file contains your MongoDB Atlas URI.\n"
    )


# ============================================================
# GENERAL HELPERS
# ============================================================

def clean_text(value):
    if value is None:
        return None

    value = str(value)
    value = value.replace("\xa0", " ")
    value = re.sub(r"\s+", " ", value)
    value = value.strip()

    return value if value else None


def utc_now():
    return datetime.now(timezone.utc)


def today_string():
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


# ============================================================
# IS NUMBER PARSING
# ============================================================

def parse_is_number(value):
    """
    Supports:

        17803:2022
        IS 17803:2022
        is 17803 : 2022

        17804 Part 1:2022
        IS 17804 Part 1:2022

        17804 (Part 1):2022
        IS 17804 (Part 1):2022
    """

    value = clean_text(value)

    if not value:
        return None

    value = value.upper()

    value = re.sub(
        r"^\s*IS\s*",
        "",
        value,
        flags=re.IGNORECASE,
    )

    value = re.sub(r"\s+", " ", value).strip()

    pattern = re.compile(
        r"""
        ^
        (?P<base>\d+(?:\.\d+)?)
        \s*
        (?:
            \(?
            \s*PART\s*
            (?P<part>\d+)
            \s*\)?
        )?
        \s*:\s*
        (?P<year>\d{4})
        $
        """,
        re.IGNORECASE | re.VERBOSE,
    )

    match = pattern.match(value)

    if not match:
        return None

    return {
        "base": match.group("base"),
        "part": (
            int(match.group("part"))
            if match.group("part")
            else None
        ),
        "year": match.group("year"),
    }


def normalize_is_number(value):
    parsed = parse_is_number(value)

    if not parsed:
        return None

    if parsed["part"] is None:
        return f"IS {parsed['base']}:{parsed['year']}"

    return (
        f"IS {parsed['base']} "
        f"(Part {parsed['part']}):{parsed['year']}"
    )


def number_without_is(value):
    normalized = normalize_is_number(value)

    if not normalized:
        return None

    return re.sub(
        r"^IS\s+",
        "",
        normalized,
        flags=re.IGNORECASE,
    )


# ============================================================
# SAFE VALUE CHECKING
# ============================================================

def is_missing_value(value):

    if value is None:
        return True

    if isinstance(value, str):

        value = value.strip()

        if not value:
            return True

        if value.upper() in {
            "--",
            "-",
            "NONE",
            "N/A",
            "NA",
            "NOT AVAILABLE",
            "NOT APPLICABLE",
        }:
            return True

        return False

    if isinstance(value, dict):

        if not value:
            return True

        return all(
            is_missing_value(v)
            for v in value.values()
        )

    if isinstance(value, (list, tuple, set)):
        return len(value) == 0

    return False


def is_useful_value(value):
    return not is_missing_value(value)


# ============================================================
# MONGODB
# ============================================================

def connect_mongodb():
    try:
        from backend.db_client import is_mongo_available
        if not is_mongo_available():
            print("\n[MongoDB] Atlas known offline — skipping Playwright DB connection.")
            return None, None
    except Exception:
        pass

    print("\nConnecting to MongoDB Atlas...")
    import certifi

    for kwargs in [
        {"tlsInsecure": True, "serverSelectionTimeoutMS": 800},
    ]:
        try:
            client = MongoClient(MONGO_URI, **kwargs)
            client.admin.command("ping")
            print("MongoDB connection: SUCCESS")
            db = client[DB_NAME]
            collection = db[COLLECTION_NAME]
            return client, collection
        except Exception:
            continue

    print("MongoDB connection: FAILED — Unreachable. Proceeding without MongoDB persistence.")
    return None, None


# ============================================================
# EXISTING STANDARD LOOKUP
# ============================================================

def find_existing_standard(collection, is_number):

    normalized = normalize_is_number(is_number)

    if not normalized:
        return None

    parsed = parse_is_number(normalized)

    if not parsed:
        return None

    base = re.escape(parsed["base"])
    year = re.escape(parsed["year"])
    part = parsed["part"]

    if part is None:

        regex = (
            rf"^\s*"
            rf"(?:IS\s*)?"
            rf"{base}"
            rf"\s*:\s*"
            rf"{year}"
            rf"\s*$"
        )

    else:

        regex = (
            rf"^\s*"
            rf"(?:IS\s*)?"
            rf"{base}"
            rf"\s*"
            rf"\(?\s*PART\s*"
            rf"{part}"
            rf"\s*\)?"
            rf"\s*:\s*"
            rf"{year}"
            rf"\s*$"
        )

    return collection.find_one(
        {
            "is_number": {
                "$regex": regex,
                "$options": "i",
            }
        }
    )


# ============================================================
# BIS SEARCH URL
# ============================================================

def build_search_urls(search_term):

    search_term = clean_text(search_term)

    if not search_term:
        return []

    encoded_once = urllib.parse.quote(
        search_term,
        safe="",
    )

    encoded_twice = urllib.parse.quote(
        encoded_once,
        safe="",
    )

    return [
        (
            f"{BIS_SEARCH_URL}"
            f"?searchTerm={encoded_twice}"
        ),
        (
            f"{BIS_SEARCH_URL}"
            f"?searchTerm={encoded_once}"
        ),
    ]


# ============================================================
# PAGE HELPERS
# ============================================================

def get_body_lines(page):

    try:
        text = page.locator(
            "body"
        ).inner_text(
            timeout=10000
        )
    except Exception:
        return []

    lines = []

    for raw in text.splitlines():

        value = clean_text(raw)

        if value:
            lines.append(value)

    return lines


def get_body_text(page):

    try:

        return (
            clean_text(
                page.locator(
                    "body"
                ).inner_text(
                    timeout=10000
                )
            )
            or ""
        )

    except Exception:
        return ""


def wait_for_bis(page):

    page.wait_for_timeout(
        SEARCH_WAIT_MS
    )

    try:

        page.wait_for_load_state(
            "networkidle",
            timeout=10000,
        )

    except Exception:
        pass

    page.wait_for_timeout(1000)


def create_page(context):

    page = context.new_page()

    page.set_default_timeout(
        PAGE_TIMEOUT
    )

    return page


# ============================================================
# EXACT STANDARD REGEX
# ============================================================

def standard_number_regex(is_number):

    parsed = parse_is_number(is_number)

    if not parsed:
        return re.compile(
            r"(?!x)x"
        )

    base = re.escape(parsed["base"])
    year = re.escape(parsed["year"])
    part = parsed["part"]

    if part is None:

        return re.compile(
            rf"\bIS\s*{base}\s*:\s*{year}\b",
            re.IGNORECASE,
        )

    return re.compile(
        rf"\bIS\s*{base}\s*"
        rf"\(?\s*PART\s*{part}\s*\)?"
        rf"\s*:\s*{year}\b",
        re.IGNORECASE,
    )


def exact_standard_number_present(
    page,
    is_number,
):

    pattern = standard_number_regex(
        is_number
    )

    body = get_body_text(page)

    if not body:
        return False

    return bool(
        pattern.search(body)
    )


# ============================================================
# DETAIL LINK EXTRACTION
# ============================================================

def extract_detail_links(
    page,
    requested_is,
):

    normalized = normalize_is_number(
        requested_is
    )

    if not normalized:
        return []

    pattern = standard_number_regex(
        normalized
    )

    found = []

    try:

        anchors = page.locator(
            "a[href*='standard-details']"
        )

        count = anchors.count()

        for index in range(count):

            try:

                anchor = anchors.nth(index)

                href = anchor.get_attribute(
                    "href"
                )

                text = clean_text(
                    anchor.inner_text()
                )

                if not href:
                    continue

                if href.startswith("/"):
                    href = (
                        BIS_BASE_URL
                        + href
                    )

                if not href.startswith(
                    "http"
                ):
                    continue

                combined = (
                    f"{text or ''} "
                    f"{href}"
                )

                if pattern.search(
                    combined
                ):

                    if href not in found:
                        found.append(href)

            except Exception:
                continue

    except Exception:
        pass

    return found


# ============================================================
# EXTRACT STANDARD NUMBER FROM BIS LINK
# ============================================================

def extract_is_number_from_href(
    href
):

    if not href:
        return None

    try:

        parsed_url = urllib.parse.urlparse(
            href
        )

        params = urllib.parse.parse_qs(
            parsed_url.query
        )

        standard_numbers = params.get(
            "standardNumber",
            []
        )

        for value in standard_numbers:

            normalized = normalize_is_number(
                urllib.parse.unquote(value)
            )

            if normalized:
                return normalized

    except Exception:
        pass

    # Fallback: search the URL itself.
    match = re.search(
        r"\bIS\s*\d+"
        r"(?:\s*\(?\s*PART\s*\d+\s*\)?)?"
        r"\s*:\s*\d{4}\b",
        urllib.parse.unquote(href),
        re.IGNORECASE,
    )

    if match:
        return normalize_is_number(
            match.group(0)
        )

    return None


# ============================================================
# KEYWORD RESULT DISCOVERY
# ============================================================

def extract_keyword_results(
    page,
    search_term,
    limit=DEFAULT_KEYWORD_LIMIT,
):

    """
    Read BIS keyword-search results.

    We DO NOT guess IS numbers.

    We only accept standards where BIS gives us
    a standard-details link containing a standardNumber.
    """

    results = []
    seen = set()

    try:

        anchors = page.locator(
            "a[href*='standard-details']"
        )

        count = anchors.count()

        for index in range(count):

            if len(results) >= limit:
                break

            try:

                anchor = anchors.nth(index)

                href = anchor.get_attribute(
                    "href"
                )

                text = clean_text(
                    anchor.inner_text()
                )

                if not href:
                    continue

                if href.startswith("/"):
                    href = (
                        BIS_BASE_URL
                        + href
                    )

                if not href.startswith(
                    "http"
                ):
                    continue

                is_number = (
                    extract_is_number_from_href(
                        href
                    )
                )

                if not is_number:

                    # Try anchor text.
                    if text:

                        match = re.search(
                            r"\bIS\s*\d+"
                            r"(?:\s*\(?\s*PART\s*\d+\s*\)?)?"
                            r"\s*:\s*\d{4}\b",
                            text,
                            re.IGNORECASE,
                        )

                        if match:
                            is_number = (
                                normalize_is_number(
                                    match.group(0)
                                )
                            )

                if not is_number:
                    continue

                key = is_number.upper()

                if key in seen:
                    continue

                seen.add(key)

                results.append(
                    {
                        "is_number": is_number,
                        "detail_url": href,
                        "search_term": search_term,
                        "result_text": text,
                    }
                )

            except Exception:
                continue

    except Exception:
        pass

    return results


# ============================================================
# KEYWORD SEARCH
# ============================================================

def search_bis_keyword(
    page,
    keyword,
    limit=DEFAULT_KEYWORD_LIMIT,
):

    keyword = clean_text(keyword)

    if not keyword:
        return []

    print(
        f"\nBIS keyword search: "
        f"'{keyword}'"
    )

    urls = build_search_urls(
        keyword
    )

    for attempt in range(
        MAX_SEARCH_ATTEMPTS
    ):

        if attempt > 0:

            print(
                f"Retry "
                f"{attempt + 1}/"
                f"{MAX_SEARCH_ATTEMPTS}"
            )

        for search_url in urls:

            try:

                print(
                    "Opening BIS search..."
                )

                page.goto(
                    search_url,
                    wait_until="domcontentloaded",
                    timeout=PAGE_TIMEOUT,
                )

                wait_for_bis(page)

                results = (
                    extract_keyword_results(
                        page,
                        keyword,
                        limit,
                    )
                )

                if results:

                    print(
                        f"BIS discovered "
                        f"{len(results)} "
                        f"candidate standard(s)."
                    )

                    for item in results:

                        print(
                            f"  - "
                            f"{item['is_number']}"
                        )

                    return results

            except PlaywrightTimeoutError:

                print(
                    "BIS page timeout."
                )

            except Exception as exc:

                print(
                    f"BIS keyword "
                    f"search error: {exc}"
                )

        time.sleep(2)

    return []


# ============================================================
# EXACT SEARCH
# ============================================================

def search_exact_standard(
    page,
    requested_is,
):

    normalized = normalize_is_number(
        requested_is
    )

    if not normalized:
        return None

    print(
        f"\nSearching BIS: "
        f"{normalized}"
    )

    # Exact number search.
    urls = build_search_urls(
        number_without_is(
            normalized
        )
    )

    for attempt in range(
        MAX_SEARCH_ATTEMPTS
    ):

        if attempt > 0:

            print(
                f"Retry "
                f"{attempt + 1}/"
                f"{MAX_SEARCH_ATTEMPTS}"
            )

        for search_url in urls:

            try:

                page.goto(
                    search_url,
                    wait_until="domcontentloaded",
                    timeout=PAGE_TIMEOUT,
                )

                wait_for_bis(page)

                if not exact_standard_number_present(
                    page,
                    normalized,
                ):
                    continue

                links = extract_detail_links(
                    page,
                    normalized,
                )

                if links:
                    return links[0]

            except PlaywrightTimeoutError:

                print(
                    "BIS page timeout."
                )

            except Exception as exc:

                print(
                    f"BIS search error: {exc}"
                )

        time.sleep(2)

    return None


def search_bis(
    page,
    requested_is,
):

    normalized = normalize_is_number(
        requested_is
    )

    if not normalized:
        return None

    exact_url = search_exact_standard(
        page,
        normalized,
    )

    if exact_url:

        return {
            "type": "exact",
            "is_number": normalized,
            "detail_url": exact_url,
        }

    return None


# ============================================================
# DETAIL PAGE VERIFICATION
# ============================================================

def verify_detail_page(
    page,
    requested_is,
):

    try:

        if (
            "standard-details"
            not in page.url.lower()
        ):
            return False

    except Exception:
        return False

    return exact_standard_number_present(
        page,
        requested_is,
    )


# ============================================================
# TITLE VALIDATION
# ============================================================

TITLE_STOP_LABELS = {
    "certification",
    "department",
    "technical committee",
    "basic details",
    "classification details",
    "superseding is",
    "degree of equivalence",
    "number of revisions",
    "number of amendments",
    "type of standard",
    "language",
    "reaffirmation year",
    "member secretary",
}


def looks_like_bad_title(value):

    value = clean_text(value)

    if not value:
        return True

    lower = value.lower()

    if lower in {
        "quick links",
        "licence",
        "license",
        "licence details",
        "license details",
        "standard details",
        "certification",
        "department",
        "technical committee",
        "basic details",
        "classification details",
        "amendments",
        "gazette",
        "laboratory",
        "corrigendum",
        "summary",
        "test request & report format",
    }:
        return True

    if lower.startswith(
        (
            "quick links",
            "licence details",
            "license details",
            "referred indian standards",
            "referred-in following",
            "copyright",
            "visitor count",
        )
    ):
        return True

    if re.match(
        r"""
        ^
        (
            certification|
            department|
            technical committee|
            superseding is|
            degree of equivalence|
            number of revisions|
            number of amendments|
            type of standard|
            language|
            reaffirmation year|
            member secretary
        )
        \s*:?
        """,
        value,
        re.IGNORECASE | re.VERBOSE,
    ):
        return True

    if re.match(
        r"^IS\s+\d",
        value,
        re.IGNORECASE,
    ):
        return True

    if re.match(
        r"^(ISO|IEC|EN|ASTM|BS)\s+",
        value,
        re.IGNORECASE,
    ):
        return True

    if re.fullmatch(
        r"[\d\W\_]+",
        value,
    ):
        return True

    if len(value) < 4:
        return True

    return False


def is_reviewed_line(line):

    return bool(
        re.match(
            r"^Reviewed\s+In\s*:?\s*(?:\d{4})?$",
            line,
            re.IGNORECASE,
        )
    )


def is_title_boundary(line):

    lower = line.lower()

    if lower in TITLE_STOP_LABELS:
        return True

    return bool(
        re.match(
            r"""
            ^
            (
                certification|
                department|
                technical committee|
                superseding is|
                degree of equivalence|
                number of revisions|
                number of amendments|
                type of standard|
                language|
                reaffirmation year|
                member secretary
            )
            \s*:?
            """,
            line,
            re.IGNORECASE | re.VERBOSE,
        )
    )


# ============================================================
# TITLE EXTRACTION
# ============================================================

def extract_title(
    page,
    requested_is,
):

    lines = get_body_lines(page)

    if not lines:
        return None

    parsed = parse_is_number(
        requested_is
    )

    if not parsed:
        return None

    base = re.escape(
        parsed["base"]
    )

    year = re.escape(
        parsed["year"]
    )

    part = parsed["part"]

    if part is None:

        exact_line_pattern = re.compile(
            rf"^\s*IS\s*"
            rf"{base}\s*:\s*"
            rf"{year}\s*$",
            re.IGNORECASE,
        )

    else:

        exact_line_pattern = re.compile(
            rf"^\s*IS\s*"
            rf"{base}\s*"
            rf"\(?\s*PART\s*"
            rf"{part}\s*\)?"
            rf"\s*:\s*"
            rf"{year}\s*$",
            re.IGNORECASE,
        )

    for index, line in enumerate(
        lines[:150]
    ):

        if exact_line_pattern.match(
            line
        ):

            for offset in range(
                1,
                10
            ):

                position = (
                    index + offset
                )

                if position >= len(lines):
                    break

                candidate = clean_text(
                    lines[position]
                )

                if not candidate:
                    continue

                if is_reviewed_line(
                    candidate
                ):
                    continue

                if is_title_boundary(
                    candidate
                ):
                    break

                if looks_like_bad_title(
                    candidate
                ):
                    continue

                return candidate

    return None


# ============================================================
# DETAIL LABELS
# ============================================================

DETAIL_LABELS = [
    "Certification",
    "Department",
    "Technical Committee",
    "Superseding IS",
    "Degree of Equivalence",
    "Number of Revisions",
    "Number of Amendments",
    "Type of Standard",
    "Language",
    "Reaffirmation Year",
    "Member Secretary",
]


def is_any_detail_label(line):

    if not line:
        return False

    for label in DETAIL_LABELS:

        if re.match(
            rf"^{re.escape(label)}\s*:?",
            line,
            re.IGNORECASE,
        ):
            return True

    return False


def extract_labeled_value(
    lines,
    label,
):

    pattern = re.compile(
        rf"""
        ^
        {re.escape(label)}
        \s*:?
        \s*
        (.*?)
        \s*$
        """,
        re.IGNORECASE | re.VERBOSE,
    )

    for index, line in enumerate(
        lines
    ):

        match = pattern.match(line)

        if not match:
            continue

        same_line = clean_text(
            match.group(1)
        )

        if is_useful_value(
            same_line
        ):
            return same_line

        next_index = index + 1

        if next_index >= len(lines):
            return None

        next_line = clean_text(
            lines[next_index]
        )

        if not next_line:
            continue

        if is_any_detail_label(
            next_line
        ):
            return None

        if next_line.lower() in {
            "basic details",
            "classification details",
            "referred indian standards",
            "referred-in following indian standards",
            "quick links",
        }:
            return None

        if is_useful_value(
            next_line
        ):
            return next_line

    return None


# ============================================================
# CERTIFICATION
# ============================================================

def extract_certification(lines):

    result = {
        "type": None,
        "status": None,
        "mandatory": None,
    }

    for index, line in enumerate(
        lines
    ):

        if not re.match(
            r"^Certification\s*:?",
            line,
            re.IGNORECASE,
        ):
            continue

        nearby = [line]

        nearby.extend(
            lines[index + 1:index + 5]
        )

        combined = (
            " ".join(nearby)
            .lower()
        )

        if "mandatory" in combined:

            result["status"] = (
                "Mandatory Certification"
            )

            result["mandatory"] = True

        elif "voluntary" in combined:

            result["status"] = (
                "Voluntary Certification"
            )

            result["mandatory"] = False

        elif "not applicable" in combined:

            result["status"] = (
                "Not Applicable"
            )

            result["mandatory"] = False

        elif "n/a" in combined:

            result["status"] = "N/A"

            result["mandatory"] = False

        break

    return result


# ============================================================
# REFERRED INDIAN STANDARDS (BIS)
# ============================================================

def extract_referred_standards(page):
    """
    Extracts referred Indian Standards from BIS detail page using DOM parsing.
    Returns a list of dicts.
    """
    results = []
    try:
        from bs4 import BeautifulSoup
        html = page.content()
        soup = BeautifulSoup(html, 'html.parser')
        
        sec8 = soup.select('#Section8 .sidebar__event')
        for event in sec8:
            a_tag = event.select_one('a')
            p_tags = event.select('p')
            if a_tag:
                is_num = a_tag.get_text(strip=True)
                title = p_tags[-1].get_text(strip=True) if p_tags else ""
                if is_num:
                    results.append({
                        'standard_number': is_num,
                        'title': title if title else None,
                        'relationship': 'BIS_REFERRED_STANDARD',
                        'source': 'BIS'
                    })
    except Exception as e:
        print(f"[BIS] extract_referred_standards error: {e}")

    return results


# ============================================================
# AMENDMENTS (BIS)
# ============================================================

def extract_amendments_from_page(page):
    """
    Extracts amendment information from a BIS standard detail page using DOM parsing.
    Returns a list of {number, date, implementation_date, details, source} dicts.
    """
    amendments = []
    try:
        from bs4 import BeautifulSoup
        html = page.content()
        soup = BeautifulSoup(html, 'html.parser')
        
        sec1 = soup.select_one('#Section1 table tbody')
        if sec1:
            for tr in sec1.select('tr'):
                tds = tr.select('td')
                if len(tds) >= 3:
                    amend_no = tds[1].get_text(strip=True)
                    amend_year = tds[2].get_text(strip=True)
                    if amend_no and amend_no.lower() != 'no data found':
                        amendments.append({
                            'number': amend_no,
                            'date': amend_year,
                            'implementation_date': None,
                            'details': f"{amend_no} ({amend_year})",
                            'source': 'BIS',
                        })
    except Exception as e:
        print(f"[BIS] extract_amendments error: {e}")
    return amendments


# ============================================================
# SCOPE (BIS)
# ============================================================

def extract_scope_from_page(page):
    """
    Extracts scope text from BIS standard detail page.
    Note: The new BIS portal rarely includes the scope directly on the page,
    so this may return None. We leave it implemented just in case.
    """
    lines = get_body_lines(page)
    in_scope = False
    scope_lines = []

    for line in lines:
        low = line.lower().strip()

        if re.match(r'^scope\s*$', low) or low.startswith('scope:'):
            in_scope = True
            # If scope is on the same line after 'Scope:'
            after = re.sub(r'^scope\s*:?\s*', '', line, flags=re.IGNORECASE).strip()
            if after:
                scope_lines.append(after)
            continue

        if in_scope:
            # Stop at known section boundaries
            if any(stop in low for stop in [
                'department',
                'technical committee',
                'certification',
                'amendments',
                'referred indian standards',
                'referred-in following',
                'quick links',
                'copyright',
                'basic details',
                'classification details',
            ]):
                break
            if line.strip():
                scope_lines.append(line.strip())

    if scope_lines:
        return ' '.join(scope_lines[:10])  # Limit to reasonable length
    return None


# ============================================================
# BIS STATUS (current/withdrawn/etc from page)
# ============================================================

def extract_bis_status_from_page(page):
    """
    Determines if a standard is current, withdrawn, superseded etc.
    from the BIS detail page title or body content.
    """
    lines = get_body_lines(page)
    for line in lines[:30]:  # Status usually near the top
        low = line.lower().strip()
        if low == 'withdrawn':
            return 'Withdrawn'
        if 'withdrawn' in low and len(low) < 30:
            return 'Withdrawn'
        if 'superseded' in low and len(low) < 30:
            return 'Superseded'
        if 'current' in low and len(low) < 20:
            return 'Current'
    return 'Current'  # Default assumption


# ============================================================
# REVIEWED YEAR
# ============================================================


def extract_reviewed_year(lines):

    for line in lines:

        match = re.search(
            r"Reviewed\s+In\s*:?\s*(\d{4})",
            line,
            re.IGNORECASE,
        )

        if match:
            return int(
                match.group(1)
            )

    return None


# ============================================================
# BIS DATA EXTRACTION
# ============================================================

def extract_standard_data(
    page,
    requested_is,
    official_bis_url,
):
    """
    Extracts ALL available official data from a BIS Standard Details page.
    Now includes: scope, referred_standards (normative_references), amendments,
    and BIS status — all extracted deterministically without Gemini.
    """
    normalized = normalize_is_number(
        requested_is
    )

    lines = get_body_lines(
        page
    )

    # ---- Core BIS metadata fields ----
    data = {
        "is_number": normalized,

        "title": extract_title(
            page,
            normalized,
        ),

        "department": extract_labeled_value(
            lines,
            "Department",
        ),

        "technical_committee": extract_labeled_value(
            lines,
            "Technical Committee",
        ),

        "certification": extract_certification(
            lines
        ),

        "superseding_is": extract_labeled_value(
            lines,
            "Superseding IS",
        ),

        "degree_of_equivalence": extract_labeled_value(
            lines,
            "Degree of Equivalence",
        ),

        "number_of_revisions": extract_labeled_value(
            lines,
            "Number of Revisions",
        ),

        "number_of_amendments": extract_labeled_value(
            lines,
            "Number of Amendments",
        ),

        "type_of_standard": extract_labeled_value(
            lines,
            "Type of Standard",
        ),

        "language": extract_labeled_value(
            lines,
            "Language",
        ),

        "reaffirmation_year": extract_labeled_value(
            lines,
            "Reaffirmation Year",
        ),

        "reviewed_in": extract_reviewed_year(
            lines
        ),

        "member_secretary": extract_labeled_value(
            lines,
            "Member Secretary",
        ),

        "official_bis_url": official_bis_url,

        # ---- NEW: BIS-scraped rich fields ----
        "scope": extract_scope_from_page(page),

        "normative_references": extract_referred_standards(page),

        "amendments": extract_amendments_from_page(page),

        "bis_status": extract_bis_status_from_page(page),

        # Source attribution
        "data_source": "BIS",
        "bis_extraction_method": "playwright_scrape",
    }

    # Protect against label bleed.
    if data["superseding_is"]:

        bad_values = {
            "degree of equivalence",
            "number of revisions",
            "number of amendments",
            "type of standard",
            "language",
            "reaffirmation year",
            "member secretary",
            "certification",
            "department",
            "technical committee",
        }

        value = (
            data["superseding_is"]
            .strip()
            .lower()
            .rstrip(":")
        )

        if value in bad_values:
            data["superseding_is"] = None

    # Log what was extracted
    print(f"[BIS Extract] scope={'YES' if data['scope'] else 'NO'}  "
          f"referred_standards={len(data['normative_references'])}  "
          f"amendments={len(data['amendments'])}  "
          f"status={data['bis_status']}")

    return data


# ============================================================
# SAFE UPDATE
# ============================================================

def build_safe_update(
    bis_data
):

    update_fields = {}
    refreshed = []

    for field in BIS_REFRESH_FIELDS:

        if field not in bis_data:
            continue

        value = bis_data[field]

        if is_missing_value(
            value
        ):
            continue

        update_fields[field] = value
        refreshed.append(field)

    # official_bis_url is intentionally special.
    official_bis_url = bis_data.get(
        "official_bis_url"
    )

    if is_useful_value(
        official_bis_url
    ):

        update_fields[
            "official_bis_url"
        ] = official_bis_url

        refreshed.append(
            "official_bis_url"
        )

    update_fields[
        "last_verified"
    ] = today_string()

    update_fields[
        "last_updated"
    ] = utc_now()

    refreshed.extend([
        "last_verified",
        "last_updated",
    ])

    return (
        update_fields,
        refreshed,
    )


def update_existing_document(
    collection,
    existing,
    bis_data,
):

    update_fields, refreshed = (
        build_safe_update(
            bis_data
        )
    )

    existing_id = existing[
        "_id"
    ]

    result = collection.update_one(
        {
            "_id": existing_id
        },
        {
            "$set": update_fields
        },
    )

    if result.matched_count != 1:

        raise RuntimeError(
            "Existing MongoDB document "
            "could not be matched by _id."
        )

    return refreshed


# ============================================================
# NEW DOCUMENT
# ============================================================

def build_new_document(
    category,
    item,
    bis_data,
    discovery_keywords=None,
):

    normalized = normalize_is_number(
        item["is_number"]
    )

    document = {

        # ----------------------------------------------------
        # Identity
        # ----------------------------------------------------

        "is_number": normalized,

        "title": bis_data.get(
            "title"
        ),

        # ----------------------------------------------------
        # User taxonomy
        # ----------------------------------------------------

        "category": category,

        "sub_category": item.get(
            "sub_category"
        ),

        # ----------------------------------------------------
        # Enrichment
        # ----------------------------------------------------

        "scope": None,

        "applicability": {},

        "key_requirements": [],

        "technical_requirements": [],

        "product_keywords": [],

        "normative_references": [],

        "cross_references": [],

        "related_standards": [],

        "test_methods": [],

        "safety_standards": [],

        "installation_standards": [],

        # ----------------------------------------------------
        # BIS metadata
        # ----------------------------------------------------

        "department": bis_data.get(
            "department"
        ),

        "technical_committee": bis_data.get(
            "technical_committee"
        ),

        "certification": bis_data.get(
            "certification"
        ),

        "superseding_is": bis_data.get(
            "superseding_is"
        ),

        "degree_of_equivalence": bis_data.get(
            "degree_of_equivalence"
        ),

        "number_of_revisions": bis_data.get(
            "number_of_revisions"
        ),

        "number_of_amendments": bis_data.get(
            "number_of_amendments"
        ),

        "type_of_standard": bis_data.get(
            "type_of_standard"
        ),

        "language": bis_data.get(
            "language"
        ),

        "reaffirmation_year": bis_data.get(
            "reaffirmation_year"
        ),

        "reviewed_in": bis_data.get(
            "reviewed_in"
        ),

        "member_secretary": bis_data.get(
            "member_secretary"
        ),

        # ----------------------------------------------------
        # Relationships
        # ----------------------------------------------------

        "amendments": [],

        "supersedes": [],

        "superseded_by": [],

        # ----------------------------------------------------
        # Status
        # ----------------------------------------------------

        "status": "Current",

        "source": "BIS",

        "source_url": bis_data.get(
            "source_url"
        ),

        # ----------------------------------------------------
        # Discovery metadata
        #
        # This tells us WHY this record entered
        # the database.
        #
        # It is NOT product_keywords.
        # ----------------------------------------------------

        "discovery_keywords": (
            discovery_keywords
            if discovery_keywords
            else []
        ),

        "discovery_method": (
            "keyword"
            if discovery_keywords
            else "is_number"
        ),

        # ----------------------------------------------------
        # Timestamps
        # ----------------------------------------------------

        "last_verified": today_string(),

        "last_updated": utc_now(),
    }

    return document


# ============================================================
# PROCESS EXACT STANDARD
# ============================================================

def process_exact_standard(
    page,
    collection,
    category,
    item,
    requested_is,
    detail_url,
    discovery_keywords=None,
):

    normalized = normalize_is_number(
        requested_is
    )

    print(
        "\n" + "=" * 70
    )

    print(
        f"PROCESSING: {normalized}"
    )

    print(
        "=" * 70
    )

    print(
        "\nExact BIS detail URL:"
    )

    print(detail_url)

    page.goto(
        detail_url,
        wait_until="domcontentloaded",
        timeout=PAGE_TIMEOUT,
    )

    wait_for_bis(page)

    if not verify_detail_page(
        page,
        normalized,
    ):

        raise RuntimeError(
            "BIS detail page verification "
            f"failed for {normalized}."
        )

    print(
        "Detail page verification: SUCCESS"
    )

    bis_data = extract_standard_data(
        page,
        normalized,
        detail_url,
    )

    print(
        "\nBIS title:"
    )

    print(
        bis_data.get("title")
    )

    title = bis_data.get(
        "title"
    )

    if not title:

        raise RuntimeError(
            "Official BIS title could not "
            "be safely extracted. "
            "MongoDB was NOT changed."
        )

    if looks_like_bad_title(
        title
    ):

        raise RuntimeError(
            "Extracted BIS title failed "
            f"validation: {title}"
        )

    document = build_new_document(
        category,
        item,
        bis_data,
        discovery_keywords=(
            discovery_keywords
        ),
    )

    update_fields, refreshed = build_safe_update(
        bis_data
    )

    set_on_insert = {
        k: v for k, v in document.items()
        if k not in update_fields
    }

    query = {
        "is_number": normalized
    }

    if collection is not None:
        result = collection.update_one(
            query,
            {
                "$set": update_fields,
                "$setOnInsert": set_on_insert
            },
            upsert=True
        )

        if result.upserted_id:
            print(
                "\nMongoDB: INSERTED"
            )
            print(
                f"_id: {result.upserted_id}"
            )
            if discovery_keywords:
                print(
                    "Discovery keywords: "
                    f"{discovery_keywords}"
                )
            return "INSERTED"
        else:
            print(
                "\nMongoDB: UPDATED"
            )
            print(
                "Protected manual/AI fields: PRESERVED"
            )
            return "UPDATED"
    else:
        print(
            "\n[MongoDB] Skipped persistence (Atlas offline). Candidate processed directly."
        )
        return "DISCOVERED_LIVE"


# ============================================================
# DYNAMIC KEYWORD COLLECTION
# ============================================================

def collect_from_keyword(
    keyword,
    limit=DEFAULT_KEYWORD_LIMIT,
    category=None,
):

    """
    Public function used by app.py.

    Example:

        collect_from_keyword(
            "cement",
            limit=5
        )

    This:

        1. Searches BIS by keyword.
        2. Gets candidate standard numbers.
        3. Opens exact BIS detail pages.
        4. Inserts or updates MongoDB.
        5. Preserves protected fields.

    It does NOT invent a category.
    """

    keyword = clean_text(
        keyword
    )

    if not keyword:
        return []

    mongo_client = None

    collected = []

    try:

        mongo_client, collection = (
            connect_mongodb()
        )

        with sync_playwright() as playwright:

            browser = playwright.chromium.launch(
                headless=True
            )

            context = browser.new_context(
                viewport={
                    "width": 1440,
                    "height": 1000,
                },
                user_agent=(
                    "Mozilla/5.0 "
                    "(Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 "
                    "(KHTML, like Gecko) "
                    "Chrome/139.0 Safari/537.36"
                ),
            )

            page = create_page(
                context
            )

            candidates = search_bis_keyword(
                page,
                keyword,
                limit=limit,
            )

            if collection is None:
                print(f"\n[MongoDB] Atlas offline — returning {len(candidates)} live BIS candidate(s) directly.")
                for candidate in candidates:
                    is_num = candidate["is_number"]
                    d_url = candidate["detail_url"]
                    t_text = candidate.get("result_text") or candidate.get("title") or f"Indian Standard for {keyword.title()}"
                    collected.append({
                        "is_number": is_num,
                        "title": t_text,
                        "detail_url": d_url,
                        "official_bis_url": d_url,
                        "status": "DISCOVERED_LIVE",
                        "search_term": keyword,
                        "verification_source": "official_bis_live",
                        "data_source": "BIS_LIVE",
                        "scope": f"Indian Standard for {is_num} ({keyword.title()})",
                    })
                try:
                    page.close()
                except Exception:
                    pass
                browser.close()
                return collected

            for candidate in candidates:

                is_number = candidate[
                    "is_number"
                ]

                detail_url = candidate[
                    "detail_url"
                ]

                try:
                    # CHECK CACHE FIRST
                    mongo_doc = collection.find_one({"is_number": is_number}, {"_id": 0}) if collection is not None else None
                    if mongo_doc and mongo_doc.get("last_verified") == today_string() and "scope" in mongo_doc:
                        print(f"\n{is_number}: SKIPPING (Fresh in MongoDB)")
                        mongo_doc["status"] = "CACHED"
                        mongo_doc["search_term"] = keyword
                        if not mongo_doc.get("detail_url"):
                            mongo_doc["detail_url"] = detail_url
                        collected.append(mongo_doc)
                        continue

                    item = {
                        "is_number": is_number,
                        "sub_category": None,
                    }

                    status = (
                        process_exact_standard(
                            page,
                            collection,
                            category,
                            item,
                            is_number,
                            detail_url,
                            discovery_keywords=[
                                keyword
                            ],
                        )
                    )

                    fresh_doc = collection.find_one({"is_number": is_number}, {"_id": 0}) if collection is not None else None
                    if fresh_doc:
                        fresh_doc["status"] = status
                        fresh_doc["search_term"] = keyword
                        if not fresh_doc.get("title") and candidate.get("title"):
                            fresh_doc["title"] = candidate["title"]
                        collected.append(fresh_doc)
                    else:
                        collected.append(
                            {
                                "is_number": is_number,
                                "title": candidate.get("title") or f"Indian Standard for {keyword.title()}",
                                "detail_url": detail_url,
                                "official_bis_url": detail_url,
                                "status": status,
                                "search_term": keyword,
                                "verification_source": "official_bis_live",
                                "data_source": "BIS_LIVE",
                            }
                        )

                except Exception as exc:

                    print(
                        "\nKeyword candidate failed:"
                    )

                    print(
                        f"{is_number}: "
                        f"{exc}"
                    )

                    collected.append(
                        {
                            "is_number": is_number,
                            "title": candidate.get("title") or f"Indian Standard for {keyword.title()}",
                            "detail_url": detail_url,
                            "official_bis_url": detail_url,
                            "status": "DISCOVERED_LIVE",
                            "error": str(exc),
                            "search_term": keyword,
                            "verification_source": "official_bis_live",
                            "data_source": "BIS_LIVE",
                        }
                    )

            try:
                page.close()
            except Exception:
                pass

            browser.close()

    finally:

        if mongo_client:
            mongo_client.close()

    return collected


# ============================================================
# MANUAL JSON INPUT
# ============================================================

def read_multiline_json():

    print(
        "\nPaste the complete standards list."
    )

    print(
        "\nExample:"
    )

    print(
        '[{"is_number": "17803:2022", '
        '"sub_category": "Water Bottles"}, '
        '{"is_number": "17804 (Part 1):2022", '
        '"sub_category": "Tea Testing"}]'
    )

    print(
        "\nFinish by pressing ENTER twice."
    )

    lines = []

    while True:

        try:
            line = input()

        except EOFError:
            break

        if line == "":
            break

        lines.append(line)

    raw = "\n".join(
        lines
    ).strip()

    if not raw:
        raise ValueError(
            "No standards list was entered."
        )

    try:

        data = json.loads(
            raw
        )

    except json.JSONDecodeError as exc:

        raise ValueError(
            f"Invalid JSON: {exc}"
        )

    if not isinstance(
        data,
        list
    ):

        raise ValueError(
            "The standards input must "
            "be a JSON list."
        )

    validated = []

    for index, item in enumerate(
        data,
        start=1,
    ):

        if not isinstance(
            item,
            dict
        ):

            raise ValueError(
                f"Item {index} must "
                "be a dictionary."
            )

        if "is_number" not in item:

            raise ValueError(
                f"Item {index} is missing "
                "'is_number'."
            )

        normalized = normalize_is_number(
            item["is_number"]
        )

        if not normalized:

            raise ValueError(
                f"Item {index} has an invalid "
                f"is_number: "
                f"{item['is_number']}"
            )

        sub_category = item.get(
            "sub_category"
        )

        if sub_category is not None:

            sub_category = clean_text(
                sub_category
            )

        validated.append(
            {
                "is_number": normalized,
                "sub_category": sub_category,
            }
        )

    # Deduplicate.
    unique = []
    seen = set()

    for item in validated:

        key = item[
            "is_number"
        ].upper()

        if key in seen:
            continue

        seen.add(key)

        unique.append(
            item
        )

    return unique


# ============================================================
# MANUAL EXACT COLLECTION
# ============================================================

def run_manual_collection():

    print(
        "=" * 70
    )

    print(
        " BIS STANDARDS COLLECTOR"
    )

    print(
        "=" * 70
    )

    category = input(
        "\nEnter category: "
    ).strip()

    if not category:

        print(
            "Category cannot be empty."
        )

        return

    try:

        standards = read_multiline_json()

    except ValueError as exc:

        print(
            f"\nINPUT ERROR: {exc}"
        )

        return

    mongo_client = None

    try:

        mongo_client, collection = (
            connect_mongodb()
        )

        with sync_playwright() as playwright:

            browser = playwright.chromium.launch(
                headless=True
            )

            context = browser.new_context(
                viewport={
                    "width": 1440,
                    "height": 1000,
                },
                user_agent=(
                    "Mozilla/5.0 "
                    "(Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 "
                    "(KHTML, like Gecko) "
                    "Chrome/139.0 Safari/537.36"
                ),
            )

            page = create_page(
                context
            )

            inserted = 0
            updated = 0
            not_found = 0
            failed = 0

            for item in standards:

                requested_is = normalize_is_number(
                    item["is_number"]
                )

                try:

                    result = search_bis(
                        page,
                        requested_is,
                    )

                    if not result:

                        print(
                            f"\nNOT FOUND: "
                            f"{requested_is}"
                        )

                        not_found += 1
                        continue

                    status = (
                        process_exact_standard(
                            page,
                            collection,
                            category,
                            item,
                            result["is_number"],
                            result["detail_url"],
                        )
                    )

                    if status == "INSERTED":
                        inserted += 1

                    elif status == "UPDATED":
                        updated += 1

                except Exception as exc:

                    failed += 1

                    print(
                        "\nFAILED:"
                    )

                    print(
                        f"{requested_is}: "
                        f"{exc}"
                    )

                    try:
                        page.close()
                    except Exception:
                        pass

                    page = create_page(
                        context
                    )

            try:
                page.close()
            except Exception:
                pass

            browser.close()

        print(
            "\n" + "=" * 70
        )

        print(
            "FINAL SUMMARY"
        )

        print(
            "=" * 70
        )

        print(
            f"Inserted   : {inserted}"
        )

        print(
            f"Updated    : {updated}"
        )

        print(
            f"Not found  : {not_found}"
        )

        print(
            f"Failed     : {failed}"
        )

    finally:

        if mongo_client:
            mongo_client.close()


# ============================================================
# MAIN
# ============================================================

def main():

    print(
        "=" * 70
    )

    print(
        " BIS STANDARDS COLLECTOR"
    )

    print(
        "=" * 70
    )

    print(
        "\n1. Exact IS-number collection"
    )

    print(
        "2. Keyword discovery collection"
    )

    choice = input(
        "\nChoose 1 or 2: "
    ).strip()

    if choice == "1":

        run_manual_collection()

        return

    if choice == "2":

        keyword = input(
            "\nEnter BIS keyword/product: "
        ).strip()

        if not keyword:
            print(
                "Keyword cannot be empty."
            )
            return

        limit_text = input(
            "Maximum standards to discover "
            "[default 10]: "
        ).strip()

        if limit_text:

            try:
                limit = int(
                    limit_text
                )

                if limit < 1:
                    limit = 10

            except ValueError:
                limit = 10

        else:
            limit = 10

        results = collect_from_keyword(
            keyword,
            limit=limit,
            category=None,
        )

        print(
            "\n" + "=" * 70
        )

        print(
            "KEYWORD COLLECTION SUMMARY"
        )

        print(
            "=" * 70
        )

        for result in results:

            print(
                f"{result['is_number']:<30}"
                f"{result['status']}"
            )

        return

    print(
        "Invalid choice."
    )


# ============================================================
# ENTRY POINT
# ============================================================

if __name__ == "__main__":
    main()