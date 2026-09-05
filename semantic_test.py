import os
import re
import certifi
import torch

from dotenv import load_dotenv
from pymongo import MongoClient
from sentence_transformers import SentenceTransformer, util


# ============================================================
# CONFIGURATION
# ============================================================

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")

DB_NAME = "BIS_Standards"
COLLECTION_NAME = "standards"

# Stronger embedding models
MODELS = {
    "MiniLM": "all-MiniLM-L6-v2",
    "BGE": "BAAI/bge-base-en-v1.5",
    "E5": "intfloat/e5-base-v2",
}

TOP_K = 10


# ============================================================
# TEST QUESTIONS
# ============================================================

TEST_CASES = [
    {
        "question": "I manufacture packaged drinking water. Which BIS standards apply to my product?",
        "product": "packaged drinking water",
    },
    {
        "question": "I manufacture stainless steel water bottles. Which BIS standards apply?",
        "product": "stainless steel water bottles",
    },
    {
        "question": "I need a container to store drinking water. Which BIS standards apply?",
        "product": "container to store drinking water",
    },
    {
        "question": "I manufacture carbonated soft drinks. Which BIS standards should I follow?",
        "product": "carbonated soft drinks",
    },
    {
        "question": "I manufacture packaged fruit juice. Which BIS standards apply to my product?",
        "product": "packaged fruit juice",
    },
    {
        "question": "I manufacture a ready-to-serve fruit drink. Which BIS standards apply?",
        "product": "ready-to-serve fruit drink",
    },
    {
        "question": "I manufacture packaged wheat flour. Which BIS standards apply to my product?",
        "product": "packaged wheat flour",
    },
    {
        "question": "I need cement for constructing a school building. Which BIS standards should I follow?",
        "product": "cement",
    },
    {
        "question": "I manufacture masonry cement. Which BIS standard applies?",
        "product": "masonry cement",
    },
    {
        "question": "I manufacture food products and need standards for testing and quality control.",
        "product": "food products",
    },
]


# ============================================================
# CONNECT TO MONGODB
# ============================================================

print("=" * 70)
print("BIS SEMANTIC MODEL COMPARISON")
print("=" * 70)

print("\nConnecting to MongoDB...")

if not MONGO_URI:
    raise RuntimeError(
        "MONGO_URI was not found in your .env file."
    )

client = MongoClient(
    MONGO_URI,
    tls=True,
    tlsCAFile=certifi.where(),
    serverSelectionTimeoutMS=10000,
)

client.admin.command("ping")

db = client[DB_NAME]
collection = db[COLLECTION_NAME]

standards = list(
    collection.find(
        {},
        {"_id": 0}
    )
)

print("MongoDB connected.")
print("Standards loaded:", len(standards))


if not standards:
    raise RuntimeError("No standards found in MongoDB.")


# ============================================================
# TEXT HELPERS
# ============================================================

def clean(value):
    if value is None:
        return ""

    if isinstance(value, list):
        return " ".join(
            str(x) for x in value
            if x is not None
        )

    if isinstance(value, dict):
        parts = []

        for key, val in value.items():
            if val is not None:
                parts.append(f"{key} {val}")

        return " ".join(parts)

    return str(value)


def build_standard_text(standard):
    """
    Build rich text representing a BIS standard.
    """

    fields = [
        ("IS Number", standard.get("is_number")),
        ("Title", standard.get("title")),
        ("Category", standard.get("category")),
        ("Sub Category", standard.get("sub_category")),
        ("Scope", standard.get("scope")),
        ("Applicability", standard.get("applicability")),
        ("Product Keywords", standard.get("product_keywords")),
        ("Key Requirements", standard.get("key_requirements")),
        ("Technical Requirements", standard.get("technical_requirements")),
        ("Test Methods", standard.get("test_methods")),
        ("Normative References", standard.get("normative_references")),
        ("Related Standards", standard.get("related_standards")),
        ("Safety Standards", standard.get("safety_standards")),
        ("Installation Standards", standard.get("installation_standards")),
        ("Certification", standard.get("certification")),
        ("Status", standard.get("status")),
    ]

    parts = []

    for label, value in fields:
        text = clean(value).strip()

        if text:
            parts.append(f"{label}: {text}")

    return "\n".join(parts)


def build_product_text(standard):
    """
    Product-focused representation.

    This intentionally gives more importance to:
    - title
    - category
    - sub-category
    - keywords
    - scope
    - applicability

    rather than procedural metadata.
    """

    fields = [
        ("Title", standard.get("title")),
        ("Category", standard.get("category")),
        ("Sub Category", standard.get("sub_category")),
        ("Product Keywords", standard.get("product_keywords")),
        ("Scope", standard.get("scope")),
        ("Applicability", standard.get("applicability")),
    ]

    parts = []

    for label, value in fields:
        text = clean(value).strip()

        if text:
            parts.append(f"{label}: {text}")

    return "\n".join(parts)


# ============================================================
# PREPARE STANDARD TEXT
# ============================================================

print("\nPreparing BIS standard representations...")

rich_texts = [
    build_standard_text(standard)
    for standard in standards
]

product_texts = [
    build_product_text(standard)
    for standard in standards
]

print("Rich representations:", len(rich_texts))
print("Product representations:", len(product_texts))


# ============================================================
# DEVICE
# ============================================================

device = "cuda" if torch.cuda.is_available() else "cpu"

print("\nDevice:", device)

if device == "cpu":
    print(
        "Note: BGE and E5 may take some time to download/load on CPU."
    )


# ============================================================
# LOAD MODELS
# ============================================================

loaded_models = {}

for model_name, model_path in MODELS.items():

    print("\n" + "-" * 70)
    print(f"Loading {model_name}")
    print(model_path)
    print("-" * 70)

    try:

        model = SentenceTransformer(
            model_path,
            device=device
        )

        loaded_models[model_name] = model

        print(f"{model_name} loaded successfully.")

    except Exception as e:

        print(f"Could not load {model_name}.")
        print("Error:", e)


if not loaded_models:
    raise RuntimeError("No embedding models could be loaded.")


# ============================================================
# ENCODING FUNCTION
# ============================================================

def encode_documents(model_name, model, texts):
    """
    Encode BIS standards.

    E5 requires passage: prefix.
    """

    if model_name == "E5":

        texts = [
            f"passage: {text}"
            for text in texts
        ]

    return model.encode(
        texts,
        convert_to_tensor=True,
        normalize_embeddings=True,
        show_progress_bar=True,
    )


def encode_query(model_name, model, query):
    """
    Encode user query.

    BGE benefits from a retrieval instruction.
    E5 requires query: prefix.
    """

    if model_name == "E5":

        query = f"query: {query}"

    elif model_name == "BGE":

        query = (
            "Represent this sentence for retrieving relevant "
            "BIS Indian Standards: "
            + query
        )

    return model.encode(
        query,
        convert_to_tensor=True,
        normalize_embeddings=True,
    )


# ============================================================
# PRE-COMPUTE EMBEDDINGS
# ============================================================

rich_embeddings = {}
product_embeddings = {}

for model_name, model in loaded_models.items():

    print("\n" + "=" * 70)
    print(f"Encoding BIS data with {model_name}")
    print("=" * 70)

    print("\nRich metadata embeddings...")

    rich_embeddings[model_name] = encode_documents(
        model_name,
        model,
        rich_texts,
    )

    print("\nProduct-focused embeddings...")

    product_embeddings[model_name] = encode_documents(
        model_name,
        model,
        product_texts,
    )


# ============================================================
# DISPLAY RESULT
# ============================================================

def show_results(
    model_name,
    question,
    query_type,
    similarities,
):
    """
    Display top BIS standards.
    """

    top_indices = torch.topk(
        similarities,
        k=min(TOP_K, len(standards)),
    ).indices.tolist()

    print("\n")
    print("=" * 70)
    print(f"{model_name} | {query_type}")
    print("=" * 70)

    print("Question:", question)

    print("\nTop results:")

    for rank, index in enumerate(top_indices, start=1):

        standard = standards[index]

        score = similarities[index].item()

        is_number = standard.get(
            "is_number",
            "N/A"
        )

        title = standard.get(
            "title",
            "N/A"
        )

        sub_category = standard.get(
            "sub_category",
            "N/A"
        )

        status = standard.get(
            "status",
            "N/A"
        )

        print(
            f"\n{rank}. {is_number}"
        )

        print(
            f"   Title       : {title}"
        )

        print(
            f"   Sub-category: {sub_category}"
        )

        print(
            f"   Score       : {score:.4f}"
        )

        print(
            f"   Status      : {status}"
        )


# ============================================================
# RUN TESTS
# ============================================================

for test in TEST_CASES:

    question = test["question"]
    product = test["product"]

    print("\n\n")
    print("#" * 70)
    print("TEST CASE")
    print("#" * 70)

    print("\nQuestion:")
    print(question)

    print("\nExpected product representation:")
    print(product)

    # --------------------------------------------------------
    # FULL QUESTION
    # --------------------------------------------------------

    for model_name, model in loaded_models.items():

        query_embedding = encode_query(
            model_name,
            model,
            question,
        )

        similarities = util.cos_sim(
            query_embedding,
            rich_embeddings[model_name],
        )[0]

        show_results(
            model_name,
            question,
            "FULL QUESTION + RICH BIS DATA",
            similarities,
        )

    # --------------------------------------------------------
    # PRODUCT ONLY
    # --------------------------------------------------------

    for model_name, model in loaded_models.items():

        query_embedding = encode_query(
            model_name,
            model,
            product,
        )

        similarities = util.cos_sim(
            query_embedding,
            product_embeddings[model_name],
        )[0]

        show_results(
            model_name,
            product,
            "PRODUCT ONLY + PRODUCT-FOCUSED BIS DATA",
            similarities,
        )


# ============================================================
# SPECIFIC FAILURE ANALYSIS
# ============================================================

print("\n\n")
print("=" * 70)
print("IMPORTANT TARGET TESTS")
print("=" * 70)

target_products = [
    "packaged wheat flour",
    "packaged drinking water",
    "ready-to-serve fruit drink",
    "carbonated soft drinks",
    "stainless steel water bottles",
    "masonry cement",
]


for target in target_products:

    print("\n")
    print("-" * 70)
    print("TARGET:", target)
    print("-" * 70)

    for model_name, model in loaded_models.items():

        query_embedding = encode_query(
            model_name,
            model,
            target,
        )

        similarities = util.cos_sim(
            query_embedding,
            product_embeddings[model_name],
        )[0]

        top_indices = torch.topk(
            similarities,
            k=min(5, len(standards)),
        ).indices.tolist()

        print(f"\n{model_name}:")

        for rank, index in enumerate(top_indices, start=1):

            standard = standards[index]

            print(
                f"{rank}. "
                f"{standard.get('is_number', 'N/A')} "
                f"| "
                f"{standard.get('title', 'N/A')} "
                f"| "
                f"{similarities[index].item():.4f}"
            )


# ============================================================
# END
# ============================================================

print("\n")
print("=" * 70)
print("EXPERIMENT COMPLETE")
print("=" * 70)

print(
    """
This script did NOT modify MongoDB.

Next, compare these questions carefully:

1. packaged wheat flour
2. packaged drinking water
3. ready-to-serve fruit drink

The most important result is whether BGE/E5 can correctly retrieve
the corresponding BIS standard when given ONLY the product phrase.

If stronger embeddings still fail on cases such as:

    wheat flour -> Atta

then the problem is not simply the embedding model.

That means we should build the Product Understanding layer next.
"""
)

client.close()