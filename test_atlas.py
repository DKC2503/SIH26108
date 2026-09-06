import os
import certifi
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv()

uri = os.getenv("MONGO_URI")

print("Testing Atlas connection...")

client = MongoClient(
    uri,
    tlsInsecure=True,
    serverSelectionTimeoutMS=5000
)

try:
    print(client.admin.command("ping"))
    print("SUCCESS: Atlas connection works with tlsInsecure!")

except Exception as e:
    print("FAILED:")
    print(e)