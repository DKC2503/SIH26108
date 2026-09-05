import re
import json


# ============================================================
# BIS PRODUCT UNDERSTANDING TEST
# ============================================================
# READ ONLY
# Does NOT connect to MongoDB
# Does NOT modify any database
# ============================================================


# ------------------------------------------------------------
# Words that are normally NOT the product itself
# ------------------------------------------------------------

STOP_WORDS = {
    "i",
    "we",
    "my",
    "our",
    "the",
    "a",
    "an",
    "which",
    "what",
    "bis",
    "standard",
    "standards",
    "apply",
    "applies",
    "applicable",
    "follow",
    "need",
    "should",
    "must",
    "for",
    "to",
    "on",
    "under",
    "according",
    "manufacture",
    "manufacturing",
    "manufacturer",
    "product",
    "products",
    "business",
    "company",
    "sale",
    "selling",
}


# ------------------------------------------------------------
# Important product phrases
#
# These make sure important concepts stay together.
# ------------------------------------------------------------

PRODUCT_PHRASES = [
    # Food & beverages
    r"\bpackaged\s+drinking\s+water\b",
    r"\bdrinking\s+water\b",
    r"\bpackaged\s+water\b",

    r"\bcarbonated\s+soft\s+drinks?\b",
    r"\bcarbonated\s+beverages?\b",

    r"\bready[-\s]+to[-\s]+serve\s+fruit\s+drinks?\b",
    r"\bready[-\s]+to[-\s]+serve\s+fruit\s+beverages?\b",

    r"\bfruit\s+juice\b",
    r"\bapple\s+juice\b",
    r"\borange\s+juice\b",
    r"\btomato\s+juice\b",

    r"\bpackaged\s+wheat\s+flour\b",
    r"\bwheat\s+flour\b",
    r"\bwheat\s+atta\b",
    r"\bfortified\s+atta\b",
    r"\bmaize\s+flour\b",
    r"\bgram\s+flour\b",
    r"\bbesan\b",

    # Water containers
    r"\bstainless\s+steel\s+water\s+bottles?\b",
    r"\bdrinking\s+water\s+containers?\b",
    r"\bwater\s+containers?\b",
    r"\bwater\s+bottles?\b",

    # Cement
    r"\bmasonry\s+cement\b",
    r"\bhigh\s+alumina\s+cement\b",
    r"\bsupersulphated\s+cement\b",
    r"\bfibre\s+cement\s+sheets?\b",
    r"\bfiber\s+cement\s+sheets?\b",
    r"\bcement\s+paint\b",
    r"\bcement\b",

    # Stationery
    r"\bball\s+point\s+pens?\b",
    r"\bball\s+point\s+pen\s+refills?\b",
    r"\bcorrecting\s+fluids?\b",
    r"\brubber\s+stamp\s+pads?\b",
    r"\bpaper\s+clips?\b",
    r"\bpaper\s+pins?\b",
    r"\bschool\s+bags?\b",
    r"\bwriting\s+and\s+printing\s+paper\b",
    r"\bphotocopy\s+paper\b",
]


# ------------------------------------------------------------
# Actions
# ------------------------------------------------------------

ACTION_WORDS = {
    "manufacture": [
        "manufacture",
        "manufacturing",
        "manufacturer",
        "produce",
        "production",
        "make",
        "making",
    ],
    "sale": [
        "sale",
        "selling",
        "sell",
        "market",
        "marketing",
    ],
    "import": [
        "import",
        "imports",
        "importing",
    ],
    "export": [
        "export",
        "exports",
        "exporting",
    ],
    "testing": [
        "test",
        "testing",
        "laboratory",
        "lab",
    ],
}


# ------------------------------------------------------------
# Forms
# ------------------------------------------------------------

FORM_WORDS = {
    "packaged": [
        "packaged",
        "package",
        "packaging",
        "packed",
    ],
    "sealed": [
        "sealed",
        "seal",
    ],
    "bottled": [
        "bottled",
        "bottle",
        "bottles",
    ],
    "ready_to_serve": [
        "ready-to-serve",
        "ready to serve",
    ],
}


# ------------------------------------------------------------
# Cleaning
# ------------------------------------------------------------

def clean_text(text):
    text = text.lower().strip()

    text = re.sub(
        r"[,:;!?()\[\]{}]",
        " ",
        text
    )

    text = re.sub(
        r"\s+",
        " ",
        text
    )

    return text


def normalize_phrase(text):
    text = text.lower().strip()
    text = re.sub(r"\s+", " ", text)

    return text


# ------------------------------------------------------------
# Product phrase extraction
# ------------------------------------------------------------

def extract_product_phrase(question):

    text = clean_text(question)

    matches = []

    for pattern in PRODUCT_PHRASES:

        match = re.search(
            pattern,
            text,
            re.IGNORECASE
        )

        if match:

            phrase = normalize_phrase(
                match.group(0)
            )

            matches.append({
                "phrase": phrase,
                "start": match.start(),
                "end": match.end(),
                "length": len(phrase),
            })

    if matches:

        # Longest product phrase wins.
        matches.sort(
            key=lambda x: x["length"],
            reverse=True
        )

        return matches[0]["phrase"]

    return None


# ------------------------------------------------------------
# Conservative fallback
# ------------------------------------------------------------

def fallback_product_extraction(question):

    text = clean_text(question)

    words = text.split()

    filtered = []

    for word in words:

        word_clean = word.strip(".-")

        if not word_clean:
            continue

        if word_clean in STOP_WORDS:
            continue

        if word_clean in {
            "which",
            "what",
            "where",
            "how",
            "does",
            "do",
            "can",
            "could",
            "would",
            "please",
            "apply",
            "applicable",
            "follow",
            "use",
        }:
            continue

        filtered.append(word_clean)

    if not filtered:
        return None

    # Conservative fallback.
    if len(filtered) <= 4:
        return " ".join(filtered)

    return " ".join(filtered[-4:])


# ------------------------------------------------------------
# Detect action
# ------------------------------------------------------------

def detect_action(question):

    text = clean_text(question)

    scores = {}

    for action, words in ACTION_WORDS.items():

        score = 0

        for word in words:

            if word in text:
                score += 1

        scores[action] = score

    best_action = max(
        scores,
        key=scores.get
    )

    if scores[best_action] == 0:
        return "unknown"

    return best_action


# ------------------------------------------------------------
# Detect form
# ------------------------------------------------------------

def detect_form(question):

    text = clean_text(question)

    detected = []

    for form, words in FORM_WORDS.items():

        for word in words:

            if word in text:

                detected.append(form)

                break

    return list(dict.fromkeys(detected))


# ------------------------------------------------------------
# Detect industry
# ------------------------------------------------------------

def detect_industry(product):

    if not product:
        return "unknown"

    product = product.lower()

    food_words = [
        "food",
        "flour",
        "atta",
        "maida",
        "besan",
        "juice",
        "drink",
        "beverage",
        "water",
        "rice",
        "sugar",
        "salt",
        "honey",
        "soya",
        "soy",
        "maize",
        "wheat",
        "fruit",
    ]

    cement_words = [
        "cement",
        "mortar",
        "concrete",
        "brick",
    ]

    stationery_words = [
        "pen",
        "paper",
        "staple",
        "scissor",
        "chalk",
        "file",
        "stamp",
        "clip",
        "pin",
    ]

    if any(
        word in product
        for word in food_words
    ):
        return "food_and_beverages"

    if any(
        word in product
        for word in cement_words
    ):
        return "construction"

    if any(
        word in product
        for word in stationery_words
    ):
        return "stationery"

    return "unknown"


# ------------------------------------------------------------
# Product type
# ------------------------------------------------------------

def detect_product_type(product):

    if not product:
        return "unknown"

    product = product.lower()

    if any(
        word in product
        for word in [
            "flour",
            "atta",
            "maida",
            "besan",
            "soya flour",
        ]
    ):
        return "flour"

    if "juice" in product:
        return "fruit_juice"

    if any(
        word in product
        for word in [
            "drink",
            "beverage",
        ]
    ):
        return "beverage"

    if "water" in product:

        if (
            "bottle" in product
            or "container" in product
        ):
            return "water_container"

        return "water"

    if "cement" in product:
        return "cement"

    if any(
        word in product
        for word in [
            "paper",
            "pen",
            "staple",
            "scissor",
            "chalk",
            "clip",
            "pin",
        ]
    ):
        return "stationery_item"

    return "unknown"


# ------------------------------------------------------------
# Intent
# ------------------------------------------------------------

def detect_intent(question):

    text = clean_text(question)

    compliance_words = [
        "which bis standards",
        "which standards",
        "what standards",
        "standards apply",
        "standards should i follow",
        "bis standards apply",
        "applicable",
    ]

    if any(
        word in text
        for word in compliance_words
    ):
        return "standards_compliance"

    if (
        "test" in text
        or "testing" in text
    ):
        return "testing"

    return "standards_compliance"


# ------------------------------------------------------------
# Main understanding function
# ------------------------------------------------------------

def understand_product(question):

    question_clean = clean_text(question)

    product = extract_product_phrase(
        question_clean
    )

    extraction_method = "phrase_match"

    if not product:

        product = fallback_product_extraction(
            question_clean
        )

        extraction_method = "conservative_fallback"

    product_type = detect_product_type(
        product
    )

    industry = detect_industry(
        product
    )

    action = detect_action(
        question_clean
    )

    forms = detect_form(
        question_clean
    )

    intent = detect_intent(
        question_clean
    )

    return {
        "original_question": question,
        "product": product,
        "product_type": product_type,
        "form": forms,
        "action": action,
        "industry": industry,
        "intent": intent,
        "extraction_method": extraction_method,
    }


# ------------------------------------------------------------
# Print one result
# ------------------------------------------------------------

def print_result(result, number):

    print("\n")
    print("=" * 70)
    print(f"TEST {number}")
    print("=" * 70)

    print("\nOriginal question:")
    print(result["original_question"])

    print("\nStructured interpretation:")

    print(
        json.dumps(
            result,
            indent=4,
            ensure_ascii=False
        )
    )

    print("\n" + "-" * 70)

    print(
        "PRODUCT IDENTIFIED :",
        result["product"]
    )

    print(
        "PRODUCT TYPE       :",
        result["product_type"]
    )

    if result["form"]:

        print(
            "FORM               :",
            ", ".join(result["form"])
        )

    else:

        print(
            "FORM               : unknown"
        )

    print(
        "ACTION             :",
        result["action"]
    )

    print(
        "INDUSTRY           :",
        result["industry"]
    )

    print(
        "INTENT             :",
        result["intent"]
    )

    print(
        "EXTRACTION METHOD  :",
        result["extraction_method"]
    )

    print("=" * 70)


# ------------------------------------------------------------
# Test questions
# ------------------------------------------------------------

TEST_QUESTIONS = [

    "I manufacture packaged wheat flour. Which BIS standards apply to my product?",

    "I manufacture packaged drinking water. Which BIS standards apply to my product?",

    "I manufacture carbonated soft drinks. Which BIS standards should I follow?",

    "I manufacture packaged fruit juice. Which BIS standards apply to my product?",

    "I manufacture a ready-to-serve fruit drink. Which BIS standards apply?",

    "I manufacture drinking water for sale in sealed bottles. Which BIS standards apply?",

    "I manufacture stainless steel water bottles. Which BIS standards apply?",

    "I need a container to store drinking water. Which BIS standards apply?",

    "I manufacture masonry cement. Which BIS standards apply?",

    "I need cement for building a school. Which BIS standards should I follow?",

    "I manufacture ball point pens. Which BIS standards apply?",
]


# ------------------------------------------------------------
# MAIN
# ------------------------------------------------------------

if __name__ == "__main__":

    print("\n")
    print("=" * 70)
    print("BIS PRODUCT UNDERSTANDING TEST")
    print("=" * 70)

    print("\nThis test is READ ONLY.")
    print("MongoDB will NOT be modified.")
    print(
        f"\nRunning {len(TEST_QUESTIONS)} test questions automatically..."
    )

    results = []

    for number, question in enumerate(
        TEST_QUESTIONS,
        start=1
    ):

        result = understand_product(
            question
        )

        results.append(result)

        print_result(
            result,
            number
        )


    # --------------------------------------------------------
    # Summary
    # --------------------------------------------------------

    print("\n")
    print("=" * 70)
    print("FINAL SUMMARY")
    print("=" * 70)

    for index, result in enumerate(
        results,
        start=1
    ):

        print(
            f"\n{index}. "
            f"{result['product']}"
        )

        print(
            f"   Type     : {result['product_type']}"
        )

        print(
            f"   Form     : "
            f"{', '.join(result['form']) if result['form'] else 'unknown'}"
        )

        print(
            f"   Action   : {result['action']}"
        )

        print(
            f"   Industry : {result['industry']}"
        )

    print("\n")
    print("=" * 70)
    print("ALL TESTS COMPLETED")
    print("=" * 70)