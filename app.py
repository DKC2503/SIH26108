# ============================================================
# BIS STANDARDS RECOMMENDATION SYSTEM
# app.py
# ============================================================

from dotenv import load_dotenv
import os
import re
import certifi

from pymongo import MongoClient
from sentence_transformers import SentenceTransformer, util

from collect_standards import collect_from_keyword


# ============================================================
# CONFIGURATION
# ============================================================

load_dotenv()

DB_NAME = "BIS_Standards"
COLLECTION_NAME = "standards"

# Number of standards to discover from BIS when local
# database does not contain a strong match.
DISCOVERY_LIMIT = 5

# Minimum local score used as one signal for deciding
# whether BIS discovery should be attempted.
LOCAL_MATCH_THRESHOLD = 0.38


# ============================================================
# MONGODB CONNECTION
# ============================================================

mongo_uri = os.getenv("MONGO_URI")

if not mongo_uri:
    raise ValueError(
        "MONGO_URI not found in .env file"
    )

client = MongoClient(
    mongo_uri,
    tls=True,
    tlsCAFile=certifi.where(),
    serverSelectionTimeoutMS=20000
)

db = client[DB_NAME]
collection = db[COLLECTION_NAME]

try:
    client.admin.command("ping")

    print("Connected to MongoDB!")
    print(
        "Total standards:",
        collection.count_documents({})
    )

except Exception as e:

    print("\nMongoDB connection failed!")
    print(e)

    raise


# ============================================================
# LOAD AI MODEL
# ============================================================

print("\nLoading recommendation model...")

model = SentenceTransformer(
    "all-MiniLM-L6-v2"
)

print("Model loaded.")


# ============================================================
# TEXT CLEANING
# ============================================================

def clean_text(value):
    """
    Convert MongoDB values into searchable text.

    Supports:
        string
        list
        dictionary
        None
    """

    if value is None:
        return ""

    if isinstance(value, list):

        return " ".join(
            clean_text(item)
            for item in value
        )

    if isinstance(value, dict):

        parts = []

        for key, value2 in value.items():

            parts.append(str(key))
            parts.append(
                clean_text(value2)
            )

        return " ".join(parts)

    return str(value)


def normalize(text):
    """
    Normalize text for matching.
    """

    text = clean_text(text).lower()

    text = text.replace("–", "-")
    text = text.replace("—", "-")
    text = text.replace("/", " ")
    text = text.replace("_", " ")

    text = re.sub(
        r"[^a-z0-9\s\-]",
        " ",
        text
    )

    text = re.sub(
        r"\s+",
        " ",
        text
    )

    return text.strip()


# ============================================================
# STOP WORDS
# ============================================================

STOP_WORDS = {
    "i",
    "we",
    "my",
    "our",
    "me",
    "the",
    "a",
    "an",
    "this",
    "that",
    "these",
    "those",
    "which",
    "what",
    "are",
    "is",
    "am",
    "do",
    "does",
    "can",
    "could",
    "should",
    "would",
    "please",
    "tell",
    "give",
    "show",
    "want",
    "need",
    "looking",
    "for",
    "about",
    "according",
    "to",
    "bis",
    "standard",
    "standards",
}


# ============================================================
# CONTEXT WORDS
# ============================================================

CONTEXT_WORDS = {
    "manufacture",
    "manufacturing",
    "manufacturer",
    "produce",
    "production",
    "processing",
    "processor",
    "sell",
    "sale",
    "selling",
    "market",
    "marketing",
    "export",
    "import",
    "construction",
    "construct",
    "building",
    "school",
    "hospital",
    "industrial",
    "industry",
    "commercial",
    "domestic",
    "residential",
    "installation",
    "install",
    "use",
    "usage",
    "application",
    "applicable",
    "packaged",
    "sealed",
    "bottled",
    "bottles",
    "retail",
    "consumer",
}


# ============================================================
# PRODUCT DESCRIPTORS
# ============================================================

PRODUCT_DESCRIPTOR_WORDS = {
    "packaged",
    "sealed",
    "bottled",
    "bulk",
    "commercial",
    "industrial",
    "domestic",
}


# ============================================================
# QUESTION CLEANING
# ============================================================

def remove_question_prefix(question):
    """
    Remove common natural-language prefixes.

    Example:

        I manufacture packaged drinking water

    becomes:

        packaged drinking water
    """

    text = normalize(question)

    prefixes = [

        r"^i manufacture\s+",

        r"^i manufacture\s+and\s+sell\s+",

        r"^i produce\s+",

        r"^i produce\s+and\s+sell\s+",

        r"^we manufacture\s+",

        r"^we produce\s+",

        r"^we make\s+",

        r"^we sell\s+",

        r"^my company manufactures\s+",

        r"^my company produces\s+",

        r"^my company makes\s+",

        r"^our company manufactures\s+",

        r"^our company produces\s+",

        r"^our company makes\s+",

        r"^manufacturer of\s+",

        r"^product is\s+",

        r"^the product is\s+",

        r"^i am manufacturing\s+",

        r"^we are manufacturing\s+",

        r"^i am producing\s+",

        r"^we are producing\s+",
    ]

    for pattern in prefixes:

        text = re.sub(
            pattern,
            "",
            text,
            count=1
        )

    return text.strip()


# ============================================================
# PRODUCT PHRASE CLEANING
# ============================================================

def clean_product_phrase(text):
    """
    Clean a product phrase without destroying
    multi-word product concepts.

    IMPORTANT:

        packaged drinking water

    remains:

        packaged drinking water

    rather than:

        packaged
        drinking
        water
    """

    text = normalize(text)

    # --------------------------------------------------------
    # Remove trailing question language.
    # --------------------------------------------------------

    trailing_patterns = [

        r"\bwhich bis standards.*$",

        r"\bwhich standards.*$",

        r"\bwhat bis standards.*$",

        r"\bwhat standards.*$",

        r"\bwhich bis standard.*$",

        r"\bwhich standard.*$",

        r"\bthat apply.*$",

        r"\bthat applies.*$",

        r"\bshould i follow.*$",

        r"\bshould we follow.*$",

        r"\bdo i need.*$",

        r"\bdo we need.*$",
    ]

    for pattern in trailing_patterns:

        text = re.sub(
            pattern,
            "",
            text
        )

    # --------------------------------------------------------
    # Remove leading article.
    # --------------------------------------------------------

    text = re.sub(
        r"^(a|an|the)\s+",
        "",
        text
    )

    text = re.sub(
        r"\s+",
        " ",
        text
    )

    return text.strip(
        " .,;:?!-"
    )


# ============================================================
# QUESTION STRUCTURE
# ============================================================

def extract_question_structure(question):
    """
    Convert natural language into:

        product_terms
        context_terms

    Examples:

        packaged drinking water

        ->
        [
            "packaged drinking water",
            "drinking water"
        ]


        carbonated soft drinks

        ->
        [
            "carbonated soft drinks"
        ]


        fruit juice

        ->
        [
            "fruit juice"
        ]


        ready-to-serve fruit drink

        ->
        [
            "ready-to-serve fruit drink",
            "fruit drink"
        ]


        cement for building a school

        ->
        product:
            cement

        context:
            building
            school
    """

    original = normalize(question)

    working = remove_question_prefix(
        original
    )

    # --------------------------------------------------------
    # Separate product from context.
    # --------------------------------------------------------

    product_part = working

    context_part = ""

    relation_patterns = [

        r"\bfor\s+",

        r"\bused\s+for\s+",

        r"\bintended\s+for\s+",

        r"\bto\s+",
    ]

    earliest_match = None

    for pattern in relation_patterns:

        match = re.search(
            pattern,
            working
        )

        if match:

            if earliest_match is None:

                earliest_match = match

            elif (
                match.start()
                < earliest_match.start()
            ):

                earliest_match = match

    if earliest_match:

        product_part = working[
            :earliest_match.start()
        ]

        context_part = working[
            earliest_match.end():
        ]

    # --------------------------------------------------------
    # Clean product phrase.
    # --------------------------------------------------------

    product_part = clean_product_phrase(
        product_part
    )

    # --------------------------------------------------------
    # Context extraction.
    # --------------------------------------------------------

    context_source = clean_product_phrase(
        context_part
    )

    context_terms = []

    if context_source:

        words = normalize(
            context_source
        ).split()

        for word in words:

            if word in CONTEXT_WORDS:

                if word not in context_terms:

                    context_terms.append(
                        word
                    )

    # --------------------------------------------------------
    # Product candidates.
    # --------------------------------------------------------

    product_candidates = []

    if product_part:

        product_candidates.append(
            product_part
        )

    words = product_part.split()

    # --------------------------------------------------------
    # Remove descriptors.
    #
    # packaged drinking water
    # ->
    # drinking water
    #
    # packaged wheat flour
    # ->
    # wheat flour
    # --------------------------------------------------------

    reduced_words = [

        word

        for word in words

        if word not in PRODUCT_DESCRIPTOR_WORDS
    ]

    reduced_phrase = " ".join(
        reduced_words
    ).strip()

    if (
        reduced_phrase
        and reduced_phrase != product_part
        and len(reduced_words) >= 2
    ):

        product_candidates.append(
            reduced_phrase
        )

    # --------------------------------------------------------
    # Descriptor phrases.
    #
    # ready-to-serve fruit drink
    # ->
    # fruit drink
    # --------------------------------------------------------

    descriptor_patterns = [

        r"^ready[- ]to[- ]serve\s+(.+)$",

        r"^ready\s+to\s+drink\s+(.+)$",

        r"^ready\s+to\s+eat\s+(.+)$",

        r"^instant\s+(.+)$",
    ]

    for pattern in descriptor_patterns:

        match = re.match(
            pattern,
            product_part
        )

        if match:

            reduced = clean_product_phrase(
                match.group(1)
            )

            if (
                reduced
                and reduced not in product_candidates
            ):

                product_candidates.append(
                    reduced
                )

    # --------------------------------------------------------
    # Context words inside the original product phrase.
    #
    # Example:
    #
    # packaged drinking water
    #
    # Product:
    # packaged drinking water
    #
    # Context:
    # packaged
    # --------------------------------------------------------

    for word in words:

        if word in CONTEXT_WORDS:

            if word not in context_terms:

                context_terms.append(
                    word
                )

    # --------------------------------------------------------
    # Remove duplicate product phrases.
    # --------------------------------------------------------

    final_products = []

    for candidate in product_candidates:

        candidate = clean_product_phrase(
            candidate
        )

        if not candidate:
            continue

        if candidate not in final_products:

            final_products.append(
                candidate
            )

    # --------------------------------------------------------
    # Remove duplicate context terms.
    # --------------------------------------------------------

    final_context = []

    for term in context_terms:

        if term not in final_context:

            final_context.append(
                term
            )

    return {
        "product_terms": final_products[:3],
        "context_terms": final_context[:8],
    }


# ============================================================
# APPLICABILITY TEXT
# ============================================================

def get_applicability_text(standard):
    """
    Safely convert applicability into searchable text.
    """

    applicability = standard.get(
        "applicability"
    )

    if not applicability:

        return ""

    if isinstance(
        applicability,
        dict
    ):

        parts = []

        for key, value in applicability.items():

            if value:

                parts.append(
                    str(key)
                )

                parts.append(
                    clean_text(value)
                )

        return " ".join(parts)

    return clean_text(
        applicability
    )


# ============================================================
# WORD OVERLAP
# ============================================================

def overlap_score(
    query,
    text
):
    """
    Calculate word overlap.

    This is supporting evidence only.
    """

    query_words = set(

        word

        for word in normalize(
            query
        ).split()

        if word not in STOP_WORDS
    )

    text_words = set(
        normalize(text).split()
    )

    if not query_words:

        return 0.0

    matched = (
        query_words
        .intersection(text_words)
    )

    return (
        len(matched)
        / len(query_words)
    )


# ============================================================
# BUILD STANDARD SEARCH TEXT
# ============================================================

def build_standard_text(standard):
    """
    Create a rich searchable representation
    of a BIS standard.
    """

    fields = [

        standard.get(
            "is_number",
            ""
        ),

        standard.get(
            "title",
            ""
        ),

        standard.get(
            "category",
            ""
        ),

        standard.get(
            "sub_category",
            ""
        ),

        standard.get(
            "scope",
            ""
        ),

        get_applicability_text(
            standard
        ),

        standard.get(
            "product_keywords",
            []
        ),

        standard.get(
            "key_requirements",
            []
        ),

        standard.get(
            "technical_requirements",
            []
        ),

        standard.get(
            "test_methods",
            []
        ),

        standard.get(
            "safety_standards",
            []
        ),

        standard.get(
            "related_standards",
            []
        ),

        standard.get(
            "normative_references",
            []
        ),

        standard.get(
            "cross_references",
            []
        ),

        standard.get(
            "certification",
            ""
        ),

        standard.get(
            "status",
            ""
        ),
    ]

    return " ".join(
        clean_text(field)
        for field in fields
    )


# ============================================================
# LOAD STANDARDS
# ============================================================

def load_standards():
    """
    Read standards from MongoDB.

    No MongoDB modifications are performed here.
    """

    standards = list(
        collection.find(
            {},
            {
                "_id": 0
            }
        )
    )

    return standards


# ============================================================
# CALCULATE LOCAL MATCH
# ============================================================

def calculate_local_match(
    standard,
    structure,
    semantic_score
):
    """
    Calculate recommendation score.

    Priority:

        Product phrase
        ↓
        Direct product match
        ↓
        Word overlap
        ↓
        Context
        ↓
        Semantic similarity
    """

    title = normalize(
        standard.get(
            "title",
            ""
        )
    )

    sub_category = normalize(
        standard.get(
            "sub_category",
            ""
        )
    )

    category = normalize(
        standard.get(
            "category",
            ""
        )
    )

    scope = normalize(
        standard.get(
            "scope",
            ""
        )
    )

    applicability = normalize(
        get_applicability_text(
            standard
        )
    )

    keywords = normalize(
        standard.get(
            "product_keywords",
            []
        )
    )

    product_text = " ".join(
        [
            title,
            sub_category,
            category,
            keywords,
            scope,
            applicability,
        ]
    )

    product_terms = structure.get(
        "product_terms",
        []
    )

    context_terms = structure.get(
        "context_terms",
        []
    )

    # --------------------------------------------------------
    # Phrase score
    # --------------------------------------------------------

    phrase_score = 0.0

    for product in product_terms:

        product_norm = normalize(
            product
        )

        if not product_norm:
            continue

        # Exact product phrase in title.
        if product_norm in title:

            phrase_score = max(
                phrase_score,
                1.0
            )

        # Exact phrase in sub-category.
        elif product_norm in sub_category:

            phrase_score = max(
                phrase_score,
                0.95
            )

        # Exact phrase in keywords.
        elif product_norm in keywords:

            phrase_score = max(
                phrase_score,
                0.90
            )

        # Phrase in scope.
        elif product_norm in scope:

            phrase_score = max(
                phrase_score,
                0.80
            )

        # Phrase in applicability.
        elif product_norm in applicability:

            phrase_score = max(
                phrase_score,
                0.80
            )

    # --------------------------------------------------------
    # Word overlap.
    # --------------------------------------------------------

    word_overlap = 0.0

    for product in product_terms:

        score = overlap_score(
            product,
            product_text
        )

        word_overlap = max(
            word_overlap,
            score
        )

    # --------------------------------------------------------
    # Context score.
    # --------------------------------------------------------

    context_score = 0.0

    if context_terms:

        matched_context = 0

        combined_context_text = " ".join(
            [
                title,
                sub_category,
                scope,
                applicability,
                keywords,
            ]
        )

        for context in context_terms:

            if normalize(
                context
            ) in combined_context_text:

                matched_context += 1

        context_score = min(
            matched_context
            / len(context_terms),
            1.0
        )

    # --------------------------------------------------------
    # Semantic score.
    # --------------------------------------------------------

    semantic_score = max(
        0.0,
        min(
            float(semantic_score),
            1.0
        )
    )

    # --------------------------------------------------------
    # Direct exact product score.
    # --------------------------------------------------------

    direct_product_score = 0.0

    for product in product_terms:

        product_norm = normalize(
            product
        )

        if not product_norm:
            continue

        if product_norm == title:

            direct_product_score = max(
                direct_product_score,
                1.0
            )

        if product_norm == sub_category:

            direct_product_score = max(
                direct_product_score,
                1.0
            )

    # --------------------------------------------------------
    # Final score.
    # --------------------------------------------------------

    final_score = (

        0.40 * phrase_score

        + 0.20 * direct_product_score

        + 0.15 * word_overlap

        + 0.10 * context_score

        + 0.15 * semantic_score
    )

    # --------------------------------------------------------
    # Penalty when semantic similarity is the only evidence.
    # --------------------------------------------------------

    if (
        product_terms
        and phrase_score == 0
    ):

        final_score *= 0.65

    return {

        "score": final_score,

        "phrase_score": phrase_score,

        "direct_product_score":
            direct_product_score,

        "word_overlap":
            word_overlap,

        "context_score":
            context_score,

        "semantic_score":
            semantic_score,
    }


# ============================================================
# MATCH EXPLANATION
# ============================================================

def generate_match_reason(
    standard,
    structure,
    score_details
):
    """
    Explain why a standard was recommended.
    """

    reasons = []

    title = normalize(
        standard.get(
            "title",
            ""
        )
    )

    sub_category = normalize(
        standard.get(
            "sub_category",
            ""
        )
    )

    keywords = normalize(
        standard.get(
            "product_keywords",
            []
        )
    )

    scope = normalize(
        standard.get(
            "scope",
            ""
        )
    )

    applicability = normalize(
        get_applicability_text(
            standard
        )
    )

    product_text = " ".join(
        [
            title,
            sub_category,
            keywords,
            scope,
            applicability,
        ]
    )

    # --------------------------------------------------------
    # Product evidence.
    # --------------------------------------------------------

    for product in structure.get(
        "product_terms",
        []
    ):

        product_norm = normalize(
            product
        )

        if product_norm in title:

            reasons.append(
                f"product phrase '{product}' "
                f"matches the standard title"
            )

            break

        if product_norm in sub_category:

            reasons.append(
                f"product phrase '{product}' "
                f"matches the sub-category"
            )

            break

        if product_norm in keywords:

            reasons.append(
                f"product phrase '{product}' "
                f"matches product keywords"
            )

            break

        if product_norm in scope:

            reasons.append(
                f"product phrase '{product}' "
                f"appears in the scope"
            )

            break

        if product_norm in applicability:

            reasons.append(
                f"product phrase '{product}' "
                f"appears in applicability"
            )

            break

    # --------------------------------------------------------
    # Context evidence.
    # --------------------------------------------------------

    matched_context = []

    for context in structure.get(
        "context_terms",
        []
    ):

        if normalize(
            context
        ) in product_text:

            matched_context.append(
                context
            )

    if matched_context:

        reasons.append(
            "context match: "
            + ", ".join(
                matched_context
            )
        )

    # --------------------------------------------------------
    # Fallback explanation.
    # --------------------------------------------------------

    if not reasons:

        if (
            score_details[
                "semantic_score"
            ] >= 0.55
        ):

            reasons.append(
                "semantic similarity "
                "with the requested product"
            )

        else:

            reasons.append(
                "limited product similarity"
            )

    return reasons


# ============================================================
# LOCAL SEARCH
# ============================================================

def search_local_database(
    standards,
    structure
):
    """
    Search the locally collected BIS standards.
    """

    if not standards:

        return []

    product_terms = structure.get(
        "product_terms",
        []
    )

    if not product_terms:

        return []

    # --------------------------------------------------------
    # Keep complete product phrases.
    # --------------------------------------------------------

    query_text = " ".join(
        product_terms
    )

    context_terms = structure.get(
        "context_terms",
        []
    )

    if context_terms:

        query_text += " "

        query_text += " ".join(
            context_terms
        )

    question_embedding = model.encode(
        query_text,
        convert_to_tensor=True
    )

    standard_texts = [

        build_standard_text(
            standard
        )

        for standard in standards
    ]

    standard_embeddings = model.encode(
        standard_texts,
        convert_to_tensor=True
    )

    similarities = util.cos_sim(
        question_embedding,
        standard_embeddings
    )[0]

    results = []

    for index, standard in enumerate(
        standards
    ):

        semantic_score = (
            similarities[index].item()
        )

        score_details = (
            calculate_local_match(
                standard,
                structure,
                semantic_score
            )
        )

        result = {

            "standard": standard,

            "score":
                score_details["score"],

            "details":
                score_details,

            "why":
                generate_match_reason(
                    standard,
                    structure,
                    score_details
                ),
        }

        results.append(
            result
        )

    results.sort(
        key=lambda item: item["score"],
        reverse=True
    )

    return results


# ============================================================
# DETERMINE WHETHER LOCAL RESULTS ARE GOOD
# ============================================================

def has_good_local_match(results):
    """
    Decide whether local MongoDB results are strong enough
    to avoid BIS discovery.
    """

    if not results:

        return False

    best = results[0]

    score = best["score"]

    details = best["details"]

    # Strong phrase match.
    if details[
        "phrase_score"
    ] >= 0.90:

        return True

    # Combined reasonable match.
    if (
        score >= LOCAL_MATCH_THRESHOLD
        and details[
            "phrase_score"
        ] >= 0.50
    ):

        return True

    return False


# ============================================================
# BIS DYNAMIC DISCOVERY
# ============================================================

def dynamic_discovery(structure):
    """
    Search BIS using complete product phrases.

    IMPORTANT:

    We search:

        packaged drinking water
        drinking water

    NOT:

        packaged
        drinking
        water

    This reduces unrelated results.
    """

    product_terms = structure.get(
        "product_terms",
        []
    )

    if not product_terms:

        return []

    print(
        "\nLocal database does not contain "
        "a strong product match."
    )

    print(
        "Trying BIS discovery using "
        "complete product phrases..."
    )

    # --------------------------------------------------------
    # Search only strongest phrases.
    # --------------------------------------------------------

    for product_term in product_terms[:3]:

        product_term = clean_product_phrase(
            product_term
        )

        if not product_term:

            continue

        print(
            "\nSearching BIS for product phrase:",
            f"'{product_term}'"
        )

        try:

            # Your collector may accept limit.
            collect_from_keyword(
                product_term,
                limit=DISCOVERY_LIMIT
            )

        except TypeError:

            # Compatibility with older collector.
            try:

                collect_from_keyword(
                    product_term
                )

            except Exception as e:

                print(
                    f"BIS discovery failed "
                    f"for '{product_term}': {e}"
                )

        except Exception as e:

            print(
                f"BIS discovery failed "
                f"for '{product_term}': {e}"
            )

    return []


# ============================================================
# RELOAD DATABASE
# ============================================================

def reload_after_discovery():

    return load_standards()


# ============================================================
# DISPLAY RESULTS
# ============================================================

def display_results(
    results,
    structure,
    max_results=5
):
    """
    Display final BIS recommendations.
    """

    print("\n")

    print(
        "=" * 70
    )

    print(
        "BIS RECOMMENDATIONS"
    )

    print(
        "=" * 70
    )

    product_terms = structure.get(
        "product_terms",
        []
    )

    context_terms = structure.get(
        "context_terms",
        []
    )

    print(
        "\nInterpreted request:"
    )

    if product_terms:

        print(
            "Product:",
            ", ".join(
                product_terms
            )
        )

    else:

        print(
            "Product: Not identified"
        )

    if context_terms:

        print(
            "Context:",
            ", ".join(
                context_terms
            )
        )

    if not results:

        print(
            "\nNo relevant BIS standards "
            "were found."
        )

        return

    shown = 0

    for result in results:

        standard = result[
            "standard"
        ]

        score = result[
            "score"
        ]

        details = result[
            "details"
        ]

        reasons = result[
            "why"
        ]

        # ----------------------------------------------------
        # Ignore extremely weak results.
        # ----------------------------------------------------

        if (
            score < 0.25
            and details[
                "phrase_score"
            ] == 0
        ):

            continue

        shown += 1

        print(
            "\n"
            + "-" * 70
        )

        print(
            f"{shown}. "
            f"{standard.get('is_number', 'N/A')}"
        )

        print(
            "   Title:",
            standard.get(
                "title",
                "N/A"
            )
        )

        print(
            "   Category:",
            standard.get(
                "category",
                "N/A"
            )
        )

        print(
            "   Sub-category:",
            standard.get(
                "sub_category",
                "N/A"
            )
        )

        print(
            "   Match:",
            round(
                score * 100,
                2
            ),
            "%"
        )

        print(
            "   Why:",
            "; ".join(
                reasons
            )
        )

        certification = standard.get(
            "certification"
        )

        if certification:

            print(
                "   Certification:",
                certification
            )

        mandatory = standard.get(
            "mandatory"
        )

        if mandatory is not None:

            print(
                "   Mandatory:",
                mandatory
            )

        status = standard.get(
            "status"
        )

        if status:

            print(
                "   Status:",
                status
            )

        source_url = standard.get(
            "source_url"
        )

        if source_url:

            print(
                "   BIS Source:",
                source_url
            )

        if shown >= max_results:

            break

    if shown == 0:

        print(
            "\nNo sufficiently relevant "
            "BIS standards found."
        )


# ============================================================
# MAIN RECOMMENDATION PIPELINE
# ============================================================

def recommend(question):
    """
    Main recommendation pipeline:

        User question
              ↓
        Product extraction
              ↓
        Phrase-aware local search
              ↓
        If weak
              ↓
        BIS phrase discovery
              ↓
        Reload MongoDB
              ↓
        Re-ranking
              ↓
        Recommendations
    """

    structure = extract_question_structure(
        question
    )

    # --------------------------------------------------------
    # Show question understanding.
    # --------------------------------------------------------

    print("\n")

    print(
        "=" * 70
    )

    print(
        "QUESTION UNDERSTANDING"
    )

    print(
        "=" * 70
    )

    print(
        "Product phrases:",
        structure.get(
            "product_terms",
            []
        )
    )

    print(
        "Context:",
        structure.get(
            "context_terms",
            []
        )
    )

    # --------------------------------------------------------
    # Load standards.
    # --------------------------------------------------------

    standards = load_standards()

    # --------------------------------------------------------
    # Search local database.
    # --------------------------------------------------------

    print(
        "\nSearching local BIS database..."
    )

    results = search_local_database(
        standards,
        structure
    )

    # --------------------------------------------------------
    # If local match is weak, perform discovery.
    # --------------------------------------------------------

    if not has_good_local_match(
        results
    ):

        dynamic_discovery(
            structure
        )

        # Reload after collector discovery.
        standards = reload_after_discovery()

        print(
            "\nRe-ranking after "
            "BIS discovery..."
        )

        results = search_local_database(
            standards,
            structure
        )

    # --------------------------------------------------------
    # Display final recommendations.
    # --------------------------------------------------------

    display_results(
        results,
        structure,
        max_results=5
    )

    return results


# ============================================================
# PROGRAM ENTRY POINT
# ============================================================

def main():

    print("\n")

    print(
        "=" * 70
    )

    print(
        "BIS STANDARD RECOMMENDATION SYSTEM"
    )

    print(
        "=" * 70
    )

    while True:

        question = input(
            "\nAsk your BIS question "
            "(or type 'exit'): "
        ).strip()

        if not question:

            continue

        if question.lower() in {
            "exit",
            "quit",
            "q"
        }:

            print(
                "\nExiting..."
            )

            break

        try:

            recommend(
                question
            )

        except KeyboardInterrupt:

            print(
                "\n\nOperation cancelled."
            )

        except Exception as e:

            print(
                "\nRecommendation error:"
            )

            print(e)


# ============================================================
# START APPLICATION
# ============================================================

if __name__ == "__main__":

    main()