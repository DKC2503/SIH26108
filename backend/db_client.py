"""
backend/db_client.py

MongoDB connection — singleton client with fast failure detection.
"""

import os
import certifi
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")

_client = None
_MONGO_AVAILABLE = None
_MONGO_DISABLE_REASON = ""


class DummyCollection:
    def count_documents(self, *args, **kwargs):
        return 0
    def find(self, *args, **kwargs):
        return []
    def find_one(self, *args, **kwargs):
        return None
    def delete_many(self, *args, **kwargs):
        pass
    def insert_one(self, *args, **kwargs):
        pass
    def update_one(self, *args, **kwargs):
        pass


class DummyDB:
    def __getitem__(self, name):
        return DummyCollection()


def check_mongo_availability() -> bool:
    global _client, _MONGO_AVAILABLE, _MONGO_DISABLE_REASON
    if _MONGO_AVAILABLE is not None:
        return _MONGO_AVAILABLE

    if not MONGO_URI:
        _MONGO_AVAILABLE = False
        _MONGO_DISABLE_REASON = "MONGO_URI missing from .env"
        print(f"[MongoDB] {_MONGO_DISABLE_REASON}")
        return False

    try:
        test_client = MongoClient(MONGO_URI, tlsInsecure=True, serverSelectionTimeoutMS=800)
        test_client.admin.command("ping")
        _client = test_client
        _MONGO_AVAILABLE = True
        print("[MongoDB] Connected successfully to Atlas.")
        return True
    except Exception as e:
        _MONGO_AVAILABLE = False
        _MONGO_DISABLE_REASON = "Atlas connection unreachable (SSL / IP restriction)"
        print(f"[MongoDB] UNAVAILABLE — {_MONGO_DISABLE_REASON}")
        return False


def is_mongo_available() -> bool:
    global _MONGO_AVAILABLE
    if _MONGO_AVAILABLE is None:
        return check_mongo_availability()
    return _MONGO_AVAILABLE


def get_db():
    global _client
    if not is_mongo_available():
        return DummyDB()
    if _client is None:
        check_mongo_availability()
    return _client["BIS_Standards"] if _client else DummyDB()


def get_standards_collection():
    if not is_mongo_available():
        return DummyCollection()
    try:
        return get_db()["standards"]
    except Exception:
        return DummyCollection()



