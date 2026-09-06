#!/usr/bin/env python3
"""
start.py — Start the BIS AI backend server.

Usage:
    python start.py
    or
    .\\venv\\Scripts\\python start.py
"""
import os
import sys
import subprocess
from pathlib import Path

ROOT = Path(__file__).parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

def check_env():
    from dotenv import load_dotenv
    load_dotenv()
    missing = []
    if not os.getenv("MONGO_URI"):
        missing.append("MONGO_URI")
    if not os.getenv("GEMINI_API_KEY"):
        missing.append("GEMINI_API_KEY")
    if missing:
        print(f"\n[WARNING] Missing .env keys: {', '.join(missing)}")
        print("   Please fill in .env before using AI features.\n")

if __name__ == "__main__":
    print("=" * 60)
    print(" BIS AI Procurement Standards Assistant")
    print(" SIH 2026 / PS 26108")
    print("=" * 60)
    check_env()
    print("\n[OK] Starting FastAPI server on http://localhost:8000")
    print("  Frontend:  http://localhost:8000/")
    print("  API Docs:  http://localhost:8000/docs")
    print("  Press Ctrl+C to stop.\n")

    import uvicorn
    uvicorn.run(
        "backend.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info",
    )
