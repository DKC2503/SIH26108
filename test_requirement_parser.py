"""
test_requirement_parser.py — validate all 5 test cases.
"""
import sys
sys.stdout.reconfigure(encoding='utf-8')

from backend.ai.gemini_client import parse_requirement, _local_fallback_parse

TEST_CASES = [
    {
        "id": 1,
        "query": "We want to procure Ordinary Portland Cement (OPC) for building construction. Which Indian Standard should we refer to?",
        "expect_product": "cement",
        "expect_type": "ordinary_portland_cement",
    },
    {
        "id": 2,
        "query": "We need cement for building construction.",
        "expect_product": "cement",
        "expect_type": "cement",
    },
    {
        "id": 3,
        "query": "We want to procure masonry cement.",
        "expect_product": "cement",
        "expect_type": "masonry_cement",
    },
    {
        "id": 4,
        "query": "We need stainless steel water bottles for office use.",
        "expect_product": "water bottle",
        "expect_type": "stainless_steel_water_bottle",
    },
    {
        "id": 5,
        "query": "We need packaged drinking water for a government event.",
        "expect_product": "drinking water",
        "expect_type": "packaged_drinking_water",
    },
]

# Test local fallback ONLY first (no Gemini API calls)
print("=" * 65)
print(" LOCAL FALLBACK PARSER — Test Results")
print("=" * 65)

passed = 0
for tc in TEST_CASES:
    result = _local_fallback_parse(tc["query"])
    product     = result.get("product", "")
    ptype       = result.get("product_type", "")
    purpose     = result.get("purpose", "")
    industry    = result.get("industry", "")
    queries     = result.get("bis_search_queries", [])

    ok_product = product.lower() == tc["expect_product"].lower()
    ok_type    = ptype.lower() == tc["expect_type"].lower()
    status     = "[PASS]" if (ok_product and ok_type) else "[FAIL]"
    if ok_product and ok_type:
        passed += 1

    print(f"\nTC{tc['id']}: {status}")
    print(f"  Query   : {tc['query'][:70]}")
    print(f"  Product : {product!r}  (expected: {tc['expect_product']!r})  {'OK' if ok_product else 'WRONG'}")
    print(f"  Type    : {ptype!r}  (expected: {tc['expect_type']!r})  {'OK' if ok_type else 'WRONG'}")
    print(f"  Purpose : {purpose}")
    print(f"  Industry: {industry}")
    print(f"  Queries : {queries}")

print(f"\n{'='*65}")
print(f" RESULT: {passed}/{len(TEST_CASES)} passed")
print(f"{'='*65}")
