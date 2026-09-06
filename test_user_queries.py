import sys
import os
import time
import json

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__))))

from backend.services.pipeline import run_analysis
from backend.services.retrieval import _get_embedding_model

print("[Init] Pre-warming embedding model...")
_get_embedding_model()
print("[Init] Embedding model ready.")

test_queries = [
    "ball point pen for office use",
    "Procurement of 500 LED street lights, 90W each, for outdoor road lighting. IP66 ingress protection, minimum 120 lm/W luminous efficacy, 230V AC 50Hz supply, surge protection and corrosion-resistant housing."
]

for idx, q in enumerate(test_queries, 1):
    print(f"\n========================================================")
    print(f"TEST {idx}: '{q}'")
    print(f"========================================================")
    t0 = time.time()
    res = run_analysis(q)
    t_tot = time.time() - t0
    
    print(f"\n[SUMMARY] Total Time: {t_tot:.3f}s")
    print(f"[SUMMARY] Product Extracted: '{res['requirement'].get('product')}'")
    print(f"[SUMMARY] Primary Standards: {len(res.get('primary_standards', []))}")
    for p in res.get('primary_standards', [])[:3]:
        print(f"   - {p.get('is_number')}: {p.get('title')}")
    
    allied_count = sum(len(v) for v in res.get('allied_standards', {}).values())
    print(f"[SUMMARY] Allied Standards: {allied_count}")
    print(f"[SUMMARY] Stages:")
    for st in res.get('stages', []):
        print(f"   {st['status'].upper():<10} | {st['name']:<30} | {st['detail']} ({st.get('timing_ms')}ms)")

