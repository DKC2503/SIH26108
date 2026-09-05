# BIS AI — Procurement Standards Recommender

> AI-Powered BIS Standards Recommendation & Verification Assistant (SIH 2026 · PS 26108)

## Features
- **BIS-first architecture**: Live BIS discovery determines current standards; MongoDB is a verified cache.
- **Structured recommendations**: PRIMARY vs ALLIED standards with explicit relationship classifications.
- **Explainable AI**: Every recommendation includes "Why Recommended", "Applicability", "Why Not Primary", and "Procurement Checks".
- **Gemini-optional**: AI enhances but never blocks recommendations. Full fallback to deterministic logic.
- **Layered caching**: BASIC → OFFICIAL → ENRICHED completeness levels with lightweight freshness checks.

## Tech Stack
- **Backend**: FastAPI (Python 3.11+)
- **AI**: Google Gemini (optional reasoning layer)
- **Database**: MongoDB Atlas (verified cache)
- **BIS Scraping**: Playwright (headless Chromium)
- **Frontend**: Single-page HTML/JS

## Quick Start (Local)
```bash
# 1. Clone
git clone <your-repo-url>
cd BIS_AI

# 2. Install dependencies
pip install -r requirements.txt
playwright install chromium

# 3. Set environment variables
cp .env.example .env
# Edit .env with your MONGO_URI and GEMINI_API_KEY

# 4. Run
uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

Open http://localhost:8000

## Environment Variables
| Variable | Required | Description |
|----------|----------|-------------|
| `MONGO_URI` | Yes | MongoDB Atlas connection string |
| `GEMINI_API_KEY` | No | Google Gemini API key (optional, enables AI reasoning) |

## Architecture
```
USER QUERY → Requirement Understanding → LIVE BIS Discovery
  → MongoDB Cache Check → Freshness Verification → Deep Extraction (if needed)
  → Classification → Structured Explanation → PRIMARY + ALLIED Standards
```

## License
MIT
