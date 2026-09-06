"""
test_mongo.py — Minimal MongoDB Atlas connectivity & security test script.
Runs ONLY MongoDB diagnostics and outputs safe status flags.
Credentials and full connection URIs are NEVER printed.
"""

import os
import sys
import ssl
import certifi
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

def run_test():
    uri = os.getenv("MONGO_URI")
    uri_configured = bool(uri and uri.strip())
    
    print("============================================================")
    print(" MONGODB ATLAS CONNECTIVITY & DIAGNOSTIC TEST")
    print("============================================================")
    print(f"MongoDB URI configured : {'YES' if uri_configured else 'NO'}")
    
    if not uri_configured:
        print("MongoDB ping           : FAILURE (No URI provided)")
        print("Database accessible    : NO")
        print("Standards collection   : NO")
        return

    # Attempt connection using secure TLS with certifi CA bundle
    ping_success = False
    db_accessible = False
    coll_accessible = False
    doc_count = 0
    error_msg = None

    # Test secure connection configurations (NO insecure flags)
    configs = [
        {"tls": True, "tlsCAFile": certifi.where(), "serverSelectionTimeoutMS": 5000},
        {"tls": True, "serverSelectionTimeoutMS": 5000},
        {"serverSelectionTimeoutMS": 5000},
    ]

    client = None
    for idx, cfg in enumerate(configs, 1):
        try:
            test_client = MongoClient(uri, **cfg)
            res = test_client.admin.command("ping")
            if res.get("ok") == 1:
                client = test_client
                ping_success = True
                break
        except Exception as e:
            error_msg = str(e)
            continue

    if ping_success and client:
        try:
            db = client["BIS_Standards"]
            db_accessible = True
            coll = db["standards"]
            doc_count = coll.count_documents({})
            coll_accessible = True
        except Exception as e:
            error_msg = str(e)

    print(f"MongoDB ping           : {'SUCCESS' if ping_success else 'FAILURE'}")
    print(f"Database accessible    : {'YES' if db_accessible else 'NO'}")
    print(f"Standards collection   : {'YES (' + str(doc_count) + ' documents)' if coll_accessible else 'NO'}")
    
    if not ping_success:
        print(f"\n[Diagnostic Note] Connection probe failed: {error_msg}")
        print("Possible causes: Atlas IP Whitelist restriction (0.0.0.0/0 required for current IP), cluster paused, or ISP/DNS TLS filtering.")

if __name__ == "__main__":
    run_test()
