"""
backend/db_client.py

MongoDB connection — singleton client.
"""

import os
import certifi
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")

if not MONGO_URI:
    print("WARNING: MONGO_URI not found in .env file.")

_client = None


def get_db():
    global _client
    if _client is None:
        if not MONGO_URI:
            raise ValueError("MONGO_URI is missing from .env")
        _client = MongoClient(
            MONGO_URI,
            tls=True,
            tlsCAFile=certifi.where(),
            serverSelectionTimeoutMS=10000,
        )
    return _client["BIS_Standards"]


def get_standards_collection():
    return get_db()["standards"]
