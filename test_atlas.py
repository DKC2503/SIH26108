import os
import certifi
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv()

uri = os.getenv("MONGO_URI")

print("Testing Atlas connection...")

client = MongoClient(
    uri,
    tls=True,
    tlsCAFile=certifi.where(),
    serverSelectionTimeoutMS=10000
)

try:
    print(client.admin.command("ping"))
    print("SUCCESS: Atlas connection works!")

except Exception as e:
    print("FAILED:")
    print(e)