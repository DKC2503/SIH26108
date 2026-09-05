
"""
validate_database.py

BIS AI Standards Recommendation System
---------------------------------------

Read-only MongoDB validation tool.

IMPORTANT:
    This script NEVER updates, deletes, or modifies MongoDB documents.

It checks the current database against the new BIS AI data contract
and reports suspicious / incomplete records.
"""

import os
import re
from collections import Counter, defaultdict
from datetime import datetime, timezone

import certifi
from pymongo import MongoClient

from schema import (
    DATABASE_NAME,
    COLLECTION_NAME,
    normalize_is_number,
    validate_document,
)


# ============================================================
# CONFIG
# ============================================================

MONGO_URI = os.getenv("MONGO_URI")

if not MONGO_URI:
    print("MONGO_URI environment variable is not set.")
    print()
    print("Please use the same MongoDB URI/configuration")
    print("that is already working in collect_standards.py.")
    print()
    raise SystemExit(1)


# ============================================================
# HELPERS
# ============================================================

def utc_now_string():
    return datetime.now(timezone.utc).strftime(
        "%Y-%m-%d %H:%M:%S UTC"
    )


def print_header(title):
    print()
    print("=" * 80)
    print(title)
    print("=" * 80)


# ============================================================
# MAIN VALIDATION
# ============================================================

def main():

    print_header("BIS AI DATABASE VALIDATION")

    print(f"Time:       {utc_now_string()}")
    print(f"Database:   {DATABASE_NAME}")
    print(f"Collection: {COLLECTION_NAME}")
    print()

    print("Connecting to MongoDB...")

    client = MongoClient(
        MONGO_URI,
        tls=True,
        tlsCAFile=certifi.where(),
        serverSelectionTimeoutMS=10000,
    )

    # Force connection test.
    client.admin.command("ping")

    db = client[DATABASE_NAME]
    collection = db[COLLECTION_NAME]

    print("MongoDB connection: OK")

    # ========================================================
    # BASIC COUNTS
    # ========================================================

    total_documents = collection.count_documents({})

    print()
    print(f"Total documents: {total_documents}")

    if total_documents == 0:
        print()
        print("No documents found.")
        return

    # ========================================================
    # VALIDATION
    # ========================================================

    severity_counter = Counter()
    field_counter = Counter()

    documents_with_errors = []
    documents_with_warnings = []

    normalized_numbers = defaultdict(list)

    missing_title = 0
    missing_source_url = 0
    invalid_source_url = 0
    status_conflicts = 0
    missing_verification = 0
    missing_eligibility = 0

    for document in collection.find({}):

        doc_id = document.get("_id")
        is_number = document.get("is_number", "")

        normalized = normalize_is_number(is_number)

        if normalized:
            normalized_numbers[normalized].append(doc_id)

        issues = validate_document(document)

        for issue in issues:

            severity = issue.get("severity", "INFO")
            field = issue.get("field", "")

            severity_counter[severity] += 1

            if field:
                field_counter[field] += 1

            if field == "title" and severity == "ERROR":
                missing_title += 1

            if field == "source_url":
                if severity == "ERROR":
                    source_url = document.get("source_url")

                    if not source_url:
                        missing_source_url += 1
                    else:
                        invalid_source_url += 1

            if (
                field == "status"
                and severity == "ERROR"
                and "conflict" in issue.get("message", "").lower()
            ):
                status_conflicts += 1

            if field == "verification_status":
                missing_verification += 1

            if field == "eligible_for_recommendation":
                missing_eligibility += 1

        if any(
            issue.get("severity") == "ERROR"
            for issue in issues
        ):
            documents_with_errors.append(
                {
                    "id": doc_id,
                    "is_number": is_number,
                    "issues": issues,
                }
            )

        if any(
            issue.get("severity") == "WARNING"
            for issue in issues
        ):
            documents_with_warnings.append(
                {
                    "id": doc_id,
                    "is_number": is_number,
                    "issues": issues,
                }
            )

    # ========================================================
    # SUMMARY
    # ========================================================

    print_header("VALIDATION SUMMARY")

    print(
        f"Documents checked:              {total_documents}"
    )

    print(
        f"Documents with ERROR:           "
        f"{len(documents_with_errors)}"
    )

    print(
        f"Documents with WARNING:         "
        f"{len(documents_with_warnings)}"
    )

    print()
    print(
        f"Total ERROR issues:             "
        f"{severity_counter['ERROR']}"
    )

    print(
        f"Total WARNING issues:           "
        f"{severity_counter['WARNING']}"
    )

    print(
        f"Total INFO issues:              "
        f"{severity_counter['INFO']}"
    )

    # ========================================================
    # SPECIFIC PROBLEMS
    # ========================================================

    print_header("KEY DATA QUALITY CHECKS")

    print(
        f"Missing titles:                 {missing_title}"
    )

    print(
        f"Missing source URLs:            {missing_source_url}"
    )

    print(
        f"Invalid BIS source URLs:       {invalid_source_url}"
    )

    print(
        f"Potential title/status conflicts: "
        f"{status_conflicts}"
    )

    print(
        f"Missing verification status:    "
        f"{missing_verification}"
    )

    print(
        f"Missing recommendation flag:    "
        f"{missing_eligibility}"
    )

    # ========================================================
    # DUPLICATE IS NUMBERS
    # ========================================================

    duplicates = {
        number: ids
        for number, ids in normalized_numbers.items()
        if len(ids) > 1
    }

    print_header("DUPLICATE IS NUMBER CHECK")

    if not duplicates:
        print("No duplicate normalized IS numbers found.")
    else:
        print(
            f"Duplicate normalized IS numbers: "
            f"{len(duplicates)}"
        )

        for number, ids in sorted(duplicates.items()):
            print()
            print(f"  {number}")
            print(f"    MongoDB documents: {len(ids)}")

            for doc_id in ids:
                print(f"      _id: {doc_id}")

    # ========================================================
    # MOST COMMON ISSUE FIELDS
    # ========================================================

    print_header("MOST COMMON ISSUE FIELDS")

    if not field_counter:
        print("No validation issues found.")
    else:
        for field, count in field_counter.most_common():
            print(
                f"{field:<35} {count}"
            )

    # ========================================================
    # ERROR DETAILS
    # ========================================================

    print_header("ERROR DETAILS")

    if not documents_with_errors:
        print("No ERROR-level records found.")
    else:

        for item in documents_with_errors:

            print()
            print(
                f"IS:  {item['is_number']}"
            )

            print(
                f"_id: {item['id']}"
            )

            for issue in item["issues"]:

                if issue.get("severity") != "ERROR":
                    continue

                print(
                    f"  [{issue['severity']}] "
                    f"{issue['field']}: "
                    f"{issue['message']}"
                )

    # ========================================================
    # WARNING DETAILS
    # ========================================================

    print_header("WARNING DETAILS")

    if not documents_with_warnings:
        print("No WARNING-level records found.")
    else:

        # Avoid producing thousands of lines.
        MAX_WARNING_DOCUMENTS = 50

        shown = 0

        for item in documents_with_warnings:

            if shown >= MAX_WARNING_DOCUMENTS:
                break

            print()
            print(
                f"IS:  {item['is_number']}"
            )

            print(
                f"_id: {item['id']}"
            )

            for issue in item["issues"]:

                if issue.get("severity") != "WARNING":
                    continue

                print(
                    f"  [{issue['severity']}] "
                    f"{issue['field']}: "
                    f"{issue['message']}"
                )

            shown += 1

        if len(documents_with_warnings) > MAX_WARNING_DOCUMENTS:
            print()
            print(
                f"... {len(documents_with_warnings) - MAX_WARNING_DOCUMENTS} "
                f"more warning records not displayed."
            )

    # ========================================================
    # FINAL RESULT
    # ========================================================

    print_header("RESULT")

    if documents_with_errors:
        print(
            "STATUS: ATTENTION REQUIRED"
        )
        print(
            "The database contains records that require "
            "verification or cleanup before they can be "
            "considered fully trusted."
        )
    else:
        print(
            "STATUS: NO CRITICAL STRUCTURAL ERRORS FOUND"
        )
        print(
            "The existing database can proceed to the next "
            "foundation stage."
        )

    print()
    print(
        "IMPORTANT: This validation was READ-ONLY."
    )
    print(
        "No MongoDB documents were inserted, updated, "
        "or deleted."
    )

    client.close()


if __name__ == "__main__":
    main()