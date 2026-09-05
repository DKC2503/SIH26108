import sys
import os
import time
import json
from pprint import pprint

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__))))

from backend.services.pipeline import run_analysis
from backend.db_client import get_standards_collection

query = "We want to procure Ordinary Portland Cement (OPC) for building construction. Which Indian Standard should we refer to, and what are the latest applicable amendments, certification requirements, and related/test standards we should consider?"

print("--- CLEARING MONGODB CACHE FOR IS 269 ---")
try:
    coll = get_standards_collection()
    coll.delete_many({"is_number": {"$regex": "269"}})
except Exception as e:
    print(f"Error clearing cache: {e}")

print("\n\n========================================================")
print("RUN 1: Live Discovery & Fetch")
print("========================================================")
t0 = time.time()
result1 = run_analysis(query)
t1 = time.time()

print("\n\n========================================================")
print("RUN 2: Cache Hit")
print("========================================================")
t2 = time.time()
result2 = run_analysis(query)
t3 = time.time()

print("\n\n========================================================")
print("RESULTS SUMMARY")
print("========================================================")
print(f"Run 1 (Live): {t1-t0:.2f}s")
print(f"Run 2 (Cache): {t3-t2:.2f}s")

if result1.get('primary_standards'):
    p = result1['primary_standards'][0]
    print(f"\nPrimary Standard: {p['is_number']}")
    print(f"Title: {p['title']}")
    print(f"Explanation: {p['explanation']}")
    print(f"Scope: {p['scope'][:100] if p['scope'] else 'None'}...")
    print(f"Amendments: {len(p['amendments'])}")
    if p['amendments']:
        print(f"  First: {p['amendments'][0]}")
    print(f"Referred Standards: {len(p['normative_references'])}")
    print(f"Certification: {p['certification']}")
    print(f"Completeness: {p['completeness_level']}")
    print(f"BIS Status: {p['bis_status']}")
else:
    print("\nNo primary standards found in Run 1!")
